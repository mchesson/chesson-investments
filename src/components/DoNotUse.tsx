import { ActionForm } from './ActionForm';
import { Section } from './ui';
import { setDoNotUse } from '@/app/(app)/contacts-actions';
import { formatDate } from '@/lib/format';

type Props = { personId?: string; companyId?: string; on: boolean; reason: string | null; at: Date | null; canEdit: boolean };

/** The red banner at the top of a record marked Do Not Use. */
export function DoNotUseBanner({ on, reason, at }: Pick<Props, 'on' | 'reason' | 'at'>) {
  if (!on) return null;
  return <div className="dnu-banner" role="alert"><strong>Do Not Use</strong>{reason}{at ? <span className="small"> (since {formatDate(at.toISOString())})</span> : null}</div>;
}

/** Mark or clear Do Not Use, always with a reason (History keeps both). */
export function DoNotUseSection(p: Props) {
  if (!p.canEdit) return null;
  const target = p.personId ? <input type="hidden" name="personId" value={p.personId} /> : <input type="hidden" name="companyId" value={p.companyId} />;
  return (
    <Section title="Do Not Use" kind="grey">
      {p.on ? (
        <ActionForm action={setDoNotUse} submit="Take Off Do Not Use" submitClass="btn secondary">
          {target}<input type="hidden" name="on" value="0" />
          <label className="f">Why (optional)<input name="reason" placeholder="Talked it through; giving them another chance" /></label>
        </ActionForm>
      ) : (
        <details className="fold">
          <summary>Mark Do Not Use</summary>
          <ActionForm action={setDoNotUse} submit="Mark Do Not Use" submitClass="btn danger">
            {target}<input type="hidden" name="on" value="1" />
            <label className="f">Why<span className="h">Required. An overall grade of D or below also sets this by itself (see Grades).</span><textarea name="reason" required rows={2} /></label>
          </ActionForm>
        </details>
      )}
    </Section>
  );
}
