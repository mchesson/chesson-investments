'use client';
// Picking the kind of outside partner ticks what that kind usually gets; any
// box can then be ticked or unticked.
import { useState } from 'react';
import { guestAbilities, guestExtraOptions, guestTypes, type GuestType } from '@/lib/guests';

export function GuestTypeFields({ initialType = 'gc', withAbilities = true, initialExtras }: { initialType?: GuestType; withAbilities?: boolean; initialExtras?: string[] }) {
  const start = guestTypes.find((t) => t.key === initialType) ?? guestTypes[0];
  const [type, setType] = useState<GuestType>(start.key);
  const [can, setCan] = useState<string[]>([...start.can]);
  const [extras, setExtras] = useState<string[]>(initialExtras ?? [...start.extras]);
  const pick = (k: GuestType) => {
    const t = guestTypes.find((x) => x.key === k)!;
    setType(k); setCan([...t.can]); setExtras([...t.extras]);
  };
  const flip = (list: string[], k: string) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  return (
    <>
      <fieldset className="f choice"><legend>What Kind of Partner<span className="h">It ticks what that kind usually gets; change any box after</span></legend>
        <div className="choice-opts">{guestTypes.map((t) => (
          <label key={t.key} className="choice-opt"><input type="radio" name="guestType" value={t.key} checked={type === t.key} onChange={() => pick(t.key)} /><span>{t.label}</span></label>
        ))}</div>
      </fieldset>
      {withAbilities ? (
        <fieldset className="f choice"><legend>What They Can Do on Their Projects<span className="h">They never see budgets, other vendors’ prices, profit or contacts</span></legend>
          <div className="role-pick">{guestAbilities.map((a) => (
            <label key={a.key} className="role-btn"><input type="checkbox" name="can" value={a.key} checked={can.includes(a.key)} onChange={() => setCan((c) => flip(c, a.key))} /><span>{a.label}</span></label>
          ))}</div>
        </fieldset>
      ) : null}
      <fieldset className="f choice"><legend>Beyond Their Projects</legend>
        <div className="role-pick">{guestExtraOptions.map((o) => (
          <label key={o.key} className="role-btn"><input type="checkbox" name="extra" value={o.key} checked={extras.includes(o.key)} onChange={() => setExtras((c) => flip(c, o.key))} /><span>{o.label}</span></label>
        ))}</div>
      </fieldset>
    </>
  );
}
