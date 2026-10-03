// Every stage going now on a project, with where each stands (lists and Home).
import { activeStages, stageLabelFor, stageStates, subStageLabel } from '@/lib/project-stages';

export function StageChips({ p }: { p: { stage: string; stageStates: Record<string, string> | null; subStages: Record<string, string> | null; rentalStatus?: string | null; rentalKind?: string | null } }) {
  const subs: Record<string, string | null | undefined> = { ...(p.subStages ?? {}), rental: p.rentalStatus };
  const going = activeStages(stageStates(p.stage, p.stageStates));
  return (
    <span className="stage-chips">
      {(going.length ? going : [p.stage]).map((k) => (
        <span key={k} className="chip blue">{stageLabelFor(k, p.rentalKind)}{subs[k] ? <span className="chip-sub"> · {subStageLabel(k, subs[k])}</span> : null}</span>
      ))}
    </span>
  );
}
