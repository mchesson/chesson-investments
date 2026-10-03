'use client';

import { useId, useRef, useState } from 'react';
import { suggestAreas } from '@/app/(app)/area-actions';
import { areaSummary, type Areas } from '@/lib/areas';

const fields = [
  { field: 'cities', kind: 'city', label: 'Cities', name: 'areaCity', placeholder: 'Raleigh, Durham…' },
  { field: 'zips', kind: 'zip', label: 'ZIP Codes', name: 'areaZip', placeholder: '27604' },
  { field: 'neighborhoods', kind: 'hood', label: 'Neighborhoods', name: 'areaHood', placeholder: 'Oakwood, Five Points…' },
] as const;

/**
 * Where they work as cities, ZIP codes and neighborhoods (owner, Oct 3, 2026):
 * type, pick a suggestion from the county records (or press Enter for your own),
 * and each becomes a chip. Sends areaCity / areaZip / areaHood for each, plus the
 * summary as `areas`.
 */
export function AreaPicker({ start, label = 'Areas They Specialize In' }: { start?: Areas; label?: string }) {
  const [a, setA] = useState<Areas>(start ?? { cities: [], zips: [], neighborhoods: [] });
  return (
    <fieldset className="f area-picker">
      <legend>{label}<span className="h">Type and pick; Enter adds what you typed</span></legend>
      <input type="hidden" name="areasPicked" value="1" />
      <input type="hidden" name="areas" value={areaSummary(a)} />
      <div className="fields">
        {fields.map((f) => (
          <ChipField key={f.field} kind={f.kind} label={f.label} name={f.name} placeholder={f.placeholder} values={a[f.field]} onChange={(v) => setA((x) => ({ ...x, [f.field]: v }))} />
        ))}
      </div>
    </fieldset>
  );
}

function ChipField({ kind, label, name, placeholder, values, onChange }: { kind: 'city' | 'zip' | 'hood'; label: string; name: string; placeholder: string; values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('');
  const [sugg, setSugg] = useState<string[]>([]);
  const id = useId();
  const seq = useRef(0);
  const add = (v: string) => {
    const t = v.replace(/\s+/g, ' ').trim();
    if (!t || (kind === 'zip' && !/^\d{5}$/.test(t)) || values.some((x) => x.toLowerCase() === t.toLowerCase())) { setText(''); setSugg([]); return; }
    onChange([...values, t]); setText(''); setSugg([]);
  };
  return (
    <div className="f chip-field">
      <label htmlFor={id}>{label}</label>
      <div className="chips">{values.map((v) => (
        <span key={v} className="chip aqua">{v}<input type="hidden" name={name} value={v} />
          <button type="button" className="chip-x" aria-label={`Take off ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button></span>
      ))}</div>
      <input id={id} value={text} placeholder={placeholder} autoComplete="off" inputMode={kind === 'zip' ? 'numeric' : undefined}
        onChange={async (e) => {
          const v = e.target.value; setText(v);
          const n = ++seq.current;
          const s = v.trim() ? await suggestAreas(kind, v).catch(() => []) : [];
          if (n === seq.current) setSugg(s);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); } }}
        onBlur={() => setTimeout(() => setSugg([]), 150)} />
      {sugg.length ? (
        <ul className="picker-list area-sugg" role="listbox" aria-label={`${label} suggestions`}>{sugg.map((s) => (
          <li key={s} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); add(s); }}>{s}</li>
        ))}</ul>
      ) : null}
    </div>
  );
}
