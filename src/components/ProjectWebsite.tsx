import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Empty, Section } from './ui';
import { SitePhotoUpload } from './SitePhotoUpload';
import { archivePhoto, saveSite, updatePhoto } from '@/app/(app)/site-actions';
import { projectPhotos } from '@/lib/site-data';
import { photoKindLabel, photoKinds, showsPrice, siteProblems, siteStatusLabel, siteStatuses, slugify } from '@/lib/site';
import { formatDateTime } from '@/lib/format';

type P = {
  id: string; name: string; heatedSf: number | null; lotAcres: string | null;
  siteStatus: string | null; siteSlug: string | null; sitePrice: string | null; siteTagline: string | null; siteDescription: string | null;
  siteBeds: string | null; siteBaths: string | null; siteDetails: string | null; siteTeam: string | null; siteFeatured: boolean; siteSort: number; siteUpdatedAt: Date | null;
};

const num = (v: string | null) => (v == null ? '' : String(Number(v)));

export async function ProjectWebsite({ p, canEdit }: { p: P; canEdit: boolean }) {
  const photos = await projectPhotos(p.id);
  const shown = photos.filter((f) => f.onSite && f.contentType.startsWith('image/'));
  const problems = siteProblems(p, shown.map((f) => ({ kind: f.photoKind })));
  const live = !!p.siteStatus && !problems.length;
  const slug = p.siteSlug ?? slugify(p.name);
  return (
    <div className="stack">
      <Section title="On the Website" kind="blue" hint={p.siteUpdatedAt ? `Updated ${formatDateTime(p.siteUpdatedAt)}` : undefined}>
        {live ? (
          <p><span className="chip blue">{siteStatusLabel(p.siteStatus)}</span> It’s on the website with {shown.length} {shown.length === 1 ? 'photo' : 'photos'}. <Link href={`/site/projects/${slug}`} target="_blank">See the page ›</Link></p>
        ) : p.siteStatus ? (
          <div className="notice warn"><strong>Not showing yet.</strong><ul>{problems.map((x) => <li key={x}>{x}</li>)}</ul></div>
        ) : <p className="muted">Not on the website. Pick a website status below to show it.</p>}
        <p className="small muted">Only what’s on this tab and the photos marked for the website ever show. Costs, bills, notes and the review never do. <Link href="/site" target="_blank">See the whole website ›</Link></p>
      </Section>

      <Section title="The Page" kind="aqua">
        {canEdit ? (
          <ActionForm action={saveSite} submit="Save the Page">
            <input type="hidden" name="projectId" value={p.id} />
            <div className="fields">
              <label className="f">Website Status
                <select name="siteStatus" defaultValue={p.siteStatus ?? ''}>
                  <option value="">Not on the Website</option>
                  {siteStatuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <label className="f">Price<span className="h">Shown only for Coming Soon, For Sale and Under Contract</span><input name="sitePrice" defaultValue={p.sitePrice ? Number(p.sitePrice).toLocaleString('en-US') : ''} placeholder="569,900" /></label>
              <label className="f">Web Address<span className="h">chessoninvestments.com/projects/…</span><input name="siteSlug" defaultValue={slug} /></label>
            </div>
            <label className="f">One Line<span className="h">Under the name, e.g. “A mid-century ranch reimagined from the ground up.”</span><input name="siteTagline" defaultValue={p.siteTagline ?? ''} maxLength={160} /></label>
            <label className="f">Description<textarea name="siteDescription" rows={5} defaultValue={p.siteDescription ?? ''} /></label>
            <div className="fields">
              <label className="f">Bedrooms<input name="siteBeds" inputMode="decimal" defaultValue={num(p.siteBeds)} /></label>
              <label className="f">Bathrooms<input name="siteBaths" inputMode="decimal" defaultValue={num(p.siteBaths)} /></label>
              <label className="f">Order<span className="h">Lower shows first</span><input name="siteSort" type="number" min={0} max={999} defaultValue={p.siteSort} /></label>
            </div>
            <p className="small muted">Square feet ({p.heatedSf ? p.heatedSf.toLocaleString() : 'not set'}) and acres ({p.lotAcres ? Number(p.lotAcres) : 'not set'}) come from the project’s own facts (Edit).</p>
            <label className="check"><input type="checkbox" name="siteFeatured" defaultChecked={p.siteFeatured} /> Feature it first on the home page</label>
            <label className="f">Finishes and Selections<span className="h">A heading line starts with ##, then one “Label: what it is” per line</span>
              <textarea name="siteDetails" rows={10} defaultValue={p.siteDetails ?? ''} placeholder={'## Kitchen\nCabinets: White shaker with oak accent island\nCounters: Silestone quartz'} /></label>
            <label className="f">Project Team<span className="h">One per line: Role | Company | What they did. A general contractor first is shown large.</span>
              <textarea name="siteTeam" rows={8} defaultValue={p.siteTeam ?? ''} placeholder={'General Contractor | Luxury Oaks Custom Builders | Jason Burnette\nElectrical | G.L. Price Electrical | Full rewire'} /></label>
          </ActionForm>
        ) : (
          <p>{siteStatusLabel(p.siteStatus)}{p.sitePrice && showsPrice(p.siteStatus) ? ` · $${Number(p.sitePrice).toLocaleString('en-US')}` : ''}</p>
        )}
      </Section>

      <Section title="Photos" kind="energy" hint={`${photos.length} in all · ${shown.length} on the website`}>
        {photos.length ? (
          <div className="photos">
            {photos.map((f) => (
              <figure key={f.id}>
                <a href={`/documents/${f.id}`}><img src={`/files/${f.id}`} alt={f.caption ?? f.name} loading="lazy" /></a>
                <figcaption>
                  {photoKindLabel(f.photoKind)} · {f.onSite ? <strong>On the website</strong> : 'Not shown'}{f.caption ? ` · ${f.caption}` : ''}
                </figcaption>
                {canEdit ? (
                  <details className="fold">
                    <summary>Change</summary>
                    <ActionForm action={updatePhoto} submit="Save">
                      <input type="hidden" name="fileId" value={f.id} />
                      <label className="f">They Are<select name="kind" defaultValue={f.photoKind ?? 'after'}>{photoKinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select></label>
                      <label className="f">Caption<input name="caption" defaultValue={f.caption ?? ''} maxLength={120} /></label>
                      <label className="f">Order<input name="sort" type="number" min={0} max={999} defaultValue={f.sort} /></label>
                      <label className="check"><input type="checkbox" name="onSite" defaultChecked={f.onSite} /> On the website</label>
                    </ActionForm>
                    <form action={archivePhoto.bind(null, f.id)} style={{ marginTop: 6 }}><button className="link-btn small" type="submit">Take this photo away</button></form>
                  </details>
                ) : null}
              </figure>
            ))}
          </div>
        ) : <Empty>No photos yet.</Empty>}
      </Section>
      {canEdit ? <Section title="Add Photos" kind="energy"><SitePhotoUpload projectId={p.id} /></Section> : null}
    </div>
  );
}
