import Link from 'next/link';
import { asc, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { companies, people } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { isUuid } from '@/lib/forms';
import { likeCompanies, likePeople } from '@/lib/duplicates';
import { mergePlan } from '@/lib/merge';
import { showPhone } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { Choice } from '@/components/Choice';
import { Empty, Facts, PageHead, Section } from '@/components/ui';
import { mergeRecords } from '../../../duplicate-actions';
import { SearchPicker } from '@/components/SearchPicker';

export const metadata = { title: 'Merge Two Records' };

async function load(kind: 'person' | 'company', id: string) {
  if (kind === 'person') {
    const [p] = await db.select({ r: people, company: companies.name }).from(people).leftJoin(companies, eq(companies.id, people.companyId)).where(eq(people.id, id));
    return p && !p.r.archived ? { id, name: `${p.r.firstName} ${p.r.lastName}`, facts: [['Email', p.r.email], ['Phone', showPhone(p.r.phone)], ['Company', p.company], ['Title', p.r.title], ['Lives', [p.r.city, p.r.state].filter(Boolean).join(', ')], ['Do Not Use', p.r.doNotUse ? p.r.doNotUseReason ?? 'Yes' : null]] as [string, string | null][] } : null;
  }
  const [c] = await db.select().from(companies).where(eq(companies.id, id));
  return c && !c.archived ? { id, name: c.name, facts: [['Website', c.website], ['Phone', showPhone(c.phone)], ['Email', c.email], ['Where', [c.city, c.state].filter(Boolean).join(', ')], ['Do Not Use', c.doNotUse ? c.doNotUseReason ?? 'Yes' : null]] as [string, string | null][] } : null;
}

export default async function MergePage({ searchParams }: { searchParams: Promise<{ kind?: string; a?: string; b?: string }> }) {
  await requirePage('records.delete');
  const sp = await searchParams;
  const kind = sp.kind === 'company' ? 'company' : 'person';
  const a = isUuid(sp.a) ? await load(kind, sp.a) : null;
  if (!a) return <><PageHead title="Merge Two Records" /><Empty>That record isn’t on file (or it’s archived).</Empty></>;
  const b = isUuid(sp.b) ? await load(kind, sp.b) : null;
  const base = `/admin/duplicates/merge?kind=${kind}&a=${a.id}`;

  if (!b) {
    // Merging from a record page: pick the other one (like names first).
    const all = kind === 'person'
      ? (await db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName }).from(people).where(isNull(people.archived)).orderBy(asc(people.lastName))).filter((p) => p.id !== a.id)
      : (await db.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived)).orderBy(asc(companies.name))).filter((c) => c.id !== a.id);
    const label = (x: (typeof all)[number]) => ('name' in x ? x.name : `${x.firstName} ${x.lastName}`);
    const [first, ...rest] = a.name.split(' ');
    const like = kind === 'person'
      ? likePeople({ firstName: first, lastName: rest.join(' ') }, all as { id: string; firstName: string; lastName: string }[])
      : likeCompanies(a.name, all as { id: string; name: string }[]);
    return (
      <div className="stack">
        <PageHead eyebrow="Merge" title={`Merge ${a.name} With…`} sub="Pick the other record. Next you’ll see both side by side and choose which one to keep." />
        {like.length ? <Section title="Looks Like" kind="energy"><div className="role-pick">{like.map((x) => <Link key={x.id} className="role-btn" href={`${base}&b=${x.id}`}>{label(x)}</Link>)}</div></Section> : null}
        <Section title="Or Pick Anyone" kind="grey">
          <form className="find-bar" action="/admin/duplicates/merge">
            <input type="hidden" name="kind" value={kind} /><input type="hidden" name="a" value={a.id} />
            <div className="grow"><SearchPicker name="b" required label={kind === 'person' ? 'Person' : 'Company'} placeholder="Type a name" options={all.map((x) => ({ id: x.id, label: label(x) }))} /></div>
            <button className="btn" type="submit">Compare</button>
          </form>
        </Section>
      </div>
    );
  }

  const [pa, pb] = await Promise.all([mergePlan(kind, a.id), mergePlan(kind, b.id)]);
  const side = (r: NonNullable<typeof a>, plan: typeof pa) => (
    <Section title={r.name} kind="blue" hint={<Link href={`/${kind === 'person' ? 'people' : 'companies'}/${r.id}`}>Open</Link>}>
      <Facts items={r.facts} />
      <p className="small muted" style={{ margin: '10px 0 4px' }}>Linked to it:</p>
      {plan.length ? <ul className="rows small">{plan.map((x) => <li key={x.label}>{x.count} {x.label}</li>)}</ul> : <p className="small muted">Nothing yet.</p>}
    </Section>
  );
  return (
    <div className="stack">
      <PageHead eyebrow="Merge" title="Merge Two Records" sub="Everything linked to the one you don’t keep moves to the one you keep: roles, touches, tasks, bills, bids, grades, issues, work history, introductions. Empty fields are filled in from it, and it’s archived (never deleted). History on both says what moved." />
      <div className="grid-2">{side(a, pa)}{side(b, pb)}</div>
      <Section title="Which One Do You Keep?" kind="energy">
        <ActionForm action={mergeRecords} submit="Merge Them" confirm="Merge these two records? Everything moves to the one you keep and the other is archived.">
          <input type="hidden" name="kind" value={kind} /><input type="hidden" name="a" value={a.id} /><input type="hidden" name="b" value={b.id} />
          <Choice name="keep" label="Keep" required options={[{ key: a.id, label: `${a.name} (left)` }, { key: b.id, label: `${b.name} (right)` }]}
            defaultValue={pa.reduce((s, x) => s + x.count, 0) >= pb.reduce((s, x) => s + x.count, 0) ? a.id : b.id} />
        </ActionForm>
      </Section>
    </div>
  );
}
