// Filing a dropped document (owner, Oct 3, 2026: "I gave you all the docs"):
// what Claude may say about a file, and the checks on it. Pure, tested in
// doc-filing.test.ts. Claude only suggests; these rules decide.
import { z } from 'zod';
import { entityDocKinds, projectDocTypes } from './doc-types';

export const allDocKinds = [...new Set([...projectDocTypes, ...entityDocKinds])];

/** What Claude returns for one file. */
export const filingSchema = z.object({
  isIdDocument: z.boolean().describe("True for a driver's license, passport, Social Security card or other personal ID: those are never stored."),
  docType: z.enum(allDocKinds as [string, ...string[]]).describe('The kind of document, from the list.'),
  title: z.string().describe('A short title: who it is from and what it covers, with the date if shown. No account, loan, routing or card numbers, no SSNs or tax IDs.'),
  documentDate: z.string().nullable().describe('The main date on the document as YYYY-MM-DD, or null.'),
  targetKind: z.enum(['project', 'entity', 'none']).describe('Whether it belongs to one of the properties, one of the business entities, or neither/unsure.'),
  targetId: z.string().nullable().describe('The id from the list it belongs to, or null.'),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string().describe('One short sentence: which address, name or detail on the document points there.'),
  ein: z.string().nullable().describe('Only for an IRS EIN letter (CP 575 or 147C): the 9-digit EIN it assigns, digits only. Otherwise null.'),
});
export type Filing = z.infer<typeof filingSchema>;

export type Target = { kind: 'project' | 'entity'; id: string; name: string; detail?: string | null };

/** The instructions; the list of places is the only thing that changes (it goes after them, for caching). */
export const FILING_INSTRUCTIONS = `You file real estate investment documents for Chesson Investments. For each document (its first pages, or only its file name when the content isn't attached), decide its kind and which property (project) or business entity it belongs to, using the list given.
- Match properties by street address first (a unit number counts), then by a project or condo name that appears in the document.
- Business documents (operating agreements, articles, certificates, EIN letters, tax returns, annual reports, bank letters) belong to the business entity they name.
- A receipt or invoice belongs to a property only if its delivery address, job name or notes point to one; otherwise targetKind is none.
- If nothing points clearly to one place, use none: a person will file it.
- Never put account, loan, routing, card or Social Security numbers, or any tax ID, in the title or reason. The only number you may return is the EIN of an IRS EIN letter, in the ein field.`;

export function targetsText(ts: Target[]) {
  return ['Properties and entities to file into (id | kind | name | address or detail):', ...ts.map((t) => `${t.id} | ${t.kind} | ${t.name}${t.detail ? ` | ${t.detail}` : ''}`)].join('\n');
}

export type Decision =
  | { action: 'refuse'; why: string }
  | { action: 'file'; kind: 'project' | 'entity'; id: string; type: string; title: string; ein: string | null }
  | { action: 'inbox'; type: string; title: string; why: string };

/** What happens to a file, from Claude's answer: never trusted beyond the ids we gave it. */
export function decide(f: Filing | null, targets: Target[], canEntity: boolean): Decision {
  if (!f) return { action: 'inbox', type: 'Other', title: '', why: 'It couldn’t be read: file it by hand.' };
  if (f.isIdDocument) return { action: 'refuse', why: 'It looks like a personal ID (license, passport, Social Security card), so it wasn’t stored.' };
  const type = allDocKinds.includes(f.docType) ? f.docType : 'Other';
  const title = scrubTitle(f.title);
  const t = f.targetKind !== 'none' && f.targetId ? targets.find((x) => x.id === f.targetId && x.kind === f.targetKind) : null;
  if (!t || f.confidence === 'low') return { action: 'inbox', type, title, why: t ? 'Not sure where it goes: check it and file it.' : 'It didn’t clearly name one of the properties or entities.' };
  if (t.kind === 'entity' && !canEntity) return { action: 'inbox', type, title, why: 'Business documents are filed by the owner.' };
  const ein = type === 'EIN Letter' && t.kind === 'entity' && f.ein && /^\d{9}$/.test(f.ein.replace(/\D/g, '')) ? f.ein.replace(/\D/g, '') : null;
  return { action: 'file', kind: t.kind, id: t.id, type, title, ein };
}

/** Long digit runs (account, loan, card numbers) never go into a title. */
export function scrubTitle(s: string) {
  return s.replace(/\b\d[\d -]{6,}\d\b/g, '…').replace(/\s+/g, ' ').trim().slice(0, 150);
}
