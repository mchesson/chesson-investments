// Chesson Investments database. Every table has row-level security enabled
// with no policies: the app connects as the owner role, and Supabase's
// anon / authenticated roles get nothing (see CLAUDE.md "Security").

import {
  boolean, customType, date, index, integer, jsonb, numeric, pgEnum, pgSequence, pgTable, primaryKey,
  text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const projectNumberSeq = pgSequence('project_number', { startWith: 1001 });
export const issueNumberSeq = pgSequence('issue_number', { startWith: 101 });

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });
const id = () => uuid('id').primaryKey().defaultRandom();
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const archived = () => timestamp('archived_at', { withTimezone: true });

// owner: everything; staff: no tax returns / PFS / investor money (later phases);
// accountant: projects' money only (banking, bills, loans, exports in later phases).
// guest: an outside person (a GC, a sub, a partner) who sees only the projects
// they're invited to, through /guest (guest_access says what on each).
export const userRole = pgEnum('user_role', ['pending', 'owner', 'staff', 'accountant', 'guest', 'admin', 'partner']);

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull(),
  name: text('name'),
  role: userRole('role').notNull().default('pending'),
  active: boolean('active').notNull().default(true),
  // The owner's ticks for this person (src/lib/permissions.ts); empty = the role's.
  permissions: text('permissions').array(),
  // What kind of outside person a guest is (src/lib/guests.ts guestTypes) and
  // what they may do beyond their projects (the deals they sent us).
  guestType: text('guest_type'),
  guestExtras: text('guest_extras').array(),
  // A guest's own record and company, when they're on file.
  personId: uuid('person_id'),
  companyId: uuid('company_id'),
  created: created(),
  lastSignIn: timestamp('last_sign_in', { withTimezone: true }),
}, (t) => [uniqueIndex('users_email').on(t.email)]).enableRLS();

// What a guest may see and do on one project (src/lib/guests.ts), until a day
// or until the owner takes it off.
export const guestAccess = pgTable('guest_access', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  can: text('can').array().notNull(),
  endsOn: date('ends_on'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  removed: timestamp('removed_at', { withTimezone: true }),
}, (t) => [index('guest_access_user').on(t.userId), index('guest_access_project').on(t.projectId)]).enableRLS();

