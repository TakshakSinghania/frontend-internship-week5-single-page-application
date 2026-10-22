// Route "/library?status=&q=&sort=": filterable list. The URL is the source of truth for the filters,
// so a filtered list can be bookmarked, refreshed or reached with Back/Forward.
import { el, cover, progressBar, STATUS_LABELS } from '../dom.js';

const SORTS = {
  title: { label: 'Title (A–Z)', fn: (a, b) => a.title.localeCompare(b.title) },
  author: { label: 'Author (A–Z)', fn: (a, b) => a.author.localeCompare(b.author) },
  recent: { label: 'Recently added', fn: (a, b) => b.addedAt.localeCompare(a.addedAt) || b.id - a.id },
  progress: { label: 'Progress', fn: (a, b) => b.progress / b.pages - a.progress / a.pages },
};
const TABS = [['all', 'All'], ['want', STATUS_LABELS.want], ['reading', STATUS_LABELS.reading], ['finished', STATUS_LABELS.finished]];

function readQuery(query) {
  const rawStatus = query.get('status') || 'all';
  const rawSort = query.get('sort') || 'title';
  return {
    status: TABS.some(([key]) => key === rawStatus) ? rawStatus : 'all',
    sort: rawSort in SORTS ? rawSort : 'title',
    q: (query.get('q') || '').trim(),
    invalid: [
      !TABS.some(([key]) => key === rawStatus) && `status “${rawStatus}”`,
      !(rawSort in SORTS) && `sort “${rawSort}”`,
    ].filter(Boolean),
  };
}

const toHash = ({ status, q, sort }) => {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (q) params.set('q', q);
  if (sort !== 'title') params.set('sort', sort);
  const s = params.toString();
  return `/library${s ? `?${s}` : ''}`;
};

export function libraryView({ store, query, navigate }) {
  let filters = readQuery(query);

  const tabs = el('nav', { class: 'filter-tabs', 'aria-label': 'Filter by status' });
  const search = el('input', { id: 'search', type: 'search', autocomplete: 'off', placeholder: 'Title or author' });
  const sort = el('select', { id: 'sort' }, Object.entries(SORTS).map(([key, s]) => el('option', { value: key }, s.label)));
  const notice = el('p', { class: 'notice', role: 'status' });
  const count = el('p', { class: 'muted', 'aria-live': 'polite' });
  const list = el('ul', { class: 'book-list' });
  const empty = el('div', { class: 'empty' });

  // Updates caused by typing must not overwrite the box; any other change (Back/Forward, a tab link) must.
  let typing = false;
  search.addEventListener('input', () => {
    typing = true;
    navigate(toHash({ ...filters, q: search.value.trim() }), { replace: true }); // renders synchronously
    typing = false;
  });
  sort.addEventListener('change', () => navigate(toHash({ ...filters, sort: sort.value }), { replace: true }));

  function paint() {
    const { books } = store.state;
    const term = filters.q.toLowerCase();
    const shown = books
      .filter((b) => filters.status === 'all' || b.status === filters.status)
      .filter((b) => !term || b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term))
      .sort(SORTS[filters.sort].fn);

    const focusedTab = tabs.contains(document.activeElement) ? document.activeElement.dataset.key : null;
    tabs.replaceChildren(...TABS.map(([key, label]) => {
      const n = key === 'all' ? books.length : books.filter((b) => b.status === key).length;
      return el('a', { href: `#${toHash({ ...filters, status: key })}`, dataset: { key }, 'aria-current': filters.status === key ? 'page' : false }, label, el('span', { class: 'count' }, String(n)));
    }));
    if (focusedTab) tabs.querySelector(`[data-key="${focusedTab}"]`).focus(); // tabs were rebuilt; keep keyboard focus
    if (!typing) search.value = filters.q;
    sort.value = filters.sort;
    notice.textContent = filters.invalid.length ? `Unknown ${filters.invalid.join(' and ')} in the address was ignored.` : '';
    notice.hidden = !filters.invalid.length;
    count.textContent = `${shown.length} ${shown.length === 1 ? 'book' : 'books'}${filters.q ? ` matching “${filters.q}”` : ''}`;

    list.replaceChildren(...shown.map((b) => el('li', { class: 'book-row' },
      cover(b, 'sm'),
      el('div', { class: 'book-row-main' },
        el('h2', { class: 'book-row-title' }, el('a', { href: `#/book/${b.id}` }, b.title)),
        el('p', { class: 'muted' }, `${b.author} · ${b.genre} · ${b.pages} pages`)),
      el('div', { class: 'book-row-side' },
        el('span', { class: `badge badge-${b.status}` }, STATUS_LABELS[b.status]),
        b.status === 'reading' && progressBar(b)))));

    list.hidden = shown.length === 0;
    empty.hidden = shown.length > 0;
    empty.replaceChildren(
      el('p', {}, books.length ? 'No books match these filters.' : 'Your shelf is empty.'),
      books.length ? el('a', { class: 'button button-ghost', href: '#/library' }, 'Clear filters') : el('a', { class: 'button', href: '#/add' }, 'Add your first book'));
  }

  const node = el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    el('header', { class: 'view-header view-header-row' },
      el('h1', { id: 'view-title', tabindex: '-1' }, 'Library'),
      el('a', { class: 'button', href: '#/add' }, 'Add a book')),
    tabs,
    el('div', { class: 'toolbar' },
      el('div', { class: 'field' }, el('label', { for: 'search' }, 'Search'), search),
      el('div', { class: 'field' }, el('label', { for: 'sort' }, 'Sort by'), sort)),
    notice, count, list, empty);

  paint();
  return {
    title: 'Library',
    node,
    update(ctx) { // same route, new query string: repaint without rebuilding the view
      filters = readQuery(ctx.query);
      paint();
    },
  };
}
