import 'server-only';
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
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

export async function publishedProjects(): Promise<PublicProject[]> {
  const rows = await db.select(cols).from(projects).where(and(isNotNull(projects.siteStatus), isNull(projects.archived)));
  const ph = await photosFor(rows.map((r) => r.id));
  const out = rows.flatMap((r) => {
    const p = toPublicProject(r, ph.get(r.id) ?? []);
    return p ? [{ ...p, sort: r.siteSort }] : [];
  });
  return sortProjects(out);
}

export async function publishedProject(slug: string): Promise<PublicProject | null> {
  const [r] = await db.select(cols).from(projects).where(and(eq(projects.siteSlug, slug), isNotNull(projects.siteStatus), isNull(projects.archived)));
  if (!r) return null;
  return toPublicProject(r, (await photosFor([r.id])).get(r.id) ?? []);
}

/** A photo, only if it's marked for the website and its project is published. */
export async function publicPhoto(id: string) {
  const [f] = await db.select().from(files).where(and(eq(files.id, id), eq(files.entity, 'project'), eq(files.onSite, true), isNull(files.archived)));
  if (!f || !f.contentType.startsWith('image/')) return null;
  const [p] = await db.select(cols).from(projects).where(and(eq(projects.id, f.entityId), isNull(projects.archived)));
  if (!p || !toPublicProject(p, [{ id: f.id, photoKind: f.photoKind, caption: f.caption, onSite: true }])) return null;
  return f;
}

/** Every photo on a project, for its Website tab (signed-in staff). */
export function projectPhotos(projectId: string) {
  return db.select({ id: files.id, name: files.name, caption: files.caption, photoKind: files.photoKind, onSite: files.onSite, sort: files.sort, sourceUrl: files.sourceUrl, contentType: files.contentType })
    .from(files).where(and(eq(files.entity, 'project'), eq(files.entityId, projectId), isNull(files.archived)))
    .orderBy(asc(files.sort), asc(files.created));
}
