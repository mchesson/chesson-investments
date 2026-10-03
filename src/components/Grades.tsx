// Grades for a contractor's or vendor's work (owner, Oct 2, 2026): a letter per
// job with the justification, the overall grade, and the Do Not Use rule.
import { ActionButton } from '@/components/ActionButton';
import Link from 'next/link';
import { ActionForm } from './ActionForm';
import { Choice } from './Choice';
import { Empty, Section } from './ui';
import { archiveGrade, saveGrade, setGradeOverride } from '@/app/(app)/grade-actions';
import { gradeParts, isPoor, letterMeaning, letters, MIN_JUSTIFICATION, type Letter } from '@/lib/grades';
import { formatDate, today } from '@/lib/format';
import type { gradesFor } from '@/lib/grade-data';

type Data = Awaited<ReturnType<typeof gradesFor>>;
type WhoProps = { personId?: string; companyId?: string };

export function GradeBadge({ letter, size = 'md' }: { letter: string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!letter) return <span className={`grade-badge none ${size}`} title="Not graded yet">–</span>;
  return <span className={`grade-badge g-${letter} ${size}`} title={letterMeaning[letter as Letter]}>{letter}</span>;
}

function Target({ personId, companyId }: WhoProps) {
  return personId ? <input type="hidden" name="personId" value={personId} /> : <input type="hidden" name="companyId" value={companyId} />;
}

const letterOptions = letters.map((l) => ({ key: l, label: `${l}: ${letterMeaning[l].split(':')[0]}` }));
const partOptions = [{ key: '', label: 'Not Graded' }, ...letters.map((l) => ({ key: l, label: l }))];

/** The grade form: on a vendor's page (pick the job) or a project's (the job is fixed). */
export function GradeForm({ who, projects, projectId }: { who: WhoProps; projects?: { id: string; name: string }[]; projectId?: string }) {
  return (
    <ActionForm action={saveGrade} submit="Save the Grade">
      <Target {...who} />
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      <Choice name="grade" label="Grade" options={letterOptions} required />
      <div className="fields">
        {projects && !projectId ? (
          <label className="f">Job<span className="h">The project this grade is for</span>
            <select name="projectId" defaultValue=""><option value="">Their work in general</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </label>
        ) : null}
        <label className="f">Graded On<input type="date" name="gradedOn" defaultValue={today()} required /></label>
      </div>
      <details className="fold"><summary>Grade the Parts Too (optional)</summary>
        <div className="stack-form">{gradeParts.map((p) => <Choice key={p.key} name={p.key} label={p.label} options={partOptions} defaultValue="" color="aqua" />)}</div>
      </details>
      <label className="f">Justification<span className="h">Required: why this grade, with examples (what went well, what went wrong, how they handled it). At least {MIN_JUSTIFICATION} characters.</span>
        <textarea name="justification" required minLength={MIN_JUSTIFICATION} rows={4} placeholder="Framing was square and passed inspection the first time. Two days late on the roof dry-in and slow to return calls the second week." />
      </label>
    </ActionForm>
  );
}

export function GradesTab({ who, data, projects, canEdit, override }: {
  who: WhoProps; data: Data; projects: { id: string; name: string }[]; canEdit: boolean; override: { on: boolean; reason: string | null };
}) {
  const o = data.overall;
  return (
    <div className="stack">
      <Section title="Overall Grade" kind="blue" hint={o ? `${o.count} ${o.count === 1 ? 'grade' : 'grades'}, average ${o.average.toFixed(2)} of 4` : 'Not graded yet'}>
        <div className="grade-overall">
          <GradeBadge letter={o?.letter} size="lg" />
          <div>
            <strong>{o ? letterMeaning[o.letter] : 'No grades yet. Grade each job when it finishes.'}</strong>
            <p className="small muted" style={{ margin: '4px 0 0' }}>The overall grade is the average of every job. D or below marks them Do Not Use by itself, unless they’re kept usable below.</p>
            {o && isPoor(o.letter) && override.on ? <p className="notice" style={{ margin: '8px 0 0' }}>Kept usable despite the grade: {override.reason}</p> : null}
          </div>
        </div>
        {canEdit && o && isPoor(o.letter) ? (
          <details className="fold" style={{ marginTop: 10 }}><summary>{override.on ? 'Take Off the Override' : 'Keep Them Usable Anyway (Override)'}</summary>
            <ActionForm action={setGradeOverride} submit={override.on ? 'Take Off the Override' : 'Keep Them Usable'} submitClass="btn secondary">
              <Target {...who} /><input type="hidden" name="on" value={override.on ? '0' : '1'} />
              {override.on ? null : <label className="f">Why<span className="h">Required</span><textarea name="reason" required rows={2} placeholder="Only electrician who can do the panel upgrade this month; owner approved" /></label>}
            </ActionForm>
          </details>
        ) : null}
      </Section>
      <Section title="Grades by Job" kind="aqua" hint={`${data.rows.length}`}>
        {data.rows.length ? (
          <ul className="grade-list">{data.rows.map((g) => (
            <li key={g.id} className="grade-card">
              <GradeBadge letter={g.grade} />
              <div className="grade-body">
                <div><strong>{g.projectId ? <Link href={`/projects/${g.projectId}?tab=vendors`}>{g.projectName}</Link> : 'Their work in general'}</strong>
                  <span className="small muted"> · {formatDate(g.gradedOn)}{g.gradedBy ? ` · ${g.gradedBy}` : ''}</span></div>
                {gradeParts.some((p) => g[p.key]) ? <div className="grade-parts">{gradeParts.filter((p) => g[p.key]).map((p) => <span key={p.key} className="chip">{p.label}: <b>{g[p.key]}</b></span>)}</div> : null}
                <p className="grade-why"><span className="small muted">Justification:</span> {g.justification}</p>
              </div>
              {canEdit ? <ActionButton action={archiveGrade.bind(null, who.personId ?? null, who.companyId ?? null, g.id)} className="link-btn small" label="Remove" done="Grade removed." /> : null}
            </li>
          ))}</ul>
        ) : <Empty>No grades yet.</Empty>}
      </Section>
      {canEdit ? <Section title="Grade Their Work" kind="energy" hint="One grade per job, always with why"><GradeForm who={who} projects={projects} /></Section> : null}
    </div>
  );
}
