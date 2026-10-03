// Filing a dropped document (owner, Oct 3, 2026: "I gave you all the docs"):
// what Claude may say about a file, and the checks on it. Pure, tested in
// doc-filing.test.ts. Claude only suggests; these rules decide.
import { z } from 'zod';
import { entityDocKinds, projectDocTypes } from './doc-types';
import { overheadKeys, type OverheadCategory } from './overhead';
import { addressKey } from './locate-rules';

export const allDocKinds = [...new Set([...projectDocTypes, ...entityDocKinds])];

/** What Claude returns for one file. */
export const filingSchema = z.object({
  isIdDocument: z.boolean().describe("True for a driver's license, passport, Social Security card or other personal ID: those are never stored."),
  docType: z.enum(allDocKinds as [string, ...string[]]).describe('The kind of document, from the list.'),
  title: z.string().describe('A short title: who it is from and what it covers, with the date if shown. No account, loan, routing or card numbers, no SSNs or tax IDs.'),
  documentDate: z.string().nullable().describe('The main date on the document as YYYY-MM-DD, or null.'),
  targetKind: z.enum(['project', 'entity', 'overhead', 'none']).describe('project: one of the properties; entity: a business record of one of the entities (agreements, tax, filings); overhead: a receipt or bill for the business itself, not any one property (office, software, phone, legal or accounting fees, filing fees, business insurance, mileage), with targetId the entity it was for; none: unsure.'),
  targetId: z.string().nullable().describe('The id from the list it belongs to, or null.'),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string().describe('One short sentence: which address, name or detail on the document points there.'),
  vendor: z.string().nullable().describe('For a receipt, invoice or bill: who was paid. Otherwise null.'),
  amount: z.number().nullable().describe('For a receipt, invoice or bill: the total paid in dollars. Otherwise null.'),
  overheadCategory: z.enum(overheadKeys).nullable().describe('For overhead only: its category. Otherwise null.'),
  newProperty: z.object({
    address: z.string().describe('Street address with the house number, e.g. "1211 Shaw View Alley"'),
    unit: z.string().nullable().describe('Unit or apartment, e.g. "101", or null'),
    city: z.string().nullable(), state: z.string().nullable(), zip: z.string().nullable(),
    purchasePrice: z.number().nullable().describe('The price we paid (contract or settlement statement), or null'),
    purchasedOn: z.string().nullable().describe('Closing or settlement date as YYYY-MM-DD, or null'),
    heatedSf: z.number().nullable().describe('Heated or finished square feet, or null'),
    community: z.string().nullable().describe('Subdivision, condo or community name (e.g. "The Grey"), or null'),
  }).nullable().describe('Only when the document is about a specific property that is NOT in the list: that property and what the document says about it. Otherwise null.'),
  ein: z.string().nullable().describe('Only for an IRS EIN letter (CP 575 or 147C): the 9-digit EIN it assigns, digits only. Otherwise null.'),
});
export type Filing = z.infer<typeof filingSchema>;

export type Target = { kind: 'project' | 'entity'; id: string; name: string; detail?: string | null };

/** The instructions; the list of places is the only thing that changes (it goes after them, for caching). */
export const FILING_INSTRUCTIONS = `You file real estate investment documents for Chesson Investments. For each document (its first pages, or only its file name when the content isn't attached), decide its kind and which property (project) or business entity it belongs to, using the list given.
- Match properties by street address first (a unit number counts), then by a project or condo name that appears in the document.
- Business documents (operating agreements, articles, certificates, EIN letters, tax returns, annual reports, bank letters) belong to the business entity they name.
- A receipt or invoice belongs to a property only if its delivery address, job name or notes point to one. A receipt for running the business itself (office supplies, software, phone, legal or accounting, filing fees, business insurance, mileage) is overhead: use targetKind overhead with the entity it was for (Chesson Investments when it doesn't say). Otherwise targetKind is none.
- If the document is about a specific property that isn't in the list (a purchase, closing, insurance, HOA or utility document for an address we don't have), use targetKind none and fill newProperty with its address and what the document says: a person will create the project from it.
- If nothing points clearly to one place, use none: a person will file it.
- Never put account, loan, routing, card or Social Security numbers, or any tax ID, in the title or reason. The only number you may return is the EIN of an IRS EIN letter, in the ein field.`;

export function targetsText(ts: Target[]) {
  return ['Properties and entities to file into (id | kind | name | address or detail):', ...ts.map((t) => `${t.id} | ${t.kind} | ${t.name}${t.detail ? ` | ${t.detail}` : ''}`)].join('\n');
}

export type NewProperty = NonNullable<z.infer<typeof filingSchema>['newProperty']>;

