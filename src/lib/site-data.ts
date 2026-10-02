import 'server-only';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { db } from '@/db';
import { files, projects } from '@/db/schema';
import { sortProjects, toPublicProject, type PublicProject } from './site';

// Reads for the public website. Every project goes through toPublicProject (the
// allowlist); a photo is served only when its project is published and it's marked.

const cols = {
  id: projects.id, name: projects.name, address: projects.address, city: projects.city, state: projects.state, zip: projects.zip,
  heatedSf: projects.heatedSf, lotAcres: projects.lotAcres, siteStatus: projects.siteStatus, siteSlug: projects.siteSlug,
  sitePrice: projects.sitePrice, siteTagline: projects.siteTagline, siteDescription: projects.siteDescription,
  siteBeds: projects.siteBeds, siteBaths: projects.siteBaths, siteDetails: projects.siteDetails, siteTeam: projects.siteTeam,
  siteFeatured: projects.siteFeatured, siteSort: projects.siteSort,
};

async function photosFor(ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; photoKind: string | null; caption: string | null; onSite: boolean }[]>();
  const rows = await db.select({ id: files.id, entityId: files.entityId, photoKind: files.photoKind, caption: files.caption, onSite: files.onSite })
    .from(files).where(and(eq(files.entity, 'project'), inArray(files.entityId, ids), eq(files.onSite, true), isNull(files.archived)))
    .orderBy(asc(files.sort), asc(files.created));
  const m = new Map<string, typeof rows>();
  for (const r of rows) m.set(r.entityId, [...(m.get(r.entityId) ?? []), r]);
  return m;
}

async function readPublishedProjects(): Promise<PublicProject[]> {
  const rows = await db.select(cols).from(projects).where(and(isNotNull(projects.siteStatus), isNull(projects.archived)));
  const ph = await photosFor(rows.map((r) => r.id));
  const out = rows.flatMap((r) => {
    const p = toPublicProject(r, ph.get(r.id) ?? []);
    return p ? [{ ...p, sort: r.siteSort }] : [];
  });
  return sortProjects(out);
}

async function readPublishedProject(slug: string): Promise<PublicProject | null> {
  const [r] = await db.select(cols).from(projects).where(and(eq(projects.siteSlug, slug), isNotNull(projects.siteStatus), isNull(projects.archived)));
  if (!r) return null;
  return toPublicProject(r, (await photosFor([r.id])).get(r.id) ?? []);
}

/** A photo, only if it's marked for the website and its project is published. */
async function readPublicPhoto(id: string) {
  const [f] = await db.select().from(files).where(and(eq(files.id, id), eq(files.entity, 'project'), eq(files.onSite, true), isNull(files.archived)));
  if (!f || !f.contentType.startsWith('image/')) return null;
  const [p] = await db.select(cols).from(projects).where(and(eq(projects.id, f.entityId), isNull(projects.archived)));
  if (!p || !toPublicProject(p, [{ id: f.id, photoKind: f.photoKind, caption: f.caption, onSite: true }])) return null;
  return f;
}

// The website is read from a cache (5 minutes; Website tab saves and imports
// clear it at once with SITE_TAG), so visitors don't each open a database
// connection: the pooler's session mode allows only 15 at a time.
export const SITE_TAG = 'site';
const cached = { tags: [SITE_TAG], revalidate: 300 };
export const publishedProjects = unstable_cache(readPublishedProjects, ['site-projects'], cached);
export const publishedProject = unstable_cache(readPublishedProject, ['site-project'], cached);
/** The photo's record (its bytes come from storage, or the row when storage is off). */
export const publicPhoto = unstable_cache(async (id: string) => {
  const f = await readPublicPhoto(id);
  return f ? { contentType: f.contentType, storagePath: f.storagePath, data: f.data ? f.data.toString('base64') : null } : null;
}, ['site-photo'], cached);

/** Every photo on a project, for its Website tab (signed-in staff). */
export function projectPhotos(projectId: string) {
  return db.select({ id: files.id, name: files.name, caption: files.caption, photoKind: files.photoKind, onSite: files.onSite, sort: files.sort, sourceUrl: files.sourceUrl, contentType: files.contentType })
    .from(files).where(and(eq(files.entity, 'project'), eq(files.entityId, projectId), isNull(files.archived)))
    .orderBy(asc(files.sort), asc(files.created));
}
