import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : n.endsWith('.tsx') ? [p] : []; });
}
// The property manager's company is picked from the short list of property managers.
const allowed = new Set(['managerCompanyId']);

// Owner, Oct 3, 2026: "the entire system should work more smoothly like that":
// people and companies are picked by typing (SearchPicker, with + Add), never
// from a long dropdown of everyone.
test('no dropdown of people or companies', () => {
  const bad: string[] = [];
  for (const f of files(root)) {
    for (const m of readFileSync(f, 'utf8').matchAll(/<select\s+name="(\w+)"/g)) {
      if (/(person|people|company|vendor|introducedBy|lender|association|hiredThrough)\w*$/i.test(m[1]) && !allowed.has(m[1])) bad.push(`${f.replace(root, 'src/')}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [], `Use SearchPicker (with add) for: ${bad.join('; ')}`);
});
