// Chesson Investments database. Every table has row-level security enabled
// with no policies: the app connects as the owner role, and Supabase's
// anon / authenticated roles get nothing (see CLAUDE.md "Security").

import {
  boolean, customType, date, index, integer, jsonb, numeric, pgEnum, pgTable,
  text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const id = () => uuid('id').primaryKey().defaultRandom();
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const archived = () => timestamp('archived_at', { withTimezone: true });

// owner: everything; staff: no tax returns / PFS / investor money (later phases);
// accountant: projects' money only (banking, bills, loans, exports in later phases).
// Later: invited outsiders (partner, investor, sub) scoped to their own records.
export const userRole = pgEnum('user_role', ['pending', 'owner', 'staff', 'accountant']);

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  name: text('name'),
  role: userRole('role').notNull().default('pending'),
  active: boolean('active').notNull().default(true),
  created: created(),
  lastSignIn: timestamp('last_sign_in', { withTimezone: true }),
}, (t) => [uniqueIndex('users_email').on(t.email)]).enableRLS();

// Who did what, when and how. Never edited or deleted. Sensitive views go here too.
export const auditLog = pgTable('audit_log', {
  id: id(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  userId: uuid('user_id').references(() => users.id),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id'),
  action: text('action').notNull(),
  via: text('via'),
  summary: text('summary'),
  before: jsonb('before'),
  after: jsonb('after'),
}, (t) => [index('audit_entity').on(t.entity, t.entityId, t.at)]).enableRLS();

export const companies = pgTable('companies', {
  id: id(),
  name: text('name').notNull(),
  website: text('website'),
  phone: text('phone'),
  email: text('email'),
  city: text('city'),
  state: text('state'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  updated: updated(),
  archived: archived(),
}, (t) => [index('companies_name').on(t.name)]).enableRLS();

export const people = pgTable('people', {
  id: id(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  title: text('title'),
  companyId: uuid('company_id').references(() => companies.id),
  city: text('city'),
  state: text('state'),
  // How we know them (src/lib/how-met.ts) and who introduced them: always a
  // person on file, so it links both ways, with a note about the introduction.
  howMet: text('how_met'),
  introducedById: uuid('introduced_by_id'),
  introNote: text('intro_note'),
  metAtEventId: uuid('met_at_event_id'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  updated: updated(),
  archived: archived(),
}, (t) => [index('people_last').on(t.lastName, t.firstName), index('people_company').on(t.companyId), index('people_introduced_by').on(t.introducedById)]).enableRLS();

// Where a person has worked: the open row is the current company (copied to people.company_id).
export const personCompanies = pgTable('person_companies', {
  id: id(),
  personId: uuid('person_id').notNull().references(() => people.id),
  companyId: uuid('company_id').notNull().references(() => companies.id),
  title: text('title'),
  startedOn: date('started_on'),
  endedOn: date('ended_on'),
  created: created(),
}, (t) => [index('person_companies_person').on(t.personId)]).enableRLS();

// A role on a person or a company (one of the two), each with its own stage.
// Role keys and their stages are data in src/lib/roles.ts.
export const partyRoles = pgTable('party_roles', {
  id: id(),
  personId: uuid('person_id').references(() => people.id),
  companyId: uuid('company_id').references(() => companies.id),
  role: text('role').notNull(),
  stage: text('stage').notNull(),
  trade: text('trade'),
  areas: text('areas'),
  licenseNumber: text('license_number'),
  // A sub or supplier we didn't hire directly: their invoices come through
  // this GC (owner, Oct 2, 2026: "that makes them a subcontractor").
  hiredThroughCompanyId: uuid('hired_through_company_id'),
  notes: text('notes'),
  stageChangedAt: timestamp('stage_changed_at', { withTimezone: true }).notNull().defaultNow(),
  created: created(),
  removed: timestamp('removed_at', { withTimezone: true }),
}, (t) => [
  index('party_roles_person').on(t.personId),
  index('party_roles_company').on(t.companyId),
  index('party_roles_role').on(t.role, t.stage),
]).enableRLS();

export const events = pgTable('events', {
  id: id(),
  name: text('name').notNull(),
  happenedOn: date('happened_on').notNull(),
  location: text('location'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  archived: archived(),
}).enableRLS();

export const eventPeople = pgTable('event_people', {
  id: id(),
  eventId: uuid('event_id').notNull().references(() => events.id),
  personId: uuid('person_id').notNull().references(() => people.id),
  note: text('note'),
  created: created(),
}, (t) => [uniqueIndex('event_people_one').on(t.eventId, t.personId)]).enableRLS();

export const touchKind = pgEnum('touch_kind', ['call', 'email', 'text', 'meeting', 'site_walk', 'event']);

export const touches = pgTable('touches', {
  id: id(),
  personId: uuid('person_id').notNull().references(() => people.id),
  kind: touchKind('kind').notNull(),
  happenedOn: date('happened_on').notNull(),
  notes: text('notes'),
  eventId: uuid('event_id').references(() => events.id),
  propertyId: uuid('property_id'),
  projectId: uuid('project_id'),
  userId: uuid('user_id').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('touches_person_on').on(t.personId, t.happenedOn)]).enableRLS();

export const taskStatus = pgEnum('task_status', ['open', 'done']);

export const tasks = pgTable('tasks', {
  id: id(),
  title: text('title').notNull(),
  dueOn: date('due_on').notNull(),
  assignedTo: uuid('assigned_to').notNull().references(() => users.id),
  personId: uuid('person_id').references(() => people.id),
  companyId: uuid('company_id').references(() => companies.id),
  propertyId: uuid('property_id'),
  projectId: uuid('project_id'),
  notes: text('notes'),
  status: taskStatus('status').notNull().default('open'),
  doneAt: timestamp('done_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('tasks_assigned').on(t.assignedTo, t.status, t.dueOn)]).enableRLS();

export const savedLists = pgTable('saved_lists', {
  id: id(),
  name: text('name').notNull(),
  purpose: text('purpose'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  archived: archived(),
}).enableRLS();

export const savedListMembers = pgTable('saved_list_members', {
  id: id(),
  listId: uuid('list_id').notNull().references(() => savedLists.id),
  personId: uuid('person_id').notNull().references(() => people.id),
  status: text('status').notNull().default('to_contact'),
  note: text('note'),
  created: created(),
  removed: timestamp('removed_at', { withTimezone: true }),
}, (t) => [index('saved_list_members_list').on(t.listId)]).enableRLS();

// Leads and the watchlist: any property we liked, bid on or watched.
export const propertyStage = pgEnum('property_stage', [
  'watching', 'analyzing', 'offer_made', 'under_contract', 'lost', 'passed', 'sold',
]);

export const properties = pgTable('properties', {
  id: id(),
  address: text('address').notNull(),
  city: text('city'),
  state: text('state').default('NC'),
  zip: text('zip'),
  neighborhood: text('neighborhood'),
  sourcePersonId: uuid('source_person_id').references(() => people.id),
  askingPrice: money('asking_price'),
  lotSf: integer('lot_sf'),
  lotAcres: numeric('lot_acres', { precision: 8, scale: 3 }),
  zoning: text('zoning'),
  stage: propertyStage('stage').notNull().default('watching'),
  metBuyBox: boolean('met_buy_box'),
  ourOffer: money('our_offer'),
  offerOn: date('offer_on'),
  winningPrice: money('winning_price'),
  winningBuyer: text('winning_buyer'),
  soldPrice: money('sold_price'),
  soldOn: date('sold_on'),
  soldBuyer: text('sold_buyer'),
  referralFee: money('referral_fee'),
  stageBeforeSold: propertyStage('stage_before_sold'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  updated: updated(),
  archived: archived(),
}, (t) => [index('properties_stage').on(t.stage), index('properties_source').on(t.sourcePersonId)]).enableRLS();

export const projectStage = pgEnum('project_stage', [
  'under_contract', 'design', 'permits', 'building', 'presold_listed', 'closed', 'rental',
]);

export const projects = pgTable('projects', {
  id: id(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city'),
  state: text('state').default('NC'),
  zip: text('zip'),
  neighborhood: text('neighborhood'),
  propertyId: uuid('property_id').references(() => properties.id),
  // Which entity holds title (Chesson Investments, LLC; WJ Invest Group…).
  // Later phases make entities their own records (investors, banking).
  ownedBy: text('owned_by'),
  stage: projectStage('stage').notNull().default('under_contract'),
  lotSf: integer('lot_sf'),
  lotAcres: numeric('lot_acres', { precision: 8, scale: 3 }),
  zoning: text('zoning'),
  lotCost: money('lot_cost'),
  lotValue: money('lot_value'),
  heatedSf: integer('heated_sf'),
  plan: text('plan'),
  // Sale scenarios (the owner's High / Mid / Low); Mid is the pro forma.
  saleLow: money('sale_low'),
  proformaSalePrice: money('proforma_sale_price'),
  saleHigh: money('sale_high'),
  closingCostAtSale: money('closing_cost_at_sale'),
  // Furniture or equipment bought on the project that we keep (staging
  // furniture, tools): added back so it isn't a cost of this house.
  keptAssetsValue: money('kept_assets_value'),
  taxRatePct: numeric('tax_rate_pct', { precision: 5, scale: 2 }),
  sellingCostPct: numeric('selling_cost_pct', { precision: 5, scale: 2 }),
  actualSalePrice: money('actual_sale_price'),
  // What the finished house would sell for today (a broker's opinion, comps,
  // an appraisal): the check against over-building.
  marketValue: money('market_value'),
  marketValueOn: date('market_value_on'),
  marketValueSource: text('market_value_source'),
  // For the post-project review: dates, the first estimate, the target and the exits.
  purchasedOn: date('purchased_on'),
  completedOn: date('completed_on'),
  originalEstimate: money('original_estimate'),
  targetProfitPct: numeric('target_profit_pct', { precision: 5, scale: 2 }),
  plannedExit: text('planned_exit'),
  backupExit: text('backup_exit'),
  actualExit: text('actual_exit'),
  reviewNotes: text('review_notes'),
  reviewUpdatedAt: timestamp('review_updated_at', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  updated: updated(),
  archived: archived(),
}).enableRLS();

export const costCodes = pgTable('cost_codes', {
  id: id(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  sort: integer('sort').notNull(),
  // 'construction' lines add up to the construction subtotal; 'soft' lines
  // sit on top (management, contingency); see src/lib/budget.ts.
  kind: text('kind').notNull().default('construction'),
  archived: archived(),
}, (t) => [uniqueIndex('cost_codes_code').on(t.code)]).enableRLS();

export const budgetLines = pgTable('budget_lines', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  costCodeId: uuid('cost_code_id').notNull().references(() => costCodes.id),
  amount: money('amount'),
  // A percent of the construction subtotal (management 13.87, contingency 5); wins over amount.
  percentOfConstruction: numeric('percent_of_construction', { precision: 6, scale: 3 }),
  notes: text('notes'),
  updated: updated(),
}, (t) => [uniqueIndex('budget_lines_one').on(t.projectId, t.costCodeId)]).enableRLS();

// Things the plans call for that nobody has priced yet.
export const projectItems = pgTable('project_items', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  description: text('description').notNull(),
  costCodeId: uuid('cost_code_id').references(() => costCodes.id),
  estimate: money('estimate'),
  status: text('status').notNull().default('unpriced'),
  created: created(),
  archived: archived(),
}).enableRLS();

export const commitments = pgTable('commitments', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  costCodeId: uuid('cost_code_id').notNull().references(() => costCodes.id),
  vendorCompanyId: uuid('vendor_company_id').references(() => companies.id),
  vendorPersonId: uuid('vendor_person_id').references(() => people.id),
  scope: text('scope').notNull(),
  // fixed: a set price; cost_plus: costs passed through plus a fee %; hourly.
  contractType: text('contract_type').notNull().default('fixed'),
  feePct: numeric('fee_pct', { precision: 5, scale: 2 }),
  amount: money('amount').notNull(),
  retainagePct: numeric('retainage_pct', { precision: 5, scale: 2 }),
  signedOn: date('signed_on'),
  created: created(),
  archived: archived(),
}, (t) => [index('commitments_project').on(t.projectId)]).enableRLS();

export const changeOrders = pgTable('change_orders', {
  id: id(),
  commitmentId: uuid('commitment_id').notNull().references(() => commitments.id),
  description: text('description').notNull(),
  amount: money('amount').notNull(),
  approvedOn: date('approved_on'),
  created: created(),
  archived: archived(),
}).enableRLS();

export const billStatus = pgEnum('bill_status', ['entered', 'approved', 'paid']);
// invoice: a bill to pay; receipt: already paid at the counter or online;
// credit: a credit memo or return (negative lines).
export const billKind = pgEnum('bill_kind', ['invoice', 'receipt', 'credit']);

export const bills = pgTable('bills', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  // The main cost code (the first line's); lines carry the real split.
  costCodeId: uuid('cost_code_id').references(() => costCodes.id),
  commitmentId: uuid('commitment_id').references(() => commitments.id),
  vendorCompanyId: uuid('vendor_company_id').references(() => companies.id),
  vendorPersonId: uuid('vendor_person_id').references(() => people.id),
  vendorName: text('vendor_name'),
  kind: billKind('kind').notNull().default('invoice'),
  // Who the bill is made out to, when it isn't us (vendors often bill the GC).
  billedTo: text('billed_to'),
  invoiceNumber: text('invoice_number'),
  invoiceOn: date('invoice_on').notNull(),
  dueOn: date('due_on'),
  // The total; always the sum of its lines (src/lib/bill-lines.ts).
  amount: money('amount').notNull(),
  // A vendor invoice that is backup for a line on the GC's bill: kept and
  // shown, never counted again.
  includedInBillId: uuid('included_in_bill_id'),
  // Sub or GC (needs a lien waiver) vs a store or supplier (doesn't).
  lienWaiverRequired: boolean('lien_waiver_required').notNull().default(true),
  retainage: money('retainage'),
  status: billStatus('status').notNull().default('entered'),
  // Phase 1: a flag. Phase 2 makes lien waivers documents with their own record.
  lienWaiverReceived: boolean('lien_waiver_received').notNull().default(false),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  paidOn: date('paid_on'),
  // How it was paid: "AmEx", "Check 1042", "ACH". Never a card or account number.
  paidHow: text('paid_how'),
  fileId: uuid('file_id'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('bills_project').on(t.projectId), index('bills_included_in').on(t.includedInBillId)]).enableRLS();

// One bill split across cost codes. kind: build (a cost code), holding
// (utilities, taxes…), fee (the GC's management fee, on its cost code),
// not_project (personal or staging: kept, never counted).
export const billLines = pgTable('bill_lines', {
  id: id(),
  billId: uuid('bill_id').notNull().references(() => bills.id),
  kind: text('kind').notNull().default('build'),
  costCodeId: uuid('cost_code_id').references(() => costCodes.id),
  holdingKind: text('holding_kind'),
  description: text('description'),
  amount: money('amount').notNull(),
  sort: integer('sort').notNull().default(0),
}, (t) => [index('bill_lines_bill').on(t.billId)]).enableRLS();

export const dailyLogs = pgTable('daily_logs', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  loggedOn: date('logged_on').notNull(),
  onSite: text('on_site'),
  work: text('work').notNull(),
  weather: text('weather'),
  userId: uuid('user_id').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('daily_logs_project').on(t.projectId, t.loggedOn)]).enableRLS();

export const holdingCosts = pgTable('holding_costs', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  kind: text('kind').notNull(),
  incurredOn: date('incurred_on').notNull(),
  amount: money('amount').notNull(),
  notes: text('notes'),
  // Set when it came from a bill's holding line (shown there, counted once).
  billLineId: uuid('bill_line_id'),
  created: created(),
  archived: archived(),
}).enableRLS();

// Files (photos, bill PDFs). Bytes in the row until Supabase Storage is set,
// then storage_path. `entity` + `entity_id` say what it belongs to.
export const files = pgTable('files', {
  id: id(),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id').notNull(),
  name: text('name').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  data: bytea('data'),
  storagePath: text('storage_path'),
  caption: text('caption'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('files_entity').on(t.entity, t.entityId)]).enableRLS();

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updated: updated(),
}).enableRLS();


// Budget stages (owner, Oct 2, 2026): a rough estimate before design, the
// post-design budget with real numbers (structural engineer, GC), then the
// owner's approved budget, locked as the baseline. Each is a snapshot of the
// lines, so later changes show against it.
export const budgetVersions = pgTable('budget_versions', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  kind: text('kind').notNull(), // rough | design | approved
  label: text('label'),
  preparedBy: text('prepared_by'),
  lines: jsonb('lines').notNull(), // [{ costCodeId, cents }]
  totalCents: integer('total_cents').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
}, (t) => [index('budget_versions_project').on(t.projectId, t.created)]).enableRLS();

// The GC's schedule: milestones the commitments hang off.
export const milestones = pgTable('milestones', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  plannedStart: date('planned_start'),
  plannedEnd: date('planned_end'),
  actualStart: date('actual_start'),
  actualEnd: date('actual_end'),
  source: text('source'), // "GC schedule 9/8/26"
  sort: integer('sort').notNull().default(0),
  created: created(),
  archived: archived(),
}, (t) => [index('milestones_project').on(t.projectId, t.sort)]).enableRLS();

// Who supplies or does what, by when (owner: "a clear expectation if someone
// misses their commitment including myself"). Due is a fixed day or a number
// of days before or after a milestone, so it follows the GC's schedule.
export const assignments = pgTable('assignments', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  costCodeId: uuid('cost_code_id').references(() => costCodes.id),
  description: text('description').notNull(),
  responsible: text('responsible').notNull(), // gc | owner | vendor
  personId: uuid('person_id').references(() => people.id),
  companyId: uuid('company_id').references(() => companies.id),
  userId: uuid('user_id').references(() => users.id),
  gcAllowance: money('gc_allowance'), // what the GC budgeted for it
  ourCost: money('our_cost'), // what it costs us supplying it ourselves
  milestoneId: uuid('milestone_id').references(() => milestones.id),
  offsetDays: integer('offset_days'), // negative = before the milestone starts
  dueOn: date('due_on'),
  status: text('status').notNull().default('open'), // open | done
  doneOn: date('done_on'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('assignments_project').on(t.projectId)]).enableRLS();
