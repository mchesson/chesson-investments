'use client';

import { useState, useTransition } from 'react';
import type { Summary } from '@/app/(app)/import-actions';

export function ImportTool({ preview, apply }: { preview: (t: string) => Promise<Summary>; apply: (t: string) => Promise<Summary> }) {
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [sum, setSum] = useState<Summary | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="stack-form">
      <label className="f">Import File (.json)<input type="file" accept=".json,application/json" onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const t = await f.text(); setText(t); setName(f.name); setSum(null);
        start(async () => setSum(await preview(t)));
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
          <details className="fold"><summary>Bills ({sum.bills?.length ?? 0})</summary><ul className="small">{sum.bills?.map((b, i) => <li key={i}>{b.label}: ${Number(b.total).toLocaleString('en-US', { minimumFractionDigits: 2 })} · {b.status}</li>)}</ul></details>
          {!sum.done && text ? (
            <div className="form-actions">
              <button className="btn" type="button" disabled={pending} onClick={() => { if (confirm(`Import ${name}? Everything is added in one step and recorded in History.`)) start(async () => setSum(await apply(text))); }}>Import It</button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
