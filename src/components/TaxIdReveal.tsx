'use client';
// Shows a tax ID for 30 seconds when asked (each Show is written to History).
import { useEffect, useState } from 'react';
import { revealTaxId } from '@/app/(app)/entity-actions';

export function TaxIdReveal({ id, last4 }: { id: string; last4: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!value) return; const t = setTimeout(() => setValue(null), 30_000); return () => clearTimeout(t); }, [value]);
  async function show() {
    setBusy(true); setMsg(null);
    const r = await revealTaxId(id);
    setBusy(false);
    if (r.value) setValue(r.value); else setMsg(r.error ?? 'Couldn’t show it.');
  }
  return (
    <span className="tax-id">
      <code className="tax-id-value" aria-live="polite">{value ?? `•••• ${last4}`}</code>{' '}
      {value ? (
        <>
          <button type="button" className="btn small secondary" onClick={() => navigator.clipboard?.writeText(value).catch(() => {})}>Copy</button>{' '}
          <button type="button" className="btn small secondary" onClick={() => setValue(null)}>Hide</button>
        </>
      ) : <button type="button" className="btn small secondary" disabled={busy} onClick={show}>{busy ? 'Showing…' : 'Show'}</button>}
      {msg ? <span className="small red"> {msg}</span> : null}
    </span>
  );
}
