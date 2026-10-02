'use client';

import { useState } from 'react';
import type { BillMatch } from '@/app/(app)/import-actions';

/** Preview which bills link to which company or person, then link them in one step. */
export function MatchBills({ preview, apply }: { preview: () => Promise<{ rows: BillMatch[] }>; apply: () => Promise<{ rows: BillMatch[]; done: string }> }) {
  const [rows, setRows] = useState<BillMatch[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<{ rows: BillMatch[]; done?: string }>) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setRows(r.rows); if (r.done) setMsg(r.done); }
    catch { setMsg('The app couldn’t answer. Reload the page and try again.'); }
    setBusy(false);
  };
  const ready = rows?.filter((r) => r.to) ?? [];
  const left = rows?.filter((r) => !r.to) ?? [];
  const money = (s: string) => `$${Number(s).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <div className="stack-form">
      <div className="form-actions"><button className="btn secondary" type="button" disabled={busy} onClick={() => run(preview)}>{busy ? 'Working…' : rows ? 'Check Again' : 'Find Bills to Link'}</button></div>
      {msg ? <div className="notice" role="status">{msg}</div> : null}
      {rows ? (
        <>
          {ready.length ? (
            <>
              <table className="t"><thead><tr><th>Name on the Bills</th><th>Links To</th><th className="num">Bills</th><th className="num">Total</th></tr></thead>
                <tbody>{ready.map((r) => <tr key={r.vendor}><td>{r.vendor}</td><td>{r.to} <span className="small muted">({r.kind}, {r.how})</span></td><td className="num">{r.count}</td><td className="num">{money(r.total)}</td></tr>)}</tbody></table>
              <div className="form-actions"><button className="btn" type="button" disabled={busy} onClick={() => { if (confirm(`Link ${ready.reduce((n, r) => n + r.count, 0)} bills? Each is recorded in History.`)) run(apply); }}>Link Them</button></div>
            </>
          ) : <p className="muted">Nothing to link right now.</p>}
          {left.length ? (
            <details className="fold"><summary>Not matched to anyone ({left.length} names)</summary>
              <p className="small muted">Add the company (or person) with this name, or one it starts with, then check again. Store receipts like “Staging Items” can stay as they are.</p>
              <ul className="small">{left.map((r) => <li key={r.vendor}>{r.vendor}: {r.count} {r.count === 1 ? 'bill' : 'bills'}, {money(r.total)}</li>)}</ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
