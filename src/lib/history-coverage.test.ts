import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Owner, Oct 2, 2026: "the app should track and trace every change made in the
// app". Every Server Action that writes must write History (audit), directly or
// through a shared save. This fails when a new one doesn't.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });
}

test('every save writes History', () => {
  const missing: string[] = [];
  for (const f of files(new URL('../app', import.meta.url).pathname)) {
    const s = readFileSync(f, 'utf8');
    if (!s.startsWith("'use server'")) continue;
    const parts = s.split(/\nexport async function /).slice(1);
    for (const body of parts) {
      const name = body.slice(0, body.indexOf('('));
      if (/\b(tx|db)\.(insert|update|delete)\(/.test(body) && !/\baudit\(/.test(body)) missing.push(`${f.split('/src/')[1]}: ${name}`);
    }
  }
  assert.deepEqual(missing, [], `these save without History: ${missing.join(', ')}`);
});

test('sign-in writes History', () => {
  assert.match(readFileSync(new URL('../auth.ts', import.meta.url), 'utf8'), /audit\(\{[^}]*sign-in/s);
});
