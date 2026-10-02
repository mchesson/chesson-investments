import Link from 'next/link';
import { eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { companies, duplicateDismissals, people } from '@/db/schema';
import { requirePage } from '@/lib/session';
import { companiesLookAlike, namesLookAlike, pairs } from '@/lib/duplicates';
import { notTheSame } from '../../duplicate-actions';
import { Empty, PageHead, Section } from '@/components/ui';

export const metadata = { title: 'Possible Duplicates' };

export default async function DuplicatesPage() {
  await requirePage('records.delete');
  const [ps, cs, gone] = await Promise.all([
    db.select({ id: people.id, firstName: people.firstName, lastName: people.lastName, email: people.email, company: companies.name })
      .from(people).leftJoin(companies, eq(companies.id, people.companyId)).where(isNull(people.archived)),
    db.select({ id: companies.id, name: companies.name }).from(companies).where(isNull(companies.archived)),
    db.select().from(duplicateDismissals),
  ]);
  const said = new Set(gone.map((g) => `${g.kind}|${g.aId}|${g.bId}`));
  const open = (kind: string) => ([a, b]: [{ id: string }, { id: string }]) => !said.has(`${kind}|${a.id < b.id ? a.id : b.id}|${a.id < b.id ? b.id : a.id}`);
  const pp = pairs(ps, namesLookAlike).filter(open('person'));
  const cp = pairs(cs, (a, b) => companiesLookAlike(a.name, b.name)).filter(open('company'));
  const name = (p: (typeof ps)[number]) => `${p.firstName} ${p.lastName}`;
  return (
    <div className="stack">
      <PageHead title="Possible Duplicates" sub="People and companies on file whose names look alike: a nickname, a typo, Inc. or LLC, or one name inside the other. Merge them (everything moves to the one you keep), or say they're not the same." />
      <Section title="People" kind="blue" hint={`${pp.length}`}>
        {pp.length ? <ul className="rows dup-rows">{pp.map(([a, b]) => (
          <li key={a.id + b.id}>
            <span className="dup-pair">
              <Link href={`/people/${a.id}`}>{name(a)}</Link>{a.company ? <span className="small muted"> {a.company}</span> : null}
              <span className="dup-vs">and</span>
              <Link href={`/people/${b.id}`}>{name(b)}</Link>{b.company ? <span className="small muted"> {b.company}</span> : null}
            </span>
            <span className="dup-actions">
              <Link className="btn small" href={`/admin/duplicates/merge?kind=person&a=${a.id}&b=${b.id}`}>Merge…</Link>
              <form action={notTheSame.bind(null, 'person', a.id, b.id, name(a), name(b))}><button className="btn secondary small" type="submit">Not the Same</button></form>
            </span>
          </li>
        ))}</ul> : <Empty>No people with like names.</Empty>}
      </Section>
      <Section title="Companies" kind="aqua" hint={`${cp.length}`}>
        {cp.length ? <ul className="rows dup-rows">{cp.map(([a, b]) => (
          <li key={a.id + b.id}>
            <span className="dup-pair"><Link href={`/companies/${a.id}`}>{a.name}</Link><span className="dup-vs">and</span><Link href={`/companies/${b.id}`}>{b.name}</Link></span>
            <span className="dup-actions">
              <Link className="btn small" href={`/admin/duplicates/merge?kind=company&a=${a.id}&b=${b.id}`}>Merge…</Link>
              <form action={notTheSame.bind(null, 'company', a.id, b.id, a.name, b.name)}><button className="btn secondary small" type="submit">Not the Same</button></form>
            </span>
          </li>
        ))}</ul> : <Empty>No companies with like names.</Empty>}
      </Section>
    </div>
  );
}
