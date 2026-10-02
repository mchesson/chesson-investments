// One place for how things are entered and shown. Pure, tested in format.test.ts.

export function formatMoney(v: string | number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0,
  });
}

export const formatCents = (c: number, opts: { cents?: boolean } = {}) => formatMoney(c / 100, opts);

/** "$1,800,000", "1.8m", "450k", "380000" → "1800000.00"; empty → null; junk → undefined. */
export function parseMoney(v: FormDataEntryValue | string | null | undefined): string | null | undefined {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase().replace(/[$,\s]/g, '');
  if (s === '') return null;
  const m = s.match(/^(-?\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return undefined;
  const n = Number(m[1]) * (m[2] === 'k' ? 1_000 : m[2] === 'm' ? 1_000_000 : 1);
  return n.toFixed(2);
}

export function parsePercent(v: FormDataEntryValue | null | undefined): string | null | undefined {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/[%\s]/g, '');
  if (s === '') return null;
  return /^-?\d+(\.\d+)?$/.test(s) ? s : undefined;
}

export function parseIntOrNull(v: FormDataEntryValue | null | undefined): number | null | undefined {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/[,\s]/g, '');
  if (s === '') return null;
  return /^\d+$/.test(s) ? Number(s) : undefined;
}

/** US phone as +19197958948; anything else kept as typed. */
export function storePhone(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return s;
}

export function showPhone(v: string | null | undefined): string {
  if (!v) return '';
  const m = v.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : v;
}

export const normalizeEmail = (v: string | null | undefined) => {
  const s = (v ?? '').trim().toLowerCase();
  return s || null;
};

/** Only a name typed all lower or ALL CAPS is changed; McDonald, O'Brien kept. */
export function formatName(v: string): string {
  const s = v.trim().replace(/\s+/g, ' ');
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-z])/g, (_, p, c) => p + c.toUpperCase())
    .replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase());
}

export function formatState(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase();
  if (/^north carolina$/i.test(s) || /^n\.?c\.?$/i.test(s)) return 'NC';
  if (/^south carolina$/i.test(s) || /^s\.?c\.?$/i.test(s)) return 'SC';
  if (/^virginia$/i.test(s)) return 'VA';
  return s;
}

export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const s = typeof v === 'string' ? v : v.toISOString();
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return `${m}/${d}/${y}`;
}

export function formatDateTime(v: Date | string | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleString('en-US', { timeZone: TIME_ZONE, month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const TIME_ZONE = 'America/New_York';

/** Today's date (YYYY-MM-DD) in the business's time zone. */
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isDay(v: string | null | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}
