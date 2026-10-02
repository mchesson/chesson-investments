@AGENTS.md

# Chesson Investments

The owner's private app for **Chesson Investments, LLC** (Triangle, NC): buys
infill lots, builds new homes, renovates, may hold rentals, and will raise money
from an investor group. **Fully separate from Technical Source / TS Workspace**
(owner, Oct 2, 2026: "two separate projects"): its own repo, database, Vercel
project and Entra app. Only the look is shared. There is no in-house developer:
it is built and maintained through Claude sessions, so keep things simple,
documented and consistent with this file. Explain things to the owner (Matthew
Chesson) in plain language, with click-by-click steps whenever he has to act.

## Stack
- **Next.js 16** (App Router, TypeScript, Server Actions). Read the bundled docs
  in `node_modules/next/dist/docs/` before using an API (see AGENTS.md). No proxy
  file: every page calls `requirePage`, every action `requireAction`
  (`src/lib/session.ts`); the role is read from the database on every request.
- **Postgres** through **Drizzle ORM** (`src/db/schema.ts`, migrations in
  `drizzle/`), hosted on **Supabase**: project `chesson-investments`
  (ref `qzhepiymbanpsuspnjpq`, East US), created Oct 2, 2026 in the existing
  **Technical Source** Supabase organization (owner: "create new projects under
  my current accounts, not new accounts"), so it shares that org's Pro plan and
  daily backups; the extra project's compute is billed to that org.
- **Auth.js** (`next-auth` v5) with **Microsoft Entra ID**: the owner signs in
  with his Technical Source Microsoft 365 account (owner, Oct 2, 2026), through a
  separate single-tenant Entra app **Chesson Investments** (not TS Workspace's).
  Built so email-link sign-in can be added later for accountants, partners,
  investors and subs (a second provider in `src/auth.ts`).
- **Vercel**: a project in the existing TS ATS team (same reason), deploys `main`.
  `vercel-build` runs `scripts/migrate.ts` before `next build`.
- Fonts self-hosted via `@fontsource-variable` (Vollkorn, Open Sans).
- Tests: `npm test` (node:test, `src/lib/*.test.ts`), `npm run test:e2e`
  (Playwright, `e2e/`; in Claude's cloud environment set
  `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`).

## Owner's workflow (as on his other projects)
- **Every time something merges and goes live, give the owner the app's link
  again** (owner, Oct 2, 2026): https://chesson-investments.vercel.app, plus a
  direct link to the page that changed when there is one (the website:
  https://chesson-investments.vercel.app/site).
- Every change goes through a pull request. **Claude merges its own pull
  requests** once `npm run typecheck`, `npm run build`, `npm test` and the
  end-to-end tests pass and there's no conflict. Then tell the owner in plain
  words what changed, with the link to try it.
- Anything the owner should decide first (costs, who sees what, business rules,
  deleting data) waits for his answer. Tell him the cost before any paid service.
- Claude sessions: keys stay in the environment, never printed or committed;
  production changes go through merged pull requests or the app.

## Look (same as TS Workspace)
Colors Near Black `#212121`, True Blue `#0D71BA`, Aqua `#00BAB4`, Energy
`#C0D961`, Ash Grey `#898989`, Light Grey `#BCBCBC` (Aqua and Energy never as
text on white: `--aqua-deep`, `--energy-deep`). Vollkorn headings, Open Sans body,
Title Case for headings and buttons. White top bar with the "Chesson
Investments" wordmark; Near Black left menu with line icons that collapses to a
rail (remembered in localStorage `ci-sidenav`) and is a drawer under 768px.
**Stages** (owner, Oct 2, 2026): several stages can be going at once. Each
stage has a state (Not Started / Going Now / Done, `projects.stage_states`) and
a sub-stage (`projects.sub_stages`; a Rental's is `rentals.status`); every
stage's sub-stages are in `src/lib/project-stages.ts` (tested). `projects.stage`
is kept as the main stage (the latest going now). The stage bar at the top of a
project (`src/components/StageBar.tsx`) shows every stage (going now True Blue
with its sub-stage, done ticked); tap one to open it beneath (`?stage=`), mark
its state and tap where it stands (History "via stage bar"). Lists show every
stage going now (`StageChips`). Short lists of choices are **buttons**, not
dropdowns (`<Choice>` in src/components/Choice.tsx; filters are `.role-btn`
links); long lists (companies, people, cost codes) stay dropdowns.
**Like names** (owner, Oct 2, 2026): adding or renaming a person or company
stops when the name looks like one on file (nicknames, typos, accents, Inc. /
LLC, one name inside the other; numbers must agree; `src/lib/duplicates.ts`,
tested); "Different person / company" saves anyway (History). The import
preview flags them; admins see every pair at /admin/duplicates (Not the Same).
`ActionForm` keeps what was typed when a save shows an error.
Sections are framed in their own color (left edge, border, deeper heading tint, shadow).
Every page is framed sections with a colored heading band (`<Section kind>` in
`src/components/ui.tsx`): **blue** details and money, **aqua** places,
properties and documents, **energy** notes, touches and follow-ups, **grey**
history and filters. Lists start with a grey "Find …" section. Record pages:
the card on the left, tabs on the right (`?tab=`; the first tab is the plain
address). Styles: `src/app/globals.css`.

## Roles (src/lib/permissions.ts)
- **Owner**: everything (users, approving bills, later the sensitive records).
  `OWNER_EMAILS` become Owners at sign-in.
- **Staff**: contacts, watchlist, projects and entering bills. Later: never tax
  returns, the personal financial statement or investor money.
- **Accountant**: projects' money and bills only (later banking, loans, exports).
- **Waiting for Access**: anyone else from the tenant who signs in.
- Later: invited outsiders (partners, investors, subs) scoped to their own records.
- **Sensitive records (later phases)**: tax returns, the PFS, IDs, W-9s, EINs,
  bank statements. Permission `sensitive.view` (Owner); numbers masked; every
  view written to History. The owner sent driver's licenses: never read; restricted.

## Data model (phase 1)
- **people / companies**: one record each. **party_roles**: many roles per
  record, each with its own stage (`src/lib/roles.ts`, data not screens): GC and
  Subcontractor (Met, Talking, Bid, Hired, Preferred, Avoid; trade, areas,
  license #), Supplier, Agent/Broker and Wholesaler (Met, Talking, Sent a Deal,
  Closed a Deal; moved forward automatically when they send a deal or it goes
  under contract), Lender, Attorney/Title, Designer/Engineer/Surveyor, Property
  Manager, Investor, Landowner/Seller, Networking (Met, Keeping in Touch), and
  **Personal Connection** (Friend, Family, Acquaintance: friends who introduce us
  to people but aren't in the business; People → "Business contacts only"
  hides people whose only role is this; Going Cold after 180 days).
- **How we know them** (owner, Oct 2, 2026: "most people that we meet are
  through networks and intros"): `people.how_met` (`src/lib/how-met.ts`),
  `introduced_by_id` (always a person on file: typing a new name adds them),
  `intro_note`, `met_at_event_id`. The introducer's page lists everyone they
  introduced, with the notes, as links; the person's page links back.
- **Subs through a GC** (owner, Oct 2, 2026: "when there is a GC and the
  invoice from the contractor comes through them that makes them a
  subcontractor"): `party_roles.hired_through_company_id`. A trade whose
  invoices come through the GC is a **Subcontractor** (with its trade, stage
  Hired) "through" that GC; a store or supplier billing the GC is a
  **Supplier**. The GC's page lists "Subs and Suppliers Through Them". People
  met at those companies get the same label.
- **Import** (/admin/import, Owner): a JSON file Claude prepares (from the
  owner's email and project folders) with people, companies, projects and
  bills; previewed first, then added in one transaction (History "via import
  from email and folders"). Matches by email, phone, then name; only fills
  empty fields; skips bills already on file. Rules: `src/lib/import-plan.ts`.
- **person_companies**: work history that follows the person.
- **touches** (call, email, text, meeting, site walk, event), **tasks** (My
  Tasks), **events** + **event_people** (adding someone logs an event touch),
  **saved_lists** for outreach. **Going Cold**: days per role (`coldDays`).
- **Deal-source credit**: `properties.source_person_id`; deals sent, met buy
  box, closed and referral fees on the person's Deals Sent tab.
- **properties** (leads and watchlist): Watching, Analyzing, Offer Made, Under
  Contract (Make It a Project), Lost (keeps our offer, the winning price and
  buyer), Passed, Sold (a comparable: off the active list, still searchable).
- **projects**: stages Under Contract … Closed, Rental; `owned_by` (the entity on
  the deed). Money: lot cost, sale scenarios Low / Mid (pro forma) / High
  (as in the owner's project sheets), commissions %, closing cost at sale, what
  we keep (staging furniture, tools: added back), tax rate, and **market value
  today**: the over-building check (owner, Oct 2, 2026, on 420 Peyton: "the
  house is only worth around 425 to 450 on the market so we are a loser"), red
  when the all-in cost is more than it nets.
- **cost_codes** (31: the 210 Plainview list plus 28 General Conditions / Site
  Services, 29 Porch / Deck / Driveway, 30 Due Diligence / Closing Costs (kind
  acquisition: counts with the lot), 31 Staging / Listing / Marketing (kind
  selling)); **budget_lines** (an amount, or a percent of the construction
  subtotal: Management 13.87%, Contingency 5%); **project_items** (not priced yet).
- **commitments** (vendor, scope, amount, retainage %, contract type fixed /
  cost-plus with fee % / hourly) + **change_orders**.
- **bills** (invoice / receipt / credit; billed to; due date; retainage; lien
  waiver required for subs and GCs, not stores and suppliers; approve, then
  paid: never paid without approval and a required waiver) split into
  **bill_lines** (build on a cost code, GC fee, holding, not for this project).
  **Backup**: a vendor invoice attached to a GC's bill (`included_in_bill_id`)
  is shown with it and never counted twice. Learned from 420 Peyton: the GC
  (Luxury Oaks) re-bills vendor invoices at cost plus a 20% construction
  management fee, with credits; vendors bill the GC, not us.
- **Budget stages** (owner, Oct 2, 2026): `budget_versions` snapshots the
  budget as the **Rough Estimate** (before design), the **Post-Design Budget**
  (real numbers from the structural engineer and GC) and the **Approved
  Budget** (Owner only; the newest approved one is the baseline). The Budget
  tab compares them line by line, with the current budget vs approved.
- **Schedule and commitments**: `milestones` (the GC's schedule) and
  `assignments` (who supplies or does what: the GC, us (owner-supplied) or a
  vendor; due on a date or N days before/after a milestone, so it moves with
  the GC's schedule; GC allowance vs our cost, e.g. Plainview's appliances:
  $47,000 allowance, $30,000 ours; the GC must credit the allowance). Missed
  commitments, the owner's included ("a clear expectation if someone misses
  their commitment including myself"), show red with the name on the project
  and Home. Rules: `src/lib/schedule.ts`.
- **Post-Project Review** (owner, Oct 2, 2026: "after action reports that use
  the same data driven points to tell us where we screwed up"): a project tab
  worked out from its own bills, budget, dates and value (`src/lib/review.ts`):
  profit vs a target (default 15%), the most we could have paid at that scope,
  the most the build could have cost at the price we paid, first estimate vs
  spent, cost vs value per heated sf, unbudgeted spend, staging, costs outside
  the GC, months the money was tied up, planned vs actual exit; plus the
  written lessons (`projects.review_notes`). Fields: purchased_on,
  completed_on, original_estimate, target_profit_pct, planned/backup/actual exit.
- **daily_logs** with photos, **holding_costs**, **files** (bytes in the row
  until `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_BUCKET` are set,
  then a private bucket; `/files/<id>` checks the viewer's role).
- **audit_log**: every create, edit, stage change and money action, with who,
  when and how. Never edited or deleted. Each record's History tab; everything
  at /admin/history.
- Money math (pure, tested): `src/lib/budget.ts` (budget, rollup, P&L, sale
  scenarios, the pay rule) and `src/lib/bill-lines.ts`.
- **Every table has row-level security on and no policies** (Supabase's Data
  API roles get nothing): `.enableRLS()` on every new `pgTable`, checked by a test.
- Seed data: migration `0001` adds the cost codes and **109 Plainview Ave**
  (Belvidere Park, 9,148 sf lot, R-10; lot $380,000 all-in, value $450,000; The
  Design Meister plan, 4,142 heated sf; sale $1,800,000; budget scaled from 210
  Plainview: construction $818,710, total build $973,200.58; five items not yet
  priced). `npm run db:seed` adds made-up sample people, locally only.

## Public website (chessoninvestments.com; built Oct 2, 2026)
Owner: project photos "under each project in here and then use this app to
display those items or projects professionally". The website is served by
this app; GoDaddy keeps only the domain and email.
- **Each project's Website tab** (`src/components/ProjectWebsite.tsx`, saves
  `src/app/(app)/site-actions.ts`, History "via Website tab"): website status
  (In Progress, Coming Soon, For Sale, Under Contract, Sold, Leased, Completed;
  blank = not on the website), price (shown only for Coming Soon / For Sale /
  Under Contract), web address (`site_slug`, unique), one line, description,
  bedrooms, bathrooms, order, Feature First, Finishes and Selections (plain
  text: `## Heading`, then `Label: value` lines) and Project Team (`Role |
  Company | What they did`; a general contractor first is shown large). Square
  feet and acres come from the project's own facts. Photos: Add Photos (many,
  sent one at a time to stay under 4 MB a request), each Before / After /
  Progress / Floor Plan, caption, order, On the Website.
- **The allowlist** is `toPublicProject` in `src/lib/site.ts` (tested in
  site.test.ts): nothing else about a project ever reaches a visitor (no
  costs, bills, budget, notes, review). A project shows only with a status, a
  description and at least one photo marked for the website.
- **Pages** (`src/app/site/`, own look kept from the GoDaddy site: Outfit,
  Chesson blue, `site.css` scoped under `.ci-site`): home (hero, services,
  projects, contact), `/projects/<slug>` (stats, After / Before / In Progress
  galleries with a lightbox, floor plan, finishes, team), `robots.txt`,
  `sitemap.xml`, `mark.svg`. Fixed words (services, phone) in
  `src/lib/site-content.ts`. Reads in `src/lib/site-data.ts`.
- **Photos** without sign-in only through `/photos/<id>` (`site/photos/[id]`):
  marked for the website, on a published project, an image; else 404.
- **Hosts** (`next.config.ts`, `PUBLIC_HOSTS` in site.ts): on
  chessoninvestments.com and www every path is rewritten to `/site/...`, so
  the app (sign-in, records, /api) can't be reached there at all; links use
  `siteHref` (`siteBase()` in `src/lib/site-host.ts`). On the app's address
  the website is at `/site` and is noindex like the rest of the app; only the
  public host is indexable (no `X-Robots-Tag` there, robots metadata index).
- **Moving photos in:** the Import file takes `projects[].site` (filled only
  where empty) and `photos[]` (`url` only from https://chessoninvestments.com,
  `allowedPhotoUrl`; read four at a time, retried when GoDaddy answers with a
  "please wait" page; `files.source_url` stops a second copy).
- Tests: site.test.ts, import-plan.test.ts (photos), `e2e/website.spec.ts`.
- Locally, server-side fetches through the sandbox proxy need
  `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.

## Added Oct 2, 2026 (afternoon)
- **Project numbers** P-1001 and up (`projects.project_number`, sequence
  `project_number`, migration 0008 numbered existing projects by creation).
- **Bids and our estimate** (Budget tab, `src/components/BudgetBids.tsx`, rules
  `src/lib/bids.ts`, saves `src/app/(app)/bid-actions.ts`, reads
  `src/lib/bid-data.ts`): a budget version of kind `bid` (a GC's: company, date,
  fixed / cost plus, fee %, good until, the proposal file, entity `bid`) or `ours`.
  Side by side by cost code: a bid is flagged when it leaves out a code others
  price, or is 25%+ above / below the middle of the others. **Select the Winning
  Budget** (the owner, with a reason) makes an approved version from it, declines
  the other open bids and, if ticked, sets the working budget to its numbers;
  History keeps the old numbers. The import file takes `bids`. A company's page
  lists the bids it sent. Jason's Plainview preliminary ($755,709) is mapped to
  our codes in the corrections file.
- **Supplier kinds** (`party_roles.supplier_types`, `supplierTypes` in roles.ts),
  **companies have a type ("What They Do"), people have roles**, People list
  columns Name / Title / Company (what it does) / Introduced By / Roles.
- **Do Not Use** (people and companies: reason required, red banner and chip,
  History); a grade of D or below will set it once grading exists.
- **Utilities tab** per property (`project_utilities`: service, company, the
  contact there).
- **Bills linked to companies by name** (`src/lib/vendor-match.ts`; Import page →
  Match Bills to Companies; imports use it too).
- **Archive / Delete Permanently** (`src/lib/delete-rules.ts` with a test that
  every column pointing at people or companies has a rule; bills, commitments and
  bids block a delete; one History row keeps what was removed). Archived page in
  the account menu.
- **History of everything:** sign-ins are recorded; `history-coverage.test.ts`
  fails when a Server Action saves without writing History.
- **Database:** node-postgres through Supabase's **session pooler** (5432, pool size
  40, set Oct 2, 2026 with the owner's OK), one connection per server instance,
  `attachDatabasePool`. Transaction mode (6543) froze the app: see
  `src/lib/db-url.ts`. Never use `db` inside a transaction. The website reads
  through a 5-minute cache (tag `site`).
- **Every saved document opens in the app or downloads** (owner, Oct 2, 2026):
  `/documents/<id>` shows PDFs in the page and web images, with Download and Open
  in a New Tab; anything else (HEIC) downloads. `/files/<id>` serves the bytes
  (`?inline=1`, `?download=1`); who may open a file follows its record
  (`fileNeed` in `src/lib/file-view.ts`). Link files to `/documents/<id>`.
- **Rentals** (Rental tab, `src/components/RentalTab.tsx`; rules `src/lib/rentals.ts`, tested;
  saves `src/app/(app)/rental-actions.ts`; reads `src/lib/rental-data.ts`; migration 0009):
  `rentals` (status, asking rent, listing, property manager and terms, the monthly costs we
  expect), `leases` (tenants, rent, term, renewal and decide-by, deposit, the signed lease
  as a document, entity `lease`), `rent_receipts`, `loans` (no account numbers). Shows cash
  flow, NOI, cap rate (on cost and value), cash-on-cash, DSCR, a plain verdict and the
  break-even rent; rent expected vs received by month; bills since the first lease as
  work done while rented. Escrowed taxes and insurance aren't counted twice.
- Claude can't write to production itself (a standing import door was refused by
  the safety system, Oct 2, 2026): the owner runs imports from the Import page.

## Environment variables (Vercel; never in the repo or chat)
`DATABASE_URL` (Supabase transaction pooler, port 6543), `AUTH_SECRET`,
`AUTH_MICROSOFT_ENTRA_ID_ID` / `_SECRET` / `_ISSUER`, `OWNER_EMAILS`,
`AUTH_TRUST_HOST` outside Vercel, optional `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`. `DEV_LOGIN=true` only in
`.env.local` (sample sign-in under `npm run dev`). See `.env.example`.

## Local development
Postgres with database `ci` (user/password `ci`); `cp .env.example .env.local`;
`npm install`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`.

## Roadmap
`docs/roadmap.md`: phases 2–7 and what the owner's past deal documents
(420 Peyton, WJ Investment Group and its beach condo) showed we need.

## Setup status (Oct 2, 2026)
- [ ] **Website moved to this app**: import the website file (Import page),
      check /site, then add chessoninvestments.com and www to the Vercel
      project and change only the A record (@ → 76.76.21.21) and the www
      CNAME (→ cname.vercel-dns.com) at GoDaddy. Never touch MX or the email
      records. Then cancel GoDaddy's hosting plan (Vendors).
- [x] GitHub repo `mchesson/chesson-investments` (private; created by the owner).
- [x] Supabase project `chesson-investments` (ref `qzhepiymbanpsuspnjpq`, East US,
      Technical Source org); private storage bucket `files`. The database
      password was set by Claude at creation and lives only in `DATABASE_URL`
      (transaction pooler, port 6543). To change it: set a new one through the
      Supabase Management API and replace `DATABASE_URL`.
- [x] Vercel project `chesson-investments` (team TS ATS), linked to the repo,
      deploys `main`; live at **https://chesson-investments.vercel.app**.
      Production settings: `DATABASE_URL`, `AUTH_SECRET`, `OWNER_EMAILS`,
      `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` (set by
      Claude), `AUTH_MICROSOFT_ENTRA_ID_ID` / `_ISSUER` (plain) and
      `AUTH_MICROSOFT_ENTRA_ID_SECRET` (sensitive, entered by the owner).
- [x] Entra app **Chesson Investments** (single tenant, Technical Source;
      client ID `ea87cc04-15f6-4102-9f59-391ad570c5c0`; redirect URI
      `https://chesson-investments.vercel.app/api/auth/callback/microsoft-entra-id`).
      **The client secret expires about Oct 2, 2028**: before then, a new one
      (Certificates & secrets) replaces `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
      A custom address later (e.g. app.chessoninvestments.com) needs its
      redirect URI added in Entra and the domain in Vercel.
