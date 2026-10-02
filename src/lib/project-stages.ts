// A project's stages and their sub-stages. Several stages can be going at once
// (owner, Oct 2, 2026: "we can be looking for permits and under contract and
// building"), so each stage has its own state (not started / going now / done)
// and its own sub-stage. `projects.stage` stays as the main stage (the latest
// one going now, for lists and the website). Pure, tested in project-stages.test.ts.

export const projectStages = [
  { key: 'under_contract', label: 'Under Contract', hint: 'Buying the property' },
  { key: 'design', label: 'Design', hint: 'Plans, engineering and selections' },
  { key: 'permits', label: 'Permits', hint: 'Applications, reviews and the permit' },
  { key: 'building', label: 'Building', hint: 'Construction, start to certificate of occupancy' },
  { key: 'presold_listed', label: 'For Sale', hint: 'Listing, showings, offers and the sale' },
  { key: 'closed', label: 'Closed', hint: 'Sold and wrapped up' },
  { key: 'rental', label: 'Rental', hint: 'Leasing and managing it' },
] as const;

export type ProjectStage = (typeof projectStages)[number]['key'];
export const isProjectStage = (v: string | null | undefined): v is ProjectStage => !!v && projectStages.some((s) => s.key === v);
export const projectStageLabel = (v: string) => projectStages.find((s) => s.key === v)?.label ?? v;

/** Every sub-stage of every stage, in order. Rental's are the rental's status (src/lib/rentals.ts). */
export const subStages: Record<ProjectStage, readonly { key: string; label: string }[]> = {
  under_contract: [
    { key: 'offer_made', label: 'Offer Made' },
    { key: 'due_diligence', label: 'Due Diligence' },
    { key: 'inspections', label: 'Inspections' },
    { key: 'survey', label: 'Survey' },
    { key: 'appraisal', label: 'Appraisal' },
    { key: 'financing', label: 'Financing' },
    { key: 'clear_to_close', label: 'Clear to Close' },
    { key: 'purchased', label: 'Purchased' },
  ],
  design: [
    { key: 'site_plan', label: 'Survey and Site Plan' },
    { key: 'architect', label: 'Architect Drawings' },
    { key: 'engineering', label: 'Engineering' },
    { key: 'selections', label: 'Selections' },
    { key: 'priced', label: 'Bids and Pricing' },
    { key: 'final_plans', label: 'Final Plans' },
  ],
  permits: [
    { key: 'preparing', label: 'Preparing Application' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'in_review', label: 'In Review' },
    { key: 'comments', label: 'Comments to Address' },
    { key: 'resubmitted', label: 'Resubmitted' },
    { key: 'approved', label: 'Approved' },
    { key: 'issued', label: 'Permit Issued' },
  ],
  building: [
    { key: 'demo_site', label: 'Demolition and Site Work' },
    { key: 'foundation', label: 'Foundation' },
    { key: 'framing', label: 'Framing' },
    { key: 'rough_ins', label: 'Rough-Ins' },
    { key: 'insulation_drywall', label: 'Insulation and Drywall' },
    { key: 'finishes', label: 'Finishes' },
    { key: 'punch_list', label: 'Punch List' },
    { key: 'final_inspection', label: 'Final Inspection' },
    { key: 'co', label: 'Certificate of Occupancy' },
  ],
  presold_listed: [
    { key: 'preparing', label: 'Getting Ready to List' },
    { key: 'coming_soon', label: 'Coming Soon' },
    { key: 'presold', label: 'Presold' },
    { key: 'listed', label: 'Listed' },
    { key: 'showings', label: 'Showings' },
    { key: 'offer', label: 'Offer Received' },
    { key: 'under_contract', label: 'Under Contract' },
    { key: 'inspection_appraisal', label: 'Buyer Inspection and Appraisal' },
    { key: 'clear_to_close', label: 'Clear to Close' },
  ],
  closed: [
    { key: 'sold', label: 'Sold' },
    { key: 'final_numbers', label: 'Final Numbers In' },
    { key: 'review_done', label: 'Review Done' },
  ],
  rental: [
    { key: 'getting_ready', label: 'Getting Ready' },
    { key: 'on_market', label: 'On the Market' },
    { key: 'application', label: 'Application Pending' },
    { key: 'leased', label: 'Leased' },
    { key: 'notice', label: 'Notice Given' },
    { key: 'vacant', label: 'Vacant' },
  ],
};
export const isSubStage = (stage: string, sub: string) => isProjectStage(stage) && subStages[stage].some((s) => s.key === sub);
export const subStageLabel = (stage: string, sub: string | null | undefined) =>
  (isProjectStage(stage) && sub ? subStages[stage].find((s) => s.key === sub)?.label : null) ?? null;

export const stageStateKeys = ['not_started', 'active', 'done'] as const;
export type StageState = (typeof stageStateKeys)[number];
export const isStageState = (v: string | null | undefined): v is StageState => stageStateKeys.includes(v as StageState);
export const stageStateLabel: Record<StageState, string> = { not_started: 'Not Started', active: 'Going Now', done: 'Done' };

const order = projectStages.map((s) => s.key) as ProjectStage[];
// Selling and renting are separate exits: being a rental doesn't mean it was sold.
const exits: ProjectStage[] = ['presold_listed', 'closed', 'rental'];

/**
 * Each stage's state. Saved states win; a project with none saved (made before
 * Oct 2, 2026, or by an import) reads from its one stage: the build stages
 * before it are done and it is going now (Closed also marks For Sale done).
 */
export function stageStates(stage: string, saved: Record<string, string> | null | undefined): Record<ProjectStage, StageState> {
  const out = Object.fromEntries(order.map((k) => [k, 'not_started'])) as Record<ProjectStage, StageState>;
  const keep = Object.entries(saved ?? {}).filter(([k, v]) => isProjectStage(k) && isStageState(v));
  if (keep.length) {
    for (const [k, v] of keep) out[k as ProjectStage] = v as StageState;
    return out;
  }
  if (!isProjectStage(stage)) return out;
  const at = order.indexOf(stage);
  for (const k of order.slice(0, at)) if (!exits.includes(k) || (stage === 'closed' && k === 'presold_listed')) out[k] = 'done';
  out[stage] = 'active';
  return out;
}

/** The main stage for lists and the website: the latest one going now, else the latest done, else the first. */
export function mainStage(states: Record<string, StageState>): ProjectStage {
  const active = order.filter((k) => states[k] === 'active');
  if (active.length) return active[active.length - 1];
  const done = order.filter((k) => states[k] === 'done');
  return done.length ? done[done.length - 1] : order[0];
}

export const activeStages = (states: Record<string, StageState>) => order.filter((k) => states[k] === 'active');

/** The stage opened under the bar: the one asked for, else the main stage. */
export const openStage = (asked: string | null | undefined, states: Record<string, StageState>): ProjectStage =>
  isProjectStage(asked) ? asked : mainStage(states);

/** Saving a stage's state: sets it, and starting a stage marks it going (a sub-stage picked means it's going). */
export function withState(states: Record<ProjectStage, StageState>, stage: ProjectStage, state: StageState) {
  return { ...states, [stage]: state };
}
