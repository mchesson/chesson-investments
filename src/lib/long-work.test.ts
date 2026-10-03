import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LONG_JOBS } from './long-work';

const root = new URL('..', import.meta.url).pathname;
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(n) ? [p] : []; });
}

// Next.js runs a page's Server Actions one at a time and holds every other click
// and page change behind them: a long one froze the app (Oct 3, 2026). Long work
// goes through /api/work (WorkButton, runWork); no page may call it directly.
test('no page calls long work as a Server Action', () => {
  const bad: string[] = [];
  for (const f of files(root)) {
    if (f.endsWith('/api/work/route.ts') || /-actions\.ts$/.test(f) || f.endsWith('.test.ts')) continue;
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/import\s+(?!type\b)\{([^}]*)\}\s+from\s+'[^']*-actions'/g)) {
      for (const name of m[1].split(',').map((x) => x.trim().replace(/^type\s+/, '')).filter(Boolean)) {
        if (!m[1].includes(`type ${name}`) && (LONG_JOBS as readonly string[]).includes(name)) bad.push(`${f.replace(root, 'src/')}: ${name}`);
      }
    }
  }
  assert.deepEqual(bad, [], `Use WorkButton or runWork for these: ${bad.join('; ')}`);
});

test('every long job is handled by /api/work', () => {
  const route = readFileSync(join(root, 'app/api/work/route.ts'), 'utf8');
  for (const j of LONG_JOBS) assert.ok(new RegExp(`\\b${j}:`).test(route), `${j} needs a line in src/app/api/work/route.ts`);
});