// Sign-in links for people without a Technical Source Microsoft account (an
// invite or "email me a link"): only the SHA-256 is kept; one use; they expire.
export const signInLinks = pgTable('sign_in_links', {
  id: id(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull(),
  purpose: text('purpose').notNull(), // invite / sign_in
  expires: timestamp('expires_at', { withTimezone: true }).notNull(),
  used: timestamp('used_at', { withTimezone: true }),
  usedIp: text('used_ip'),
  emailedTo: text('emailed_to'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
}, (t) => [uniqueIndex('sign_in_links_hash').on(t.tokenHash), index('sign_in_links_user').on(t.userId)]).enableRLS();

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
  // Do Not Use (owner, Oct 2, 2026): set by hand with a reason, and later by a
  // grade of D or below. Never deletes anything; History keeps who and why.
  doNotUse: boolean('do_not_use').notNull().default(false),
  doNotUseReason: text('do_not_use_reason'),
  doNotUseAt: timestamp('do_not_use_at', { withTimezone: true }),
  doNotUseBy: uuid('do_not_use_by'),
  // Keep using them although their overall grade is D or below (owner, Oct 2, 2026), with why.
  gradeOverride: boolean('grade_override').notNull().default(false),
  gradeOverrideReason: text('grade_override_reason'),
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
  // Do Not Use (owner, Oct 2, 2026): set by hand with a reason, and later by a
  // grade of D or below. Never deletes anything; History keeps who and why.
  doNotUse: boolean('do_not_use').notNull().default(false),
  doNotUseReason: text('do_not_use_reason'),
  doNotUseAt: timestamp('do_not_use_at', { withTimezone: true }),
  doNotUseBy: uuid('do_not_use_by'),
  // Keep using them although their overall grade is D or below (owner, Oct 2, 2026), with why.
  gradeOverride: boolean('grade_override').notNull().default(false),
  gradeOverrideReason: text('grade_override_reason'),
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
  areas: text('areas'), // the summary shown and searched (src/lib/areas.ts)
  // Where they work, as values (agents: cities, ZIPs, neighborhoods); null on roles saved before Oct 3, 2026 (read from areas).
  cities: text('cities').array(),
  zips: text('zips').array(),
  neighborhoods: text('neighborhoods').array(),
  licenseNumber: text('license_number'),
  // A sub or supplier we didn't hire directly: their invoices come through
  // this GC (owner, Oct 2, 2026: "that makes them a subcontractor").
  hiredThroughCompanyId: uuid('hired_through_company_id'),
  // A supplier's kinds (Utilities, Lumber and Materials...; supplierTypes in
  // src/lib/roles.ts). Owner, Oct 2, 2026.
  supplierTypes: text('supplier_types').array(),
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
  // The association that held it (a company with the Association role).
  associationId: uuid('association_id').references(() => companies.id),
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
  // Where it is on the map, found from the county's parcel records (src/lib/market-sync.ts).
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lng: numeric('lng', { precision: 9, scale: 6 }),
  sourcePersonId: uuid('source_person_id').references(() => people.id),
  // Where it came from beyond the person (owner, Oct 2, 2026: "track the source and
  // over time see what proves to provide the best deals"; src/lib/deal-sources.ts).
  sourceCompanyId: uuid('source_company_id').references(() => companies.id),
  sourceKind: text('source_kind'), // wholesaler / agent / attorney / builder / owner / referral / driving / mail / online / other
  sourceAccurate: boolean('source_accurate'), // did the numbers they gave us hold up?
  sourceNote: text('source_note'),
  // The kind of deal: a lot or teardown, a house, land for a subdivision, commercial.
  dealType: text('deal_type').notNull().default('lot'),
  lotsPossible: integer('lots_possible'), // land: how many lots or units it could hold
  utilities: text('utilities'), // water_sewer / water_only / well_septic / nearby / unknown
  entitlement: text('entitlement'), // none / rezoning / site_plan / approved / recorded
  commercialUse: text('commercial_use'),
  checklist: jsonb('checklist').notNull().default({}), // land and commercial due diligence: { key: true }
  askingPrice: money('asking_price'),
  lotSf: integer('lot_sf'),
  lotAcres: numeric('lot_acres', { precision: 8, scale: 3 }),
  zoning: text('zoning'),
  // From the county zoning map (zoning-data.ts): what it allows, which town, when checked.
  zoningFamily: text('zoning_family'),
  zoningPlace: text('zoning_place'),
  zoningCheckedAt: timestamp('zoning_checked_at', { withTimezone: true }),
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
}, (t) => [index('properties_stage').on(t.stage), index('properties_source').on(t.sourcePersonId), index('properties_source_company').on(t.sourceCompanyId)]).enableRLS();

export const projectStage = pgEnum('project_stage', [
  'under_contract', 'design', 'permits', 'building', 'presold_listed', 'closed', 'rental',
]);

