// Route "/add": form to add a book. On success the app navigates to the new book's page.
import { el, STATUS_LABELS } from '../dom.js';
import { toast } from '../ui.js';

const GENRES = ['Fiction', 'Classic', 'Short stories', 'Biography', 'History', 'Psychology', 'Self-help', 'Technology', 'Other'];

export function addView({ store, navigate }) {
  const field = (id, label, control, hint) => el('div', { class: 'field' },
    el('label', { for: id }, label),
    hint && el('p', { class: 'hint', id: `${id}-hint` }, hint),
    control,
    el('p', { class: 'error', id: `${id}-error`, hidden: true }));

  const title = el('input', { id: 'title', name: 'title', autocomplete: 'off', required: true, maxlength: '200', 'aria-describedby': 'title-error' });
  const author = el('input', { id: 'author', name: 'author', autocomplete: 'off', required: true, maxlength: '200', 'aria-describedby': 'author-error' });
  const pages = el('input', { id: 'pages', name: 'pages', type: 'number', inputmode: 'numeric', min: '1', max: '5000', step: '1', required: true, 'aria-describedby': 'pages-hint pages-error' });
  const genre = el('select', { id: 'genre', name: 'genre', 'aria-describedby': 'genre-error' }, GENRES.map((g) => el('option', {}, g)));

  const form = el('form', { class: 'form-card', novalidate: true },
    field('title', 'Title', title),
    field('author', 'Author', author),
    el('div', { class: 'field-row' },
      field('pages', 'Number of pages', pages, 'Between 1 and 5000.'),
      field('genre', 'Genre', genre)),
    el('fieldset', { class: 'field' },
      el('legend', {}, 'Status'),
      el('div', { class: 'segmented' }, Object.entries(STATUS_LABELS).map(([value, label]) => el('label', {},
        el('input', { type: 'radio', name: 'status', value, checked: value === 'want' }), label)))),
    el('div', { class: 'form-actions' },
      el('button', { class: 'button', type: 'submit' }, 'Add to shelf'),
      el('a', { class: 'button button-ghost', href: '#/library' }, 'Cancel')));

  function validate() {
    const errors = {};
    const t = title.value.trim();
    const a = author.value.trim();
    if (!t) errors.title = 'Enter the book’s title.';
    if (!a) errors.author = 'Enter the author’s name.';
    if (!pages.value.trim()) errors.pages = 'Enter the number of pages.';
    else if (!/^\d+$/.test(pages.value.trim()) || Number(pages.value) < 1 || Number(pages.value) > 5000) errors.pages = 'Enter a whole number between 1 and 5000.';
    const duplicate = t && a && store.state.books.find((b) => b.title.toLowerCase() === t.toLowerCase() && b.author.toLowerCase() === a.toLowerCase());
    if (duplicate) errors.title = `“${duplicate.title}” by ${duplicate.author} is already on your shelf.`;

    for (const input of [title, author, pages]) {
      const message = errors[input.id] || '';
      const box = form.querySelector(`#${input.id}-error`);
      box.textContent = message;
      box.hidden = !message;
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    return errors;
  }

  form.addEventListener('input', (event) => {
    if (event.target.hasAttribute('aria-invalid')) validate(); // clear an error as soon as it is fixed
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const errors = validate();
    const first = ['title', 'author', 'pages'].find((key) => errors[key]);
    if (first) {
      form.querySelector(`#${first}`).focus();
      return;
    }
    const book = store.add({ title: title.value, author: author.value, pages: Number(pages.value), genre: genre.value, status: form.elements.status.value });
    toast(`Added “${book.title}” to your shelf.`);
    navigate(`/book/${book.id}`);
  });

  const node = el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    el('header', { class: 'view-header' },
      el('h1', { id: 'view-title', tabindex: '-1' }, 'Add a book'),
      el('p', { class: 'muted' }, 'All fields are required.')),
    form);

  return { title: 'Add a book', node };
}
