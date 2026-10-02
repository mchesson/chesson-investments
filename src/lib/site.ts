// The public website (chessoninvestments.com), served by this app. Pure, tested
// in site.test.ts. Only what toPublicProject returns ever reaches a visitor:
// never costs, budgets, bills, vendors' money, notes or the review.

export const siteStatuses = [
  { key: 'in_progress', label: 'In Progress' },
  { key: 'coming_soon', label: 'Coming Soon' },
  { key: 'for_sale', label: 'For Sale' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'sold', label: 'Sold' },
  { key: 'rented', label: 'Leased' },
  { key: 'completed', label: 'Completed' },
] as const;
export type SiteStatus = (typeof siteStatuses)[number]['key'];
export const isSiteStatus = (v: string | null | undefined): v is SiteStatus => siteStatuses.some((s) => s.key === v);
export const siteStatusLabel = (v: string | null | undefined) => siteStatuses.find((s) => s.key === v)?.label ?? 'Not on the Website';
/** The price is shown only while it's for sale or under contract. */
export const showsPrice = (s: string | null | undefined) => s === 'for_sale' || s === 'under_contract' || s === 'coming_soon';

export const photoKinds = [
  { key: 'after', label: 'After' },
  { key: 'before', label: 'Before' },
  { key: 'progress', label: 'Progress' },
  { key: 'plan', label: 'Floor Plan' },
] as const;
export const isPhotoKind = (v: string | null | undefined) => photoKinds.some((k) => k.key === v);
export const photoKindLabel = (v: string | null | undefined) => photoKinds.find((k) => k.key === v)?.label ?? 'Photo';

export function slugify(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export type DetailSection = { title: string; items: { label: string; value: string }[] };

/**
 * Finishes and selections, typed as plain text:
 *   ## Kitchen
 *   Cabinets: White shaker with oak accent island
 * A line without "Label:" is a value on its own. Blank lines are ignored.
 */
export function parseDetails(text: string | null | undefined): DetailSection[] {
  const out: DetailSection[] = [];
  for (const raw of (text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const head = line.match(/^#+\s*(.+)$/);
    if (head) { out.push({ title: head[1].trim(), items: [] }); continue; }
    if (!out.length) out.push({ title: 'Details', items: [] });
    const i = line.indexOf(':');
    const item = i > 0 && i < 40 ? { label: line.slice(0, i).trim(), value: line.slice(i + 1).trim() } : { label: '', value: line };
    out[out.length - 1].items.push(item);
  }
  return out.filter((s) => s.items.length);
}

export type TeamMember = { role: string; name: string; detail: string };

/** One per line: Role | Company or Name | What they did (the last is optional). */
export function parseTeam(text: string | null | undefined): TeamMember[] {
  return (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).flatMap((l) => {
    const [role, name, ...rest] = l.split('|').map((x) => x.trim());
    if (!role || !name) return [];
    return [{ role, name, detail: rest.join(' | ') }];
  });
}

/** What must be true before a project can go on the website. */
export function siteProblems(p: { siteStatus: string | null; siteSlug: string | null; siteDescription: string | null }, photos: { kind: string | null }[]): string[] {
  if (!p.siteStatus) return [];
  const out: string[] = [];
  if (!isSiteStatus(p.siteStatus)) out.push('Pick a website status.');
  if (!p.siteSlug || p.siteSlug !== slugify(p.siteSlug)) out.push('The web address needs letters, numbers and dashes only.');
  if (!p.siteDescription?.trim()) out.push('Add a description.');
  if (!photos.length) out.push('Mark at least one photo for the website.');
  return out;
}

export type PublicPhoto = { id: string; kind: string; caption: string | null };
export type PublicProject = {
  slug: string; name: string; status: SiteStatus; statusLabel: string; place: string;
  price: number | null; tagline: string | null; description: string;
  beds: number | null; baths: number | null; sqft: number | null; acres: number | null;
  details: DetailSection[]; team: TeamMember[]; featured: boolean;
  cover: PublicPhoto | null; photos: PublicPhoto[];
};

type Row = {
  name: string; address: string; city: string | null; state: string | null; zip: string | null;
  heatedSf: number | null; lotAcres: string | null;
  siteStatus: string | null; siteSlug: string | null; sitePrice: string | null; siteTagline: string | null; siteDescription: string | null;
  siteBeds: string | null; siteBaths: string | null; siteDetails: string | null; siteTeam: string | null; siteFeatured: boolean;
};
const num = (v: string | null | undefined) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** The allowlist: the one way a project reaches the website. Null when it isn't published. */
export function toPublicProject(p: Row, photos: { id: string; photoKind: string | null; caption: string | null; onSite: boolean }[]): PublicProject | null {
  if (!isSiteStatus(p.siteStatus) || !p.siteSlug || !p.siteDescription?.trim()) return null;
  const ph = photos.filter((f) => f.onSite).map((f) => ({ id: f.id, kind: isPhotoKind(f.photoKind) ? f.photoKind! : 'after', caption: f.caption }));
  if (!ph.length) return null;
  return {
    slug: p.siteSlug, name: p.name, status: p.siteStatus, statusLabel: siteStatusLabel(p.siteStatus),
    place: [p.city, [p.state, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    price: showsPrice(p.siteStatus) ? num(p.sitePrice) : null,
    tagline: p.siteTagline?.trim() || null, description: p.siteDescription.trim(),
    beds: num(p.siteBeds), baths: num(p.siteBaths), sqft: p.heatedSf ?? null, acres: num(p.lotAcres),
    details: parseDetails(p.siteDetails), team: parseTeam(p.siteTeam), featured: p.siteFeatured,
    cover: ph.find((f) => f.kind === 'after') ?? ph.find((f) => f.kind !== 'plan') ?? ph[0], photos: ph,
  };
}

/** Featured first, then the owner's order (lower first), then name. */
export function sortProjects<T extends { featured: boolean; sort: number; name: string }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => Number(b.featured) - Number(a.featured) || a.sort - b.sort || a.name.localeCompare(b.name));
}

/** The website's own address (the app's address shows it under /site). */
export const PUBLIC_HOSTS = ['chessoninvestments.com', 'www.chessoninvestments.com'];
export const isPublicHost = (host: string | null | undefined) => PUBLIC_HOSTS.includes((host ?? '').toLowerCase().replace(/:\d+$/, ''));
/** Links on the website: "/projects/x" on chessoninvestments.com, "/site/projects/x" elsewhere. */
export const siteHref = (publicHost: boolean, path: string) => (publicHost ? path || '/' : `/site${path === '/' ? '' : path}`);

/** Photos may be copied in only from our own old website (no other addresses: the server fetches them). */
export function allowedPhotoUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && PUBLIC_HOSTS.includes(url.hostname) && !url.username && !url.password && (url.port === '' || url.port === '443');
  } catch { return false; }
}

export const formatNumber = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
