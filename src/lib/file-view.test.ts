import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadName, fileNeed, fileSize, previewKind } from './file-view';

test('PDFs and web images show in the app; the rest download', () => {
  assert.equal(previewKind('application/pdf'), 'pdf');
  assert.equal(previewKind('image/jpeg'), 'image');
  assert.equal(previewKind('image/heic'), 'download');
  assert.equal(previewKind('application/zip'), 'download');
});

test('a file needs the same access as its record; unknown kinds only the owner', () => {
  assert.equal(fileNeed('bill'), 'money.view');
  assert.equal(fileNeed('bid'), 'money.view');
  assert.equal(fileNeed('project'), 'projects.view');
  assert.equal(fileNeed('something-new'), 'users.manage');
});

test('sizes and download names', () => {
  assert.equal(fileSize(2048), '2 KB');
  assert.equal(fileSize(3 * 1024 * 1024), '3.0 MB');
  assert.equal(downloadName('Inv "Baggett"/23669.pdf'), 'Inv _Baggett__23669.pdf');
});