/** One key per property whatever way its address is written ("1211 Shaw View Alley Unit 101"). */
export function propertyKey(p: { address: string; unit?: string | null }) {
  const k = addressKey(p.unit && !/unit|apt|#/i.test(p.address) ? `${p.address} Unit ${p.unit}` : p.address);
  return k ? `${k.number} ${k.street}${k.unit ? ` #${k.unit}` : ''}` : p.address.trim().toUpperCase();
}

/** The facts from several documents about one new property: the first one given for each, the largest price. */
export function mergeProposals(ps: NewProperty[]): NewProperty | null {
  if (!ps.length) return null;
  const first = <K extends keyof NewProperty>(k: K) => ps.map((p) => p[k]).find((v) => v !== null && v !== undefined && v !== '') ?? null;
  const prices = ps.map((p) => p.purchasePrice).filter((v): v is number => typeof v === 'number' && v > 0);
  return {
    address: ps[0].address, unit: first('unit') as string | null, city: first('city') as string | null, state: first('state') as string | null, zip: first('zip') as string | null,
    purchasePrice: prices.length ? Math.max(...prices) : null, purchasedOn: first('purchasedOn') as string | null, heatedSf: first('heatedSf') as number | null, community: first('community') as string | null,
  };
}

export type Expense = { vendor: string | null; amount: number | null; spentOn: string | null; category: OverheadCategory };
export type Decision =
  | { action: 'refuse'; why: string }
  | { action: 'file'; kind: 'project' | 'entity'; id: string; type: string; title: string; ein: string | null }
  | { action: 'file'; kind: 'overhead'; id: string; type: string; title: string; ein: null; expense: Expense }
  | { action: 'inbox'; type: string; title: string; why: string; proposal?: NewProperty };

/** What happens to a file, from Claude's answer: never trusted beyond the ids we gave it. */
export function decide(f: Filing | null, targets: Target[], canEntity: boolean, canMoney = true): Decision {
  if (!f) return { action: 'inbox', type: 'Other', title: '', why: 'It couldn’t be read: file it by hand.' };
  if (f.isIdDocument) return { action: 'refuse', why: 'It looks like a personal ID (license, passport, Social Security card), so it wasn’t stored.' };
  const type = allDocKinds.includes(f.docType) ? f.docType : 'Other';
  const title = scrubTitle(f.title);
  // Overhead is filed under one of the entities (the business it was for).
  const t = f.targetKind !== 'none' && f.targetId ? targets.find((x) => x.id === f.targetId && x.kind === (f.targetKind === 'overhead' ? 'entity' : f.targetKind)) : null;
  if (!t && f.newProperty?.address && addressKey(f.newProperty.address)) {
    const n = f.newProperty;
    const clean = { ...n, address: n.address.trim().slice(0, 120), purchasePrice: typeof n.purchasePrice === 'number' && n.purchasePrice > 0 && n.purchasePrice < 100_000_000 ? Math.round(n.purchasePrice) : null,
      purchasedOn: n.purchasedOn && /^\d{4}-\d{2}-\d{2}$/.test(n.purchasedOn) ? n.purchasedOn : null, heatedSf: typeof n.heatedSf === 'number' && n.heatedSf > 100 && n.heatedSf < 50_000 ? Math.round(n.heatedSf) : null };
    return { action: 'inbox', type, title, why: `A property we don’t have yet: ${propertyKey(clean)}`, proposal: clean };
  }
  if (!t || f.confidence === 'low') return { action: 'inbox', type, title, why: t ? 'Not sure where it goes: check it and file it.' : 'It didn’t clearly name one of the properties or entities.' };
  if (f.targetKind === 'overhead') {
    if (!canMoney) return { action: 'inbox', type, title, why: 'Overhead is filed by someone who sees the money.' };
    const amount = typeof f.amount === 'number' && Number.isFinite(f.amount) && f.amount >= 0 && f.amount < 10_000_000 ? Math.round(f.amount * 100) / 100 : null;
    const spentOn = f.documentDate && /^\d{4}-\d{2}-\d{2}$/.test(f.documentDate) ? f.documentDate : null;
    const category = f.overheadCategory && overheadKeys.includes(f.overheadCategory) ? f.overheadCategory : 'other';
    return { action: 'file', kind: 'overhead', id: t.id, type, title, ein: null, expense: { vendor: f.vendor ? scrubTitle(f.vendor).slice(0, 100) : null, amount, spentOn, category } };
  }
  if (t.kind === 'entity' && !canEntity) return { action: 'inbox', type, title, why: 'Business documents are filed by the owner.' };
  const ein = type === 'EIN Letter' && t.kind === 'entity' && f.ein && /^\d{9}$/.test(f.ein.replace(/\D/g, '')) ? f.ein.replace(/\D/g, '') : null;
  return { action: 'file', kind: t.kind, id: t.id, type, title, ein };
}

/** Long digit runs (account, loan, card numbers) never go into a title. */
export function scrubTitle(s: string) {
  return s.replace(/\b\d[\d -]{6,}\d\b/g, '…').replace(/\s+/g, ' ').trim().slice(0, 150);
}
