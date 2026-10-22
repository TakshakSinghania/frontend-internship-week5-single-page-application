// Route "/stats": reading goal (editable) and breakdowns computed from the current state.
import { el, progressBar, STATUS_LABELS } from '../dom.js';
import { toast } from '../ui.js';

export function statsView({ store }) {
  const node = el('section', { class: 'view', 'aria-labelledby': 'view-title' });
  const year = new Date().getFullYear();

  function paint(focusSelector) {
    const { books, goal } = store.state;
    const finished = books.filter((b) => b.status === 'finished');
    const thisYear = finished.filter((b) => b.finishedAt?.startsWith(String(year)));
    const rated = finished.filter((b) => b.rating);
    const average = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : '–';
    const byGenre = Object.entries(books.reduce((acc, b) => {
      acc[b.genre] ??= { books: 0, pages: 0 };
      acc[b.genre].books += 1;
      acc[b.genre].pages += b.progress;
      return acc;
    }, {})).sort((a, b) => b[1].pages - a[1].pages);
    const maxPages = Math.max(1, ...byGenre.map(([, g]) => g.pages));

    const goalInput = el('input', { id: 'goal', type: 'number', inputmode: 'numeric', min: '1', max: '365', step: '1', value: String(goal), 'aria-describedby': 'goal-error' });
    const goalError = el('p', { class: 'error', id: 'goal-error', hidden: true });
    const goalForm = el('form', { class: 'inline-form', novalidate: true },
      el('div', { class: 'field' }, el('label', { for: 'goal' }, `Books to finish in ${year}`), goalInput, goalError),
      el('button', { class: 'button button-ghost', type: 'submit' }, 'Save goal'));
    goalForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = goalInput.value.trim();
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 365) {
        goalError.textContent = 'Enter a whole number of books between 1 and 365.';
        goalError.hidden = false;
        goalInput.setAttribute('aria-invalid', 'true');
        goalInput.focus();
        return;
      }
      store.setGoal(Number(value));
      toast(`Goal set to ${value} books.`);
      paint('#goal');
    });

    node.replaceChildren(
      el('header', { class: 'view-header' },
        el('h1', { id: 'view-title', tabindex: '-1' }, 'Reading stats'),
        el('p', { class: 'muted' }, 'Calculated from the books on your shelf.')),
      el('section', { class: 'panel', 'aria-labelledby': 'goal-title' },
        el('h2', { id: 'goal-title' }, `${year} goal`),
        el('p', { class: 'big' }, `${thisYear.length} of ${goal} books`),
        progressBar({ title: 'goal', pages: goal, progress: Math.min(thisYear.length, goal) }, `Goal progress: ${thisYear.length} of ${goal} books`),
        el('p', { class: 'small muted' }, thisYear.length >= goal ? 'Goal reached. Time to raise it?' : `${goal - thisYear.length} to go.`),
        goalForm),
      el('ul', { class: 'stat-grid', 'aria-label': 'Books by status' },
        Object.entries(STATUS_LABELS).map(([key, label]) => el('li', { class: 'stat' },
          el('span', { class: 'stat-value' }, String(books.filter((b) => b.status === key).length)), el('span', {}, label))),
        el('li', { class: 'stat' }, el('span', { class: 'stat-value' }, average), el('span', {}, 'Average rating'))),
      el('section', { class: 'panel', 'aria-labelledby': 'genre-title' },
        el('h2', { id: 'genre-title' }, 'Pages read by genre'),
        books.length
          ? el('table', { class: 'genre-table' },
            el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Genre'), el('th', { scope: 'col' }, 'Books'), el('th', { scope: 'col' }, 'Pages read'))),
            el('tbody', {}, byGenre.map(([name, g]) => el('tr', {},
              el('th', { scope: 'row' }, name),
              el('td', {}, String(g.books)),
              el('td', {}, el('span', { class: 'bar', style: `--w:${(g.pages / maxPages) * 100}%`, 'aria-hidden': 'true' }), g.pages.toLocaleString('en-IN'))))))
          : el('p', { class: 'muted' }, 'Add books to see statistics.')));
    if (focusSelector) node.querySelector(focusSelector)?.focus();
  }

  paint();
  return { title: 'Stats', node };
}
