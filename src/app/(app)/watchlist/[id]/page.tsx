import { Choice } from '@/components/Choice';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { activeStaff, historyFor, tasksForRecord } from '@/lib/contacts';
import { Suspense } from 'react';
import { getProperty } from '@/lib/watch';
import { zoneFor } from '@/lib/buy-box-data';
import { verdictLabel } from '@/lib/buy-box';
import { filesFor } from '@/lib/files';
import { isUuid } from '@/lib/forms';
import { formatDate, formatMoney, today } from '@/lib/format';
import { pickableStages, pricePerLotSf, propertyStageLabel } from '@/lib/properties';
import { Facts, PageHead, Section, Tabs, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { HistoryList, TaskForm, TaskRows } from '@/components/contacts';
import { addPropertyPhoto, convertToProject, markSold, setPropertyStage } from '../../watch-actions';

export default async function PropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePage('properties.view');
  const { id } = await params;
  const { tab = 'overview' } = await searchParams;
  const data = isUuid(id) ? await getProperty(id) : null;
  if (!data || data.property.archived) notFound();
  const { property: p, source, project } = data;
  const edit = can(user, 'properties.edit');
  const base = `/watchlist/${id}`;
  const photos = await filesFor('property', id);
  const ppsf = pricePerLotSf(p.stage === 'sold' ? p.soldPrice : p.askingPrice, p.lotSf);

  return (
    <>
      <PageHead eyebrow="Watchlist" title={p.address} sub={<><span className="chip blue">{propertyStageLabel(p.stage)}</span> {[p.neighborhood, p.city, p.state, p.zip].filter(Boolean).join(', ')}</>}
        actions={edit ? <Link className="btn secondary" href={`${base}/edit`}>Edit</Link> : null} />
      {project ? <div className="notice">This is now a project: <Link href={`/projects/${project.id}`}>{project.name}</Link>.</div> : null}
      <div className="record">
        <div className="card-side">
          <Section title="The Lot" kind="aqua">
            <Facts items={[
              ['Asking', formatMoney(p.askingPrice)],
              ['Lot', p.lotSf ? `${p.lotSf.toLocaleString()} sf${p.lotAcres ? ` (${Number(p.lotAcres)} ac)` : ''}` : null],
              ['$ per Lot SF', ppsf ? `$${ppsf.toFixed(2)}` : null],
              ['Zoning', p.zoning],
              ['Buy Box', p.metBuyBox === null ? 'Not decided' : p.metBuyBox ? 'Meets it' : 'Doesn’t meet it'],
              ['Sent By', source ? <Link href={`/people/${source.id}`}>{source.firstName} {source.lastName}</Link> : 'We found it'],
              ['Referral Fee', p.referralFee ? formatMoney(p.referralFee) : null],
            ]} />
          </Section>
          {p.ourOffer || p.stage === 'lost' ? (
            <Section title="Our Bid" kind="blue">
              <Facts items={[['Our Offer', formatMoney(p.ourOffer)], ['Offered On', p.offerOn ? formatDate(p.offerOn) : null], ['Won At', p.winningPrice ? formatMoney(p.winningPrice) : null], ['Bought By', p.winningBuyer]]} />
            </Section>
          ) : null}
          {p.stage === 'sold' ? (
            <Section title="Sold (Comparable)" kind="grey">
              <Facts items={[['Sold For', formatMoney(p.soldPrice)], ['Sold On', formatDate(p.soldOn)], ['Buyer', p.soldBuyer]]} />
            </Section>
          ) : null}
        </div>
        <div>
          <Tabs base={base} current={tab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'photos', label: 'Photos', count: photos.length }, { key: 'tasks', label: 'Tasks' }, { key: 'history', label: 'History' }]} />
          {tab === 'overview' ? (
            <div className="stack">
              <Suspense fallback={<Section title="Buy Box Check" kind="aqua"><p className="small muted" style={{ margin: 0 }}>Working it out from the market…</p></Section>}>
                <BuyBoxCheck p={{ neighborhood: p.neighborhood, address: p.address, city: p.city, askingPrice: p.askingPrice }} />
              </Suspense>
              {p.notes ? <Section title="Notes" kind="energy"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.notes}</p></Section> : null}
              {edit && p.stage !== 'sold' && !project ? (
                <Section title="Where It Stands" kind="blue" hint="Offer Made and Lost keep our offer; Lost keeps who won and at what price">
                  <ActionForm action={setPropertyStage} submit="Save">
                    <input type="hidden" name="id" value={id} />
                    <div className="fields">
                      <Choice name="stage" label="Stage" options={pickableStages.map((s) => ({ key: s, label: propertyStageLabel(s) }))} defaultValue={pickableStages.includes(p.stage) ? p.stage : 'watching'} />
                      <label className="f">Our Offer<input name="ourOffer" defaultValue={p.ourOffer ?? ''} inputMode="decimal" /></label>
                      <label className="f">Offered On<input type="date" name="offerOn" defaultValue={p.offerOn ?? ''} /></label>
                      <label className="f">Winning Price<span className="h">If we lost it</span><input name="winningPrice" defaultValue={p.winningPrice ?? ''} inputMode="decimal" /></label>
                      <label className="f">Winning Buyer<input name="winningBuyer" defaultValue={p.winningBuyer ?? ''} /></label>
                    </div>
                  </ActionForm>
                </Section>
              ) : null}
              {edit && !project && p.stage !== 'sold' && can(user, 'projects.edit') ? (
                <Section title="Under Contract?" kind="aqua">
                  <ActionForm action={convertToProject} submit="Make It a Project" confirm="Put this under contract and make it a project?">
                    <input type="hidden" name="id" value={id} />
                    <label className="f">Contract Price<span className="h">The lot cost; leave blank to use our offer or the asking price</span><input name="lotCost" inputMode="decimal" /></label>
                  </ActionForm>
                </Section>
              ) : null}
              {edit && p.stage !== 'sold' && !project ? (
                <Section title="Sold to Someone Else?" kind="grey" hint="It leaves the watchlist but stays searchable as a comparable">
                  <ActionForm action={markSold} submit="Mark Sold">
                    <input type="hidden" name="id" value={id} />
                    <div className="fields">
                      <label className="f">Sold For<input name="soldPrice" required inputMode="decimal" /></label>
                      <label className="f">Sold On<input type="date" name="soldOn" required max={today()} /></label>
                      <label className="f">Buyer<input name="soldBuyer" /></label>
                    </div>
                  </ActionForm>
                </Section>
              ) : null}
            </div>
          ) : null}
          {tab === 'photos' ? (
            <div className="stack">
              <Section title="Photos" kind="aqua">
                {photos.length ? (
                  <div className="photos">{photos.map((f) => (
                    <figure key={f.id}>
                      {f.contentType.startsWith('image/') ? <a href={`/documents/${f.id}`}><img src={`/files/${f.id}`} alt={f.caption ?? f.name} loading="lazy" /></a> : <a href={`/documents/${f.id}`}>{f.name}</a>}
                      <figcaption>{f.caption ?? f.name}</figcaption>
                    </figure>
                  ))}</div>
                ) : <Empty>No photos yet.</Empty>}
              </Section>
              {edit ? (
                <Section title="Add a Photo" kind="aqua">
                  <ActionForm action={addPropertyPhoto} submit="Upload" resetOnOk>
                    <input type="hidden" name="id" value={id} />
                    <div className="fields">
                      <label className="f">Photo<input type="file" name="file" accept="image/*" capture="environment" required /></label>
                      <label className="f">Caption<input name="caption" /></label>
                    </div>
                  </ActionForm>
                </Section>
              ) : null}
            </div>
          ) : null}
          {tab === 'tasks' ? (
            <div className="stack">
              <Section title="Tasks" kind="energy"><TaskRows items={await tasksForRecord('propertyId', id)} /></Section>
              {edit ? <Section title="Add a Task" kind="energy"><TaskForm propertyId={id} staff={await activeStaff()} me={user.id} /></Section> : null}
            </div>
          ) : null}
          {tab === 'history' ? <Section title="History" kind="grey"><HistoryList rows={await historyFor('property', id)} /></Section> : null}
        </div>
      </div>
    </>
  );
}

