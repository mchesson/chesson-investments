import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/session';
import { historyFor, peopleOptions } from '@/lib/contacts';
import { entityDocTypes, entityKindLabel, entityOptions, getEntity, memberRoleLabel, memberRoles } from '@/lib/entities';
import { taxIdKindLabel, taxIdKinds } from '@/lib/secret-box';
import { projectStageLabel } from '@/lib/project-stages';
import { isUuid } from '@/lib/forms';
import { formatDate, formatMoney } from '@/lib/format';
import { fileSize } from '@/lib/file-view';
import { ActionForm } from '@/components/ActionForm';
import { HistoryList } from '@/components/contacts';
import { TaxIdReveal } from '@/components/TaxIdReveal';
import { Empty, Facts, PageHead, Section, Tabs } from '@/components/ui';
import { addEntityDoc, addTaxId, removeMember, removeTaxId, saveMember } from '../../entity-actions';

export const metadata = { title: 'Business Entity' };

export default async function EntityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requirePage('sensitive.view');
  const { id } = await params;
  const { tab = 'overview' } = await searchParams;
  const d = isUuid(id) ? await getEntity(id) : null;
  if (!d) notFound();
  const { entity: e, members, taxIds, docs, projects, partOf, percentTotal } = d;
  const base = `/entities/${id}`;
  return (
    <>
      <PageHead eyebrow="Business Entity" title={e.name}
        sub={<span className="sub-row"><span className="chip blue">{entityKindLabel(e.kind)}</span>{e.state ? ` ${e.state}` : ''}{e.formedOn ? ` · formed ${formatDate(e.formedOn)}` : ''}{e.status === 'dissolved' ? <span className="chip">Dissolved</span> : null}</span>}
        actions={<Link className="btn secondary" href={`${base}/edit`}>Edit</Link>} />
      <Tabs base={base} current={tab} tabs={[
        { key: 'overview', label: 'Overview' }, { key: 'documents', label: 'Documents', count: docs.length },
        { key: 'tax-ids', label: 'Tax IDs', count: taxIds.length }, { key: 'history', label: 'History' },
      ]} />
      {tab === 'overview' ? (
        <div className="stack">
          <div className="grid-2">
            <Section title="Facts" kind="blue">
              <Facts items={[['Taxes', e.taxForm], ['Fiscal Year Ends', e.fiscalYearEnd], ['Address', e.address], ['Registered Agent', e.registeredAgent], ['Website', e.website],
                ['Notes', e.notes ? <span style={{ whiteSpace: 'pre-wrap' }}>{e.notes}</span> : null]]} />
            </Section>
            <Section title="It Owns a Share Of" kind="aqua">
              {partOf.length ? <ul className="rows">{partOf.map((p) => <li key={p.entityId}><Link href={`/entities/${p.entityId}`}><strong>{p.name}</strong></Link>{p.percent ? ` · ${Number(p.percent)}%` : ''}{p.role ? <span className="small muted"> · {memberRoleLabel(p.role)}</span> : null}</li>)}</ul>
                : <Empty>Not a member of our other entities.</Empty>}
            </Section>
          </div>
          <Section title="Who Owns It" kind="energy" hint={percentTotal ? `${percentTotal}% recorded${percentTotal !== 100 ? ' (not 100%)' : ''}` : 'Members and their share'}>
            {members.length ? (
              <div className="table-wrap"><table className="t members-table">
                <thead><tr><th>Member</th><th className="num">Share</th><th className="num">Capital Put In</th><th>Role</th><th>Since</th><th></th></tr></thead>
                <tbody>{members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.memberEntityId ? <Link href={`/entities/${m.memberEntityId}`}><strong>{m.name}</strong></Link> : m.personId ? <Link href={`/people/${m.personId}`}><strong>{m.name}</strong></Link> : <strong>{m.name}</strong>}{m.notes ? <div className="small muted">{m.notes}</div> : null}</td>
                    <td className="num">{m.percent ? `${Number(m.percent)}%` : '—'}</td>
                    <td className="num">{m.capital ? formatMoney(m.capital) : '—'}</td>
                    <td>{memberRoleLabel(m.role)}</td>
                    <td>{m.since ? formatDate(m.since) : '—'}</td>
                    <td><ActionForm action={removeMember} submit="Remove" confirm={`Take ${m.name} off the members?`}><input type="hidden" name="id" value={m.id} /></ActionForm></td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <Empty>No members recorded yet.</Empty>}
            <details className="fold" style={{ marginTop: 10 }}><summary>Add a Member</summary>
              <ActionForm action={saveMember} submit="Add the Member" resetOnOk>
                <input type="hidden" name="entityId" value={id} />
                <div className="fields">
                  <label className="f">One of Our Entities<select name="memberEntityId" defaultValue=""><option value="">No (a person or someone else)</option>{(await entityOptions()).filter((x) => x.id !== id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                  <label className="f">Or a Person<select name="personId" defaultValue=""><option value="">None</option>{(await peopleOptions()).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
                  <label className="f">Name<span className="h">As on the operating agreement</span><input name="name" /></label>
                  <label className="f">Share (%)<input name="percent" inputMode="decimal" placeholder="65" /></label>
                  <label className="f">Capital Put In<input name="capital" inputMode="decimal" placeholder="146,250" /></label>
                  <label className="f">Role<select name="role" defaultValue="member">{memberRoles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>
                  <label className="f">Since<input type="date" name="since" /></label>
                </div>
                <label className="f">Notes<input name="notes" /></label>
              </ActionForm>
            </details>
          </Section>
          <Section title="Its Projects" kind="aqua" hint="Projects whose Owned By names it">
            {projects.length ? <ul className="rows">{projects.map((p) => <li key={p.id}><Link href={`/projects/${p.id}`}><strong>{p.name}</strong></Link> <span className="chip">{projectStageLabel(p.stage)}</span></li>)}</ul>
              : <Empty>No projects name it as the owner yet (a project’s Owned By).</Empty>}
          </Section>
        </div>
      ) : null}
      {tab === 'documents' ? (
        <div className="stack">
          <Section title="Documents" kind="blue" hint="Restricted: only people with restricted-records access can open these">
            {docs.length ? <ul className="rows">{docs.map((f) => (
              <li key={f.id}><Link href={`/documents/${f.id}`}><strong>{f.caption ?? f.name}</strong></Link><span className="small muted"> · {f.name} · {fileSize(f.size)} · added {formatDate(f.created.toISOString().slice(0, 10))}</span></li>
            ))}</ul> : <Empty>No documents yet.</Empty>}
          </Section>
          <Section title="Add a Document" kind="aqua">
            <ActionForm action={addEntityDoc} submit="Upload" resetOnOk>
              <input type="hidden" name="entityId" value={id} />
              <div className="fields">
                <label className="f">Kind<select name="docType" required defaultValue="">{[<option key="" value="" disabled>Pick one</option>, ...entityDocTypes.map((t) => <option key={t} value={t}>{t}</option>)]}</select></label>
                <label className="f">Note<span className="h">e.g. “2025 Form 1065”, “signed May 20, 2025”</span><input name="note" /></label>
                <label className="f">File<span className="h">PDF or photo, up to 4 MB</span><input type="file" name="file" accept="application/pdf,image/*" required /></label>
              </div>
            </ActionForm>
          </Section>
        </div>
      ) : null}
      {tab === 'tax-ids' ? (
        <div className="stack">
          <Section title="Tax IDs" kind="energy" hint="Kept encrypted; shown as the last 4 digits. Each Show is written to History.">
            {taxIds.length ? (
              <div className="table-wrap"><table className="t">
                <thead><tr><th>Kind</th><th>Number</th><th>Issued</th><th></th></tr></thead>
                <tbody>{taxIds.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{taxIdKindLabel(t.kind)}</strong>{t.label ? <div className="small muted">{t.label}</div> : null}</td>
                    <td><TaxIdReveal id={t.id} last4={t.last4} /></td>
                    <td>{t.issuedOn ? formatDate(t.issuedOn) : '—'}</td>
                    <td><ActionForm action={removeTaxId} submit="Remove" confirm="Remove this number? It stays in History as removed (last 4 only)."><input type="hidden" name="id" value={t.id} /></ActionForm></td>
                  </tr>
                ))}</tbody>
              </table></div>
            ) : <Empty>No tax IDs yet.</Empty>}
          </Section>
          <Section title="Add a Tax ID" kind="grey">
            <ActionForm action={addTaxId} submit="Save It" resetOnOk>
              <input type="hidden" name="entityId" value={id} />
              <div className="fields">
                <label className="f">Kind<select name="kind" defaultValue="ein">{taxIdKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>
                <label className="f">Number<input name="value" required autoComplete="off" spellCheck={false} placeholder="12-3456789" /></label>
                <label className="f">Label<span className="h">Optional, e.g. “SC accommodations tax”</span><input name="label" /></label>
                <label className="f">Issued On<input type="date" name="issuedOn" /></label>
              </div>
            </ActionForm>
          </Section>
        </div>
      ) : null}
      {tab === 'history' ? <Section title="History" kind="grey"><HistoryList rows={await historyFor('entity', id)} /></Section> : null}
    </>
  );
}
