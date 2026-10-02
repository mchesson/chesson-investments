import { showPhone } from '@/lib/format';

export function Phone({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return <a href={`tel:${value}`}>{showPhone(value)}</a>;
}
