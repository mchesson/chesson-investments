// Reading form fields the same way everywhere. Pure.
export const str = (d: FormData, k: string): string | null => {
  const v = d.get(k);
  if (v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
export const bool = (d: FormData, k: string) => d.get(k) === 'on' || d.get(k) === 'true';
export const uuidOrNull = (d: FormData, k: string) => {
  const s = str(d, k);
  return s && /^[0-9a-f-]{36}$/i.test(s) ? s : null;
};
export const isUuid = (s: string | null | undefined): s is string => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
