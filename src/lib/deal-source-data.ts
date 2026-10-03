import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { guessSourceKind, rankSources, sourceKindLabel, sourceStats, type SourceDeal } from './deal-sources';

// The Deal Sources scoreboard: every person, company and kind of source that
// sent us deals, and how those deals turned out.

type Row = {
  id: string; address: string; stage: string; deal_type: string; met_buy_box: boolean | null; source_accurate: boolean | null; offered: boolean; bought: boolean;
  created: string; source_kind: string | null; person_id: string | null; person_name: string | null; company_id: string | null; company_name: string | null;
  roles: string[] | null; last_touch: string | null;
};

export async function dealSources(opts: { dealType?: string | null } = {}) {
  const r = await db.execute<Row>(sql`
    select pr.id, pr.address, pr.stage::text, pr.deal_type, pr.met_buy_box, pr.source_accurate,
      (pr.our_offer is not null or pr.stage in ('offer_made', 'lost')) as offered,
      (pr.stage = 'under_contract' or exists (select 1 from projects j where j.property_id = pr.id)) as bought,
      pr.created_at::date::text as created, pr.source_kind,
      p.id as person_id, case when p.id is not null then p.first_name || ' ' || p.last_name end as person_name,
      coalesce(pr.source_company_id, p.company_id) as company_id, c.name as company_name,
      (select array_agg(distinct r.role) from party_roles r where r.person_id = p.id and r.removed_at is null) as roles,
      (select max(t.happened_on)::text from touches t where t.person_id = p.id and t.archived_at is null) as last_touch
    from properties pr
    left join people p on p.id = pr.source_person_id
    left join companies c on c.id = coalesce(pr.source_company_id, p.company_id)
    where pr.archived_at is null and pr.stage <> 'sold' ${opts.dealType ? sql`and pr.deal_type = ${opts.dealType}` : sql``}
      and (pr.source_person_id is not null or pr.source_company_id is not null or pr.source_kind is not null)`);
  const rows = r.rows.map((x) => ({ ...x, kind: x.source_kind ?? guessSourceKind(x.roles ?? []) }));
  const deal = (x: (typeof rows)[number]): SourceDeal => ({ stage: x.stage, metBuyBox: x.met_buy_box, accurate: x.source_accurate, offered: x.offered, bought: x.bought });

  // By who sent it: the person, else their company.
  const who = new Map<string, { key: string; name: string; href: string | null; company: string | null; kind: string | null; lastTouch: string | null; lastDeal: string; deals: typeof rows }>();
  for (const x of rows) {
    if (!x.person_id && !x.company_id) continue;
    const key = x.person_id ? `p:${x.person_id}` : `c:${x.company_id}`;
    const o = who.get(key) ?? { key, name: x.person_name ?? x.company_name ?? '—', href: x.person_id ? `/people/${x.person_id}` : `/companies/${x.company_id}`, company: x.person_id ? x.company_name : null, kind: x.kind, lastTouch: x.last_touch, lastDeal: '', deals: [] };
    o.deals.push(x);
    if (x.created > o.lastDeal) o.lastDeal = x.created;
    who.set(key, o);
  }
  const bySource = rankSources([...who.values()].map((o) => ({ ...o, stats: sourceStats(o.deals.map(deal)) })));

  // By kind of source (wholesalers as a group, agents as a group ...).
  const kinds = new Map<string, typeof rows>();
  for (const x of rows) kinds.set(x.kind ?? 'unknown', [...(kinds.get(x.kind ?? 'unknown') ?? []), x]);
  const byKind = rankSources([...kinds.entries()].map(([k, ds]) => ({ key: k, label: k === 'unknown' ? 'Not Recorded' : sourceKindLabel(k), sources: new Set(ds.map((d) => d.person_id ?? d.company_id).filter(Boolean)).size, stats: sourceStats(ds.map(deal)) })));
  return { bySource, byKind, deals: rows.length };
}

/** One person's or company's record as a source (for their page). */
export async function sourceRecordFor(field: 'person' | 'company', id: string) {
  const r = await db.execute<{ stage: string; met_buy_box: boolean | null; source_accurate: boolean | null; offered: boolean; bought: boolean }>(sql`
    select pr.stage::text, pr.met_buy_box, pr.source_accurate, (pr.our_offer is not null or pr.stage in ('offer_made', 'lost')) as offered,
      (pr.stage = 'under_contract' or exists (select 1 from projects j where j.property_id = pr.id)) as bought
    from properties pr where pr.archived_at is null and pr.stage <> 'sold'
      and ${field === 'person' ? sql`pr.source_person_id = ${id}` : sql`(pr.source_company_id = ${id} or pr.source_person_id in (select id from people where company_id = ${id}))`}`);
  return r.rows.length ? sourceStats(r.rows.map((x) => ({ stage: x.stage, metBuyBox: x.met_buy_box, accurate: x.source_accurate, offered: x.offered, bought: x.bought }))) : null;
}
