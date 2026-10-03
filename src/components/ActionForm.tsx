'use client';

import { startTransition, useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { failure, toast } from './Toast';

export type FormResult = { error?: string; ok?: string; link?: string } | null | undefined | void;
type Action = (prev: FormResult, data: FormData) => Promise<FormResult>;

/**
 * A form for a Server Action: shows its error or message; resets after a success when asked.
 * Submitted by hand (not the form's action prop) so an error keeps what was typed:
 * React otherwise clears the form after every submit.
 */
export function ActionForm(props: {
  action: Action; children: ReactNode; className?: string; resetOnOk?: boolean; confirm?: string; submit?: string; submitClass?: string;
  /** What to say when it worked and the action moved on to another page. */
  saved?: string;
}) {
  // Every save says how it went, in the message box at the bottom of the screen
  // too: said as soon as the answer comes, even if the form then goes away.
  const awaiting = useRef(false);
  const savedMsg = useRef(props.saved ?? 'Saved.');
  savedMsg.current = props.saved ?? 'Saved.';
  // A thrown error (a bug, the database down) becomes a plain message instead of an error page.
  const [state, run, pending] = useActionState(async (prev: FormResult, data: FormData): Promise<FormResult> => {
    let r: FormResult;
    try { r = await props.action(prev, data); } catch (e) { const m = failure(e); if (!m) throw e; r = { error: m }; }
    awaiting.current = false;
    if (r && r.error) toast(r.error, 'error'); else toast((r && r.ok) || savedMsg.current);
    return r;
  }, null);
  // A save that goes on to another page never comes back with a message: it worked.
  useEffect(() => () => { if (awaiting.current) toast(savedMsg.current); }, []);
  const ref = useRef<HTMLFormElement>(null);
  // Until the page is ready the button waits: a press before then would reload
  // the page with what was typed in the address bar, and save nothing.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // After a save that worked, clear the form as React would; after an error, keep what was typed.
  const submitted = useRef(false);
  useEffect(() => {
    if (pending || !submitted.current) return;
    submitted.current = false;
    if (!state?.error) ref.current?.reset();
  }, [pending, state]);
  return (
    <form
      ref={ref}
      className={props.className ?? 'stack-form'}
      onSubmit={(e) => {
        e.preventDefault();
        if (props.confirm && !window.confirm(props.confirm)) return;
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        submitted.current = true;
        awaiting.current = true;
        startTransition(() => run(data));
      }}
    >
      {state?.error ? <div className="notice error" role="alert">{state.error}</div> : null}
      {state?.ok ? <div className="notice" role="status">{state.ok}</div> : null}
      {state?.link ? (
        <div className="copy-link">
          <input readOnly value={state.link} aria-label="Sign-in link" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn small" onClick={() => { navigator.clipboard?.writeText(state.link!).catch(() => {}); }}>Copy the Link</button>
        </div>
      ) : null}
      {props.children}
      {props.submit ? (
        <div className="form-actions">
          <button className={props.submitClass ?? 'btn'} type="submit" disabled={pending || !ready}>{pending ? 'Saving…' : props.submit}</button>
        </div>
      ) : null}
    </form>
  );
}
