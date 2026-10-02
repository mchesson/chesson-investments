// How a saved file is shown (owner, Oct 2, 2026: "all saved docs in the system
// should be able to render in the system or be able to download"). Pure, tested.
import type { Permission } from './permissions';

/** What each kind of record's files need to be opened (the same as the record). */
export const fileNeeds: Record<string, Permission> = {
  property: 'properties.view', project: 'projects.view', daily_log: 'projects.view', bill: 'money.view', bid: 'money.view', lease: 'money.view',
};
export const fileNeed = (entity: string): Permission => fileNeeds[entity] ?? 'users.manage';

/** pdf and web images show in the page; anything else (HEIC, a future type) is download only. */
export function previewKind(contentType: string): 'pdf' | 'image' | 'download' {
  if (contentType === 'application/pdf') return 'pdf';
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)) return 'image';
  return 'download';
}

export const fileSize = (n: number) => (n < 1024 ? `${n} bytes` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
export const documentHref = (id: string) => `/documents/${id}`;

/** A safe name for the Content-Disposition header. */
export const downloadName = (name: string) => name.replace(/[^\w.\- ]/g, '_').slice(0, 150) || 'file';
