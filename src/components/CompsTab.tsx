import Link from 'next/link';
import { ActionButton } from './ActionButton';
import { WorkButton } from './WorkButton';
import { ActionForm } from './ActionForm';
import { Empty, Notice, Section, Tile } from './ui';
import { formatDate, formatMoney } from '@/lib/format';
import { SearchPicker, type PickOption } from './SearchPicker';
import { HELD_UP_PCT, isWatched, offBy, adjusted, adjustmentsText, compSources, compStatuses, compSourceLabel, compStatusLabel, finishLabel, finishLevels, isPublicSource, perSf, summarize } from '@/lib/comps';
import type { CompRecord, Suggestion } from '@/lib/comp-data';
import { addPublicComp, removeComp, saveComp, setCompFlag, setFinishLevel, useCompValue } from '@/app/(app)/comp-actions';

type Subject = { id: string; heatedSf: number | null; finishLevel: string | null; marketValue: string | null; marketValueOn: string | null; marketValueSource: string | null };
type Doc = { id: string; name: string; caption: string | null; likely: boolean };

const psf = (v: number | null) => (v == null ? '—' : `$${Math.round(v).toLocaleString('en-US')}`);
const money = (v: number | null) => (v == null ? '—' : formatMoney(v));

/** The project's Comps tab: what the comps say, each comp with its source and finish level, and where to get more. */
type Reliability = { provider: string; given: number; compared: number; heldUp: number; averageOff: number | null; verdict: string };

