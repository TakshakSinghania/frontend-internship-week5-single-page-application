// Entry point: wires the store, the router and the views together.
import { createRouter } from './router.js';
import { createStore } from './store.js';
import { dashboardView } from './views/dashboard.js';
import { libraryView } from './views/library.js';
import { bookView } from './views/book.js';
import { addView } from './views/add.js';
import { statsView } from './views/stats.js';
import { aboutView } from './views/about.js';
import { notFoundView } from './views/not-found.js';
import { loadingView, errorView } from './views/status.js';

const store = createStore();
const outlet = document.getElementById('view');
const withStore = (view) => (ctx) => view({ ...ctx, store });

const router = createRouter({
  outlet,
  routes: [
    { path: '/', view: withStore(dashboardView) },
    { path: '/library', view: withStore(libraryView) },
    { path: '/book/:id', view: withStore(bookView) },
    { path: '/add', view: withStore(addView) },
    { path: '/stats', view: withStore(statsView) },
    { path: '/about', view: withStore(aboutView) },
  ],
  notFound: notFoundView,
  // Until the data is ready every route shows the loading or error screen instead.
  guard: () => {
    if (store.state.status === 'ready') return null;
    return store.state.status === 'error' ? errorView({ store }) : loadingView();
  },
  onRoute: ({ path, focus }) => {
    const section = `/${path.split('/')[1]}`; // "/book/3" -> "/book"
    const active = section === '/book' ? '/library' : section;
    document.querySelectorAll('[data-nav]').forEach((link) => {
      if (link.dataset.nav === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    // Move focus to the new heading so keyboard and screen-reader users start at the new content.
    if (focus) {
      window.scrollTo(0, 0);
      document.getElementById('view-title')?.focus({ preventScroll: true });
    }
  },
});

// Data finished loading (or failed): redraw whatever route is in the address bar.
store.subscribe((type) => {
  if (type === 'status') router.refresh();
});

// A normal "#main" skip link would be treated as a route, so focus the heading directly instead.
document.querySelector('[data-skip-link]').addEventListener('click', (event) => {
  event.preventDefault();
  document.getElementById('view-title')?.focus();
});

router.start();
store.load();
