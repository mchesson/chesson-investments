'use client';

import { useEffect, useSyncExternalStore } from 'react';

// Every save says how it went (owner, Oct 3, 2026: "when you save something it
// should confirm it was successful or if it sends something out it should say
// that or if there is an error it should say that as well"). One message box at
// the bottom of the screen; it lives in the app layout, so it stays through a
// save that moves to another page.

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
let items: Toast[] = [];
let next = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function toast(text: string, kind: 'ok' | 'error' = 'ok') {
  const t = { id: next++, text, kind };
  items = [...items.filter((x) => x.text !== text), t].slice(-3);
  emit();
  // Errors stay until closed; good news goes after a few seconds.
  if (kind === 'ok') setTimeout(() => dismiss(t.id), 6000);
}
function dismiss(id: number) { items = items.filter((x) => x.id !== id); emit(); }

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function ToastHost() {
  const list = useSyncExternalStore(subscribe, () => items, () => items);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && items.length) { items = []; emit(); } };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <span className="toast-icon" aria-hidden>{t.kind === 'error' ? '!' : '✓'}</span>
          <span className="toast-text">{t.text}</span>
          <button type="button" className="toast-x" aria-label="Close" onClick={() => dismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

/** A server action's own error, or a plain sentence when it threw (never a stack trace). */
export function failure(e: unknown) {
  const d = (e as { digest?: string })?.digest ?? '';
  if (d.startsWith('NEXT_REDIRECT') || d.startsWith('NEXT_HTTP_ERROR_FALLBACK') || d === 'NEXT_NOT_FOUND') return null;
  return 'Something went wrong, so it wasn’t saved. Try again; if it keeps happening, tell Claude what you were doing.';
}