export const projects = pgTable('projects', {
  id: id(),
  // P-1001 and up, from its own sequence, assigned once and never reused.
  projectNumber: integer('project_number').default(sql`nextval('project_number')`),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city'),
  state: text('state').default('NC'),
  zip: text('zip'),
  neighborhood: text('neighborhood'),
  // Where it is on the map, found from the county's parcel records (src/lib/market-sync.ts).
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lng: numeric('lng', { precision: 9, scale: 6 }),
  propertyId: uuid('property_id').references(() => properties.id),
  // Which entity holds title (Chesson Investments, LLC; WJ Invest Group…).
  // Later phases make entities their own records (investors, banking).
  ownedBy: text('owned_by'),
  stage: projectStage('stage').notNull().default('under_contract'),
  // Several stages can be going at once: each one's state (not_started /
  // active / done) and its sub-stage (src/lib/project-stages.ts). Empty = read
  // from `stage`. A rental's sub-stage is rentals.status.
  stageStates: jsonb('stage_states').$type<Record<string, string>>().notNull().default({}),
  subStages: jsonb('sub_stages').$type<Record<string, string>>().notNull().default({}),
  lotSf: integer('lot_sf'),
  lotAcres: numeric('lot_acres', { precision: 8, scale: 3 }),
  zoning: text('zoning'),
  zoningFamily: text('zoning_family'),
  zoningPlace: text('zoning_place'),
  zoningCheckedAt: timestamp('zoning_checked_at', { withTimezone: true }),
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
  // The whole cost of selling from the settlement statement (commissions and
  // closing together). Once set it replaces the commission % and the closing
  // cost estimate (Hillock was counted twice before, Oct 3, 2026).
  actualSaleCosts: money('actual_sale_costs'),
  // What the finished house would sell for today (a broker's opinion, comps,
  // an appraisal): the check against over-building.
  marketValue: money('market_value'),
  marketValueOn: date('market_value_on'),
  marketValueSource: text('market_value_source'),
  // Our finish level, so comps at the same level stand out (src/lib/comps.ts).
  finishLevel: text('finish_level'),
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
  // The public website (chessoninvestments.com), served by this app. Nothing
  // shows until a website status is chosen; only these fields and the photos
  // marked for the website ever go out (src/lib/site.ts toPublicProject).
  siteStatus: text('site_status'),
  siteSlug: text('site_slug'),
  sitePrice: money('site_price'),
  siteTagline: text('site_tagline'),
  siteDescription: text('site_description'),
  siteBeds: numeric('site_beds', { precision: 4, scale: 1 }),
  siteBaths: numeric('site_baths', { precision: 4, scale: 1 }),
  siteDetails: text('site_details'),
  siteTeam: text('site_team'),
  siteFeatured: boolean('site_featured').notNull().default(false),
  siteSort: integer('site_sort').notNull().default(0),
  siteUpdatedAt: timestamp('site_updated_at', { withTimezone: true }),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  updated: updated(),
  archived: archived(),
}, (t) => [uniqueIndex('projects_site_slug').on(t.siteSlug), uniqueIndex('projects_number').on(t.projectNumber)]).enableRLS();

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
  // Project photos: before / after / plan / progress; only those marked for the
  // website are ever served without a sign-in (/photos/<id>).
  photoKind: text('photo_kind'),
  onSite: boolean('on_site').notNull().default(false),
  sort: integer('sort').notNull().default(0),
  sourceUrl: text('source_url'),
  // A dropped document about a property we don't have yet: the address and
  // facts read from it, so the drop page can offer to create the project.
  proposedProperty: jsonb('proposed_property').$type<import('@/lib/doc-filing').NewProperty>(),
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
  lines: jsonb('lines').notNull(), // [{ costCodeId, cents, note? }]
  totalCents: integer('total_cents').notNull(),
  // A GC's bid (kind 'bid') or our own estimate (kind 'ours'), Oct 2, 2026:
  // who sent it, when, the terms, and whether it won.
  companyId: uuid('company_id').references(() => companies.id),
  personId: uuid('person_id').references(() => people.id),
  submittedOn: date('submitted_on'),
  contractType: text('contract_type'), // fixed | cost_plus
  feePct: numeric('fee_pct', { precision: 5, scale: 2 }),
  validUntil: date('valid_until'),
  status: text('status'), // open | selected | declined
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedReason: text('decided_reason'),
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


// Who supplies each utility at a property (owner, Oct 2, 2026): the company
// (a Supplier with the Utilities type) and the person we deal with there.
export const projectUtilities = pgTable('project_utilities', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  service: text('service').notNull(),
  companyId: uuid('company_id').references(() => companies.id),
  personId: uuid('person_id').references(() => people.id),
  startedOn: date('started_on'),
  endedOn: date('ended_on'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  removed: timestamp('removed_at', { withTimezone: true }),
}, (t) => [index('project_utilities_project').on(t.projectId), index('project_utilities_company').on(t.companyId)]).enableRLS();

