import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedPhotoUrl, isPublicHost, parseDetails, parseTeam, siteHref, siteProblems, slugify, sortProjects, toPublicProject } from './site';

const row = {
  name: '420 Peyton Street', address: '420 Peyton St', city: 'Raleigh', state: 'NC', zip: '27610', heatedSf: 1408, lotAcres: '0.270',
  siteStatus: 'for_sale', siteSlug: '420-peyton-street', sitePrice: '569900.00', siteTagline: 'A ranch reimagined', siteDescription: 'Down to the studs.',
  siteBeds: '3.0', siteBaths: '2.0', siteDetails: '## Kitchen\nCabinets: White shaker\nCounters: Quartz', siteTeam: 'General Contractor | Luxury Oaks | Jason Burnette', siteFeatured: true,
  // Things that must never reach the website:
  lotCost: '203133.00', marketValue: '437500.00', notes: 'private', reviewNotes: 'we overbuilt',
};
const photos = [
  { id: 'a', photoKind: 'before', caption: null, onSite: true },
  { id: 'b', photoKind: 'after', caption: 'Kitchen', onSite: true },
  { id: 'c', photoKind: 'after', caption: 'Hidden', onSite: false },
];

test('toPublicProject keeps only public fields', () => {
  const p = toPublicProject(row, photos)!;
  assert.equal(p.price, 569900);
  assert.equal(p.place, 'Raleigh, NC 27610');
  assert.equal(p.cover?.id, 'b');
  assert.deepEqual(p.photos.map((f) => f.id), ['a', 'b']);
  const text = JSON.stringify(p);
  for (const secret of ['203133', '437500', 'private', 'overbuilt']) assert.ok(!text.includes(secret), secret);
  assert.deepEqual(Object.keys(p).sort(), ['acres', 'baths', 'beds', 'cover', 'description', 'details', 'featured', 'name', 'photos', 'place', 'price', 'slug', 'sqft', 'status', 'statusLabel', 'tagline', 'team'].sort());
});

test('nothing is published without a status, description and a photo', () => {
  assert.equal(toPublicProject({ ...row, siteStatus: null }, photos), null);
  assert.equal(toPublicProject({ ...row, siteStatus: 'bogus' }, photos), null);
  assert.equal(toPublicProject({ ...row, siteDescription: ' ' }, photos), null);
  assert.equal(toPublicProject(row, photos.map((f) => ({ ...f, onSite: false }))), null);
});

test('the price shows only while for sale', () => {
  assert.equal(toPublicProject({ ...row, siteStatus: 'rented' }, photos)!.price, null);
  assert.equal(toPublicProject({ ...row, siteStatus: 'sold' }, photos)!.price, null);
});

test('details and team parse from plain text', () => {
  assert.deepEqual(parseDetails('Siding: White\n\n## Baths\nVanities: Oak\nNew everything'), [
    { title: 'Details', items: [{ label: 'Siding', value: 'White' }] },
    { title: 'Baths', items: [{ label: 'Vanities', value: 'Oak' }, { label: '', value: 'New everything' }] },
  ]);
  assert.deepEqual(parseTeam('Electrical | G.L. Price | Full rewire\nbad line\nDesign | Wilmoth'), [
    { role: 'Electrical', name: 'G.L. Price', detail: 'Full rewire' },
    { role: 'Design', name: 'Wilmoth', detail: '' },
  ]);
});

test('slugs, problems, sorting', () => {
  assert.equal(slugify('420 Peyton Street, Raleigh & Co.'), '420-peyton-street-raleigh-and-co');
  assert.deepEqual(siteProblems({ siteStatus: null, siteSlug: null, siteDescription: null }, []), []);
  assert.equal(siteProblems({ siteStatus: 'for_sale', siteSlug: 'Bad Slug', siteDescription: '' }, []).length, 3);
  assert.deepEqual(sortProjects([{ name: 'B', sort: 0, featured: false }, { name: 'A', sort: 1, featured: false }, { name: 'C', sort: 5, featured: true }]).map((x) => x.name), ['C', 'B', 'A']);
});

test('hosts and links', () => {
  assert.ok(isPublicHost('chessoninvestments.com'));
  assert.ok(isPublicHost('WWW.chessoninvestments.com:443'));
  assert.ok(!isPublicHost('chesson-investments.vercel.app'));
  assert.equal(siteHref(true, '/projects/x'), '/projects/x');
  assert.equal(siteHref(false, '/projects/x'), '/site/projects/x');
  assert.equal(siteHref(false, '/'), '/site');
});

test('photos are copied only from our own old website', () => {
  assert.ok(allowedPhotoUrl('https://chessoninvestments.com/images/after-01.jpg'));
  assert.ok(!allowedPhotoUrl('http://chessoninvestments.com/images/a.jpg'));
  assert.ok(!allowedPhotoUrl('https://evil.example/images/a.jpg'));
  assert.ok(!allowedPhotoUrl('https://chessoninvestments.com.evil.example/a.jpg'));
  assert.ok(!allowedPhotoUrl('https://user@chessoninvestments.com/a.jpg'));
  assert.ok(!allowedPhotoUrl('not a url'));
});
