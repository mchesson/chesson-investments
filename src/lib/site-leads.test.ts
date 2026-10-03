import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowSubmit, checkLead, cleanPath, cleanReferrer, isBot, isBotAgent, isGaId, pageName, parseSource, parseUtm, phoneLink, phoneShown,
  searchConsoleCode, sourceName, websiteSettings, HONEYPOT, type WebsiteSettings,
} from './site-leads';

const form = (o: Record<string, string>) => (k: string) => (o[k]?.trim() ? o[k].trim() : null);

test('a contact needs a name, a way to reach them and a message', () => {
  assert.deepEqual(checkLead('contact', form({ email: 'a@b.com', message: 'Hi' })), { error: 'Please tell us your name.' });
  assert.match((checkLead('contact', form({ name: 'Ann', message: 'Hi' })) as { error: string }).error, /email address or a phone/);
  assert.match((checkLead('contact', form({ name: 'Ann', email: 'a@b.com' })) as { error: string }).error, /short message/);
  assert.match((checkLead('contact', form({ name: 'Ann', email: 'not-an-email', message: 'x' })) as { error: string }).error, /email address doesn’t look right/);
  assert.match((checkLead('contact', form({ name: 'Ann', phone: '555-12', message: 'x' })) as { error: string }).error, /area code/);
  const ok = checkLead('contact', form({ name: '  Ann   Lee ', email: 'Ann@Example.COM', message: 'Hello', topic: 'selling', propertyAddress: 'ignored' }));
  assert.ok('lead' in ok);
  assert.equal(ok.lead.name, 'Ann Lee');
  assert.equal(ok.lead.email, 'ann@example.com');
  assert.equal(ok.lead.topic, 'selling');
  assert.equal(ok.lead.propertyAddress, null);
});

test('a property to sell needs its address; unknown choices are dropped', () => {
  assert.match((checkLead('sell', form({ name: 'Bo', phone: '(919) 555-0101' })) as { error: string }).error, /property’s address/);
  const ok = checkLead('sell', form({ name: 'Bo', phone: '(919) 555-0101', propertyAddress: '12 Oak St', propertyKind: 'house', condition: 'castle', timeline: 'now', askingPrice: '400k' }));
  assert.ok('lead' in ok);
  assert.equal(ok.lead.propertyKind, 'house');
  assert.equal(ok.lead.condition, null);
  assert.equal(ok.lead.timeline, 'now');
  assert.equal(ok.lead.askingPrice, '400k');
  assert.equal(ok.lead.message, null);
});

test('an unknown form and very long text are handled', () => {
  assert.ok('error' in checkLead('spam', form({ name: 'x' })));
  const ok = checkLead('contact', form({ name: 'x'.repeat(500), email: 'a@b.co', message: 'y'.repeat(9000) }));
  assert.ok('lead' in ok);
  assert.equal(ok.lead.name.length, 120);
  assert.equal(ok.lead.message!.length, 5000);
});

test('the honeypot catches bots', () => {
  assert.ok(isBot(form({ [HONEYPOT]: 'http://spam' })));
  assert.ok(!isBot(form({ name: 'Ann' })));
});

test('utm tags come from an address or a query', () => {
  assert.deepEqual(parseUtm('/sell?utm_source=Facebook&utm_medium=social&utm_campaign=Fall%20Lots#x'), { utmSource: 'facebook', utmMedium: 'social', utmCampaign: 'fall lots' });
  assert.deepEqual(parseUtm('utm_source=google'), { utmSource: 'google', utmMedium: null, utmCampaign: null });
  assert.deepEqual(parseUtm(''), { utmSource: null, utmMedium: null, utmCampaign: null });
  assert.equal(parseUtm('?utm_source=<script>').utmSource, 'script');
});

