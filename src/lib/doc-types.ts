// The kinds of document we keep, grouped for a project's Documents tab and the
// document drop (owner, Oct 3, 2026: "where is my docs section and all the docs
// that should be in the system"). A file's kind is the first part of its caption
// ("Settlement Statement · Purchase, Nov 2024"). Pure, tested in doc-types.test.ts.

export const docGroups = [
  { key: 'purchase', label: 'Purchase and Closing', types: ['Purchase Contract', 'Settlement Statement', 'Closing Documents', 'Offer or Addendum', 'Earnest Money Receipt', 'Disclosure'] },
  { key: 'title', label: 'Deed, Title and Survey', types: ['Deed', 'Title Insurance', 'Survey or Plat', 'Covenants or HOA Documents'] },
  { key: 'loan', label: 'Loan and Mortgage', types: ['Loan Document', 'Mortgage Statement', 'Appraisal'] },
  { key: 'insurance', label: 'Insurance', types: ['Insurance Policy', 'Flood Certificate or Policy'] },
  { key: 'rental', label: 'Lease and Management', types: ['Lease', 'Management Agreement', 'Rental Statement'] },
  { key: 'build', label: 'Design, Permits and Construction', types: ['Design or Plans', 'Permit', 'Bid or Proposal', 'Contract with a Contractor', 'Inspection Report', 'Lien Waiver'] },
  { key: 'money', label: 'Receipts, Invoices and Bills', types: ['Receipt', 'Invoice', 'Utility Bill', 'Tax Bill', 'Bank or Wire Record'] },
  { key: 'warranty', label: 'Warranties and Manuals', types: ['Warranty', 'Product Manual'] },
  { key: 'tax', label: 'Tax Forms', types: ['1099 or Tax Form'] },
  { key: 'other', label: 'Other', types: ['Other'] },
] as const;

/** A business entity's documents (the Business Entities page's own list). */
export const entityDocKinds = ['Operating Agreement', 'Articles of Organization', 'Certificate of Existence', 'EIN Letter', 'Tax Return', 'Tax Filing Instructions', 'Annual Report', 'Insurance', 'Bank Letter', 'Amendment', 'Minutes or Resolution', 'Other'] as const;

export const projectDocTypes: string[] = docGroups.flatMap((g) => [...g.types]);
export const isProjectDocType = (v: string | null | undefined) => !!v && projectDocTypes.includes(v);

/** "Settlement Statement · Purchase, Nov 2024" → its kind and the rest. */
export function splitCaption(caption: string | null | undefined): { type: string | null; title: string | null } {
  if (!caption) return { type: null, title: null };
  const i = caption.indexOf(' · ');
  const head = i < 0 ? caption : caption.slice(0, i);
  const known = projectDocTypes.includes(head) || (entityDocKinds as readonly string[]).includes(head);
  return known ? { type: head, title: i < 0 ? null : caption.slice(i + 3) } : { type: null, title: caption };
}

export const docCaption = (type: string, title?: string | null) => (title ? `${type} · ${title}` : type).slice(0, 200);

/** Files grouped as the Documents tab shows them; files of no known kind go under Other. */
export function groupDocs<T extends { caption: string | null }>(rows: T[]) {
  const out = docGroups.map((g) => ({ ...g, rows: [] as (T & { type: string | null; title: string | null })[] }));
  for (const r of rows) {
    const c = splitCaption(r.caption);
    const g = out.find((x) => c.type && (x.types as readonly string[]).includes(c.type)) ?? out[out.length - 1];
    g.rows.push({ ...r, ...c });
  }
  return out.filter((g) => g.rows.length);
}
