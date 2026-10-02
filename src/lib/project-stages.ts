export const projectStages = [
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'design', label: 'Design' },
  { key: 'permits', label: 'Permits' },
  { key: 'building', label: 'Building' },
  { key: 'presold_listed', label: 'Presold / Listed' },
  { key: 'closed', label: 'Closed' },
  { key: 'rental', label: 'Rental' },
] as const;

export type ProjectStage = (typeof projectStages)[number]['key'];
export const isProjectStage = (v: string | null | undefined): v is ProjectStage => !!v && projectStages.some((s) => s.key === v);
export const projectStageLabel = (v: string) => projectStages.find((s) => s.key === v)?.label ?? v;
