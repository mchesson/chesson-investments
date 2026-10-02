import { ShowCurrent } from './ShowCurrent';
import { projectStages } from '@/lib/project-stages';
import { rentalStatuses } from '@/lib/rentals';
import { setProjectStage } from '@/app/(app)/project-actions';
import { setRentalStatus } from '@/app/(app)/rental-actions';

/**
 * The project's stage as buttons across the top, and under it the stage's own
 * sub-stages (owner, Oct 2, 2026: "if rental, what is the sub stage"). One tap
 * each; History records it.
 */
export function StageBar({ projectId, stage, rentalStatus, canEdit }: { projectId: string; stage: string; rentalStatus: string | null; canEdit: boolean }) {
  const subs = stage === 'rental' ? { label: 'Rental', items: rentalStatuses, current: rentalStatus ?? 'getting_ready', action: setRentalStatus } : null;
  const at = projectStages.findIndex((s) => s.key === stage);
  return (
    <nav className="stage-bar" aria-label="Stage">
      <div className="stage-row">
        <span className="stage-label">Stage</span>
        <ol className="stage-steps">
          {projectStages.map((s, i) => {
            const state = s.key === stage ? 'current' : i < at ? 'done' : 'todo';
            const inner = <span className="stage-step" data-state={state} aria-current={s.key === stage ? 'step' : undefined}>{s.label}</span>;
            return <li key={s.key}>{canEdit && s.key !== stage ? <form action={setProjectStage.bind(null, projectId, s.key)}><button type="submit" className="stage-btn">{inner}</button></form> : inner}</li>;
          })}
        </ol>
      </div>
      {subs ? (
        <div className="stage-row sub">
          <span className="stage-label">{subs.label}</span>
          <ul className="sub-steps">
            {subs.items.map((x) => (
              <li key={x.key}>
                {canEdit && x.key !== subs.current
                  ? <form action={subs.action.bind(null, projectId, x.key)}><button type="submit" className="sub-step">{x.label}</button></form>
                  : <span className="sub-step" aria-current={x.key === subs.current ? 'true' : undefined}>{x.label}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {canEdit ? <p className="stage-hint">Tap a stage to move the project there{subs ? '; tap where the rental stands now' : ''}. Every move is kept in History.</p> : null}
      <ShowCurrent />
    </nav>
  );
}
