'use client';

import { useEffect } from 'react';

// Where a visitor came from, kept in this browser tab only (sessionStorage, no
// cookie) from their first page, and sent with a form so the lead says how
// they found us: the other site, the first page and any utm_ tags.
export const SOURCE_KEY = 'ci-src';

export function readSource(): string {
  try { return sessionStorage.getItem(SOURCE_KEY) ?? ''; } catch { return ''; }
}

export function SourceTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SOURCE_KEY)) return;
      const q = new URLSearchParams(location.search);
      sessionStorage.setItem(SOURCE_KEY, JSON.stringify({
        referrer: document.referrer || null,
        landing: location.pathname + location.search,
        utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign'),
      }));
    } catch { /* private window: the lead just says Direct */ }
  }, []);
  return null;
}