// Rentals (owner, Oct 2, 2026; docs/roadmap.md "Next" item 7). One row per
// rented property: its status on the market, the property manager and their
// terms, and the monthly costs we expect (for cash flow before actuals exist).
export const rentals = pgTable('rentals', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  // long_term / mid_term / short_term (src/lib/rentals.ts): each has its own statuses.
  kind: text('kind').notNull().default('long_term'),
  status: text('status').notNull().default('getting_ready'), // leases: getting_ready | on_market | application | leased | notice | vacant; short-term: getting_ready | listed | operating | paused
  askingRent: money('asking_rent'),
  listedOn: date('listed_on'),
  listedWhere: text('listed_where'),
  managerCompanyId: uuid('manager_company_id').references(() => companies.id),
  managerPersonId: uuid('manager_person_id').references(() => people.id),
  managementFeePct: numeric('management_fee_pct', { precision: 5, scale: 2 }),
  leasingFee: money('leasing_fee'),
  managementTerms: text('management_terms'),
  taxesMonthly: money('taxes_monthly'),
  insuranceMonthly: money('insurance_monthly'),
  hoaMonthly: money('hoa_monthly'),
  utilitiesMonthly: money('utilities_monthly'),
  repairsReservePct: numeric('repairs_reserve_pct', { precision: 5, scale: 2 }),
  vacancyPct: numeric('vacancy_pct', { precision: 5, scale: 2 }),
  notes: text('notes'),
  created: created(),
  updated: updated(),
}, (t) => [uniqueIndex('rentals_project').on(t.projectId)]).enableRLS();

export const leases = pgTable('leases', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  tenants: text('tenants').notNull(),
  rent: money('rent').notNull(),
  dueDay: integer('due_day'),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on'),
  renewalTerms: text('renewal_terms'),
  decideBy: date('decide_by'),
  deposit: money('deposit'),
  depositHeldBy: text('deposit_held_by'),
  depositReturned: money('deposit_returned'),
  pets: text('pets'),
  utilitiesPaidBy: text('utilities_paid_by'),
  terms: text('terms'),
  status: text('status').notNull().default('active'), // active | ended
  endedOn: date('ended_on'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
}, (t) => [index('leases_project').on(t.projectId)]).enableRLS();

// Money in: rent and the rest, as the manager's statements or the bank show it.
export const rentReceipts = pgTable('rent_receipts', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  leaseId: uuid('lease_id').references(() => leases.id),
  receivedOn: date('received_on').notNull(),
  forMonth: date('for_month'),
  kind: text('kind').notNull().default('rent'), // rent | late_fee | deposit | other
  amount: money('amount').notNull(),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('rent_receipts_project').on(t.projectId, t.receivedOn)]).enableRLS();

// The bank loan against a property. No account numbers, ever.
export const loans = pgTable('loans', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  lenderCompanyId: uuid('lender_company_id').references(() => companies.id),
  lenderName: text('lender_name'),
  originalAmount: money('original_amount'),
  balance: money('balance'),
  balanceOn: date('balance_on'),
  ratePct: numeric('rate_pct', { precision: 6, scale: 3 }),
  monthlyPayment: money('monthly_payment'),
  escrowIncluded: boolean('escrow_included').notNull().default(false),
  startedOn: date('started_on'),
  maturesOn: date('matures_on'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('loans_project').on(t.projectId)]).enableRLS();

