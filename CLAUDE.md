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