/** How this property's zone looks against the buy box (streams in: the market numbers take a moment). */
async function BuyBoxCheck({ p }: { p: { neighborhood: string | null; address: string; city: string | null; askingPrice: string | null } }) {
                const z = await zoneFor({ neighborhood: p.neighborhood, address: p.address, city: p.city });
                const zone = z.street && z.street.verdict !== 'thin' ? z.street : z.hood ?? z.street;
                const asking = p.askingPrice ? Number(p.askingPrice) : null;
                return (
                  <Section title="Buy Box Check" kind="aqua" hint={zone ? `From ${zone === z.street ? 'sales on its street' : `sales in ${zone.name}`}` : 'From what’s selling near it'}>
                    {zone && zone.money ? (
                      <>
                        <p className="trend-sentence" style={{ marginBottom: 6 }}><span className={`chip verdict-${zone.verdict}`}>{verdictLabel[zone.verdict]}</span>{' '}
                          A new {z.settings.houseSf.toLocaleString()} sf house here would sell for about <strong>{formatMoney(String(zone.money.value))}</strong>; we can pay up to <strong>{formatMoney(String(zone.money.maxLot))}</strong> for the lot.</p>
                        {asking ? <p style={{ margin: '0 0 6px' }} className={asking <= zone.money.maxLot ? 'green' : 'red'}>The asking price of {formatMoney(String(asking))} is {asking <= zone.money.maxLot ? `${formatMoney(String(zone.money.maxLot - asking))} under` : `${formatMoney(String(asking - zone.money.maxLot))} over`} what we can pay.</p> : null}
                        <p className="small muted" style={{ margin: 0 }}>{zone.reasons.join('; ')}. <Link href="/market/buy-box">See the Buy Box</Link></p>
                      </>
                    ) : <p className="small muted" style={{ margin: 0 }}>Not enough sales on its street or in its neighborhood yet{p.neighborhood ? '' : ' (add its neighborhood on Edit)'}. <Link href="/market/buy-box">See the Buy Box</Link></p>}
                  </Section>
                );
}
