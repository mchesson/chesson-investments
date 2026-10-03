// Work that can take more than a few seconds (Claude reading files, the county
// and feed updates, placing and zoning every property). It never runs as a
// click's Server Action: Next.js handles a page's Server Actions one at a time
// and holds every other click and page change behind them, so the whole app
// seemed frozen while documents were read (Oct 3, 2026). These go through
// /api/work instead (src/lib/work-client.ts); long-work.test.ts fails if a page
// calls one of them directly. Pure.

export const LONG_JOBS = [
  'startDrop', 'finishDrop', 'dropSmall', 'readAgain',
  'startMarketSync', 'stepMarketSync', 'updateFeed', 'updateEverything', 'placeOurPlaces',
  'findLocationsAndZoning', 'readCompsFromDocument', 'readReceipt',
] as const;
export type LongJob = (typeof LONG_JOBS)[number];
export const isLongJob = (v: unknown): v is LongJob => LONG_JOBS.includes(v as LongJob);
