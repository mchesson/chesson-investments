# Roadmap

Phase 1 (contacts and introductions, watchlist, projects and job costing) is
built. What follows is the order from the owner's spec (Oct 2, 2026), with what
his past deal documents showed we need (read Oct 2, 2026; no account numbers,
tax IDs or ID documents are copied anywhere).

## Queue (owner, Oct 3, 2026), in order
1. **Comps tab** (built): sources (public record, appraisal, presale / new build, broker, listing, private), finish level, adjustments, value at our size; county sales offered; Claude reads appraisals; presales and appraised houses watched until the county records the close; who gave each comp and whether their numbers held up; builder and custom builds kept apart.
2. **Project page fixes**: Plainview lot cost $310,000 per the purchase agreement, with closing, tear-down and holding as their own lines; the list shows lot cost only; the Projected tag; the address as one field, address and neighborhood link to the map.
3. **Upload documents in every section** (Add Project and each record), not only Drop Documents.
2b. **Where agents specialize, as real areas** (owner: "under realtors we should add a place to say what zip codes and neighborhoods they are specialized in and cities"): today one free-text Areas box. It becomes cities, ZIP codes and neighborhoods picked from our county data (typed ones allowed), shown on the agent and the People list, searchable ("agents for 27604" / "agents in Oakwood"), and offered on the map and a watched property ("agents who work here"); later checked against who actually sells there (item 7).
1a. **Type to find, + to add, everywhere: the whole app works this way** (owner: "the entire system should work more smoothly like that"; about 20 record dropdowns today: person form, bills, commitments, schedule, utilities, grades and issues, watched property sources, bids, rental manager, users, merges; a test fails on any new record dropdown) (owner: "instead of a drop down i should type in the name or company the referrer is from and it should start to give me a list ... and then if i have typed a name in it should allow me to click a plus button and add the person"): Who Introduced Them, the person form's Company, comp providers and vendor pickers use the search box; a + Add "name" option opens a small form in place (name, company, phone, email), saves, and picks the new record without leaving the page.
2c. **People list: Name, Company, Title, then Properties** (owner: "the order should be name company title and ... a column for the property they are associated with or if multiple should list those"): the properties and projects each person is tied to (deals they sent, schedule commitments, bills and commitments, utilities, rental contacts, issues), each a link.
2a. **Short-term rentals named as such** (owner: "rentals that are short term should be listed as such and not rental on the market as those all have different meanings"): each rental has a type (long-term, mid-term, short-term) shown in the stage everywhere, with its own statuses (short-term: getting ready, live on booking sites, booked / operating, off season / paused); the beach condo is short-term.
3. (also) **Timelines** (owner: "do we have a timeline for what they did for us under their profile and under each property should be a timeline of all things that have happened at the property and who did it"): a property Timeline (purchase and closing, design, permits and inspections, bids and who won, schedule work done on time or late and by whom, daily logs and photos, change orders, bills and payments, issues, grades, documents, stages, listing, offers, sale or lease; filters: work, money, a vendor) and a vendor Timeline across every property (bids won or lost, commitments met or missed, bills and payments, issues and days to fix, grades, touches) with a summary: jobs, paid, on-time %, open issues, average grade. Built from what's already recorded.
3d. **Snap a Receipt** (built Oct 3, 2026) (owner: "take a pic and send"): a one-tap camera button on the phone and each property page; what Claude read shown for a quick confirm; receipts forwarded by email later.
3e. **Trip Log for mileage and the car write-off** (built Oct 4, 2026) (owner: "track when I go to a property and why, not just for mileage ... to justify writing off a car"): I'm Here on the phone (nearest property from location, confirmed), the reason, note and photos, miles from the start point or typed, multi-stop days, the entity it's for, a mileage rate setting; on the property Timeline and as a site walk; the year-end IRS-style log (date, place, business purpose, miles, vehicle) by entity and property, and the share of the car's miles that were business.
3b. **Personal records, owner only** (owner: "I also need to upload my tax docs for banking purposes"): a Personal (Matthew Chesson) place for personal returns, statements and what a lender asks about him, restricted like entity tax records; Drop Documents files personal ones there.
3c. **Share Securely and Request Documents** (owner: "send and receive secure docs with someone and have upload"): a private, expiring link for one person to a document or a set (optional code sent separately; every open logged; revoke at once; owner-only documents shared only by the owner), and an upload link that drops what a lender, attorney or appraiser sends into Drop Documents marked as from them. Needs the Resend domain verified.
3f. **Bank, card and property manager statements** (owner: "I keep by quarter all the bank statements and AMG Realty etc statements ... in SharePoint but I would like to track it here and log it against the properties"): drop a statement, Claude reads each line and sorts it onto a property, overhead or a transfer, matched to bills and rent already here, new ones confirmed; AMG owner statements fill each rental's rent, fees, repairs and net by month (the actuals against the projection); owner only, account numbers shown as last 4 only; a one-time move of past quarters from the owner's SharePoint folder (read only).
3g. **Mileage both ways** (built Oct 4, 2026, in the Trip Log) (owner: "track both ways so we can compare"): the standard mileage rate and actual car costs (receipts tagged to the car) side by side in the year-end report, with the business-use share.
3h. **QuickBooks, read only** (owner: "connect to QuickBooks ... read how they are categorizing expenses and see if we have missed anything or any vendors or spend ... don't send anything to it"): the owner connects once with read-only access; compare categories, vendors and spend with what's here; nothing is ever written to QuickBooks; recorded in Vendors.
3a. **Delete what's missing it** (owner: "i should be able to delete list or other items in the app"): a list, someone on a list, an event, a task, a touch, a document; money and track-record rows (bills, commitments, grades) are archived, never deleted.
4. **Run the numbers before the offer**: maximum offer from comps, budget, holding, selling and profit target; sell / rent / short-term rent side by side; saved with the offer for the review.
5. **Contract dates and stage checklists** with reminders.
6. **Who uses the app**: a page of every sign-in and page visit (who, when, from where), and cutting someone off at once (owner: "a way or page to see who accesses this site and when and cut off access").
7. **Grade everyone at every important step, over time** (like GCs and subs today): lenders (what they approve and decline by deal type: land, construction to perm, retrofit, multifamily; the trend in declines), attorneys (closed on time, fees, issues), wholesalers, property managers, designers, appraisers, agents (who sells the most in an area), and identify investors.
8. **Builders tracked throughout**: one builder record across permits, county sales, comps and our own projects; spec builders apart from custom builders for owners.
9. **Multifamily and small condo / townhome sites for sale** on the map (6 condos or townhomes on one piece of land): Zillow and Redfin miss most of them; find sources (county parcel and permit data for multi-unit land use, LoopNet / Crexi listings, broker lists).
10. **Presales tracked publicly where we can**: new-home permits (builder, address) as "being built", the lot purchase, then the county-recorded close.
11. Website rebuild with lead forms (built Oct 3, 2026: top bar, footer, Contact and Sell Us Your Property forms, Leads, visits, Website Settings).
12. **Marketing section** (owner: lists "may be best served as part of marketing"): lists become outreach lists built from a filter (absentee owners near the buy box, agents in an area, past sellers), each with a goal and a follow-up sequence, who answered, and which lists turned into deals; website leads feed it; My Tasks stays for one-off to-dos. Then the rest of the earlier list below.

