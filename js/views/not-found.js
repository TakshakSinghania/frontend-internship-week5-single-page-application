// Fallback views for addresses that do not exist.
import { el } from '../dom.js';

function fallback({ heading, text, title }) {
  const node = el('section', { class: 'view view-center', 'aria-labelledby': 'view-title' },
    el('p', { class: 'code-404', 'aria-hidden': 'true' }, '404'),
    el('h1', { id: 'view-title', tabindex: '-1' }, heading),
    el('p', { class: 'muted' }, ...text),
    el('div', { class: 'form-actions' },
      el('a', { class: 'button', href: '#/' }, 'Go to the dashboard'),
      el('a', { class: 'button button-ghost', href: '#/library' }, 'Browse the library')));
  return { title, node };
}

export function notFoundView({ path }) {
  return fallback({ heading: 'Page not found', title: 'Page not found', text: ['There is no page at ', el('code', {}, `#${path}`), '. Check the address or use the links below.'] });
}

export function bookNotFoundView(id) {
  return fallback({ heading: 'Book not found', title: 'Book not found', text: ['No book with the id ', el('code', {}, String(id)), ' is on your shelf. It may have been deleted.'] });
}
