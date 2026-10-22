// Captures each view into docs/screenshots (used in the README and report).
// Usage: npm run screenshots
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    res.writeHead(200, { 'Content-Type': types[extname(path) || '.html'] }).end(await readFile(join(root, path.endsWith('/') ? path + 'index.html' : path)));
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const out = (name) => join(root, 'docs/screenshots', `${name}.jpg`);

async function shoot(name, hash, { width = 1440, height = 900, before } = {}) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport({ width, height });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); // capture finished states, not mid-animation
  await page.goto(base + hash, { waitUntil: 'networkidle0' });
  if (before) await before(page);
  await page.screenshot({ path: out(name), type: 'jpeg', quality: 82 });
  await context.close();
}

await shoot('desktop-dashboard', '#/');
await shoot('desktop-library-filtered', '#/library?status=reading&sort=progress');
await shoot('desktop-book', '#/book/3');
await shoot('desktop-add-errors', '#/add', { before: (p) => p.click('form.form-card button[type="submit"]') });
await shoot('desktop-stats', '#/stats');
await shoot('desktop-not-found', '#/this-page-does-not-exist');
await shoot('desktop-delete-dialog', '#/book/9', { before: (p) => p.click('.button-danger') });
await shoot('mobile-dashboard', '#/', { width: 375, height: 812 });
await shoot('mobile-library', '#/library?q=narayan', { width: 375, height: 812 });
await shoot('mobile-book', '#/book/12', { width: 375, height: 812 });

await browser.close();
server.close();
console.log('Screenshots saved to docs/screenshots');