export function CompsTab({ p, rows, docs, suggestions, providers, reliable, canEdit }: { p: Subject; rows: CompRecord[]; docs: Doc[]; suggestions: Suggestion[]; providers: PickOption[]; reliable: Reliability[]; canEdit: boolean }) {
  const s = summarize(rows, { heatedSf: p.heatedSf, finishLevel: p.finishLevel });
  const best = s.sameFinishValue ?? s.value;
  return (
    <div className="stack">
      <Section title="What the Comps Say" kind="blue" hint={`${s.total} looked at`}>
        <div className="tiles">
          <Tile k="Comps Looked At" v={s.total} s={`${s.publicCount} public · ${s.privateCount} private`} />
          <Tile k="Counted in the Value" v={s.counted} s={s.toCheck ? `${s.toCheck} still to check` : 'Sold, checked and counted'} />
          <Tile k="Median $ / Heated SF" v={psf(s.medianPerSf)} s={s.perSfRange ? `${psf(s.perSfRange[0])} to ${psf(s.perSfRange[1])}` : 'After adjustments'} />
          <Tile k={p.heatedSf ? `Value at ${p.heatedSf.toLocaleString()} SF` : 'Value'} v={money(s.value)}
            s={s.valueRange ? `${money(s.valueRange[0])} to ${money(s.valueRange[1])}` : p.heatedSf ? 'Needs comps with prices and square feet' : 'Enter the heated SF on the project'} />
          {p.finishLevel ? <Tile k={`At Our Finish (${finishLabel(p.finishLevel)})`} v={money(s.sameFinishValue)} s={s.sameFinishValue ? 'Only comps at the same finish level' : 'No counted comps at our finish level yet'} /> : null}
        </div>
        <div className="comp-bar">
          {canEdit ? (
            <ActionForm action={setFinishLevel} submit="Save" submitClass="btn small secondary" className="inline-form">
              <input type="hidden" name="projectId" value={p.id} />
              <label htmlFor="our-finish">Our finish level</label>
              <select id="our-finish" name="finishLevel" defaultValue={p.finishLevel ?? ''}>
                <option value="">Not set</option>
                {finishLevels.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </ActionForm>
          ) : <span>Our finish level: <strong>{finishLabel(p.finishLevel)}</strong></span>}
          <span className="small muted">Market value on the project: {p.marketValue ? <strong>{formatMoney(p.marketValue)}</strong> : 'not set'}{p.marketValueSource ? ` (${p.marketValueSource}${p.marketValueOn ? `, ${formatDate(p.marketValueOn)}` : ''})` : ''}</span>
          {canEdit && best ? <ActionButton action={useCompValue.bind(null, p.id)} label={`Use ${formatMoney(best)} as Market Value`} done="Market value saved." className="btn small" dataK="use-comp-value" /> : null}
        </div>
        {s.total ? (
          <div className="grid-2">
            <div className="table-wrap"><table className="t small">
              <thead><tr><th>Source</th><th className="num">Looked At</th><th className="num">Counted</th></tr></thead>
              <tbody>{s.bySource.map((b) => <tr key={b.key}><td>{b.label} <span className="muted">({isPublicSource(b.key) ? 'public' : 'private'})</span></td><td className="num">{b.count}</td><td className="num">{b.counted}</td></tr>)}</tbody>
            </table></div>
            <div className="table-wrap"><table className="t small">
              <thead><tr><th>Finish Level</th><th className="num">Comps</th><th className="num">Median $ / SF</th></tr></thead>
              <tbody>{s.byFinish.map((f) => <tr key={f.key || 'none'} className={f.sameAsOurs ? 'comp-ours' : undefined}><td>{f.label}{f.sameAsOurs ? ' (ours)' : ''}</td><td className="num">{f.count}</td><td className="num">{psf(f.medianPerSf)}</td></tr>)}</tbody>
            </table></div>
          </div>
        ) : null}
        <p className="small muted">The value uses comps that sold, are pending or presold, that are counted and checked, priced after adjustments. The range is the middle half of them (lowest to highest with fewer than four). For deciding, not an appraisal.</p>
      </Section>

      {s.toCheck ? <Notice kind="warn">{s.toCheck} {s.toCheck === 1 ? 'comp' : 'comps'} read by Claude still to check: open each one, correct anything it got wrong, and press Looks Right. They aren’t in the value until then.</Notice> : null}

      <Section title="Comps" kind="aqua" hint={`${rows.length}`}>
        {rows.length ? (
          <div className="table-wrap"><table className="t comps">
            <thead><tr><th>Address</th><th>Source</th><th>Sold</th><th className="num">Price</th><th className="num">SF</th><th className="num">Adjusted</th><th className="num">$ / SF</th><th>Finish</th><th>Beds / Baths · Built</th><th className="num">Miles</th><th>Counted</th></tr></thead>
            <tbody>{rows.map((c) => {
              const adj = adjusted(c);
              return (
                <tr key={c.id} className={c.checked ? (c.counted ? undefined : 'comp-off') : 'comp-check'} data-comp={c.address}>
                  <td>
                    <strong>{c.address}</strong>{c.neighborhood || c.city ? <div className="small muted">{[c.neighborhood, c.city].filter(Boolean).join(', ')}</div> : null}
                    {!c.checked ? <div className="small"><span className="chip sev-medium">To Check</span></div> : null}
                    {c.notes ? <div className="small muted">{c.notes}</div> : null}
                    {c.fileId ? <div className="small"><Link href={`/documents/${c.fileId}`}>{c.fileName ?? 'Document'}</Link></div> : null}
                    {canEdit ? (
                      <details className="comp-edit">
                        <summary>Edit</summary>
                        <CompForm projectId={p.id} c={c} docs={docs} providers={providers} />
                        <div className="form-actions">
                          {!c.checked ? <ActionButton action={setCompFlag.bind(null, c.id, 'checked', true)} label="Looks Right" done="Marked checked." dataK="comp-checked" /> : null}
                          <ActionButton action={removeComp.bind(null, c.id)} label="Take Off" done="Comp taken off." className="btn small secondary" confirm={`Take ${c.address} off the comps?`} dataK="comp-remove" />
                        </div>
                      </details>
                    ) : null}
                  </td>
                  <td>
                    <span className={`chip ${isPublicSource(c.source) ? "blue" : "aqua"}`}>{compSourceLabel(c.source)}</span>
                    {c.status !== 'sold' ? <div className="small muted">{compStatusLabel(c.status)}</div> : null}
                    {isWatched(c) ? <div className="small"><span className="chip sev-medium" title="The twice-daily update looks for it in the county sales">Watching for the Close{c.expectedCloseOn ? `: ${formatDate(c.expectedCloseOn)}` : ''}</span></div> : null}
                    {c.actualPrice != null ? <div className="small">Closed {money(c.actualPrice)}{c.actualSoldOn ? ` on ${formatDate(c.actualSoldOn)}` : ''}{(() => { const o = offBy(c.price, c.actualPrice); return o == null ? null : <> ({o > 0 ? '+' : ''}{o}% vs. what we were told)</>; })()}</div> : null}
                    {c.provider ? <div className="small muted">From {c.provider}</div> : null}
                    {c.builderName ? <div className="small muted">Built by {c.builderName}{c.customBuild ? ' (custom build)' : ''}</div> : c.customBuild ? <div className="small muted">Custom build</div> : null}
                  </td>
                  <td>{c.soldOn ? formatDate(c.soldOn) : '—'}</td>
                  <td className="num">{money(c.price)}</td>
                  <td className="num">{c.heatedSf ? c.heatedSf.toLocaleString() : '—'}</td>
                  <td className="num">{adj != null && adj !== c.price ? money(adj) : '—'}{c.adjustments.length ? <div className="small muted" title={adjustmentsText(c.adjustments)}>{c.adjustments.length} adjustments</div> : null}</td>
                  <td className="num">{psf(perSf(adj, c.heatedSf))}</td>
                  <td>{c.finishLevel ? <span className={c.finishLevel === p.finishLevel ? 'chip energy' : 'chip'}>{finishLabel(c.finishLevel)}</span> : <span className="muted">Not known</span>}{c.quality ? <div className="small muted">{c.quality}</div> : null}</td>
                  <td>{[c.beds ? `${c.beds} bd` : null, c.baths ? `${c.baths} ba` : null].filter(Boolean).join(' / ') || '—'}{c.yearBuilt ? ` · ${c.yearBuilt}` : ''}</td>
                  <td className="num">{c.distanceMi ?? '—'}</td>
                  <td>{canEdit ? <ActionButton action={setCompFlag.bind(null, c.id, 'counted', !c.counted)} label={c.counted ? 'Counted' : 'Not Counted'} done="Saved." className={`btn small ${c.counted ? '' : 'secondary'}`} dataK="comp-count" /> : c.counted ? 'Yes' : 'No'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <Empty>No comps yet. Add the county sales offered below, have Claude read an appraisal or CMA, or type one in.</Empty>}
        {canEdit ? (
          <details className="comp-add">
            <summary className="btn small">Add a Comp</summary>
            <CompForm projectId={p.id} docs={docs} providers={providers} />
          </details>
        ) : null}
      </Section>

      <Section title="Whose Numbers Hold Up" kind="grey" hint={reliable.length ? `${reliable.length}` : undefined}>
        {reliable.length ? (
          <div className="table-wrap"><table className="t small">
            <thead><tr><th>From</th><th className="num">Comps Given</th><th className="num">Checked Against the Sale</th><th className="num">Average Off</th><th>So Far</th></tr></thead>
            <tbody>{reliable.map((r) => <tr key={r.provider}><td>{r.provider}</td><td className="num">{r.given}</td><td className="num">{r.compared}</td><td className="num">{r.averageOff == null ? '—' : `${r.averageOff}%`}</td><td>{r.verdict}</td></tr>)}</tbody>
          </table></div>
        ) : <Empty>No comps with who gave them to us yet.</Empty>}
        <p className="small muted">Across every project. When a presale or pending sale someone told us about closes, the county price is checked against what they said: within {HELD_UP_PCT}% held up.</p>
      </Section>

      <Section title="Read From an Appraisal or CMA" kind="energy" hint={docs.length ? `${docs.length} documents` : undefined}>
        <p className="small muted" style={{ margin: 0 }}>Claude reads the comparable sales grid (addresses, prices, square feet, adjustments, quality ratings) from a document on this project. About 10 to 20 cents a document. Add the document first under <Link href={`/projects/${p.id}?tab=documents`}>Documents</Link>.</p>
        {docs.length ? (
          <ul className="rows">{docs.slice(0, 12).map((d) => (
            <li key={d.id} className="sync-row">
              <span><Link href={`/documents/${d.id}`}>{d.caption ?? d.name}</Link>{d.likely ? <> <span className="chip sev-medium">Looks like comps</span></> : null}<div className="small muted">{d.name}</div></span>
              {canEdit ? <WorkButton job="readCompsFromDocument" args={[p.id, d.id]} label="Read Comps" busyLabel="Reading…" done="Read." className="btn small secondary" dataK="read-comps" /> : null}
            </li>
          ))}</ul>
        ) : <Empty>No PDFs or photos on this project yet.</Empty>}
      </Section>

      <Section title="Suggested From Public Records" kind="grey" hint={suggestions.length ? `${suggestions.length}` : undefined}>
        {suggestions.length ? (
          <div className="table-wrap"><table className="t small">
            <thead><tr><th>Address</th><th>Sold</th><th className="num">Price</th><th className="num">SF</th><th className="num">$ / SF</th><th className="num">Built</th><th className="num">Miles</th><th /></tr></thead>
            <tbody>{suggestions.map((x) => (
              <tr key={x.saleId} data-suggest={x.address}>
                <td>{x.address}{x.neighborhood ? <div className="muted">{x.neighborhood}</div> : null}</td>
                <td>{formatDate(x.soldOn)}</td><td className="num">{formatMoney(x.price)}</td><td className="num">{x.heatedSf?.toLocaleString() ?? '—'}</td>
                <td className="num">{psf(perSf(x.price, x.heatedSf))}</td><td className="num">{x.yearBuilt ?? '—'}</td><td className="num">{x.miles}</td>
                <td>{canEdit ? <ActionButton action={addPublicComp.bind(null, p.id, x.saleId)} label="Add" done="Comp added." className="btn small secondary" dataK="add-public-comp" /> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>No county sales of houses within a mile in the last 18 months{p.heatedSf ? ' near our size' : ''}, or the project isn’t on the map yet.</Empty>}
        <p className="small muted">Houses sold within a mile in the last 18 months, {p.heatedSf ? 'sized 60% to 160% of ours, ' : ''}closest, newest and nearest our size first. County records don’t say the finish level: set it when you add one.</p>
      </Section>
    </div>
  );
}

function CompForm({ projectId, c, docs, providers }: { projectId: string; c?: CompRecord; docs: Doc[]; providers: PickOption[] }) {
  const k = c?.id ?? 'new';
  const f = (name: string) => `comp-${k}-${name}`;
  return (
    <ActionForm action={saveComp} submit={c ? 'Save Comp' : 'Add Comp'} resetOnOk={!c}>
      <input type="hidden" name="projectId" value={projectId} />
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="fields">
        <label htmlFor={f('address')}>Address<input id={f('address')} name="address" required defaultValue={c?.address} /></label>
        <label htmlFor={f('city')}>City<input id={f('city')} name="city" defaultValue={c?.city ?? ''} /></label>
        <label htmlFor={f('neighborhood')}>Neighborhood<input id={f('neighborhood')} name="neighborhood" defaultValue={c?.neighborhood ?? ''} /></label>
        <label htmlFor={f('source')}>Source<select id={f('source')} name="source" defaultValue={c?.source ?? 'appraisal'}>{compSources.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
        <label htmlFor={f('status')}>Status<select id={f('status')} name="status" defaultValue={c?.status ?? 'sold'}>{compStatuses.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
        <label htmlFor={f('soldOn')}>Sold or Contract Date<input id={f('soldOn')} name="soldOn" type="date" defaultValue={c?.soldOn ?? ''} /></label>
        <label htmlFor={f('price')}>Price<input id={f('price')} name="price" inputMode="decimal" defaultValue={c?.price ?? ''} /></label>
        <label htmlFor={f('heatedSf')}>Heated SF<input id={f('heatedSf')} name="heatedSf" inputMode="numeric" defaultValue={c?.heatedSf ?? ''} /></label>
        <label htmlFor={f('finishLevel')}>Finish Level<select id={f('finishLevel')} name="finishLevel" defaultValue={c?.finishLevel ?? ''}><option value="">Not known</option>{finishLevels.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select></label>
        <label htmlFor={f('quality')}>Appraisal Rating<input id={f('quality')} name="quality" placeholder="Q3;C1" defaultValue={c?.quality ?? ''} /></label>
        <label htmlFor={f('beds')}>Beds<input id={f('beds')} name="beds" inputMode="decimal" defaultValue={c?.beds ?? ''} /></label>
        <label htmlFor={f('baths')}>Baths<input id={f('baths')} name="baths" inputMode="decimal" defaultValue={c?.baths ?? ''} /></label>
        <label htmlFor={f('yearBuilt')}>Year Built<input id={f('yearBuilt')} name="yearBuilt" inputMode="numeric" defaultValue={c?.yearBuilt ?? ''} /></label>
        <label htmlFor={f('lotAcres')}>Lot Acres<input id={f('lotAcres')} name="lotAcres" inputMode="decimal" defaultValue={c?.lotAcres ?? ''} /></label>
        <label htmlFor={f('distanceMi')}>Miles Away<input id={f('distanceMi')} name="distanceMi" inputMode="decimal" defaultValue={c?.distanceMi ?? ''} /></label>
        <label htmlFor={f('adjustedPrice')}>Adjusted Price<input id={f('adjustedPrice')} name="adjustedPrice" inputMode="decimal" defaultValue={c?.adjustedPrice ?? ''} /></label>
        <label htmlFor={f('expectedCloseOn')}>Expected Closing <span className="small muted">(presale or pending)</span><input id={f('expectedCloseOn')} name="expectedCloseOn" type="date" defaultValue={c?.expectedCloseOn ?? ''} /></label>
        <label htmlFor={f('builderName')}>Builder<input id={f('builderName')} name="builderName" defaultValue={c?.builderName ?? ''} /></label>
        <label htmlFor={f('fileId')}>Document<select id={f('fileId')} name="fileId" defaultValue={c?.fileId ?? ''}><option value="">None</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.caption ?? d.name}</option>)}</select></label>
      </div>
      <SearchPicker name="provider" label="Who Gave It to Us" hint="Optional: so we learn whose numbers hold up" placeholder="Type the person or company" options={providers}
        defaultId={c?.providedByPersonId ? `p:${c.providedByPersonId}` : c?.providedByCompanyId ? `c:${c.providedByCompanyId}` : null} />
      <label className="check"><input type="checkbox" name="customBuild" defaultChecked={c?.customBuild ?? false} /> A custom build for an owner on their own lot (not a market sale; left out of the value unless counted)</label>
      <label htmlFor={f('adjustments')}>Adjustments <span className="small muted">(one per line or separated by ;, e.g. “Size: -12,000; Garage: +5,000”)</span>
        <textarea id={f('adjustments')} name="adjustments" rows={2} defaultValue={c ? adjustmentsText(c.adjustments) : ''} /></label>
      <label htmlFor={f('notes')}>Notes<textarea id={f('notes')} name="notes" rows={2} defaultValue={c?.notes ?? ''} /></label>
    </ActionForm>
  );
}
