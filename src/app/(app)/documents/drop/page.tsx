import Link from 'next/link';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { entities, files, projects } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { can } from '@/lib/permissions';
import { formatDateTime } from '@/lib/format';
import { docGroups, entityDocKinds, splitCaption } from '@/lib/doc-types';
import { aiOn } from '@/lib/doc-filing-ai';
import { overheadCategories } from '@/lib/overhead';
import { today } from '@/lib/format';
import { PageHead, Section, Empty } from '@/components/ui';
import { ActionForm } from '@/components/ActionForm';
import { ActionButton } from '@/components/ActionButton';
import { SearchPicker } from '@/components/SearchPicker';
import { DropDocuments } from '@/components/DropDocuments';
import { createProjectFromDocs, discardDropped, fileFromInbox, readAgain } from '../../doc-drop-actions';
import { mergeProposals, propertyKey, type NewProperty } from '@/lib/doc-filing';
import { projectStages } from '@/lib/project-stages';
import { sameAsAddress } from '@/lib/locate-rules';

export const metadata = { title: 'Drop Documents' };
export const maxDuration = 300; // each file is read by Claude (a few seconds each)

export default async function DropPage() {
  const user = await requirePage('projects.edit');
  const seeEntities = can(user, 'sensitive.view');
  const seeMoney = can(user, 'money.view');
  const [inbox, ps, es] = await Promise.all([
    db.select({ id: files.id, name: files.name, caption: files.caption, created: files.created, proposed: files.proposedProperty }).from(files).where(and(eq(files.entity, 'inbox'), isNull(files.archived))).orderBy(desc(files.created)).limit(200),
    db.select({ id: projects.id, name: projects.name, address: projects.address, city: projects.city }).from(projects).where(isNull(projects.archived)).orderBy(asc(projects.name)),
    seeEntities || seeMoney ? db.select({ id: entities.id, name: entities.name }).from(entities).where(isNull(entities.archived)).orderBy(asc(entities.name)) : Promise.resolve([]),
  ]);
  // Documents about properties we don't have yet, one card per address.
  const groups = new Map<string, { files: typeof inbox; props: NewProperty[] }>();
  for (const f of inbox) if (f.proposed) { const k = propertyKey(f.proposed); const g = groups.get(k) ?? { files: [], props: [] }; g.files.push(f); g.props.push(f.proposed); groups.set(k, g); }
  const rest = inbox.filter((f) => !f.proposed);
  const targets = [...ps.map((p) => ({ id: `p:${p.id}`, label: p.name, sub: [!sameAsAddress(p.name, p.address) ? p.address : null, p.city, 'Property'].filter(Boolean).join(' · ') })), ...(seeEntities ? es.map((e) => ({ id: `e:${e.id}`, label: e.name, sub: 'Business records (owner only)' })) : []), ...(seeMoney ? es.map((e) => ({ id: `o:${e.id}`, label: `Overhead: ${e.name}`, sub: 'A business expense, not one property' })) : [])];
  const types = [...docGroups.flatMap((g) => g.types), ...(seeEntities ? entityDocKinds.filter((k) => k !== 'Other' && k !== 'Insurance') : [])];
  return (
    <>
      <PageHead title="Drop Documents" sub="Every document at once: each is read and filed on the right property or business entity, with its kind. Anything unclear waits below for you." />
      {!aiOn() ? <div className="notice warn">Claude isn’t connected here, so files go to the inbox below for you to file.</div> : null}
      <div className="stack">
        <Section title="Drop Them Here" kind="aqua" hint="Personal IDs (licenses, passports) are refused, never stored. The same file twice is skipped.">
          <DropDocuments />
        </Section>
        {groups.size ? (
          <Section title="New Properties Found" kind="blue" hint="Documents about properties that aren’t projects yet: check what was read and create the project">
            <div className="stack">{[...groups.entries()].map(([key, g]) => {
              const m = mergeProposals(g.props)!;
              const addr = m.unit && !/unit|#/i.test(m.address) ? `${m.address} Unit ${m.unit}` : m.address;
              return (
                <div key={key} className="new-property">
                  <h3 style={{ margin: '0 0 4px' }}>{addr}{m.city ? `, ${m.city}` : ''}</h3>
                  <p className="small muted" style={{ margin: '0 0 8px' }}>{g.files.length} {g.files.length === 1 ? 'document' : 'documents'}: {g.files.map((f) => splitCaption(f.caption).type ?? f.name).join(', ')}</p>
                  <ActionForm action={createProjectFromDocs} submit="Create This Project" saved="Project created, with its documents.">
                    <input type="hidden" name="key" value={key} />
                    <div className="fields">
                      <label className="f">Name<input name="name" defaultValue={m.community ? `${m.community} ${m.unit ? `#${m.unit}` : ''}`.trim() : addr} /></label>
                      <label className="f">Address<input name="address" defaultValue={addr} required /></label>
                      <label className="f">City<input name="city" defaultValue={m.city ?? ''} /></label>
                      <label className="f">State<input name="state" defaultValue={m.state ?? 'NC'} /></label>
                      <label className="f">ZIP<input name="zip" defaultValue={m.zip ?? ''} /></label>
                      <label className="f">Neighborhood or Community<input name="neighborhood" defaultValue={m.community ?? ''} /></label>
                      <label className="f">Purchase Price<input name="lotCost" inputMode="decimal" defaultValue={m.purchasePrice ?? ''} /></label>
                      <label className="f">Bought On<input type="date" name="purchasedOn" defaultValue={m.purchasedOn ?? ''} /></label>
                      <label className="f">Heated SF<input name="heatedSf" inputMode="numeric" defaultValue={m.heatedSf ?? ''} /></label>
                      <label className="f">Stage<select name="stage" defaultValue={m.purchasedOn ? 'rental' : 'under_contract'}>{projectStages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
                    </div>
                  </ActionForm>
                </div>
              );
            })}</div>
          </Section>
        ) : null}
        <Section title="Waiting to Be Filed" kind="energy" hint={`${rest.length}`}>
          {inbox.length ? <p style={{ margin: '0 0 8px' }}><ActionButton action={readAgain} className="btn small secondary" label="Read Again" done="Read again." /> <span className="small muted">Reads the waiting files again: they’re filed where they now fit, and documents about new properties gather above.</span></p> : null}
          {rest.length ? <ul className="rows">{rest.map((f) => {
            const c = splitCaption(f.caption);
            return (
              <li key={f.id}>
                <Link href={`/documents/${f.id}`}><strong>{f.name}</strong></Link> <span className="small muted">{c.type ?? ''}{c.title ? ` · ${c.title}` : ''} · dropped {formatDateTime(f.created)}</span>
                <details className="fold"><summary>File It</summary>
                  <ActionForm action={fileFromInbox} submit="File It" saved="Filed.">
                    <input type="hidden" name="id" value={f.id} />
                    <div className="fields">
                      <SearchPicker name="target" label="Where It Goes" required placeholder="Type the property or entity" options={targets} />
                      <label className="f">Kind<select name="type" defaultValue={c.type ?? 'Other'}>{types.map((t) => <option key={t}>{t}</option>)}</select></label>
                      <label className="f">Title<input name="title" defaultValue={c.title ?? ''} /></label>
                    </div>
                    {seeMoney ? (
                      <div className="fields">
                        <span className="small muted" style={{ flexBasis: '100%' }}>For overhead only:</span>
                        <label className="f">Paid To<input name="vendor" /></label>
                        <label className="f">Amount<input name="amount" inputMode="decimal" /></label>
                        <label className="f">Date<input type="date" name="spentOn" defaultValue={today()} /></label>
                        <label className="f">Category<select name="category" defaultValue="other">{overheadCategories.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
                      </div>
                    ) : null}
                  </ActionForm>
                  <ActionButton action={discardDropped.bind(null, f.id)} className="link-btn small" label="Not Needed: Remove It" done="Removed." confirm="Take this file out of the inbox?" />
                </details>
              </li>
            );
          })}</ul> : <Empty>Nothing waiting.</Empty>}
        </Section>
      </div>
    </>
  );
}
