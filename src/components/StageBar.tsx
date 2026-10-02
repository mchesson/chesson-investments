// The stage bar at the top of a project (owner, Oct 2, 2026): every stage with
// its state (several can be going at once), and the opened stage's own state
// buttons and sub-stages beneath. Server component: buttons are forms.
import Link from 'next/link';
import { activeStages, projectStages, stageStateKeys, stageStateLabel, subStageLabel, subStages, type ProjectStage, type StageState } from '@/lib/project-stages';
import { setStageState, setSubStage } from '@/app/(app)/project-actions';
import { ShowCurrent } from './ShowCurrent';

export function StageBar({ projectId, states, subs, open, href, canEdit }: {
  projectId: string; states: Record<ProjectStage, StageState>; subs: Record<string, string | null | undefined>;
  open: ProjectStage; href: (stage: ProjectStage) => string; canEdit: boolean;
}) {
  const going = activeStages(states);
  const def = projectStages.find((s) => s.key === open)!;
  const sub = subs[open] ?? null;
  return (
    <nav className="stage-bar" aria-label="Stages">
      <div className="stage-row">
        <span className="stage-label">Stages</span>
        <ol className="stage-steps">
          {projectStages.map((s) => (
            <li key={s.key}>
              <Link href={href(s.key)} scroll={false} className="stage-step" data-state={states[s.key]} data-open={s.key === open ? 'true' : undefined}
                aria-current={s.key === open ? 'true' : undefined} title={`${s.label}: ${stageStateLabel[states[s.key]]}`}>
                {s.label}
                {states[s.key] === 'active' && subs[s.key] ? <small>{subStageLabel(s.key, subs[s.key])}</small> : null}
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <p className="stage-now">
        <strong>Going now:</strong>{' '}
        {going.length ? going.map((k, i) => (
          <span key={k}>{i ? ' · ' : ''}<Link href={href(k)} scroll={false}>{projectStages.find((s) => s.key === k)!.label}{subs[k] ? ` (${subStageLabel(k, subs[k])})` : ''}</Link></span>
        )) : <span className="muted">nothing yet. Open a stage and mark it Going Now.</span>}
      </p>

      <section className="stage-panel" aria-label={`${def.label} stage`}>
        <div className="stage-panel-head">
          <h2>{def.label}</h2>
          <span className="muted">{def.hint}</span>
          <div className="seg" role="group" aria-label={`${def.label} status`}>
            {stageStateKeys.map((k) => canEdit && states[open] !== k ? (
              <form key={k} action={setStageState.bind(null, projectId, open, k)}><button type="submit" className="seg-btn" data-k={k}>{stageStateLabel[k]}</button></form>
            ) : (
              <span key={k} className="seg-btn" data-k={k} aria-pressed={states[open] === k}>{stageStateLabel[k]}</span>
            ))}
          </div>
        </div>
        <div className="stage-row sub">
          <span className="stage-label">Where It Stands</span>
          <ul className="sub-steps">
            {subStages[open].map((x) => (
              <li key={x.key}>
                {canEdit && x.key !== sub
                  ? <form action={setSubStage.bind(null, projectId, open, x.key)}><button type="submit" className="sub-step">{x.label}</button></form>
                  : <span className="sub-step" aria-current={x.key === sub ? 'true' : undefined}>{x.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      </section>
      {canEdit ? <p className="stage-hint">Tap a stage to open it. Mark it Not Started, Going Now or Done (several can be going at once), then tap where it stands. Every change is kept in History.</p> : null}
      <ShowCurrent />
    </nav>
  );
}
