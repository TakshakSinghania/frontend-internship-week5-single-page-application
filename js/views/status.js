// Screens shown by the router guard while the data is loading or after it failed to load.
import { el } from '../dom.js';

export function loadingView() {
  const node = el('section', { class: 'view', 'aria-labelledby': 'view-title', 'aria-busy': 'true' },
    el('h1', { id: 'view-title', tabindex: '-1', class: 'visually-hidden' }, 'Loading your shelf'),
    el('p', { class: 'muted', role: 'status' }, 'Loading your shelf…'),
    el('div', { class: 'skeleton-list', 'aria-hidden': 'true' }, [1, 2, 3].map(() => el('div', { class: 'skeleton' }))));
  return { title: 'Loading', node };
}

export function errorView({ store }) {
  const node = el('section', { class: 'view view-center', 'aria-labelledby': 'view-title' },
    el('h1', { id: 'view-title', tabindex: '-1' }, 'Your shelf could not be loaded'),
    el('p', { role: 'alert' }, store.state.error),
    el('p', { class: 'muted' }, 'Check your connection and try again. If you opened index.html directly from your files, run it from a local web server instead (see README).'),
    el('button', { class: 'button', type: 'button', onclick: () => store.load() }, 'Try again'));
  return { title: 'Error', node };
}
