# Lessons and Features to Carry Over to TS Workspace

The owner (Oct 3, 2026): "make sure you are taking detailed notes on all the
issues along with features and benefits we added that can be applied to ts
workspace so we aren't doing work twice." Both apps are Next.js 16 + Drizzle
on Supabase + Vercel, so most of this applies as it is. Each entry: what
happened or what was built, the fix or design, where it lives here, and what
to do in TS Workspace. Newest first. **Nothing here changes TS Workspace
by itself**: a TS Workspace session picks an item up as its own pull request.

## Issues and their fixes

### The whole app froze while long work ran (Oct 3, 2026)
- **What happened:** while documents were being read (Drop Documents, Read
  Again) every click and page change hung for minutes. Next.js runs a page's
  Server Actions one at a time and holds every other click and navigation
  behind them, so one long action freezes the tab.
- **Fix:** long work never runs as a Server Action. It goes through one route,
  `POST /api/work` (`src/app/api/work/route.ts`, `maxDuration` 300), called
  with `fetch` (`runWork` in `src/lib/work-client.ts`, `WorkButton`). The job
  list is `src/lib/long-work.ts`; each job still checks its own permission and
  the route refuses other sites' pages. `updateTag` only works inside Server
  Actions, so the jobs use `revalidateTag(tag, { expire: 0 })`.
- **Guard:** `src/lib/long-work.test.ts` fails if any page imports a long job
  from an actions file, and if a job has no line in the route.
- **TS Workspace:** check every Server Action that calls Claude, reads files or
  loops over many records (resume drop, Find People, Crelate Sync Now, Account
  Cleanup's Approve All, Run Now buttons, One-Time Data Moves). Most already use
  `after()` or the cron; any that wait on Claude inside the click should move
  to the same pattern, with the same test.
- Skew protection (pages opened before a deploy keep working) was already on
  here (12 hours); confirm it's on for TS Workspace too (Vercel → Settings →
  Advanced).

### The same address shown twice (Oct 3, 2026)
- **What happened:** "420 Peyton Street" (name) and "420 Peyton St" (address)
  were compared letter by letter, so the list showed both.
- **Fix:** one shared check, `sameAsAddress` in `src/lib/locate-rules.ts`
  (house number, street, unit; St / Street, S / South, Ave / Avenue the same),
  tested, used by every screen.
- **TS Workspace:** wherever a name is shown with an address (locations named
  after their city, website leads), compare through one tested function, never
  `!==`.

### A subquery matched its own column (Oct 3, 2026)
- **What happened:** Drizzle writes a single-table query's columns without the
  table name, so `${companies.id}` inside a subquery became `"id"` and matched
  the subquery's own table: every company showed "No role yet".
- **Fix:** `ref()` in `src/lib/sql-ref.ts` writes `"table"."column"`; a test
  guards it. **TS Workspace:** search for outer columns used inside
  `sql\`...(select ...)\`` and use the same helper.

### Every save says how it went (Oct 3, 2026)
- Toasts on every save (`Toast.tsx`, `ActionForm`, `ActionButton`): raised
  inside the action wrapper so a form that redirects still says "Saved.";
  buttons stay disabled until the page is ready (a click before then reloaded
  the page and saved nothing). **TS Workspace:** same pattern, if any save is
  silent.

### Tests tripping over old local data
- A stopped run leaves records behind (a project left on the website, permits
  past a list limit). Tests start from a known state (turn it off first; delete
  their own earlier rows) rather than assuming a clean database.

## Features worth reusing

- **Type to find, + to add, never a dropdown of records** (owner, Oct 3, 2026:
  "the entire system should work more smoothly like that"): choosing a person,
  company, vendor or project is a search box showing who each match is; a
  "+ Add <name>" option opens a small form in place, saves it and picks it
  without leaving the page. Short fixed choices are tap buttons. A test fails
  on a new `<select>` of records. TS Workspace has CompanyPicker and
  PeopleMultiPicker already; add the "+ Add" step and the test.

- **Comps with sources and "whose numbers hold up"** (`src/lib/comps.ts`,
  `comp-watch.ts`): each piece of private information records who gave it to
  us; when the real outcome arrives (the county-recorded close), it's compared
  with what they said, and a Reliability table ranks sources. **TS Workspace:**
  the same idea grades who gives reliable information: a hiring manager's
  timelines, a client's "we'll extend", a candidate's rate, a vendor's quote.
- **Watching for an outcome automatically**: a scheduled job looks for the
  real event (here the recorded sale; there, a start date, a timecard, an
  extension) and writes History with how far off the promise was.
- **Claude reads a document into rows to check** (`comp-reading.ts`,
  `comps-ai.ts`): strict schema, nothing invented, a rule pass that drops bad
  values, rows saved as "to check" until a person confirms.
- **Drop Documents**: drop any number of files or zips; each is read and filed
  on the right record, new records proposed from what was read, sensitive ones
  refused. TS Workspace has resume drop; the same flow fits agreements,
  insurance certificates and vendor invoices.
- **Grading vendors over time** (GCs and subs here): planned to extend to
  lenders, attorneys, wholesalers, property managers, designers and agents.
  TS Workspace's version: clients, hiring managers, vendors.
- **Page layout settings and folding sections** (planned for both, owner Oct 3,
  2026): sections fold; an admin screen sets each page's section order and
  which are shown, without code changes; with who can see what.
- **Snap a Receipt** (built Oct 3, 2026; `SnapReceipt.tsx`,
  `receipt-actions.ts`): a phone camera button (`capture="environment"`). A
  big photo is shrunk to 2,000 px in the browser first, so it stays under the
  4.5 MB request limit. It's read as long work through /api/work, so the page
  never freezes. The file waits in the inbox while the user checks what was
  read, then moves onto the record it's saved on. The page it was opened from
  is chosen already. TS Workspace can use the same flow for expense receipts
  (E1), a business card snapped into a contact, or a signed timesheet photo.
  Lesson: money shown in a message needs `formatMoney(x, { cents: true })`,
  or $84.17 reads "$84".
- **"What's happening in this ZIP" in plain words** (built Oct 3, 2026;
  `zip-report-rules.ts`, `/market/zip/<zip>`): a headline plus one sentence
  per number we actually have. A missing number drops its sentence; nothing is
  guessed. It's rules-based (no Claude call), so it's instant and free. The
  same pattern fits TS Workspace's "what's happening at this account" or "in
  this market / skill": a short story from the key numbers above the tables.
- **A free outside source needs a backup** (Oct 3, 2026): FRED timed out
  from Vercel on every run, so the Market Map showed no rates for a whole day
  with no alert. Now each rate has a first source and a backup:
  - mortgage rates: Freddie Mac's file, then FRED;
  - the 10-year: Treasury.gov;
  - fed funds: the New York Fed.

  Any one answering is enough, and what failed is logged. The lesson for TS
  Workspace's feeds (Crelate, Redfin-style public data): use fallbacks, and
  show a stale-data warning on the page, not just a failed row in a log table.
- **Weights measured, not guessed** (Buyer Factors, Oct 3, 2026;
  `price-drivers.ts`): one least-squares fit over about 43,000 local sales,
  with each factor's share of the spread in prices. It runs in about 0.4
  seconds in the browser-free server code, with no paid tools, and missing
  inputs (Durham's year built) get an "unknown" marker instead of dropping
  the row. TS Workspace can use the same method for "what drives bill rates"
  (skill, tier, location, client, contract type) from its own placements.
