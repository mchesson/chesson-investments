import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionUrl } from './db-url';

test('the transaction pooler address becomes the session pooler', () => {
  assert.equal(sessionUrl('postgresql://postgres.abc:p%40ss@aws-0-us-east-1.pooler.supabase.com:6543/postgres'), 'postgresql://postgres.abc:p%40ss@aws-0-us-east-1.pooler.supabase.com:5432/postgres');
  assert.equal(sessionUrl('postgres://ci:ci@localhost:5432/ci'), 'postgres://ci:ci@localhost:5432/ci');
  assert.equal(sessionUrl('postgresql://x@db.abc.supabase.co:6543/postgres'), 'postgresql://x@db.abc.supabase.co:6543/postgres');
  assert.equal(sessionUrl('not a url'), 'not a url');
});
