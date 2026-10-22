# Testing — Week 5 (Shelf SPA)

## Environment

| Item | Version / detail |
|------|------------------|
| OS | macOS (Darwin 27.0) |
| Node.js | 26.8.2 (`node:test`) |
| Automated browser | Google Chrome 156 headless via puppeteer-core 25.16.0 |
| Manual browser | Built-in Chromium browser pane of the Claude desktop app, served by `python3 -m http.server` |
| Static tools | html-validate 11.17.0, csstree-validator 4.0.1, `node --check` |
| Extra scan | axe-core 4.14.0 (one-off script, not a project dependency) |

## Tests executed

### Static analysis (automated): `npm run validate`

| Check | Result |
|-------|--------|
| html-validate | **Pass**, 0 errors (first run: 2 `no-implicit-button-type` errors on the dialog buttons, fixed) |
| csstree-validator | **Pass**, 0 errors |
| `node --check` on all 13 modules | **Pass** |

### End-to-end tests (automated): `npm run e2e`

Each test runs in a fresh browser context against a local static server. Every test records console errors, page errors and HTTP responses ≥ 400.

Required checks from the brief: (1) initial loading, (2) navigation between views, (3) URL updates, (4) Back/Forward, (5) refreshing routes, (6) direct navigation, (7) unknown routes, (8) state updates, (9) console errors and broken assets, (10) responsive behaviour.

| Test (as named in `tests/spa.test.mjs`) | What it asserts | Required checks covered | Result |
|------------------------------------------|-----------------|-------------------------|--------|
| 1. initial load | Data request held: "Loading your shelf…" with `aria-busy`; empty hash rewritten to `#/` without a history entry; dashboard renders; title "Dashboard · Shelf" | 1, 3 | ✅ Pass |
| 2. navigation between all views | Each nav link gives the right `h1`, hash and title, exactly one `aria-current`, and focus on `#view-title`; book page highlights Library; a `window` marker proves no reload | 2, 3, 9 | ✅ Pass |
| 3. browser Back and Forward | Dashboard → Library → Book 9 → Stats; Back ×3, Forward ×2; same document throughout | 4 | ✅ Pass |
| 4. refreshing keeps the route and filters | Reload `#/library?status=reading&sort=progress` keeps the same tab, sort and order | 5 | ✅ Pass |
| 5. direct navigation | Fresh tabs at `#/book/9`, `#/stats`, `#/library/`, `#/add`; no errors | 6, 9 | ✅ Pass |
| 6. unknown routes and invalid navigation | `#/nope`, `#/book/999`, `#/book/abc`, `#/book`, `#/%E0%A4%A` show a fallback with the address and links; `?status=bogus&sort=price` shows a notice and all books | 7, 9 | ✅ Pass |
| 7. library filters live in the URL | Tab click pushes `?status=reading` and keeps focus; typing replaces history (length unchanged) and keeps focus; results and live count; sort in URL; empty state; Back skips keystrokes and resyncs the search box | 3, 4, 8 | ✅ Pass |
| 8. state updates: progress… | Progress validation (400 > 320, 12.5), save at 200 (63%), finish at 320, rating, dashboard totals, persistence after reload | 8, 9 | ✅ Pass |
| 8b. adding and deleting a book | Add-book validation (3 errors, focus), duplicate detection, redirect to `#/book/13`, delete dialog (Cancel focused, Esc cancels), confirm → Library (12 books), Back → "Book not found" | 3, 4, 7, 8 | ✅ Pass |
| 9. data loading failure | `books.json` returns 500 → error view with message; Try again → Stats renders and focus moves to its heading | 1, 9 | ✅ Pass |
| 9b. reset demo data | Adding a book, then resetting, restores 12 books | 8 | ✅ Pass |
| 10. responsive layout | 375, 768, 1440 px: 0 px overflow; nav `fixed` (bottom bar) on 375/768, `static` (sidebar) on 1440 | 10 | ✅ Pass |
| skip link | Focuses the heading and leaves the hash unchanged | 2 | ✅ Pass |
| no console errors, failed requests or leaked values | Visits 9 routes: no console/page/HTTP errors and no `false`/`null`/`undefined`/`NaN` text in `main` | 9 | ✅ Pass |

Final run:

```
ℹ tests 14
ℹ pass 14
ℹ fail 0
```

### Accessibility scan (one-off, axe-core 4.14, WCAG 2.0–2.2 A/AA + best practice)

| Route | Violations |
|-------|------------|
| `#/`, `#/library`, `#/library?status=finished`, `#/book/3`, `#/book/1`, `#/add`, `#/stats`, `#/about`, `#/nope` | 0 on every route |

### Manual checks (built-in browser pane)

| Check | Result |
|-------|--------|
| Dashboard, Library and Book views at the pane width (about 800 px, bottom tab bar) | Rendered correctly after defect 3 was fixed |
| Dashboard → Library → Book 1, then browser Back → Library, Forward → Book 1; a `window` flag set at the start was still present (same document) | Pass |
| Review of all 10 screenshots in `docs/screenshots/` | Found defect 1; pass after the fix |

### ZIP archive verification (`week-5-single-page-application.zip`)

Built with `npm run zip`, then checked from a fresh folder:

| Check | Result |
|-------|--------|
| `unzip -t` integrity test | No errors detected |
| Contents compared with `git ls-files` | Every tracked project file present; files sit under one top-level `week-5-single-page-application/` folder |
| Excluded items | No `node_modules/`, `.git/`, `.DS_Store` or nested ZIP |
| Extracted copy: `npm ci` then `npm test` | 47 packages installed from the lockfile; validators pass; 14/14 end-to-end tests pass |

The archive was rebuilt once after this section was added, so that it contains this file, and the same checks were run again on the rebuilt archive.

## Defects found and fixed

| # | Defect | Found by | Fix |
|---|--------|----------|-----|
| 1 | The text "false" rendered on finished and want-to-read book pages | Screenshot review | Filter conditional panels before `replaceChildren()`; regression check in test 12 |
| 2 | After Back, the library search box kept stale text while focused | Test 7 | `typing` flag: only typing-driven updates skip syncing the box |
| 3 | Dashboard covers stretched across half the row | Manual view in browser pane | Specific `.reading-info` class instead of `.reading-item > div` |
| 4 | Dialog buttons without `type` | html-validate | `type="submit"` (required for `method="dialog"`) |

Test-code issues fixed (not app defects): a new Puppeteer tab already has `about:blank` in its history, so the history-length check compares against a page opened at `#/`; and `location.hash` changes before the app handles `hashchange`, so the tests wait for the UI (the active tab) instead of the URL.

## Not tested

- Safari / WebKit and Firefox
- Physical phones and tablets (only Chrome emulation)
- Screen-reader announcements (focus movement and ARIA were asserted, not the speech output)
- Performance audits (Lighthouse was the Week 4 focus)

## Limitations of the routing strategy

- Hash URLs work on any static host, including refresh and direct links, but look like `#/book/3`. Path URLs (`/book/3`) with the History API would need the server to return `index.html` for unknown paths, which GitHub Pages cannot do without a 404.html redirect workaround.
- ES modules and `fetch` need `http(s)://`; the page shows a message when opened via `file://`.
- Scroll position is not restored on Back (every navigation scrolls to the top).

## Reproduce

```bash
npm install
npm test
```

Manual: `python3 -m http.server 8000`, open <http://localhost:8000/>, use the navigation and the browser's Back, Forward and Refresh buttons, and try addresses such as `#/book/999` and `#/library?status=finished`.
