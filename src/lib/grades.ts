// Grading a contractor's or vendor's work (owner, Oct 2, 2026): a letter per
// job with a written justification, an overall grade from all of them, and D or
// below marks them Do Not Use unless someone overrides it with a reason. Pure,
// tested in grades.test.ts.

export const letters = ['A', 'B', 'C', 'D', 'F'] as const;
export type Letter = (typeof letters)[number];
export const isLetter = (v: string | null | undefined): v is Letter => letters.includes(v as Letter);
const points: Record<Letter, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
export const letterMeaning: Record<Letter, string> = {
  A: 'Excellent: hire again first', B: 'Good: would hire again', C: 'Fair: only with close watching', D: 'Poor: avoid', F: 'Failed: never again',
};

/** The parts of a job that can be graded on their own (optional). */
export const gradeParts = [
  { key: 'quality', label: 'Quality of Work' },
  { key: 'schedule', label: 'On Schedule' },
  { key: 'budget', label: 'On Budget' },
  { key: 'communication', label: 'Communication' },
] as const;

/** A justification has to say why: at least a sentence. */
export const MIN_JUSTIFICATION = 20;
export function gradeProblem(g: { grade: string | null; justification: string | null; parts?: Record<string, string | null> }): string | null {
  if (!isLetter(g.grade)) return 'Pick a grade.';
  if ((g.justification ?? '').trim().length < MIN_JUSTIFICATION) return `Say why they got ${g.grade}: what went well or wrong, with examples (at least a sentence).`;
  for (const [k, v] of Object.entries(g.parts ?? {})) if (v && !isLetter(v)) return `Pick a letter for ${k}.`;
  return null;
}

/** The overall grade: the average of the job grades, rounded to the nearest letter. */
export function overallGrade(gs: { grade: string }[]): { letter: Letter; average: number; count: number } | null {
  const ok = gs.filter((g) => isLetter(g.grade));
  if (!ok.length) return null;
  const average = ok.reduce((s, g) => s + points[g.grade as Letter], 0) / ok.length;
  const letter = average >= 3.5 ? 'A' : average >= 2.5 ? 'B' : average >= 1.5 ? 'C' : average >= 0.5 ? 'D' : 'F';
  return { letter, average: Math.round(average * 100) / 100, count: ok.length };
}

export const isPoor = (l: Letter | null | undefined) => l === 'D' || l === 'F';

/**
 * What Do Not Use should be after a grade changes: a D or F overall marks them
 * (unless overridden); it never clears a Do Not Use someone set by hand, and
 * clears one the grade set once the grade comes back up.
 */
export function doNotUseFromGrade(o: { letter: Letter; count: number } | null, cur: { doNotUse: boolean; reason: string | null; override: boolean }):
  { doNotUse: boolean; reason: string | null } | null {
  const fromGrade = (cur.reason ?? '').startsWith(GRADE_REASON);
  if (o && isPoor(o.letter) && !cur.override) {
    const reason = `${GRADE_REASON} ${o.letter} from ${o.count} ${o.count === 1 ? 'job' : 'jobs'}`;
    return cur.doNotUse && cur.reason === reason ? null : cur.doNotUse && !fromGrade ? null : { doNotUse: true, reason };
  }
  if (cur.doNotUse && fromGrade) return { doNotUse: false, reason: null };
  return null;
}
export const GRADE_REASON = 'Overall grade';
