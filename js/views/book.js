// Route "/book/:id": details and actions for one book. Unknown or malformed ids show a "book not found" view.
import { el, cover, progressBar, percent, formatDate, STATUS_LABELS } from '../dom.js';
import { toast, confirmDialog } from '../ui.js';
import { bookNotFoundView } from './not-found.js';

export function bookView({ store, params, navigate }) {
  const id = /^\d+$/.test(params.id) ? Number(params.id) : NaN;
  if (!store.find(id)) return bookNotFoundView(params.id);

  const node = el('section', { class: 'view', 'aria-labelledby': 'view-title' });

  // Re-render the view's content after each action, then put focus back on the control that was used.
  function paint(focusSelector) {
    const book = store.find(id);
    node.replaceChildren(...[ // filter out the `false` of panels that do not apply (replaceChildren would print "false")
      el('a', { class: 'back-link', href: '#/library' }, '← Library'),
      el('header', { class: 'book-hero' },
        cover(book, 'lg'),
        el('div', {},
          el('span', { class: `badge badge-${book.status}` }, STATUS_LABELS[book.status]),
          el('h1', { id: 'view-title', tabindex: '-1' }, book.title),
          el('p', { class: 'byline' }, `by ${book.author}`),
          el('dl', { class: 'facts' },
            el('div', {}, el('dt', {}, 'Genre'), el('dd', {}, book.genre)),
            el('div', {}, el('dt', {}, 'Pages'), el('dd', {}, String(book.pages))),
            el('div', {}, el('dt', {}, 'Added'), el('dd', {}, formatDate(book.addedAt))),
            book.finishedAt && el('div', {}, el('dt', {}, 'Finished'), el('dd', {}, formatDate(book.finishedAt)))))),
      statusPanel(book),
      book.status === 'reading' && progressPanel(book),
      book.status === 'finished' && ratingPanel(book),
      notesPanel(book),
      dangerPanel(book),
    ].filter(Boolean));
    if (focusSelector) node.querySelector(focusSelector)?.focus();
  }

  function statusPanel(book) {
    return el('section', { class: 'panel', 'aria-labelledby': 'status-title' },
      el('h2', { id: 'status-title' }, 'Status'),
      el('div', { class: 'segmented', role: 'radiogroup', 'aria-labelledby': 'status-title' },
        Object.entries(STATUS_LABELS).map(([value, label]) => el('label', {},
          el('input', {
            type: 'radio', name: 'status', value, checked: book.status === value,
            onchange: () => {
              store.update(id, { status: value });
              toast(`Moved “${book.title}” to ${label}.`);
              paint(`input[name="status"][value="${value}"]`);
            },
          }), label))));
  }

  function progressPanel(book) {
    const error = el('p', { class: 'error', id: 'page-error', hidden: true });
    const input = el('input', { id: 'page', name: 'page', type: 'number', inputmode: 'numeric', min: '0', max: String(book.pages), step: '1', value: String(book.progress), 'aria-describedby': 'page-hint page-error', required: true });
    const form = el('form', { class: 'inline-form', novalidate: true },
      el('div', { class: 'field' },
        el('label', { for: 'page' }, 'Current page'),
        el('p', { class: 'hint', id: 'page-hint' }, `A whole number from 0 to ${book.pages}.`),
        input, error),
      el('button', { class: 'button', type: 'submit' }, 'Update progress'));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      let message = '';
      if (value === '') message = 'Enter the page you have reached.';
      else if (!/^\d+$/.test(value)) message = 'Use a whole number, without decimals or letters.';
      else if (Number(value) > book.pages) message = `This book has ${book.pages} pages. Enter ${book.pages} or less.`;
      if (message) {
        error.textContent = message;
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      const updated = store.update(id, { progress: Number(value) });
      if (updated.status === 'finished') {
        toast(`You finished “${book.title}”. Well done!`);
        paint('input[name="rating"]');
      } else {
        toast(`Progress saved: page ${updated.progress} (${percent(updated)}%).`);
        paint('#page');
      }
    });

    return el('section', { class: 'panel', 'aria-labelledby': 'progress-title' },
      el('h2', { id: 'progress-title' }, 'Progress'),
      progressBar(book),
      el('p', { class: 'small' }, `Page ${book.progress} of ${book.pages} · ${percent(book)}%`),
      form);
  }

  function ratingPanel(book) {
    return el('section', { class: 'panel', 'aria-labelledby': 'rating-title' },
      el('h2', { id: 'rating-title' }, 'Your rating'),
      el('div', { class: 'stars', role: 'radiogroup', 'aria-labelledby': 'rating-title' },
        [1, 2, 3, 4, 5].map((n) => el('label', { title: `${n} out of 5` },
          el('input', {
            type: 'radio', name: 'rating', value: String(n), checked: book.rating === n,
            onchange: () => {
              store.update(id, { rating: n });
              toast(`Rated “${book.title}” ${n} out of 5.`);
              paint(`input[name="rating"][value="${n}"]`);
            },
          }),
          el('span', { 'aria-hidden': 'true', class: n <= (book.rating || 0) ? 'star on' : 'star' }, '★'),
          el('span', { class: 'visually-hidden' }, `${n} star${n === 1 ? '' : 's'}`)))),
      el('p', { class: 'small muted' }, book.rating ? `${book.rating} out of 5` : 'Not rated yet'));
  }

  function notesPanel(book) {
    const area = el('textarea', { id: 'notes', rows: '4', maxlength: '1000' }, book.notes);
    const form = el('form', { class: 'stack' },
      el('label', { for: 'notes' }, 'Notes'),
      area,
      el('button', { class: 'button button-ghost', type: 'submit' }, 'Save notes'));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      store.update(id, { notes: area.value });
      toast('Notes saved.');
    });
    return el('section', { class: 'panel', 'aria-labelledby': 'notes-title' }, el('h2', { id: 'notes-title', class: 'visually-hidden' }, 'Notes'), form);
  }

  function dangerPanel(book) {
    return el('section', { class: 'panel panel-danger', 'aria-labelledby': 'danger-title' },
      el('h2', { id: 'danger-title' }, 'Remove from shelf'),
      el('button', {
        class: 'button button-danger', type: 'button',
        onclick: async () => {
          const ok = await confirmDialog({ title: `Delete “${book.title}”?`, message: 'Its progress, rating and notes will be removed. This cannot be undone.', confirmLabel: 'Delete book' });
          if (!ok) return;
          store.remove(id);
          toast(`Deleted “${book.title}”.`);
          navigate('/library');
        },
      }, 'Delete this book'));
  }

  paint();
  return { title: store.find(id).title, node };
}
