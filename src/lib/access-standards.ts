import 'server-only';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { appSettings } from '@/db/schema';
import type { RoleStandards } from './permissions';
import type { PartnerStandards } from './guests';

// The owner's standard access per user type (owner, Oct 2, 2026: "I should be
// able to set what people see also by user type if I choose as a standard").
export const STANDARDS_KEY = 'access_standards';
export const STANDARDS_TAG = 'access-standards';
export type Standards = { roles: RoleStandards; partners: PartnerStandards };

export const readStandards = unstable_cache(async (): Promise<Standards> => {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, STANDARDS_KEY));
  const v = (row?.value ?? {}) as Partial<Standards>;
  return { roles: v.roles ?? {}, partners: v.partners ?? {} };
}, [STANDARDS_KEY], { tags: [STANDARDS_TAG], revalidate: 300 });
