import 'server-only';
import type { Reader } from '@/db';
import { db } from '@/db';
import { auditLog } from '@/db/schema';

export type AuditEntry = {
  userId: string | null;
  entity: string;
  entityId: string | null;
  action: string;
  summary: string;
  via?: string;
  before?: unknown;
  after?: unknown;
};

/** Every create, edit, archive and sensitive view is written here. Never edited or deleted. */
export async function audit(e: AuditEntry, x: Reader = db) {
  await x.insert(auditLog).values({
    userId: e.userId, entity: e.entity, entityId: e.entityId, action: e.action,
    summary: e.summary, via: e.via ?? 'screen', before: e.before ?? null, after: e.after ?? null,
  });
}

/** Only the fields that changed, as { before, after }. */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of Object.keys(after)) {
    const x = before[k] ?? null;
    const y = after[k] ?? null;
    if (String(x) !== String(y)) { b[k] = x; a[k] = y; }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
