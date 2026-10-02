'use client';

import { useState } from 'react';

type Co = { id: string; name: string; people: { id: string; name: string; title: string | null }[] };

/** Only property management companies; below, only that company's people: tick one or more, mark the main one. */
export function ManagerPicker({ companies, companyId, chosen, main }: { companies: Co[]; companyId: string | null; chosen: string[]; main: string | null }) {
  const [co, setCo] = useState(companyId ?? '');
  const [picked, setPicked] = useState<string[]>(chosen);
  const [lead, setLead] = useState<string | null>(main ?? chosen[0] ?? null);
  const current = companies.find((c) => c.id === co);
  const toggle = (id: string) => setPicked((p) => {
    const next = p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
    if (!next.includes(lead ?? '')) setLead(next[0] ?? null);
    else if (!lead && next.length) setLead(next[0]);
    return next;
  });
  return (
    <div className="manager-pick">
      <label className="f">Property Management Company
        <select name="managerCompanyId" value={co} onChange={(e) => { setCo(e.target.value); setPicked([]); setLead(null); }}>
          <option value="">None</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {!companies.length ? <p className="small muted">No property management companies yet. On the company’s page, add “Property Manager” under What They Do.</p> : null}
      {current ? (
        <fieldset className="contact-pick">
          <legend className="small">Their people on this property <span className="muted">(tick one or more; pick the main one)</span></legend>
          {current.people.length ? current.people.map((p) => (
            <div key={p.id} className="contact-row">
              <label className="check"><input type="checkbox" name="managerContacts" value={p.id} checked={picked.includes(p.id)} onChange={() => toggle(p.id)} /> {p.name}{p.title ? <span className="small muted"> · {p.title}</span> : null}</label>
              {picked.includes(p.id) ? <label className="check small"><input type="radio" name="managerMain" value={p.id} checked={lead === p.id} onChange={() => setLead(p.id)} /> Main contact</label> : null}
            </div>
          )) : <p className="small muted">No one from {current.name} is on file yet. Open {current.name} and use Add Person Here.</p>}
        </fieldset>
      ) : null}
    </div>
  );
}
