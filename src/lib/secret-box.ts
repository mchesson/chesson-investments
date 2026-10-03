// Encrypting the few secrets we keep (tax IDs). AES-256-GCM with a key derived
// (HKDF-SHA256) from TAX_ID_KEY, else AUTH_SECRET. Changing that secret makes
// the stored numbers unreadable: set TAX_ID_KEY once and keep it. Tested in
// secret-box.test.ts.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function keyFrom(secret: string | undefined): Buffer {
  if (!secret || secret.length < 16) throw new Error('No encryption key: set TAX_ID_KEY (or AUTH_SECRET).');
  return Buffer.from(hkdfSync('sha256', secret, 'chesson-investments', 'tax-ids v1', 32));
}
const envSecret = () => process.env.TAX_ID_KEY || process.env.AUTH_SECRET;

/** "v1.<iv>.<tag>.<ciphertext>", all base64url. */
export function seal(plain: string, secret = envSecret()): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [VERSION, iv.toString('base64url'), c.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

export function open(sealed: string, secret = envSecret()): string {
  const [v, iv, tag, body] = sealed.split('.');
  if (v !== VERSION || !iv || !tag || body === undefined) throw new Error('Not a sealed value.');
  const d = createDecipheriv('aes-256-gcm', keyFrom(secret), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8');
}

export const taxIdKinds = [
  { key: 'ein', label: 'Federal EIN' },
  { key: 'state_tax', label: 'State Tax ID' },
  { key: 'withholding', label: 'State Withholding Number' },
  { key: 'sales_tax', label: 'Sales or Accommodations Tax Number' },
  { key: 'sos', label: 'Secretary of State ID' },
  { key: 'other', label: 'Other' },
] as const;
export const isTaxIdKind = (v: string | null | undefined) => taxIdKinds.some((k) => k.key === v);
export const taxIdKindLabel = (v: string) => taxIdKinds.find((k) => k.key === v)?.label ?? v;

/** A tax ID as typed: digits, letters and dashes only, 4 to 40 characters; the EIN as 12-3456789. */
export function cleanTaxId(kind: string, raw: string): { value: string } | { error: string } {
  const v = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z0-9-]{4,40}$/.test(v)) return { error: 'Type the number: letters, digits and dashes only.' };
  if (kind === 'ein') {
    const d = v.replace(/-/g, '');
    if (!/^\d{9}$/.test(d)) return { error: 'An EIN is 9 digits, like 12-3456789.' };
    return { value: `${d.slice(0, 2)}-${d.slice(2)}` };
  }
  return { value: v };
}
export const last4Of = (v: string) => v.replace(/[^A-Z0-9]/gi, '').slice(-4);
export const masked = (last4: string) => `•••• ${last4}`;
