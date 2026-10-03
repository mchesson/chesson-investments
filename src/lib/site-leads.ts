// Leads from the public website's Contact Us and Sell Us Your Property forms,
// where they came from, and the website's own settings. Pure, tested in
// site-leads.test.ts. Nothing here touches the database.

export const leadKinds = [
  { key: 'contact', label: 'Contact Us' },
  { key: 'sell', label: 'Sell Us Your Property' },
] as const;
export type LeadKind = (typeof leadKinds)[number]['key'];
export const isLeadKind = (v: string | null | undefined): v is LeadKind => leadKinds.some((k) => k.key === v);
export const leadKindLabel = (v: string | null | undefined) => leadKinds.find((k) => k.key === v)?.label ?? 'Website';

export const leadStatuses = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'closed', label: 'Closed' },
  { key: 'not_a_fit', label: 'Not a Fit' },
] as const;
export type LeadStatus = (typeof leadStatuses)[number]['key'];
export const isLeadStatus = (v: string | null | undefined): v is LeadStatus => leadStatuses.some((k) => k.key === v);
export const leadStatusLabel = (v: string | null | undefined) => leadStatuses.find((k) => k.key === v)?.label ?? 'New';

/** What the Contact Us form asks what it's about. */
export const contactTopics = [
  { key: 'buying', label: 'A Home or Project' },
  { key: 'selling', label: 'Selling Property' },
  { key: 'working', label: 'Working With Us' },
  { key: 'other', label: 'Something Else' },
] as const;
export const propertyKinds = [
  { key: 'lot', label: 'Vacant Lot' },
  { key: 'house', label: 'House' },
  { key: 'teardown', label: 'Teardown' },
  { key: 'land', label: 'Land (Several Acres)' },
  { key: 'other', label: 'Something Else' },
] as const;
export const propertyConditions = [
  { key: 'good', label: 'Good' },
  { key: 'needs_work', label: 'Needs Some Work' },
  { key: 'full_renovation', label: 'Needs a Full Renovation' },
  { key: 'teardown', label: 'Should Come Down' },
  { key: 'not_sure', label: 'Not Sure' },
] as const;
export const sellTimelines = [
  { key: 'now', label: 'As Soon As Possible' },
  { key: '1_3', label: 'In 1 to 3 Months' },
  { key: '3_6', label: 'In 3 to 6 Months' },
  { key: 'exploring', label: 'Just Exploring' },
] as const;
const labelIn = (list: readonly { key: string; label: string }[], v: string | null | undefined) => list.find((x) => x.key === v)?.label ?? null;
export const topicLabel = (v: string | null | undefined) => labelIn(contactTopics, v);
export const propertyKindLabel = (v: string | null | undefined) => labelIn(propertyKinds, v);
export const conditionLabel = (v: string | null | undefined) => labelIn(propertyConditions, v);
export const timelineLabel = (v: string | null | undefined) => labelIn(sellTimelines, v);

export type LeadInput = {
  kind: LeadKind; name: string; email: string | null; phone: string | null; message: string | null; topic: string | null;
  propertyAddress: string | null; propertyCity: string | null; propertyKind: string | null; condition: string | null;
  timeline: string | null; askingPrice: string | null;
};

