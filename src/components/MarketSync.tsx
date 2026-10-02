'use client';
// Update Market Data: reads a county's sales a page at a time, with progress.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { placeOurPlaces, startMarketSync, stepMarketSync, updateFeed, type SyncState } from '@/app/(app)/market-actions';

const counties = [{ key: 'wake', label: 'Wake County' }, { key: 'durham', label: 'Durham County' }] as const;
const feeds = [
  { key: 'rates', label: 'Mortgage Rates', button: 'Update Rates', what: 'the 30-year rate each week (Federal Reserve, free)' },
  { key: 'redfin', label: 'Redfin Market Data', button: 'Update Redfin Data', what: 'days on market, homes for sale and price drops by ZIP code (free; about 2 minutes)' },
  { key: 'permits', label: 'Building Permits', button: 'Update Permits', what: 'new homes and teardowns, Raleigh and Durham (free)' },
] as const;

export function MarketSync({ last }: { last: Record<string, { status: string; finished: string | null; parcels: number; newSales: number; error: string | null } | undefined> }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [prog, setProg] = useState<SyncState | null>(null);

  async function run(county: string) {
    setBusy(county); setMsg(null);
    try {
      let s = await startMarketSync(county);
      while (!('problem' in s) && s.status === 'running') {
        setProg(s);
        s = await stepMarketSync(s.id);
      }
      if ('problem' in s) setMsg(s.problem);
      else if (s.status === 'failed') setMsg(`It stopped: ${s.error}. Press Update again to start over.`);
      else setMsg(`Done: ${s.parcels.toLocaleString()} parcels read, ${s.newSales.toLocaleString()} new sales.`);
    } catch (e) {
      setMsg(`It stopped: ${e instanceof Error ? e.message : e}. Press Update again.`);
    }
    setBusy(null); setProg(null); router.refresh();
  }

  async function feed(key: string) {
    setBusy(key); setMsg(null);
    try {
      const r = await updateFeed(key);
      setMsg(r.ok ?? r.problem ?? null);
    } catch (e) {
      setMsg(`It stopped: ${e instanceof Error ? e.message : e}. Try again.`);
    }
    setBusy(null); router.refresh();
  }

  async function place() {
    setBusy('place');
    await placeOurPlaces();
    setBusy(null); router.refresh();
  }

  return (
    <div className="market-sync">
      <ul className="rows">{counties.map((c) => {
        const l = last[c.key];
        return (
          <li key={c.key} className="sync-row">
            <span className="sync-name"><strong>{c.label}</strong><span className="small muted"> {l ? (l.status === 'done' ? `updated ${l.finished?.slice(0, 10)} · ${l.parcels.toLocaleString()} parcels, ${l.newSales.toLocaleString()} new sales` : l.status === 'failed' ? `last try stopped: ${l.error}` : 'updating…') : 'not loaded yet'}</span></span>
            <button className="btn small" type="button" disabled={!!busy} onClick={() => run(c.key)}>{busy === c.key ? 'Updating…' : `Update ${c.label}`}</button>
          </li>
        );
      })}
      {feeds.map((c) => {
        const l = last[c.key];
        return (
          <li key={c.key} className="sync-row">
            <span className="sync-name"><strong>{c.label}</strong><span className="small muted"> {c.what} · {l ? (l.status === 'done' ? `updated ${l.finished?.slice(0, 10)}, ${l.parcels.toLocaleString()} records` : l.status === 'failed' ? `last try stopped: ${l.error}` : 'updating…') : 'not loaded yet'}</span></span>
            <button className="btn small" type="button" disabled={!!busy} onClick={() => feed(c.key)}>{busy === c.key ? 'Updating…' : c.button}</button>
          </li>
        );
      })}</ul>
      {prog ? (
        <div className="sync-progress" role="status">
          <progress max={prog.total ?? undefined} value={prog.offset} /> <span className="small">{prog.offset.toLocaleString()} of {(prog.total ?? 0).toLocaleString()} records read</span>
        </div>
      ) : null}
      {msg ? <p className="notice" role="status">{msg}</p> : null}
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        The first update reads three years of sales (a few minutes; keep this page open). Later updates read only what’s new.
        Our projects and the watchlist go on the map by their address. <button className="link-btn" type="button" disabled={!!busy} onClick={place}>{busy === 'place' ? 'Placing…' : 'Place them now'}</button>
      </p>
    </div>
  );
}
