'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { submitLead, type LeadFormState } from '@/app/site/lead-actions';
import { contactTopics, HONEYPOT, propertyConditions, propertyKinds, sellTimelines } from '@/lib/site-leads';
import { readSource } from './SourceTracker';

function Pills({ name, label, options }: { name: string; label: string; options: readonly { key: string; label: string }[] }) {
  return (
    <fieldset className="pills">
      <legend>{label}</legend>
      <div className="opts">
        {options.map((o) => (
          <label key={o.key}><input type="radio" name={name} value={o.key} /><span>{o.label}</span></label>
        ))}
      </div>
    </fieldset>
  );
}

/** Contact Us or Sell Us Your Property. Saved as a website lead; a clear thank-you after. */
export function LeadForm({ kind }: { kind: 'contact' | 'sell' }) {
  const [state, run, pending] = useActionState<LeadFormState, FormData>(submitLead, null);
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state?.ok) done.current?.focus(); }, [state]);
  if (state?.ok) {
    return (
      <div className="thanks" role="status" tabIndex={-1} ref={done}>
        <h2>Thank You</h2>
        <p>{state.ok}</p>
      </div>
    );
  }
  return (
    <form
      className="lead-form"
      onSubmit={(e) => {
        const d = new FormData(e.currentTarget);
        d.set('src', readSource());
        d.set('page', location.pathname);
        e.preventDefault();
        startTransition(() => run(d));
      }}
      action={run}
    >
      <input type="hidden" name="kind" value={kind} />
      {/* People never see this field; bots fill it in. */}
      <div className="hp" aria-hidden="true">
        <label>Company Website<input name={HONEYPOT} tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state?.error ? <div className="form-error" role="alert">{state.error}</div> : null}
      <div className="row2">
        <label className="fld">Your Name<input name="name" required autoComplete="name" maxLength={120} /></label>
        <label className="fld">Email<input name="email" type="email" autoComplete="email" maxLength={200} /></label>
      </div>
      <div className="row2">
        <label className="fld">Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
        {kind === 'sell' ? <label className="fld">Asking Price <span className="opt">(optional)</span><input name="askingPrice" maxLength={60} inputMode="decimal" /></label> : <span />}
      </div>
      <p className="hint">An email or a phone number is enough; whichever you prefer.</p>
      {kind === 'sell' ? (
        <>
          <div className="row2">
            <label className="fld">Property Address<input name="propertyAddress" required autoComplete="street-address" maxLength={200} /></label>
            <label className="fld">City<input name="propertyCity" autoComplete="address-level2" maxLength={80} /></label>
          </div>
          <Pills name="propertyKind" label="What Kind of Property" options={propertyKinds} />
          <Pills name="condition" label="Its Condition" options={propertyConditions} />
          <Pills name="timeline" label="When You’d Like to Sell" options={sellTimelines} />
          <label className="fld">Anything Else We Should Know <span className="opt">(optional)</span><textarea name="message" rows={5} maxLength={5000} /></label>
        </>
      ) : (
        <>
          <Pills name="topic" label="What It’s About" options={contactTopics} />
          <label className="fld">Your Message<textarea name="message" rows={6} required maxLength={5000} /></label>
        </>
      )}
      <button type="submit" className="btnlink" disabled={pending}>{pending ? 'Sending…' : kind === 'sell' ? 'Send the Property' : 'Send the Message'}</button>
    </form>
  );
}
