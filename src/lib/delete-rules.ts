// What a permanent delete does to every row that points at a person or company
// (owner, Oct 2, 2026: "a way as the admin to delete or archive"). Data, not
// code; delete-rules.test.ts fails when a new column pointing at people or
// companies has no rule here. Pure.
//   delete: belongs to the record (its roles, touches, tasks, list places)
//   clear:  another record only mentions it (set the column empty)
//   block:  money history (bills, commitments): archive instead
export type Rule = { table: string; column: string; does: 'delete' | 'clear' | 'block'; label: string };

export const deleteRules: Record<'person' | 'company', Rule[]> = {
  person: [
    { table: 'person_companies', column: 'person_id', does: 'delete', label: 'work history' },
    { table: 'party_roles', column: 'person_id', does: 'delete', label: 'roles' },
    { table: 'event_people', column: 'person_id', does: 'delete', label: 'event attendance' },
    { table: 'touches', column: 'person_id', does: 'delete', label: 'calls, meetings and site walks' },
    { table: 'tasks', column: 'person_id', does: 'delete', label: 'tasks about them' },
    { table: 'saved_list_members', column: 'person_id', does: 'delete', label: 'places on lists' },
    { table: 'people', column: 'introduced_by_id', does: 'clear', label: 'people they introduced (the link only)' },
    { table: 'properties', column: 'source_person_id', does: 'clear', label: 'watchlist leads they sent (the credit only)' },
    { table: 'assignments', column: 'person_id', does: 'clear', label: 'schedule commitments (who only)' },
    { table: 'project_utilities', column: 'person_id', does: 'clear', label: 'utility contacts (who only)' },
    { table: 'bills', column: 'vendor_person_id', does: 'block', label: 'bills from them' },
    { table: 'commitments', column: 'vendor_person_id', does: 'block', label: 'commitments with them' },
    { table: 'budget_versions', column: 'person_id', does: 'block', label: 'bids from them' },
  ],
  company: [
    { table: 'person_companies', column: 'company_id', does: 'delete', label: 'work history at it' },
    { table: 'party_roles', column: 'company_id', does: 'delete', label: 'what they do' },
    { table: 'tasks', column: 'company_id', does: 'delete', label: 'tasks about it' },
    { table: 'people', column: 'company_id', does: 'clear', label: 'people working there (their company only)' },
    { table: 'party_roles', column: 'hired_through_company_id', does: 'clear', label: 'subs and suppliers through them (the link only)' },
    { table: 'assignments', column: 'company_id', does: 'clear', label: 'schedule commitments (who only)' },
    { table: 'project_utilities', column: 'company_id', does: 'clear', label: 'property utilities (company only)' },
    { table: 'bills', column: 'vendor_company_id', does: 'block', label: 'bills from them' },
    { table: 'commitments', column: 'vendor_company_id', does: 'block', label: 'commitments with them' },
    { table: 'budget_versions', column: 'company_id', does: 'block', label: 'bids from them' },
  ],
};

/** The name typed to confirm must match (case and spaces don't matter). */
export const confirmMatches = (typed: string, name: string) => typed.trim().replace(/\s+/g, ' ').toLowerCase() === name.trim().replace(/\s+/g, ' ').toLowerCase();