// The property manager's people on a rental (owner, Oct 2, 2026): one or more
// from the manager company, one of them the main contact for this property.
export const rentalContacts = pgTable('rental_contacts', {
  id: id(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  personId: uuid('person_id').notNull().references(() => people.id),
  main: boolean('main').notNull().default(false),
  created: created(),
}, (t) => [uniqueIndex('rental_contacts_one').on(t.projectId, t.personId)]).enableRLS();

// Possible duplicates someone said are different (owner, Oct 2, 2026: like
// names). One row per pair (ids in order), so the Possible Duplicates page
// stops listing it.
export const duplicateDismissals = pgTable('duplicate_dismissals', {
  id: id(),
  kind: text('kind').notNull(), // person / company
  aId: uuid('a_id').notNull(),
  bId: uuid('b_id').notNull(),
  dismissedBy: uuid('dismissed_by').references(() => users.id),
  created: timestamp('created', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('duplicate_dismissals_pair').on(t.kind, t.aId, t.bId)]).enableRLS();

// Grades for a contractor's or vendor's work, one per job (owner, Oct 2, 2026:
// "put a justification in the grades section"). A company or a person (one of
// the two); the overall grade is the average (src/lib/grades.ts), and D or
// below marks them Do Not Use unless overridden.
export const grades = pgTable('grades', {
  id: id(),
  companyId: uuid('company_id').references(() => companies.id),
  personId: uuid('person_id').references(() => people.id),
  projectId: uuid('project_id').references(() => projects.id),
  grade: text('grade').notNull(), // A B C D F
  quality: text('quality'), schedule: text('schedule'), budget: text('budget'), communication: text('communication'),
  justification: text('justification').notNull(),
  gradedBy: uuid('graded_by').references(() => users.id),
  gradedOn: date('graded_on').notNull(),
  created: created(),
  archived: archived(),
}, (t) => [index('grades_company').on(t.companyId), index('grades_person').on(t.personId), index('grades_project').on(t.projectId)]).enableRLS();

// Issues with a contractor or vendor (owner, Oct 2, 2026): each open item with
// its status, the time it took to fix and who was involved.
export const vendorIssues = pgTable('vendor_issues', {
  id: id(),
  number: integer('number').default(sql`nextval('issue_number')`),
  companyId: uuid('company_id').references(() => companies.id),
  personId: uuid('person_id').references(() => people.id),
  projectId: uuid('project_id').references(() => projects.id),
  title: text('title').notNull(),
  details: text('details'),
  severity: text('severity').notNull().default('medium'), // low / medium / high
  status: text('status').notNull().default('open'), // src/lib/issues.ts
  reportedOn: date('reported_on').notNull(),
  dueOn: date('due_on'),
  resolvedOn: date('resolved_on'),
  resolution: text('resolution'),
  costToFix: money('cost_to_fix'),
  // The vendor's own update, from the guest pages ("fixed, please check").
  vendorNote: text('vendor_note'),
  vendorNoteAt: timestamp('vendor_note_at', { withTimezone: true }),
  vendorNoteBy: uuid('vendor_note_by').references(() => users.id),
  reportedBy: uuid('reported_by').references(() => users.id),
  statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
  created: created(),
  archived: archived(),
}, (t) => [index('vendor_issues_company').on(t.companyId, t.status), index('vendor_issues_person').on(t.personId, t.status), index('vendor_issues_project').on(t.projectId)]).enableRLS();

// Who was involved in an issue: people on file (theirs or ours) and our staff.
export const issuePeople = pgTable('issue_people', {
  id: id(),
  issueId: uuid('issue_id').notNull().references(() => vendorIssues.id),
  personId: uuid('person_id').references(() => people.id),
  userId: uuid('user_id').references(() => users.id),
  role: text('role'), // what they did: reported it, fixed it, signed off
  created: created(),
}, (t) => [index('issue_people_issue').on(t.issueId), index('issue_people_person').on(t.personId)]).enableRLS();

// County parcel records with a recent sale (owner, Oct 2, 2026: "we are
// connecting to Wake County public data but we need to look at Durham and
// other surrounding areas"): what sold, where, for how much and how big, for
// the market map and the buy box. Public records, refreshed by Update Market
// Data (src/lib/market-sync.ts). Never edited by hand.
export const marketParcels = pgTable('market_parcels', {
  id: id(),
  county: text('county').notNull(), // wake / durham
  parcelKey: text('parcel_key').notNull(), // the county's REID
  address: text('address'),
  street: text('street'), // "PEYTON ST"
  city: text('city'),
  zip: text('zip'),
  neighborhood: text('neighborhood'), // Durham's neighborhood, Wake's subdivision
  landUse: text('land_use'), // single_family / townhouse / condo / multi_family / land / other
  heatedSf: integer('heated_sf'),
  yearBuilt: integer('year_built'),
  acres: numeric('acres', { precision: 10, scale: 3 }),
  assessedValue: money('assessed_value'),
  ownerName: text('owner_name'),
  absentee: boolean('absentee'), // mailing address isn't the property
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lng: numeric('lng', { precision: 9, scale: 6 }),
  lastSalePrice: money('last_sale_price'),
  lastSaleOn: date('last_sale_on'),
  updated: updated(),
}, (t) => [
  uniqueIndex('market_parcels_key').on(t.county, t.parcelKey),
  index('market_parcels_sale').on(t.lastSaleOn),
  index('market_parcels_latlng').on(t.lat, t.lng),
  index('market_parcels_hood').on(t.neighborhood),
  index('market_parcels_street').on(t.street, t.city),
  index('market_parcels_address').on(t.county, t.address), // builders' permits matched to the sale of the same address
]).enableRLS();

// Every sale we've seen on a parcel (the county shows only the latest, so the
// history grows each time we refresh).
export const marketSales = pgTable('market_sales', {
  id: id(),
  parcelId: uuid('parcel_id').notNull().references(() => marketParcels.id),
  soldOn: date('sold_on').notNull(),
  price: money('price').notNull(),
  heatedSf: integer('heated_sf'),
  created: created(),
}, (t) => [uniqueIndex('market_sales_once').on(t.parcelId, t.soldOn, t.price), index('market_sales_on').on(t.soldOn)]).enableRLS();

// Each refresh of a county's data: how far it got, what it added.
export const marketSyncs = pgTable('market_syncs', {
  id: id(),
  county: text('county').notNull(),
  status: text('status').notNull().default('running'), // running / done / failed
  since: date('since').notNull(),
  offset: integer('offset').notNull().default(0),
  total: integer('total'),
  parcels: integer('parcels').notNull().default(0),
  newSales: integer('new_sales').notNull().default(0),
  error: text('error'),
  startedBy: uuid('started_by').references(() => users.id),
  started: created(),
  finished: timestamp('finished_at', { withTimezone: true }),
}, (t) => [index('market_syncs_county').on(t.county, t.started)]).enableRLS();

// Free market data beyond the county sales (owner, Oct 2, 2026: "proceed with
// free items"; src/lib/market-feeds.ts). Public, read-only from each source,
// refreshed from the Market Map's Update Market Data. Never edited by hand.

// The 30-year mortgage rate each week (Freddie Mac's survey, through FRED).
export const marketRates = pgTable('market_rates', {
  id: id(),
  series: text('series').notNull(), // '30yr'
  week: date('week').notNull(),
  rate: numeric('rate', { precision: 5, scale: 2 }).notNull(),
}, (t) => [uniqueIndex('market_rates_week').on(t.series, t.week)]).enableRLS();

// Redfin's market data by ZIP code and county, 3-month rolling, each month.
export const marketTrends = pgTable('market_trends', {
  id: id(),
  regionType: text('region_type').notNull(), // zip / county
  region: text('region').notNull(), // '27608', 'Wake County, NC'
  metro: text('metro'),
  propertyType: text('property_type').notNull(), // all / single_family / townhouse / condo / multi_family
  periodEnd: date('period_end').notNull(),
  medianSalePrice: money('median_sale_price'),
  medianListPrice: money('median_list_price'),
  medianPpsf: numeric('median_ppsf', { precision: 10, scale: 1 }),
  homesSold: integer('homes_sold'),
  pendingSales: integer('pending_sales'),
  newListings: integer('new_listings'),
  inventory: integer('inventory'),
  monthsOfSupply: numeric('months_of_supply', { precision: 6, scale: 1 }),
  medianDom: numeric('median_dom', { precision: 6, scale: 1 }),
  saleToList: numeric('sale_to_list', { precision: 6, scale: 4 }),
  soldAboveList: numeric('sold_above_list', { precision: 6, scale: 4 }),
  priceDrops: numeric('price_drops', { precision: 6, scale: 4 }),
  offMarket2Wk: numeric('off_market_2wk', { precision: 6, scale: 4 }),
}, (t) => [uniqueIndex('market_trends_once').on(t.regionType, t.region, t.propertyType, t.periodEnd), index('market_trends_period').on(t.periodEnd)]).enableRLS();

// Building permits: new homes and teardowns (Raleigh and Durham open data).
export const marketPermits = pgTable('market_permits', {
  id: id(),
  source: text('source').notNull(), // raleigh / durham_demo / durham_new
  county: text('county').notNull(),
  permitNo: text('permit_no').notNull(),
  kind: text('kind').notNull(), // new_home / demolition
  issuedOn: date('issued_on'),
  year: integer('year').notNull(),
  address: text('address'),
  city: text('city'),
  zip: text('zip'),
  lat: numeric('lat', { precision: 9, scale: 6 }),
  lng: numeric('lng', { precision: 9, scale: 6 }),
  cost: money('cost'),
  sf: integer('sf'),
  units: integer('units'),
  builder: text('builder'),
  description: text('description'),
  status: text('status'),
  updated: updated(),
}, (t) => [uniqueIndex('market_permits_key').on(t.source, t.permitNo), index('market_permits_latlng').on(t.lat, t.lng), index('market_permits_year').on(t.kind, t.year)]).enableRLS();

// Business entities (owner, Oct 3, 2026: "give me a place in the system to
// track business docs like this and a section for tax IDs"): the companies we
// own or hold a share of (Chesson Investments, WJ Investment Group), who owns
// what, their documents (files with entity 'entity') and their tax IDs. Seen
// only with the restricted-records permission (sensitive.view).
export const entities = pgTable('entities', {
  id: id(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('llc'), // llc / corporation / partnership / trust / other
  state: text('state'), // where it was formed
  formedOn: date('formed_on'),
  status: text('status').notNull().default('active'), // active / dissolved
  taxForm: text('tax_form'), // how it files: 1065 partnership, 1120-S, disregarded (Schedule C/E) ...
  fiscalYearEnd: text('fiscal_year_end'), // "12/31"
  address: text('address'),
  registeredAgent: text('registered_agent'),
  website: text('website'),
  companyId: uuid('company_id').references(() => companies.id), // the same business as a CRM company (for bills and contacts)
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  updated: updated(),
  archived: archived(),
}, (t) => [index('entities_company').on(t.companyId)]).enableRLS();

// Who owns an entity, and how much: a person, another of our entities (Chesson
// Investments owns 65% of WJ Investment Group) or just a name.
export const entityMembers = pgTable('entity_members', {
  id: id(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  name: text('name').notNull(),
  personId: uuid('person_id').references(() => people.id),
  memberEntityId: uuid('member_entity_id').references(() => entities.id),
  percent: numeric('percent', { precision: 7, scale: 4 }),
  capital: money('capital'), // capital contribution
  role: text('role'), // member / manager / member_manager
  since: date('since'),
  notes: text('notes'),
  created: created(),
  removed: timestamp('removed_at', { withTimezone: true }),
}, (t) => [index('entity_members_entity').on(t.entityId), index('entity_members_person').on(t.personId), index('entity_members_member_entity').on(t.memberEntityId)]).enableRLS();

// Tax and registration numbers (EIN, state tax and withholding IDs, Secretary of
// State ID). Kept encrypted (AES-256-GCM, src/lib/secret-box.ts); the page shows
// the last 4, and every Show is written to History.
export const entityTaxIds = pgTable('entity_tax_ids', {
  id: id(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  kind: text('kind').notNull(), // ein / state_tax / withholding / sales_tax / sos / other
  label: text('label'),
  cipher: text('cipher').notNull(),
  last4: text('last4').notNull(),
  issuedOn: date('issued_on'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  updated: updated(),
  archived: archived(),
}, (t) => [index('entity_tax_ids_entity').on(t.entityId)]).enableRLS();

// Business overhead (owner, Oct 3, 2026: "a general overhead receipt and where it
// might go"): spending for the business itself, not one property, under the
// business entity it's for. Read from the receipt by the document drop, or typed.
export const overheadExpenses = pgTable('overhead_expenses', {
  id: id(),
  entityId: uuid('entity_id').notNull().references(() => entities.id),
  fileId: uuid('file_id').references(() => files.id),
  vendor: text('vendor'),
  amount: money('amount'),
  spentOn: date('spent_on'),
  category: text('category').notNull().default('other'),
  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  archived: archived(),
}, (t) => [index('overhead_entity_on').on(t.entityId, t.spentOn)]).enableRLS();

// Comparable sales (owner, Oct 3, 2026: "break those down in to public data comps
// private data comps etc to know how many we looked at and talk about the trim
// level of those comps"). On a project (or a watched property, for the analysis
// before an offer). Source, finish level and adjustments are what tell them
// apart; src/lib/comps.ts has the rules. Read from an appraisal by Claude
// (checked = false until a person looks), offered from county sales, or typed.
export const comps = pgTable('comps', {
  id: id(),
  projectId: uuid('project_id').references(() => projects.id),
  propertyId: uuid('property_id').references(() => properties.id),
  source: text('source').notNull(), // public_record / appraisal / new_build / broker / listing / private
  status: text('status').notNull().default('sold'), // sold / pending / active / presale / appraised
  address: text('address').notNull(),
  city: text('city'),
  neighborhood: text('neighborhood'),
  soldOn: date('sold_on'),
  price: money('price'),
  heatedSf: integer('heated_sf'),
  beds: numeric('beds', { precision: 4, scale: 1 }),
  baths: numeric('baths', { precision: 4, scale: 1 }),
  yearBuilt: integer('year_built'),
  lotAcres: numeric('lot_acres', { precision: 8, scale: 3 }),
  finishLevel: text('finish_level'), // basic / builder / upgraded / high / luxury
  quality: text('quality'), // the appraisal's rating as written (Q3, C1)
  distanceMi: numeric('distance_mi', { precision: 6, scale: 2 }),
  adjustments: jsonb('adjustments').$type<{ label: string; amount: number }[]>().notNull().default([]),
  adjustedPrice: money('adjusted_price'),
  counted: boolean('counted').notNull().default(true), // used in the value range
  checked: boolean('checked').notNull().default(true), // false: read by Claude, not looked at yet
  notes: text('notes'),
  fileId: uuid('file_id').references(() => files.id),
  marketSaleId: uuid('market_sale_id').references(() => marketSales.id),
  // A presale or pending sale (owner, Oct 3, 2026: "keep an eye out for when it
  // closes"): the expected closing, then what the county recorded once it did.
  expectedCloseOn: date('expected_close_on'),
  actualPrice: money('actual_price'),
  actualSoldOn: date('actual_sold_on'),
  closeFoundAt: timestamp('close_found_at', { withTimezone: true }),
  // Who gave it to us, so we learn whose numbers hold up ("determine who gives
  // reliable info"). Private comps mostly; public records come from the county.
  providedByPersonId: uuid('provided_by_person_id').references(() => people.id),
  providedByCompanyId: uuid('provided_by_company_id').references(() => companies.id),
  // Who built it (owner, Oct 3, 2026: "separate data from customer home builders
  // and track builders"). A custom build for an owner on their own lot isn't a
  // market sale of a finished house, so it's kept out of the value by default.
  builderName: text('builder_name'),
  customBuild: boolean('custom_build').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id),
  created: created(),
  updated: updated(),
  archived: archived(),
}, (t) => [index('comps_project').on(t.projectId), index('comps_property').on(t.propertyId)]).enableRLS();
// Leads from the public website's forms (owner, Oct 3, 2026: "a place to track
// leads through the website and track what happens"): Contact Us and Sell Us
// Your Property, where they came from, and how we worked them. Rules in
// src/lib/site-leads.ts. `ip_hash` is a salted hash of the sender's address,
// changing daily, kept only to slow down repeat sending; never the address itself.
export const siteLeads = pgTable('site_leads', {
  id: id(),
  kind: text('kind').notNull(), // contact / sell
  status: text('status').notNull().default('new'), // new / contacted / qualified / closed / not_a_fit
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  topic: text('topic'),
  message: text('message'),
  propertyAddress: text('property_address'),
  propertyCity: text('property_city'),
  propertyKind: text('property_kind'),
  condition: text('condition'),
  timeline: text('timeline'),
  askingPrice: text('asking_price'),
  referrer: text('referrer'),
  landingPage: text('landing_page'),
  formPage: text('form_page'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  ipHash: text('ip_hash'),
  handledBy: uuid('handled_by').references(() => users.id),
  statusChangedAt: timestamp('status_changed_at', { withTimezone: true }),
  personId: uuid('person_id').references(() => people.id),
  propertyId: uuid('property_id').references(() => properties.id),
  alertSent: boolean('alert_sent'),
  created: created(),
  updated: updated(),
  archived: archived(),
}, (t) => [index('site_leads_status').on(t.status, t.created), index('site_leads_ip').on(t.ipHash, t.created)]).enableRLS();

export const siteLeadNotes = pgTable('site_lead_notes', {
  id: id(),
  leadId: uuid('lead_id').notNull().references(() => siteLeads.id),
  text: text('text').notNull(),
  userId: uuid('user_id').references(() => users.id),
  created: created(),
}, (t) => [index('site_lead_notes_lead').on(t.leadId, t.created)]).enableRLS();

// Visits to the website, counted on our own server: a page and a day, nothing
// about who (no cookies, no addresses). Search engines and link checkers aren't counted.
export const sitePageViews = pgTable('site_page_views', {
  day: date('day').notNull(),
  path: text('path').notNull(),
  views: integer('views').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.day, t.path] })]).enableRLS();
