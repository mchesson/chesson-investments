'use client';

import { useId, useMemo, useRef, useState } from 'react';

export type PickOption = { id: string; label: string; sub?: string | null };

/**
 * Type a few letters, pick from the matches (owner, Oct 3, 2026: "we should
 * select a vendor from a form each time ... it should not show all vendors in a
 * list"). The chosen id goes in a hidden field named `name`.
 */
export function SearchPicker(props: {
  name: string; label: string; options: PickOption[]; placeholder?: string; required?: boolean; defaultId?: string | null; hint?: string; max?: number;
}) {
  const start = props.options.find((o) => o.id === props.defaultId) ?? null;
  const [picked, setPicked] = useState<PickOption | null>(start);
  const [text, setText] = useState(start?.label ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = useMemo(() => {
    if (!words.length) return [];
    return props.options.filter((o) => {
      const hay = `${o.label} ${o.sub ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, props.max ?? 8);
  }, [props.options, props.max, words.join(' ')]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (o: PickOption) => { setPicked(o); setText(o.label); setOpen(false); };
  const showList = open && words.length > 0 && !(picked && picked.label === text);
  return (
    <label className="f picker">
      {props.label}{props.hint ? <span className="h">{props.hint}</span> : null}
      <input
        ref={input} role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
        value={text} placeholder={props.placeholder ?? 'Type a name'} autoComplete="off" required={props.required}
        onChange={(e) => { setText(e.target.value); setPicked(null); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active]); }
          else if (e.key === 'Escape') { setOpen(false); }
        }}
      />
      <input type="hidden" name={props.name} value={picked?.id ?? ''} />
      {showList ? (
        <ul id={listId} role="listbox" className="picker-list">
          {matches.length ? matches.map((o, i) => (
            <li key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }} onMouseEnter={() => setActive(i)}>
              <strong>{o.label}</strong>{o.sub ? <span className="small muted"> · {o.sub}</span> : null}
            </li>
          )) : <li className="muted small" aria-disabled="true">No match. Check the spelling, or add them first.</li>}
        </ul>
      ) : null}
      {picked ? <span className="small muted picker-picked">Picked: {picked.label}{picked.sub ? ` · ${picked.sub}` : ''}</span> : null}
    </label>
  );
}
