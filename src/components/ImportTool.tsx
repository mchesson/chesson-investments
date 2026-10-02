'use client';

import { useState } from 'react';
import type { Summary } from '@/app/(app)/import-actions';

/** One request to /api/import; a failure says exactly what happened, never "Working…" forever. */
async function send(mode: 'preview' | 'apply', text: string, ms: number): Promise<Summary> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(`/api/import?mode=${mode}`, { method: 'POST', body: text, headers: { 'Content-Type': 'text/plain' }, signal: ctl.signal });
    const body = await r.text();
    try { return JSON.parse(body) as Summary; } catch { return { error: `The app answered ${r.status} ${r.statusText || ''}: ${body.slice(0, 200) || 'no message'}` }; }
  } catch (e) {
    return { error: ctl.signal.aborted ? `No answer after ${ms / 1000} seconds. Tell Claude the time you tried (${new Date().toLocaleTimeString()}).` : `The request didn’t go through (${e instanceof Error ? e.message : 'network error'}).` };
  } finally { clearTimeout(timer); }
}

export function ImportTool() {
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sum, setSum] = useState<Summary | null>(null);
  const [pending, setPending] = useState(false);
  const run = async (mode: 'preview' | 'apply', t: string) => { setPending(true); setSum(await send(mode, t, mode === 'apply' ? 150_000 : 60_000)); setPending(false); };
  return (
    <div className="stack-form">
      <label className="f">Import File (.json)<input type="file" accept=".json,application/json" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const t = await f.text(); setText(t); setName(f.name); setSum(null);
        void run('preview', t);
      }} /></label>
      {pending ? <p className="muted">Working…</p> : null}
      {sum?.error ? <div className="notice error">{sum.error}</div> : null}
      {sum?.done ? <div className="notice">{sum.done}</div> : null}
      {sum?.counts ? (
        <>
          <table className="t"><thead><tr><th></th><th className="num">New</th><th className="num">Already on File</th></tr></thead>
            <tbody>{sum.counts.map((c) => <tr key={c.label}><td>{c.label}</td><td className="num">{c.add}</td><td className="num">{c.match}</td></tr>)}</tbody></table>
          {sum.problems?.length ? <div className="notice warn"><strong>Check:</strong><ul>{sum.problems.map((p, i) => <li key={i}>{p}</li>)}</ul></div> : null}
          <details className="fold"><summary>People ({sum.people?.length ?? 0})</summary><ul className="small">{sum.people?.map((p, i) => <li key={i}>{p.name}{p.role ? ` · ${p.role}` : ''}{p.match ? ` · ${p.match}` : ''}</li>)}</ul></details>
          {sum.photos?.length ? <details className="fold"><summary>Photos ({sum.photos.length})</summary><ul className="small">{sum.photos.map((f, i) => <li key={i}>{f.label} · {f.status}</li>)}</ul></details> : null}
          <details className="fold"><summary>Bills ({sum.bills?.length ?? 0})</summary><ul className="small">{sum.bills?.map((b, i) => <li key={i}>{b.label}: ${Number(b.total).toLocaleString('en-US', { minimumFractionDigits: 2 })} · {b.status}</li>)}</ul></details>
          {!sum.done && text ? (
            <div className="form-actions">
              <button className="btn" type="button" disabled={pending} onClick={() => { if (confirm(`Import ${name}? Everything is added in one step and recorded in History.`)) void run('apply', text); }}>Import It</button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
