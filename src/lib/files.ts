import 'server-only';
import { createHash } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, type Reader } from '@/db';
import { files } from '@/db/schema';
import { detectFile, MAX_FILE } from './file-rules';
import { putObject, storageOn } from './storage';

export async function saveFile(
  f: File, owner: { entity: string; entityId: string }, userId: string, opts: { caption?: string | null; imagesOnly?: boolean } = {}, x: Reader = db,
): Promise<{ id: string } | { error: string }> {
  if (!f || f.size === 0) return { error: 'Pick a file.' };
  if (f.size > MAX_FILE) return { error: 'Files can be up to 4 MB.' };
  const buf = Buffer.from(await f.arrayBuffer());
  const kind = detectFile(buf);
  if (!kind || (opts.imagesOnly && !kind.image)) return { error: opts.imagesOnly ? 'Photos must be JPEG, PNG, WebP or HEIC.' : 'Files must be a PDF or a photo (JPEG, PNG, WebP, HEIC).' };
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const [dup] = await x.select({ id: files.id }).from(files)
    .where(and(eq(files.entity, owner.entity), eq(files.entityId, owner.entityId), eq(files.sha256, sha256), isNull(files.archived)));
  if (dup) return { error: 'That file is already here.' };
  const [row] = await x.insert(files).values({
    ...owner, name: f.name.slice(0, 200) || `file.${kind.ext}`, contentType: kind.type, size: buf.length, sha256,
    data: storageOn() ? null : buf, caption: opts.caption ?? null, uploadedBy: userId,
  }).returning({ id: files.id });
  if (storageOn()) {
    const path = `${owner.entity}/${row.id}.${kind.ext}`;
    await putObject(path, buf, kind.type);
    await x.update(files).set({ storagePath: path }).where(eq(files.id, row.id));
  }
  return { id: row.id };
}

export function filesFor(entity: string, entityId: string) {
  return db.select({ id: files.id, name: files.name, contentType: files.contentType, size: files.size, caption: files.caption, created: files.created })
    .from(files).where(and(eq(files.entity, entity), eq(files.entityId, entityId), isNull(files.archived))).orderBy(desc(files.created));
}