test('where a lead came from, from what the browser kept', () => {
  const raw = JSON.stringify({ referrer: 'https://www.google.com/search?q=private+words', landing: '/site/sell?utm_source=Mailer', utm_source: null });
  const s = parseSource(raw, '/site/sell', ['localhost:3000']);
  assert.equal(s.referrer, 'https://www.google.com');
  assert.equal(s.landingPage, '/sell?utm_source=Mailer');
  assert.equal(s.formPage, '/sell');
  assert.equal(s.utmSource, 'mailer');
  // Our own site isn't a referrer; junk is ignored.
  assert.equal(parseSource(JSON.stringify({ referrer: 'https://chessoninvestments.com/about' }), null, ['chessoninvestments.com']).referrer, null);
  assert.deepEqual(parseSource('not json', 'https://evil.example/x', []), { referrer: null, landingPage: null, formPage: '/x', utmSource: null, utmMedium: null, utmCampaign: null });
  assert.equal(parseSource('[1,2]', null).landingPage, null);
});

test('paths and referrers are cleaned', () => {
  assert.equal(cleanPath('/site'), '/');
  assert.equal(cleanPath('/site/projects/x'), '/projects/x');
  assert.equal(cleanPath('//evil.com'), null);
  assert.equal(cleanPath('javascript:alert(1)'), null);
  assert.equal(cleanReferrer('javascript:alert(1)'), null);
  assert.equal(cleanReferrer('https://m.facebook.com/'), 'https://m.facebook.com');
});

test('leads by source: the utm tag, else the site, else Direct', () => {
  assert.equal(sourceName({ utmSource: 'mailer', referrer: 'https://www.google.com' }), 'mailer');
  assert.equal(sourceName({ utmSource: null, referrer: 'https://www.google.co.uk' }), 'google');
  assert.equal(sourceName({ utmSource: null, referrer: 'https://l.facebook.com/x' }), 'facebook');
  assert.equal(sourceName({ utmSource: null, referrer: 'https://www.zillow.com/x' }), 'zillow.com');
  assert.equal(sourceName({ utmSource: null, referrer: null }), 'Direct');
});

test('rate limit: three in ten minutes, ten in a day', () => {
  const now = new Date('2026-10-03T12:00:00Z');
  const ago = (m: number) => new Date(now.getTime() - m * 60_000);
  assert.ok(allowSubmit([], now));
  assert.ok(allowSubmit([ago(1), ago(2)], now));
  assert.ok(!allowSubmit([ago(1), ago(2), ago(3)], now));
  assert.ok(allowSubmit([ago(11), ago(12), ago(13)], now));
  assert.ok(!allowSubmit(Array.from({ length: 10 }, (_, i) => ago(30 + i * 60)), now));
  assert.ok(allowSubmit(Array.from({ length: 10 }, (_, i) => ago(25 * 60 + i)), now));
});

test('bots and link checkers aren’t counted as visits', () => {
  assert.ok(isBotAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'));
  assert.ok(isBotAgent(null));
  assert.ok(!isBotAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'));
});

test('website settings: Google tools are checked, empty words go back to the start', () => {
  const d: WebsiteSettings = { phone: '+19195550100', email: null, area: 'Here', aboutText: 'A', whatWeDoIntro: 'B', sellIntro: 'C', contactIntro: 'D', gaId: null, searchConsole: null };
  assert.deepEqual(websiteSettings(null, d), d);
  const s = websiteSettings({ phone: '', aboutText: '  ', gaId: 'g-abc1234', searchConsole: '<meta name="google-site-verification" content="abcDEF_12345-x" />' }, d);
  assert.equal(s.phone, null);
  assert.equal(s.aboutText, 'A');
  assert.equal(s.gaId, 'G-ABC1234');
  assert.equal(s.searchConsole, 'abcDEF_12345-x');
  assert.equal(websiteSettings({ gaId: 'UA-1234' }, d).gaId, null);
  assert.ok(isGaId('G-ABCD1234'));
  assert.ok(!isGaId('G-"><script>'));
  assert.equal(searchConsoleCode('"><script>'), null);
});

test('phones and page names', () => {
  assert.equal(phoneShown('+19197958948'), '(919) 795-8948');
  assert.equal(phoneLink('(919) 795-8948'), 'tel:+19197958948');
  assert.equal(phoneLink(null), null);
  assert.equal(pageName('/sell'), 'Sell Us Your Property');
  assert.equal(pageName('/projects/109-plainview'), 'Project: 109-plainview');
});