## Next (owner, Oct 2, 2026): bids, our estimate, holding costs, schedules, documents
In this order, before phase 2:
1. **Project numbers.** Every project gets a short number (P-1001, from its
   own sequence, assigned once and never reused), shown on the page heading,
   the list, bills and the import, and searchable.
2. **Budgets from several bids.** Each project holds any number of budgets
   side by side, by cost code:
   - one per **GC submission** (who, the date, the proposal file, fixed price
     or cost-plus with the fee %, allowances, what's excluded, how long it's
     good for, the GC's schedule);
   - **our own estimate**, built by the app from our track record (cost per
     heated sf by size, finish level and neighborhood, our past bills by cost
     code) and the market (comps, $/sf the house can sell for), with every
     number's source shown;
   - a **comparison**: each bid against ours and each other, line by line,
     with the gaps flagged (missing scope, allowances under what the
     finishes cost, a GC fee over the others);
   - **Select the Winning Budget**: it becomes the approved budget (the
     baseline today's Budget tab tracks against) and the GC's commitment, with
     who chose it, when and why in History.
   - Plainview's to load first: Blake Anderson's (Envision Investor
     Solutions) initial estimate of Sept 11, 2025 (a shared Google Doc: the
     owner exports it to PDF, since the app can't open the link), the Luxury
     Oaks / Jason Burnette numbers, and the owner's own rough numbers of
     Sept 10, 2025: land $315k, demolition of house and trees $20k, survey
     $2k, holding 12 months $65k, closing front and back $8k, realtor $55k,
     build $494k (2,600 sf × $190), profit $150k, sale $1,109,000 ($426/sf;
     wanting to come in under $1.1M).
3. **Holding costs in the budget.** Today only actual holding costs are
   entered (Holding Costs tab). Each budget also carries the expected holding
   costs: months held × (loan interest, property tax, insurance, utilities,
   HOA, lawn), from the schedule, so a longer schedule shows its cost, and
   actual vs expected month by month.
4. **Two schedules.** The winning GC's schedule (its milestones, loaded from
   the bid) and **our expected schedule** (what we expect to see, from our
   past projects' durations by phase), shown together with the gaps, and the
   actual dates as they happen. Commitments (who supplies what by when) hang
   off the GC's schedule as today.
5. **Documents on every project, vendor, person and property**, with types:
   Proposal / Bid, Contract (GC, Sub, Design, Supplier), Change Order, Lien
   Waiver, Insurance Certificate, W-9 (restricted), Permit, Plans, Survey,
   Inspection, Closing Statement, Deed, Title Policy, Warranty, Receipt,
   Other. An **executed contract** records its parties, amount, signed date,
   term and the signed file (every version kept), and links to its
   commitment in job costing. The contract templates library (phase 2)
   builds on this.
6. **Upload receipts.** A Receipts button on the project (and on the phone):
   drop or photograph one or many receipts; each becomes a bill of kind
   receipt with its file. Later Claude reads the vendor, date, lines and tax
   and proposes the cost codes for one-tap confirm (phase 2 invoice reading).

7. **Rentals (owner, Oct 2, 2026; moved up from phase 4). Built Oct 2, 2026** (the Rental
   tab); still to come: reading the manager's monthly statements, and actual expenses
   replacing the monthly estimates. 420 Peyton is a
   rental now. A rental gets:
   - a **status**: Getting Ready, On the Market (asking rent, listed on, where),
     Application Pending, Leased, Notice Given, Vacant;
   - the **lease**: tenant(s), the signed lease and every version (a typed
     document), rent and due day, term start and end, renewal terms and the
     date to decide (a task 60 days before it ends), deposit (amount, where it's
     held, what was returned), pets, utilities paid by whom, the terms and
     conditions;
   - the **property manager** (AMG Realty for Peyton): the company and its
     people, the management agreement (fee %, leasing fee, term), their
     monthly statements read in;
   - **work done while rented**: each repair or maintenance call (who did it,
     what, cost, the invoice), with the vendor's grade;
   - **money**: expected monthly revenue vs actual (rent collected, late fees,
     vacancy), expenses (management, repairs, taxes, insurance, HOA, utilities),
     the **bank loan** against it (lender, balance, rate, payment, escrow,
     maturity), and the result: monthly cash flow, NOI, cap rate,
     cash-on-cash and DSCR, with a plain "making money / losing money" line and
     how much rent or cost would change it. The same numbers for Shaw View and
     the beach condo.
8. **Grading contractors and checking their prices (owner, Oct 2, 2026).**
   **Built Oct 2, 2026:** a grade per job (A–F, optional parts) with a required
   justification, the overall grade on their page and the project's Vendors
   tab, and **Issues** for every contractor and vendor (a tab per status, days
   to fix, who was involved, cost to fix). Still to come below: the end-of-job
   task, price checks and suggested vendors.
   - A **grade per job**: quality, schedule kept, budget kept, communication,
     clean-up, would-we-hire-again, with a note, given when their work on a
     project ends (a task asks for it); an **overall grade** on their page from
     every job.
   - **Cost against the market**: each bid and invoice line by cost code (per
     sf, per unit) compared with every quote we've received over time from
     anyone (the bids in item 2), our own past bills, and outside price guides
     where we can get them free; shown as "12% above our median for framing".
   - **Suggest another vendor** when someone with an equal or better grade has
     quoted or billed the same trade for less, with the numbers and dates.

9. **Email and a timeline on every company and person (owner, Oct 2, 2026).**
   Connect this app to the owner's Microsoft 365 mailbox (read-only, like TS
   Workspace's mail reader): each person's and company's page gets an **Email**
   tab with every message to and from them (who, when, subject, a short
   summary, Open in Outlook), and one **Timeline** that puts everything in
   date order: emails, calls, meetings, site walks, bids and proposals sent,
   invoices, introductions, role changes and Do Not Use. Contacts found in
   email are suggested for a one-tap add.
10. **Do Not Use, by grade** (built Oct 2, 2026, with the override). Built by hand (Oct 2, 2026: a reason is
    required, red on the record and the lists); once grading (item 8) exists,
    a grade of D or below sets it by itself, with the grade as the reason, and
    a manual override that keeps them usable with a reason.
11. **Projects with several stages at once** (owner, Oct 2, 2026: "we can be
    looking for permits and under contract and building"). **Built Oct 2,
    2026:** each stage has its own state and sub-stages (the stage bar). Still
    to do: **Selling** has its own
    statuses (Coming Soon, For Sale, Under Contract, Sold) and logs
    **viewings** (date, agent, buyer feedback) and offers. **Permits and
    inspections**: each permit (type, number, applied, issued, expires) and
    each inspection (type, date, inspector, passed / failed, notes, the report
    file), against the GC's schedule and ours, so a late permit or failed
    inspection shows as days behind.

12. **Outside people in the app (owner, Oct 2, 2026: "invite people outside
    the Chesson org like a GC to certain parts of the app").** A **Guest** role:
    the owner invites someone by email to one or more projects and picks what
    they see (the schedule and their commitments, the daily log, photos, their
    own bills and change orders, documents shared with them); nothing else in
    the app, never other vendors' prices, the budget, the P&L or contacts.
    They sign in with an emailed one-time link (needs an email service: Resend's
    free tier, recorded in Vendors first) instead of the Technical Source
    Microsoft sign-in. Each guest's access is per project, ends on a date or when
    the owner turns it off, and everything they see and change is in History.
    Later: a GC posts its schedule updates and invoices there itself.
    **Built Oct 2, 2026:** guests, per-project checkboxes, sign-in links, the
    /guest pages (schedule and commitments, daily log, issues). Email waits for
    an email service; until then links are copied by hand. Still to come:
    documents and photos shared with a guest, their bills, the security review
    (item 13) before many guests use it.
13. **Security threat assessment (owner, Oct 2, 2026).** A written review like
    TS Workspace's docs/security: every connection and who can reach what,
    findings ranked with fixes, an incident runbook (the cyber insurer first),
    key rotation, restore tests, and a check before guests (item 12) go live.
    Then repeated yearly and before each big change.
14. **Ask Claude inside the app.** Built once the owner creates the Anthropic
    key: a workspace "Chesson Investments" with a $25/month limit, the key
    saved in Vercel as ANTHROPIC_API_KEY (Production, sensitive). It answers
    from the app's data with the same permissions as the person asking, and
    proposes changes for a one-tap confirm, never saving silently.

## Next: the post-project review says where, why, how and with what
Owner (Oct 2, 2026): "Telling me we should have spent less doesn't help, but
having the info and then telling me where we should have spent less and why
and how we could have done it and for what products is different." The
review's findings become specific, from the project's own bills and lines:
- **Where:** each cost code over what the house's value supported (our own
  cost per heated sf on comparable houses, the market value, the target
  profit), ranked by dollars over.
- **Why:** what drove it, from the lines themselves: the finish level picked
  (e.g. quartz vs laminate, custom vs stock cabinets), change orders, GC fee
  and allowance gaps, rework, holding months, items bought twice.
- **How and with what products:** the cheaper path for each, with the
  product or trade named (stock shaker cabinets from a named supplier instead
  of custom; owner-supplied appliances, as on Plainview: $30,000 vs the GC's
  $47,000 allowance; LVP instead of white oak in secondary rooms), the price
  difference from our own bills on other projects where we have them, else
  marked as an estimate with its source. Never a made-up number.
- **The buy decision:** the most we could have paid (already built), and
  whether we should have bought at all at that value.
- A **Lessons** list carried into the next project's budget stages (a
  warning when a rough estimate picks a finish that over-built before).

## Phase 2: contracts, closings, title, invoices
- **Contracts with a date engine.** NC Offer to Purchase (Form 2-T): effective
  date (last signature), due diligence fee and period end (warn when blank),
  earnest money (who holds it, due 5 days after), settlement date, and actual
  vs planned closing (420 Peyton closed 7/31, before the 8/4 date). Every
  deadline becomes a task. Offer → counter → executed versions, with who signed,
  when and on which platform (dotloop, Authentisign, Adobe Sign).
- **Contract library** (owner, Oct 2, 2026: "a place for standard contracts
  with GCs etc ... and a place to house contracts that we have executed under
  each contractor, vendor"). Two parts:
  - **Standard templates** (none exist yet; to build, with an NC construction
    attorney's review before first use): GC agreement (fixed price and
    cost-plus with fee %, draw schedule, retainage, change-order process,
    schedule, warranty, insurance and lien waiver requirements), subcontractor
    agreement, independent contractor agreement for day labor, design and
    engineering agreement, supplier terms, lien waiver forms (conditional and
    unconditional, partial and final), W-9 and certificate-of-insurance
    requests. Each template versioned, with merge fields (parties, property,
    price, dates) filled from the project and the vendor's record.
  - **Executed contracts** on each vendor (company or person) and on the
    project: type, parties, property, amount, signed date, term and end date,
    the signed file and every earlier version, and its commitment in job
    costing (scope, price, retainage, fee %). The vendor's page lists every
    contract, insurance certificate (with expiry reminders), W-9 (restricted)
    and lien waiver, across projects.
- **Closings, both directions** (purchase and sale): settlement agent, closing
  attorney, title agency and insurer, both brokers, surveyor, lender; cash or
  loan; 1031 exchange (45 / 180-day deadlines); power of attorney; affiliated
  business disclosure; a closing checklist (intake letter, info sheet, ID,
  survey, title coverage choice, review the statement, wire, recording, policy,
  keys). Sale side: listing, buyer, buyer's agent compensation (Form 220: %,
  who pays, expiry), concessions, builder warranty.
- **ALTA settlement statements read by Claude**, every version kept, one final.
  Lines map to the P&L: price → lot cost; DD fee credited (never counted twice);
  attorney, settlement, title, recording, survey, admin fees → code 30 (lot
  basis); tax proration → holding cost; on a sale: commissions, excise tax
  ($1 per $500), deed prep → selling costs; loan payoff → net proceeds.
  Reconcile against every wire and check (420 Peyton: $198,984.10 wire +
  $22.25 check + $5,000 DD = basis $203,133 + $851.10 taxes).
- **Wire-fraud safeguard**: confirm wiring instructions by calling a number
  already on file (never one from an email), log who and when, flag any change,
  match the bank's sent and received confirmations. Bank details only as
  restricted files, never data.
- **Title**: owner's policy (insured amount, date, exceptions: covenants
  book/page, survey matters), legal description, plat and deed book/page,
  recorded deed (instrument, book/page, excise tax), parcel PIN vs REID checked
  against county data (420 Peyton's contract PIN didn't match the deed).
- **Disclosures checklist** by property: Residential Property and Owners'
  Association, Mineral and Oil and Gas Rights, lead-based paint (pre-1978),
  Working With Real Estate Agents (agency type), HOA facts.
- **Environmental**: underground tanks (420 Peyton: 270-gallon heating oil tank,
  removed 9/3/25, not regulated, visual soil check only), removal letters as
  property documents; asbestos and demolition checks for old houses.
- **Inspections**: report, findings (Now / Later, system, room, photos) →
  "Create Repair Item" on the not-priced list with a cost code.
- **Invoice and receipt reading by Claude**: vendor, number (with prefixes),
  date, due/terms, bill-to (often the GC) vs the property (by address, typos
  like "1420 Peyton"), lines with tax and discounts, returns, receipts already
  paid by card (last four only), handwritten forms. It proposes; a person
  confirms. Match vendor invoices to the GC's cost-plus lines (exact, or several
  to one), and flag lines with no backup or a gap (420 Peyton: Medrano $650 vs
  $350; Cavanaugh Dr time billed to Peyton; a multi-job cleaning invoice).
  Auto-file by the owner's file names (`Inv_<Vendor>_<number>_<date>_<address>.pdf`).
- **Lien waivers** as documents (GC final waiver, subs with a balance), **W-9s**
  (restricted, for 1099s), **insurance certificates**, **sub scorecards**.
- **Selections / finish schedule** per room (from the Wilmoth design package:
  tag, SKU, finish, quantity, supplier, status specified → installed),
  **payment milestones** on a commitment (25 / 50 / 25), hourly add-on rates and
  included visits, **plan sheets and revisions** as document versions.
- **Utility contracts** (City of Raleigh service start, Duke Energy) with dates.

## Phase 3: documents, entities, lenders, banking, accountant
- **Document library** with versions and stale reminders; restricted types
  (tax returns, the PFS as data, IDs, EINs, W-9s, BOIR) owner only, every view
  logged; lender packages by expiring link.
- **Entities**: Chesson Investments, LLC and WJ Investment Group LLC (NC,
  formed Feb 2023; manager-managed; members Chesson Investments 65%, James
  Bailey 35% from May 20, 2025), ownership history, managers, registered agent,
  governing terms (capital calls unanimous, pro-rata distributions, transfer
  consent, buy-sell triggers and appraisal method), compliance dates (NC annual
  report, 1065 and K-1s by March 15, NC D-403, SC1065: confirm with the CPA).
- **Loans**: private and bank, related-party flag (420 Peyton was funded by a
  $25,000 unsecured private loan with a fixed $28,000 payoff due Feb 4, 2026,
  $6 a day after, default after Jan 21, 2027). Fixed-return or rate, payoff as
  of a date, collateral (or none), draws and payments ledger; the cost spread
  as interest into the project's holding costs. HELOC (FNB).
- **Bank accounts and monthly statements** read by Claude and matched; owner
  contributions and intercompany transfers (the $5,000 to WJ on 5/20/25).
- **Accountant role**, **QuickBooks** (confirm Online or Desktop with the owner).

## Phase 4: rentals (moved up: see Next, item 7)
The Chateau N-3 beach condo (S Ocean Blvd, North Myrtle Beach; WJ Investment
Group; placed in service June 9, 2025) and 1211 Shaw View Alley, Unit 101:
property managers, bookings and leases (nightly / weekly rates, platform),
expenses by Form 8825 line, insurance policies, utilities, furniture and its
protection plan, NOI, cap rate, cash-on-cash, occupancy, comparable rate sets.

## Phase 5: Deal Analyzer and buy box
Owner (Oct 2, 2026): "we need a way to evaluate deals for buying all types of
properties ... we want to look at deals from all angles." One property on the
watchlist, run through every strategy side by side, each saved as a dated
analysis on the property:
- **Hold the land**; **clear / develop and sell lots**; **subdivide and build N
  homes** (2, 5, more: lot yield from zoning and lot size, phasing);
  **build and sell**; **build and rent**; **remodel and flip**; **remodel and
  rent** (refinance and keep, BRRRR); **buy and rent as is**.
- Inputs per strategy: price, closing and due diligence, site and demolition,
  build or remodel cost (from our own cost per heated sf by size and
  neighborhood: the Track Record), soft and holding costs, financing (loan to
  cost, rate, points, months), timeline, sale price (comps) or rent, vacancy,
  management, taxes, insurance, HOA, maintenance, refinance terms.
- Outputs: cash needed, months, profit and margin, return on cash, annualized
  return, equity multiple; for rentals monthly cash flow, NOI, cap rate,
  cash-on-cash, DSCR; and the max price we can pay for each strategy at our
  target profit (the buy box formula below). Sensitivity: Low / Mid / High.
- **Exit strategies** (owner, Oct 2, 2026: "we certainly need to factor in
  comps and exit strategy when deciding to enter a deal and then we need a
  backup exit strategy and why"). Every deal records a **primary exit** and a
  **backup exit**, each with the reason: presale (sold before or during
  construction: less market risk, a buyer's deposit, but a fixed price and
  change requests), post-construction sale (full retail and staging, but
  carrying cost and market risk), list as is, sell the lots, rent and hold,
  refinance and keep, sell to an investor. For each: the comps it relies on
  (dated, from Wake County and the MLS later), the price and timeline, what it
  nets, and what would make us switch (e.g. "no presale by framing → list on
  completion"; "sale under $X after 60 days → rent at $Y", as 420 Peyton went
  from listing to rental). The Deal Analyzer won't mark a deal "Ready to Offer"
  until both exits and their comps are filled in. The project carries the
  chosen exits forward; a change of exit is a dated decision in History.
- **Wake County free data** (parcels, zoning, assessed values, recorded sales)
  feeds lot facts, comps by neighborhood and teardown candidates. Claude's
  environment needs network access to maps.wakegov.com, *.wakegov.com,
  data-wake.opendata.arcgis.com and *.arcgis.com (owner adding, Oct 2, 2026).

### Buy box: it moves with the market (owner, Oct 2, 2026)
**Built Oct 2, 2026** (Buy Box page, map layer, watchlist check) from county
sales; still to come: listing alerts and time on market (a listings feed), and
trend alerts on a schedule.
"The buy box is not static." It's worked out from market data and re-checked
as the market moves, not typed once:
- **Data sets, dated:** sale price, time on market (days from listing to
  contract), sale price against time on market, and neighborhood against time
  on market; $/heated sf; list-to-sale ratio; how many sell per month (absorption).
- **Street by street:** buy zones are drawn from streets and blocks, then
  neighborhoods, then towns, with the buy price for each (what a finished house
  sells for there, worked back through the max lot price formula below).
  Being near a downtown or metro center is a factor.
- **By price band:** which bands are selling and which are stuck. Today (Oct
  2026): under $400k sells (people have to live somewhere) and over $1.5M sells
  (cash buyers don't care about 7% rates after years at 3–4%); the middle is
  slower, and only certain neighborhoods absorb $1.5M+. The app shows this per
  neighborhood and alerts when it shifts.
- **Alerts:** a listing for sale inside a buy zone; a street or neighborhood
  whose sales speed up or slow down; a price band turning.
- **Where to look:** suggested zones (on-market) and off-market targets
  (phase 5b) in the same zones.
- **Counties:** Wake first (its parcel and sales data is connected), then
  Durham (its open data has parcels, neighborhoods and sales: reachable), then
  Orange, Johnston and Chatham.
- **Listings and days on market** aren't in county records. Zillow has no
  public data feed (its old API is closed; listing data comes through the MLS
  or a paid listings service). Options for the owner: an MLS (IDX/VOW) feed
  through one of our agents, or a paid listings API recorded in Vendors first
  (open question).
- **Interactive heat map** (Map in the menu): zoom in and out, with buttons
  across the top to add or take away what's shown: recent sales ($/sf heat),
  time on market, our projects, the watchlist, buy zones, listings, off-market
  targets, agents' areas.
- **Agents:** every agent's areas they specialize in (built Oct 2, 2026, on
  their role), shown on the map.

### Buy box
County parcel and sales data; max lot price = (value × (1 − selling costs) −
build − soft and holding − target profit) ÷ (1 + financing per $ of land);
neighborhood map; teardown finder. Comps dated and re-checked at listing (the
420 Peyton comps were a year old by the time it listed). Track record by
neighborhood and size: cost per heated sf, profit or loss, over-building.

## Phase 5b: off-market sourcing (owner, Oct 2, 2026)
"Off-market properties are the best way we have found to identify good
prospective properties." Built on Wake County data and the watchlist:
- **Target lists** from county parcels: owner name and mailing address,
  absentee owners, long ownership, older houses on big lots (teardown
  candidates), vacant land, estates, by neighborhood and buy box.
- **Outreach log** per property and owner: calls, door knocks (with the
  date, who went, what was said, follow-up), letters and postcards; status
  from Not Contacted → Talked → Interested → Offer → Under Contract / Not
  Selling, and Going Cold reminders. Owners become Landowner / Seller people.
- **Lead sources and results:** each lead's source (door knock, call, mail,
  web, referral, agent, wholesaler) carried to offers, contracts and profit,
  so we see which channel finds the deals that pay.
- **Web marketing to that audience later:** a "Sell Us Your House or Lot"
  page on chessoninvestments.com with a form that creates the lead here, and
  targeted online ads to owners on our lists.
- Rules to check before calling: the National Do Not Call Registry and NC
  telemarketing rules (scrub phone lists, record consent and opt-outs);
  phone numbers from public records or a skip-trace service (a paid service
  goes in Vendors first).

## Phase 6: investor group
Profiles, accreditation, commitments, capital in and out, distributions,
updates, K-1s (securities-law caution: counsel first).

## Phase 7: market data
MLS feed and Monday Triangle market reports as dated PDFs.
