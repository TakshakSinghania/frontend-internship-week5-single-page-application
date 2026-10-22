// End-to-end tests for routing, history, state and error handling (headless Chrome).
// Usage: npm test   (set CHROME_PATH if Chrome is not at the default macOS location)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
let server;
let browser;
let base;

before(async () => {
  server = http.createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
      const body = await readFile(join(root, path.endsWith('/') ? path + 'index.html' : path));
      res.writeHead(200, { 'Content-Type': types[extname(path) || '.html'] || 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }).listen(0);
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
});

after(async () => { await browser?.close(); server?.close(); });

// Fresh browser context (empty localStorage) per test. Collects console errors and failed requests.
async function open(hash = '', { width = 1280, height = 900, intercept } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.problems = [];
  page.on('pageerror', (e) => page.problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && page.problems.push(`console: ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && !r.url().includes('books.json') && page.problems.push(`HTTP ${r.status()} ${r.url()}`));
  if (intercept) {
    await page.setRequestInterception(true);
    page.on('request', (req) => intercept(req));
  }
  await page.setViewport({ width, height });
  await page.goto(base + hash, { waitUntil: 'networkidle0' });
  page.done = () => context.close();
  return page;
}

const h1 = (page) => page.$eval('h1', (h) => h.textContent);
const hash = (page) => page.evaluate(() => location.hash);
const waitForH1 = (page, text) => page.waitForFunction((t) => document.querySelector('h1')?.textContent === t, { timeout: 5000 }, text);
// location.hash changes as soon as a link is clicked, before the app handles hashchange, so wait for the UI instead
const waitForTab = (page, key) => page.waitForFunction((k) => document.querySelector('.filter-tabs [aria-current="page"]')?.dataset.key === k, { timeout: 5000 }, key);
const mark = (page) => page.evaluate(() => { window.__noReload = true; });
const notReloaded = (page) => page.evaluate(() => window.__noReload === true);

test('1. initial load: loading state, then dashboard; empty hash becomes #/', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setRequestInterception(true);
  page.on('request', async (req) => {
    if (req.url().endsWith('books.json')) await gate; // hold the data so the loading state can be observed
    req.continue();
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Loading your shelf');
  assert.equal(await page.$eval('[aria-busy="true"] [role="status"]', (s) => s.textContent), 'Loading your shelf…');
  assert.equal(await hash(page), '#/');
  release();
  await waitForH1(page, 'Your reading');
  assert.equal(await page.title(), 'Dashboard · Shelf');
  assert.equal(await page.$eval('[data-nav="/"]', (a) => a.getAttribute('aria-current')), 'page');
  const lengthFromEmptyHash = await page.evaluate(() => history.length);
  await context.close();
  const direct = await open('#/'); // same app opened at "#/" directly
  assert.equal(lengthFromEmptyHash, await direct.evaluate(() => history.length), 'rewriting the empty hash did not add a history entry');
  await direct.done();
});

test('2. navigation between all views updates the view, URL, title, active link and focus without reloading', async () => {
  const page = await open();
  await mark(page);
  const routes = [
    ['/library', '#/library', 'Library', 'Library · Shelf'],
    ['/add', '#/add', 'Add a book', 'Add a book · Shelf'],
    ['/stats', '#/stats', 'Reading stats', 'Stats · Shelf'],
    ['/about', '#/about', 'About Shelf', 'About · Shelf'],
    ['/', '#/', 'Your reading', 'Dashboard · Shelf'],
  ];
  for (const [nav, expectedHash, heading, title] of routes) {
    await page.click(`[data-nav="${nav}"]`);
    await waitForH1(page, heading);
    assert.equal(await hash(page), expectedHash);
    assert.equal(await page.title(), title);
    assert.equal(await page.$eval(`[data-nav="${nav}"]`, (a) => a.getAttribute('aria-current')), 'page');
    assert.equal(await page.$$eval('[data-nav][aria-current]', (a) => a.length), 1);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'view-title', `focus moved to the ${heading} heading`);
  }
  await page.click('a[href="#/book/3"]');
  await waitForH1(page, 'Atomic Habits');
  assert.equal(await page.$eval('[data-nav="/library"]', (a) => a.getAttribute('aria-current')), 'page', 'book pages highlight Library');
  assert.equal(await notReloaded(page), true);
  assert.deepEqual(page.problems, []);
  await page.done();
});

test('3. browser Back and Forward move between views', async () => {
  const page = await open();
  await mark(page);
  await page.click('[data-nav="/library"]');
  await waitForH1(page, 'Library');
  await page.click('a[href="#/book/9"]');
  await waitForH1(page, 'Wings of Fire');
  await page.click('[data-nav="/stats"]');
  await waitForH1(page, 'Reading stats');

  await page.goBack();
  await waitForH1(page, 'Wings of Fire');
  await page.goBack();
  await waitForH1(page, 'Library');
  await page.goBack();
  await waitForH1(page, 'Your reading');
  await page.goForward();
  await waitForH1(page, 'Library');
  await page.goForward();
  await waitForH1(page, 'Wings of Fire');
  assert.equal(await hash(page), '#/book/9');
  assert.equal(await notReloaded(page), true, 'Back/Forward stayed inside the single page');
  await page.done();
});

test('4. refreshing keeps the route and the filters from the URL', async () => {
  const page = await open('#/library?status=reading&sort=progress');
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await h1(page), 'Library');
  assert.equal(await page.$eval('.filter-tabs [aria-current="page"]', (a) => a.dataset.key), 'reading');
  assert.equal(await page.$eval('#sort', (s) => s.value), 'progress');
  assert.deepEqual(await page.$$eval('.book-row-title', (r) => r.map((x) => x.textContent)), ['Clean Code', 'Atomic Habits', 'The God of Small Things']);
  await page.done();
});

test('5. direct navigation to supported routes (including a trailing slash)', async () => {
  for (const [route, heading] of [['#/book/9', 'Wings of Fire'], ['#/stats', 'Reading stats'], ['#/library/', 'Library'], ['#/add', 'Add a book']]) {
    const page = await open(route);
    assert.equal(await h1(page), heading, route);
    assert.deepEqual(page.problems, []);
    await page.done();
  }
});

test('6. unknown routes and invalid navigation show helpful fallbacks', async () => {
  const cases = [
    ['#/nope', 'Page not found', '#/nope'],
    ['#/book/999', 'Book not found', '999'],
    ['#/book/abc', 'Book not found', 'abc'],
    ['#/book', 'Page not found', '#/book'],
    ['#/%E0%A4%A', 'Page not found', null], // malformed percent-encoding must not crash the router
  ];
  for (const [route, heading, codeText] of cases) {
    const page = await open(route);
    assert.equal(await h1(page), heading, route);
    if (codeText) assert.equal(await page.$eval('main code', (c) => c.textContent), codeText);
    assert.equal(await page.$$eval('main a[href="#/"]', (a) => a.length), 1, 'offers a way back');
    assert.deepEqual(page.problems, [], route);
    await page.done();
  }
  const page = await open('#/library?status=bogus&sort=price');
  assert.equal(await page.$eval('.notice', (n) => n.textContent), 'Unknown status “bogus” and sort “price” in the address was ignored.');
  assert.equal(await page.$$eval('.book-row', (r) => r.length), 12);
  await page.done();
});

test('7. library filters live in the URL; typing replaces history instead of adding entries', async () => {
  const page = await open('#/library');
  await page.click('.filter-tabs [data-key="reading"]');
  await waitForTab(page, 'reading');
  assert.equal(await hash(page), '#/library?status=reading');
  assert.equal(await page.$$eval('.book-row', (r) => r.length), 3);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.key), 'reading', 'focus stays on the tab');
  await page.click('.filter-tabs [data-key="all"]');
  await waitForTab(page, 'all');

  const before = await page.evaluate(() => history.length);
  await page.type('#search', 'narayan');
  assert.equal(await hash(page), '#/library?q=narayan');
  assert.equal(await page.evaluate(() => history.length), before, 'no history entry per keystroke');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'search', 'search box keeps focus while the list updates');
  assert.deepEqual(await page.$$eval('.book-row-title', (r) => r.map((x) => x.textContent)), ['Malgudi Days', 'The Guide']);
  assert.match(await page.$eval('.view [aria-live]', (c) => c.textContent), /^2 books matching “narayan”/);

  await page.select('#sort', 'recent');
  assert.equal(await hash(page), '#/library?q=narayan&sort=recent');
  await page.$eval('#search', (i) => i.select());
  await page.type('#search', 'zzz');
  assert.equal(await page.$eval('.empty', (e) => !e.hidden && e.textContent.includes('No books match')), true);
  await page.goBack(); // back to the "reading" filter, skipping every keystroke
  await waitForTab(page, 'reading');
  assert.equal(await hash(page), '#/library?status=reading');
  assert.equal(await page.$$eval('.book-row', (r) => r.length), 3);
  assert.equal(await page.$eval('#search', (i) => i.value), '', 'search box synced after Back');
  await page.done();
});

test('8. state updates: progress, validation, finishing a book, rating, persistence', async () => {
  const page = await open('#/book/3');
  await page.$eval('#page', (i) => i.select());
  await page.type('#page', '400');
  await page.click('form.inline-form button[type="submit"]');
  assert.equal(await page.$eval('#page-error', (e) => e.textContent), 'This book has 320 pages. Enter 320 or less.');
  assert.equal(await page.$eval('#page', (i) => i.getAttribute('aria-invalid')), 'true');
  await page.$eval('#page', (i) => i.select());
  await page.type('#page', '12.5');
  await page.click('form.inline-form button[type="submit"]');
  assert.equal(await page.$eval('#page-error', (e) => e.textContent), 'Use a whole number, without decimals or letters.');

  await page.$eval('#page', (i) => i.select());
  await page.type('#page', '200');
  await page.click('form.inline-form button[type="submit"]');
  assert.match(await page.$eval('.toast:last-child', (t) => t.textContent), /page 200 \(63%\)/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'page');

  await page.$eval('#page', (i) => i.select());
  await page.type('#page', '320');
  await page.click('form.inline-form button[type="submit"]');
  assert.equal(await page.$eval('.badge', (b) => b.textContent), 'Finished');
  await page.click('input[name="rating"][value="4"]');
  assert.equal(await page.$eval('.stars + p', (p) => p.textContent), '4 out of 5');

  await page.click('[data-nav="/"]');
  await waitForH1(page, 'Your reading');
  const stats = await page.$$eval('.stat-value', (s) => s.map((x) => x.textContent));
  assert.equal(stats[0], '2', 'one fewer book being read');
  assert.match(stats[1], /^6\//, 'one more book finished this year');

  await page.reload({ waitUntil: 'networkidle0' });
  assert.match((await page.$$eval('.stat-value', (s) => s.map((x) => x.textContent)))[1], /^6\//, 'state persisted');
  assert.deepEqual(page.problems, []);
  await page.done();
});

test('8b. adding and deleting a book, with validation and a confirmation dialog', async () => {
  const page = await open('#/add');
  await page.click('form.form-card button[type="submit"]');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'title');
  assert.deepEqual(await page.$$eval('.error:not([hidden])', (e) => e.map((x) => x.textContent)), ['Enter the book’s title.', 'Enter the author’s name.', 'Enter the number of pages.']);

  await page.type('#title', 'godaan');
  await page.type('#author', 'Munshi Premchand');
  await page.type('#pages', '300');
  await page.click('form.form-card button[type="submit"]');
  assert.match(await page.$eval('#title-error', (e) => e.textContent), /already on your shelf/);

  await page.$eval('#title', (i) => i.select());
  await page.type('#title', 'Nirmala');
  await page.click('form.form-card button[type="submit"]');
  await waitForH1(page, 'Nirmala');
  assert.equal(await hash(page), '#/book/13');

  await page.click('.button-danger');
  assert.equal(await page.$eval('#confirm-dialog', (d) => d.open), true);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.dialogCancel !== undefined), true, 'Cancel is focused first');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#confirm-dialog', (d) => d.open), false);
  assert.equal(await h1(page), 'Nirmala', 'Escape cancelled the delete');

  await page.click('.button-danger');
  await page.click('[data-dialog-confirm]');
  await waitForH1(page, 'Library');
  assert.equal(await page.$$eval('.book-row', (r) => r.length), 12);
  await page.goBack();
  await waitForH1(page, 'Book not found');
  await page.done();
});

test('9. data loading failure shows an error state with a working retry', async () => {
  let fail = true;
  const page = await open('#/stats', {
    intercept: (req) => (req.url().endsWith('books.json') && fail ? req.respond({ status: 500, body: 'error' }) : req.continue()),
  });
  assert.equal(await h1(page), 'Your shelf could not be loaded');
  assert.match(await page.$eval('[role="alert"]', (a) => a.textContent), /500/);
  fail = false;
  await page.click('main .button');
  await waitForH1(page, 'Reading stats');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'view-title', 'focus moved from the retry button to the new heading');
  await page.done();
});

test('9b. reset demo data restores the sample shelf', async () => {
  const page = await open('#/add');
  await page.type('#title', 'Temporary');
  await page.type('#author', 'Someone');
  await page.type('#pages', '100');
  await page.click('form.form-card button[type="submit"]');
  await waitForH1(page, 'Temporary');
  await page.click('[data-nav="/about"]');
  await waitForH1(page, 'About Shelf');
  await page.click('.button-danger');
  await page.click('[data-dialog-confirm]');
  await page.waitForFunction(() => document.querySelector('.toast')?.textContent === 'Demo data restored.');
  await page.click('[data-nav="/library"]');
  await waitForH1(page, 'Library');
  assert.equal(await page.$$eval('.book-row', (r) => r.length), 12);
  await page.done();
});

test('10. responsive layout: no overflow; bottom tab bar on phones, sidebar on desktop', async () => {
  for (const [width, height, expected] of [[375, 812, 'fixed'], [768, 1024, 'fixed'], [1440, 900, 'static']]) {
    const page = await open('#/library', { width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${width}px overflow`);
    assert.equal(await page.$eval('.nav', (n) => getComputedStyle(n).position), expected, `${width}px nav position`);
    await page.done();
  }
});

test('skip link focuses the heading without changing the route', async () => {
  const page = await open('#/stats');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to content');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'view-title');
  assert.equal(await hash(page), '#/stats');
  await page.done();
});

test('no console errors, failed requests or leaked values across every view', async () => {
  const page = await open();
  for (const route of ['#/library', '#/book/1', '#/book/3', '#/book/4', '#/add', '#/stats', '#/about', '#/missing', '#/']) {
    await page.evaluate((r) => { location.hash = r; }, route);
    await page.waitForFunction((r) => location.hash === r && document.querySelector('h1'), {}, route);
    // guards against values such as `false` or `undefined` leaking into the page as text
    assert.doesNotMatch(await page.$eval('main', (m) => m.textContent), /\b(false|null|undefined|NaN)\b/, route);
  }
  assert.deepEqual(page.problems, []);
  await page.done();
});
