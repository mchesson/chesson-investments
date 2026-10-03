'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { quickAddCompany, quickAddPerson, type QuickAddResult } from '@/app/(app)/quick-add-actions';
import { toast } from './Toast';

export type PickOption = { id: string; label: string; sub?: string | null };
/** What "+ Add" makes: a person, a company, or either (a vendor box); the prefixes are what the box's ids start with ("p:", "c:"). */
export type AddKind = { kind: 'person' | 'company' | 'either'; personPrefix?: string; companyPrefix?: string };

/**
 * Type a few letters, pick from the matches (owner, Oct 3, 2026: "we should
 * select a vendor from a form each time ... it should not show all vendors in a
 * list"). The chosen id goes in a hidden field named `name`. With `add`, a
 * "+ Add" choice opens a small form right there, saves the new person or
 * company and picks it, without leaving the page ("the entire system should
 * work more smoothly like that").
 */
export function SearchPicker(props: {
  name: string; label: string; options: PickOption[]; placeholder?: string; required?: boolean; defaultId?: string | null; hint?: string; max?: number;
  add?: AddKind;
}) {
  const [extra, setExtra] = useState<PickOption[]>([]);
  const options = useMemo(() => [...extra, ...props.options], [extra, props.options]);
  const start = props.options.find((o) => o.id === props.defaultId) ?? null;
  const [picked, setPicked] = useState<PickOption | null>(start);
  const [text, setText] = useState(start?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState<'person' | 'company' | null>(null);
  const listId = useId();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = useMemo(() => {
    if (!words.length) return [];
    return options.filter((o) => {
      const hay = `${o.label} ${o.sub ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, props.max ?? 8);
  }, [options, props.max, words.join(' ')]); // eslint-disable-line react-hooks/exhaustive-deps
  const exact = matches.some((o) => o.label.toLowerCase() === text.trim().toLowerCase());
  const addChoices: ('person' | 'company')[] = !props.add || !words.length || exact ? [] : props.add.kind === 'either' ? ['company', 'person'] : [props.add.kind];
  const count = matches.length + addChoices.length;
  const choose = (o: PickOption) => { setPicked(o); setText(o.label); setOpen(false); setAdding(null); };
  const startAdd = (k: 'person' | 'company') => { setAdding(k); setOpen(false); };
  const showList = open && words.length > 0 && !(picked && picked.label === text);
  return (
    <div className="f picker">
      <label htmlFor={inputId}>{props.label}{props.hint ? <span className="h">{props.hint}</span> : null}</label>
      <input
        id={inputId} ref={input} role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList && active < count ? `${listId}-${active}` : undefined}
        value={text} placeholder={props.placeholder ?? 'Type a name'} autoComplete="off" required={props.required}
        onChange={(e) => { setText(e.target.value); setPicked(null); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, count - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && active < count) {
            e.preventDefault();
            if (active < matches.length) choose(matches[active]); else startAdd(addChoices[active - matches.length]);
          } else if (e.key === 'Escape') { setOpen(false); }
        }}
      />
      <input type="hidden" name={props.name} value={picked?.id ?? ''} />
      {showList ? (
        <ul id={listId} role="listbox" className="picker-list">
          {matches.map((o, i) => (
            <li key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}>
              <strong>{o.label}</strong>{o.sub ? <span className="small muted"> · {o.sub}</span> : null}
            </li>
          ))}
          {addChoices.map((k, j) => (
            <li key={k} id={`${listId}-${matches.length + j}`} role="option" aria-selected={matches.length + j === active} className="picker-add"
              onMouseDown={(e) => { e.preventDefault(); startAdd(k); }} onMouseEnter={() => setActive(matches.length + j)}>
              + Add “{text.trim()}” as a new {k}
            </li>
          ))}
          {!count ? <li className="muted small" aria-disabled="true">No match. Check the spelling, or add them first.</li> : null}
        </ul>
      ) : null}
      {picked ? <span className="small muted picker-picked">Picked: {picked.label}{picked.sub ? ` · ${picked.sub}` : ''}</span> : null}
      {adding && props.add ? (
        <QuickAdd kind={adding} typed={text.trim()} prefix={adding === 'person' ? props.add.personPrefix ?? '' : props.add.companyPrefix ?? ''}
          onDone={(o) => { setExtra((x) => [o, ...x.filter((y) => y.id !== o.id)]); choose(o); }} onCancel={() => setAdding(null)} />
      ) : null}
    </div>
  );
}

/** The small form "+ Add" opens. Not a <form>: it sits inside the page's own form. */
function QuickAdd({ kind, typed, prefix, onDone, onCancel }: { kind: 'person' | 'company'; typed: string; prefix: string; onDone: (o: PickOption) => void; onCancel: () => void }) {
  const parts = typed.split(/\s+/);
  const [f, setF] = useState<Record<string, string>>(kind === 'person'
    ? { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' '), company: '', phone: '', email: '' }
    : { name: typed, phone: '' });
  const [busy, setBusy] = useState(false);
  const [like, setLike] = useState<PickOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const field = (k: string, label: string, type = 'text') => (
    <label className="f" htmlFor={`${id}-${k}`}>{label}
      <input id={`${id}-${k}`} type={type} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  async function save(different = false) {
    setBusy(true); setError(null);
    try {
      const r: QuickAddResult = kind === 'person'
        ? await quickAddPerson({ firstName: f.firstName, lastName: f.lastName, company: f.company, phone: f.phone, email: f.email, different, prefix })
        : await quickAddCompany({ name: f.name, phone: f.phone, different, prefix });
      if ('error' in r) setError(r.error);
      else if ('like' in r) setLike(r.like);
      else { toast(`Added ${r.option.label}.`); onDone(r.option); }
    } catch { setError('It didn’t save. Try again.'); }
    setBusy(false);
  }
  return (
    <div className="quick-add" role="group" aria-label={`Add a new ${kind}`}>
      <strong>New {kind === 'person' ? 'Person' : 'Company'}</strong>
      <div className="fields">
        {kind === 'person' ? <>{field('firstName', 'First Name')}{field('lastName', 'Last Name')}{field('company', 'Company (optional)')}{field('phone', 'Phone (optional)', 'tel')}{field('email', 'Email (optional)', 'email')}</>
          : <>{field('name', 'Company Name')}{field('phone', 'Main Phone (optional)', 'tel')}</>}
      </div>
      {error ? <div className="notice error" role="alert">{error}</div> : null}
      {like ? (
        <div className="notice" role="status">
          This looks like {like.length === 1 ? 'someone' : 'one of these'} already on file. Pick them instead:
          <ul className="rows">{like.map((o) => <li key={o.id}><button type="button" className="link-btn" onClick={() => onDone(o)}>{o.label}{o.sub ? ` · ${o.sub}` : ''}</button></li>)}</ul>
          <button type="button" className="btn small secondary" disabled={busy} onClick={() => save(true)}>Different {kind === 'person' ? 'Person' : 'Company'}: Add Anyway</button>
        </div>
      ) : null}
      <div className="form-actions">
        <button type="button" className="btn small" disabled={busy} onClick={() => save(false)}>{busy ? 'Saving…' : `Add ${kind === 'person' ? 'Person' : 'Company'}`}</button>
        <button type="button" className="btn small secondary" onClick={onCancel}>Cancel</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Saved now; open their page later to fill in the rest.</p>
    </div>
  );
}
