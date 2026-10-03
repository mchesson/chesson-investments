import { Suspense } from 'react';
import { zoningAt } from '@/lib/zoning-data';
import { zoningFamilyLabel } from '@/lib/zoning';

// The zoning at a property, from the county map (Wake or Durham), beside what
// we typed. Streams in, so a slow county map never holds up the page.
async function ZoningValue({ lat, lng, typed }: { lat: string | number | null; lng: string | number | null; typed: string | null }) {
  const z = await zoningAt(lat, lng);
  if (!z) return <>{typed ?? <span className="muted">{lat && lng ? 'Not on the Wake or Durham zoning maps' : 'Add the location to look it up'}</span>}</>;
  const differs = typed && typed.replace(/\s/g, '').toUpperCase() !== z.code.replace(/\s/g, '').toUpperCase();
  return (
    <span className="zoning-fact">
      <strong>{z.code}</strong> · {z.label} <span className="chip blue">{zoningFamilyLabel(z.family)}</span>
      <span className="small muted"> ({z.place}, county zoning map)</span>
      <span className="small" style={{ display: 'block' }}>{z.detail}{z.overlays.length ? ` Overlays: ${z.overlays.join(', ')}.` : ''}{z.ordinance ? <> <a href={z.ordinance} target="_blank" rel="noreferrer">{z.place}’s rules</a></> : null}</span>
      {differs ? <span className="small red" style={{ display: 'block' }}>We have {typed} on file: check which is right.</span> : null}
    </span>
  );
}

export function ZoningFact(props: { lat: string | number | null; lng: string | number | null; typed: string | null }) {
  return <Suspense fallback={<span className="muted">Checking the county zoning map…</span>}><ZoningValue {...props} /></Suspense>;
}
