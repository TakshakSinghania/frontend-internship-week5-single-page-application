// Route "/about": what the app is, how it works, and a reset for the demo data.
import { el } from '../dom.js';
import { toast, confirmDialog } from '../ui.js';

export function aboutView({ store }) {
  const reset = el('button', {
    class: 'button button-danger', type: 'button',
    onclick: async () => {
      const ok = await confirmDialog({ title: 'Reset the demo data?', message: 'All books you added, progress, ratings and notes will be replaced by the original sample shelf.', confirmLabel: 'Reset data' });
      if (!ok) return;
      await store.reset();
      toast('Demo data restored.');
    },
  }, 'Reset demo data');

  const node = el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    el('header', { class: 'view-header' },
      el('h1', { id: 'view-title', tabindex: '-1' }, 'About Shelf'),
      el('p', { class: 'muted' }, 'A small single-page application built with HTML, CSS and vanilla JavaScript.')),
    el('section', { class: 'panel prose', 'aria-labelledby': 'how-title' },
      el('h2', { id: 'how-title' }, 'How it works'),
      el('ul', { class: 'bullets' },
        el('li', {}, 'There is one HTML page. Each view (dashboard, library, book, add, stats, about) is drawn by JavaScript into the same container, so moving between them never reloads the page.'),
        el('li', {}, 'The address shows where you are, for example ', el('code', {}, '#/book/3'), ' or ', el('code', {}, '#/library?status=reading'), '. You can bookmark it, refresh it, share it, and use the browser’s Back and Forward buttons.'),
        el('li', {}, 'The sample books load from data/books.json the first time. After that your shelf is saved in this browser’s local storage.'),
        el('li', {}, 'Addresses that do not exist show a “page not found” view instead of a broken screen.'))),
    el('section', { class: 'panel prose', 'aria-labelledby': 'keys-title' },
      el('h2', { id: 'keys-title' }, 'Keyboard and accessibility'),
      el('ul', { class: 'bullets' },
        el('li', {}, 'After each navigation, focus moves to the new page heading, so screen-reader users hear where they are.'),
        el('li', {}, 'Every control is a native link, button or form field. Use Tab to move around and Enter or Space to activate.'),
        el('li', {}, 'Animations are short and switch off when your system asks for reduced motion.'))),
    el('section', { class: 'panel panel-danger', 'aria-labelledby': 'reset-title' },
      el('h2', { id: 'reset-title' }, 'Demo data'),
      el('p', {}, 'Shelf is a demonstration. Nothing leaves your browser.'),
      reset));

  return { title: 'About', node };
}
