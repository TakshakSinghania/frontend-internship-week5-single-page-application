// Hash-based client-side router.
//
// URLs look like  index.html#/library?status=reading  so a static server always serves the same
// index.html, and refreshing or opening any route directly works without server configuration.
// Each hash change adds a browser history entry, so Back/Forward move between views.
//
// Routes are patterns such as "/book/:id". A view is a function (ctx) => { title, node, update?, destroy? }.
// If only the query string changes on the same route, the router calls view.update(ctx) instead of
// re-rendering, so typing in a search box keeps its focus.

function compile(pattern) {
  const keys = [];
  const source = pattern.replace(/\/:([a-z]+)/gi, (_, key) => {
    keys.push(key);
    return '/([^/]+)';
  });
  return { regex: new RegExp(`^${source}$`), keys };
}

export function parseHash(hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  let path;
  try {
    path = decodeURIComponent(q === -1 ? raw : raw.slice(0, q));
  } catch {
    path = '/\u0000invalid'; // malformed escape such as "%E0%A4" -> matches no route -> not-found view
  }
  if (path.length > 1) path = path.replace(/\/+$/, ''); // "/library/" -> "/library"
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(q === -1 ? '' : raw.slice(q + 1)) };
}

export function createRouter({ routes, notFound, outlet, guard, onRoute }) {
  const table = routes.map((route) => ({ ...route, ...compile(route.path) }));
  let current = null;

  function match(path) {
    for (const route of table) {
      const m = path.match(route.regex);
      if (m) return { route, params: Object.fromEntries(route.keys.map((key, i) => [key, m[i + 1]])) };
    }
    return null;
  }

  function render({ focus = true } = {}) {
    // An empty hash (first visit to index.html) is rewritten to "#/" without adding a history entry.
    if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/');
    const { path, query } = parseHash(location.hash);
    const found = match(path);
    const ctx = { path, query, params: found?.params ?? {}, navigate };

    const sameRoute = current && found && current.route === found.route
      && JSON.stringify(current.params) === JSON.stringify(found.params);
    if (sameRoute && current.view.update) {
      current.view.update(ctx);
      return;
    }

    current?.view.destroy?.();
    const blocked = guard?.(ctx); // e.g. loading or error screen while data is not ready
    const view = blocked || (found ? found.route.view(ctx) : notFound(ctx));
    current = { route: blocked ? null : found?.route, params: found?.params ?? {}, view };

    view.node.classList.add('view-enter');
    outlet.replaceChildren(view.node);
    document.title = `${view.title} · Shelf`;
    onRoute?.({ path, title: view.title, focus, found: Boolean(found) });
  }

  function navigate(to, { replace = false } = {}) {
    const hash = `#${to}`;
    if (hash === location.hash) return;
    if (replace) {
      history.replaceState(null, '', hash); // replaceState does not fire hashchange, so render directly
      render({ focus: false });
    } else {
      location.hash = to; // fires hashchange -> render
    }
  }

  window.addEventListener('hashchange', () => render());

  return {
    start: () => render({ focus: false }),
    // Redraw the current route (after data loads). If focus was inside the old view, move it to the new heading.
    refresh: () => {
      const hadFocus = outlet.contains(document.activeElement);
      current = null;
      render({ focus: hadFocus });
    },
    navigate,
    match,
  };
}