type Get = (k: string) => string | null;
const clip = (v: string | null, n: number) => (v ? v.replace(/\s+$/g, '').slice(0, n) : null);
const one = (v: string | null, n: number) => (v ? v.replace(/\s+/g, ' ').trim().slice(0, n) || null : null);
const pick = (list: readonly { key: string }[], v: string | null) => (v && list.some((x) => x.key === v) ? v : null);
export const looksLikeEmail = (v: string) => /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(v);
/** At least ten digits (a US number), or seven with a + for elsewhere. */
export const looksLikePhone = (v: string) => { const d = v.replace(/\D/g, ''); return d.length >= 10 && d.length <= 15 && /^[\d\s().+\-x#ext.]+$/i.test(v); };

/**
 * Checks a website form. `get` reads one field (already trimmed, empty = null).
 * A name, and an email or a phone, always; a message for Contact Us; the
 * property's address for Sell Us Your Property. Everything is cut to a sane length.
 */
export function checkLead(kind: string | null, get: Get): { lead: LeadInput } | { error: string } {
  if (!isLeadKind(kind)) return { error: 'Something went wrong with the form. Please try again.' };
  const name = one(get('name'), 120);
  const email = one(get('email'), 200)?.toLowerCase() ?? null;
  const phone = one(get('phone'), 40);
  if (!name) return { error: 'Please tell us your name.' };
  if (!email && !phone) return { error: 'Please give us an email address or a phone number so we can reach you.' };
  if (email && !looksLikeEmail(email)) return { error: 'That email address doesn’t look right. Please check it.' };
  if (phone && !looksLikePhone(phone)) return { error: 'That phone number doesn’t look right. Please include the area code.' };
  const message = clip(get('message'), 5000);
  const lead: LeadInput = {
    kind, name, email, phone, message, topic: null,
    propertyAddress: null, propertyCity: null, propertyKind: null, condition: null, timeline: null, askingPrice: null,
  };
  if (kind === 'contact') {
    if (!message?.trim()) return { error: 'Please write a short message.' };
    lead.topic = pick(contactTopics, get('topic'));
  } else {
    lead.propertyAddress = one(get('propertyAddress'), 200);
    if (!lead.propertyAddress) return { error: 'Please give us the property’s address.' };
    lead.propertyCity = one(get('propertyCity'), 80);
    lead.propertyKind = pick(propertyKinds, get('propertyKind'));
    lead.condition = pick(propertyConditions, get('condition'));
    lead.timeline = pick(sellTimelines, get('timeline'));
    lead.askingPrice = one(get('askingPrice'), 60);
  }
  return { lead };
}

/** The hidden field people never see: anything typed in it means a bot. */
export const HONEYPOT = 'company_website';
export const isBot = (get: Get) => !!get(HONEYPOT);

export type LeadSource = {
  referrer: string | null; landingPage: string | null; formPage: string | null;
  utmSource: string | null; utmMedium: string | null; utmCampaign: string | null;
};

/** A path on the website ("/sell?utm_source=x"), never another site's address. */
export function cleanPath(v: string | null | undefined): string | null {
  if (!v) return null;
  let s = v.trim();
  try { if (/^https?:\/\//i.test(s)) { const u = new URL(s); s = u.pathname + u.search; } } catch { return null; }
  if (!s.startsWith('/') || s.startsWith('//')) return null;
  return s.replace(/^\/site(?=\/|$|\?)/, '') .replace(/^(?=\?)/, '/').slice(0, 300) || '/';
}

/** Only the other site's name (its page and query can hold private words); none for our own sites. */
export function cleanReferrer(v: string | null | undefined, ownHosts: string[] = []): string | null {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase();
    if (ownHosts.map((h) => h.toLowerCase().replace(/:\d+$/, '')).includes(host)) return null;
    return `${u.protocol}//${host}`;
  } catch { return null; }
}

const tag = (v: string | null | undefined) => (v ? v.trim().toLowerCase().replace(/[^a-z0-9._\-+ ]/g, '').replace(/\s+/g, ' ').slice(0, 80) || null : null);

/** utm_source, utm_medium and utm_campaign from a page's address or its query. */
export function parseUtm(search: string | null | undefined): Pick<LeadSource, 'utmSource' | 'utmMedium' | 'utmCampaign'> {
  let q = (search ?? '').trim();
  const at = q.indexOf('?');
  if (at >= 0) q = q.slice(at + 1);
  q = q.replace(/#.*$/, '');
  let p: URLSearchParams;
  try { p = new URLSearchParams(q); } catch { p = new URLSearchParams(); }
  return { utmSource: tag(p.get('utm_source')), utmMedium: tag(p.get('utm_medium')), utmCampaign: tag(p.get('utm_campaign')) };
}

/**
 * Where a lead came from, from what the browser kept on its first page of the
 * visit (the `src` field: JSON with referrer, landing and utm) and the page the
 * form was sent from. Utm tags in the landing address count when none were sent.
 */
export function parseSource(raw: string | null | undefined, formPage: string | null | undefined, ownHosts: string[] = []): LeadSource {
  let o: Record<string, unknown> = {};
  try { const j = raw ? JSON.parse(raw.slice(0, 4000)) : null; if (j && typeof j === 'object' && !Array.isArray(j)) o = j as Record<string, unknown>; } catch { /* nothing kept */ }
  const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : null);
  const landingPage = cleanPath(s('landing'));
  const fromLanding = parseUtm(s('landing'));
  return {
    referrer: cleanReferrer(s('referrer'), ownHosts),
    landingPage,
    formPage: cleanPath(formPage),
    utmSource: tag(s('utm_source')) ?? fromLanding.utmSource,
    utmMedium: tag(s('utm_medium')) ?? fromLanding.utmMedium,
    utmCampaign: tag(s('utm_campaign')) ?? fromLanding.utmCampaign,
  };
}

/** One word for "Leads by Source": the utm source, else the other site's name, else Direct. */
export function sourceName(l: { utmSource: string | null; referrer: string | null }): string {
  if (l.utmSource) return l.utmSource;
  if (l.referrer) {
    try {
      const h = new URL(l.referrer).hostname.replace(/^www\./, '').replace(/^m\./, '');
      if (/(^|\.)google\./.test(h)) return 'google';
      if (/(^|\.)bing\.com$/.test(h)) return 'bing';
      if (/(^|\.)(facebook\.com|fb\.com)$/.test(h)) return 'facebook';
      if (/(^|\.)(linkedin\.com|lnkd\.in)$/.test(h)) return 'linkedin';
      if (/(^|\.)instagram\.com$/.test(h)) return 'instagram';
      return h;
    } catch { return 'Direct'; }
  }
  return 'Direct';
}

export type RateRule = { max: number; windowMs: number };
/** At most 3 in 10 minutes and 10 in a day from one address (counted by its hash). */
export const RATE_RULES: RateRule[] = [{ max: 3, windowMs: 10 * 60_000 }, { max: 10, windowMs: 24 * 3600_000 }];

/** Whether one more form may be sent, given when the earlier ones from the same address came. */
export function allowSubmit(earlier: Date[], now: Date = new Date(), rules: RateRule[] = RATE_RULES): boolean {
  return rules.every((r) => earlier.filter((t) => now.getTime() - t.getTime() < r.windowMs && t.getTime() <= now.getTime()).length < r.max);
}

/** Search engines and link checkers: not counted as visits. */
export const isBotAgent = (ua: string | null | undefined) => !ua || /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|monitor|curl|wget|python|axios|node-fetch|go-http|lighthouse|pingdom|uptime/i.test(ua);

// The website's settings (Leads → Website Settings), saved in app_settings 'website'.
export type WebsiteSettings = {
  phone: string | null; email: string | null; area: string;
  aboutText: string; whatWeDoIntro: string; sellIntro: string; contactIntro: string;
  gaId: string | null; searchConsole: string | null;
};
export const WEBSITE_SETTINGS_KEY = 'website';

/** Google Analytics 4 measurement IDs look like G-ABC123DEF4. */
export const isGaId = (v: string | null | undefined) => !!v && /^G-[A-Z0-9]{4,15}$/.test(v);
/** Search Console's HTML tag verification code: the content="…" part only. */
export function searchConsoleCode(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = v.match(/content=["']([^"']+)["']/i);
  const s = (m ? m[1] : v).trim();
  return /^[A-Za-z0-9_\-]{10,100}$/.test(s) ? s : null;
}

/** Reads saved settings over the defaults, keeping only values that check out. */
export function websiteSettings(saved: unknown, defaults: WebsiteSettings): WebsiteSettings {
  const o = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {};
  const s = (k: keyof WebsiteSettings) => (typeof o[k] === 'string' ? (o[k] as string).trim() : undefined);
  const text = (k: 'area' | 'aboutText' | 'whatWeDoIntro' | 'sellIntro' | 'contactIntro') => s(k) || defaults[k];
  const opt = (k: 'phone' | 'email') => (k in o ? s(k) || null : defaults[k]);
  const ga = s('gaId')?.toUpperCase();
  return {
    phone: opt('phone'), email: opt('email'), area: text('area'),
    aboutText: text('aboutText'), whatWeDoIntro: text('whatWeDoIntro'), sellIntro: text('sellIntro'), contactIntro: text('contactIntro'),
    gaId: isGaId(ga) ? ga! : null, searchConsole: searchConsoleCode(s('searchConsole')),
  };
}

/** "+19197958948" → "(919) 795-8948"; anything else as typed. */
export function phoneShown(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : null;
  return ten ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : v;
}
export function phoneLink(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  if (d.length === 10) return `tel:+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `tel:+${d}`;
  return d.length >= 7 ? `tel:+${d}` : null;
}

/** "/projects/x" → "Project: x"; the website's pages by name. */
export function pageName(path: string): string {
  const named: Record<string, string> = { '/': 'Home', '/projects': 'Projects', '/what-we-do': 'What We Do', '/sell': 'Sell Us Your Property', '/about': 'About', '/contact': 'Contact Us' };
  if (named[path]) return named[path];
  const m = path.match(/^\/projects\/(.+)$/);
  return m ? `Project: ${m[1]}` : path;
}
