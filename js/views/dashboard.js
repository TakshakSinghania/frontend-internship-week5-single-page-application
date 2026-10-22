// Route "/": overview of current reading, yearly goal and recent activity.
import { el, cover, progressBar, percent, formatDate } from '../dom.js';

export function dashboardView({ store }) {
  const { books, goal } = store.state;
  const year = new Date().getFullYear();
  const reading = books.filter((b) => b.status === 'reading');
  const finishedThisYear = books.filter((b) => b.status === 'finished' && b.finishedAt?.startsWith(String(year)));
  const pagesRead = books.reduce((sum, b) => sum + b.progress, 0);
  const recent = books.filter((b) => b.finishedAt).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 3);
  const goalBook = { title: 'Yearly goal', pages: goal, progress: Math.min(finishedThisYear.length, goal) };

  const node = el('section', { class: 'view', 'aria-labelledby': 'view-title' },
    el('header', { class: 'view-header' },
      el('h1', { id: 'view-title', tabindex: '-1' }, 'Your reading'),
      el('p', { class: 'muted' }, `${books.length} books on your shelf`)),

    el('ul', { class: 'stat-grid', 'aria-label': 'Summary' },
      el('li', { class: 'stat' }, el('span', { class: 'stat-value' }, String(reading.length)), el('span', {}, 'Reading now')),
      el('li', { class: 'stat' }, el('span', { class: 'stat-value' }, `${finishedThisYear.length}/${goal}`), el('span', {}, `Finished in ${year}`),
        progressBar(goalBook, `Reading goal: ${finishedThisYear.length} of ${goal} books`)),
      el('li', { class: 'stat' }, el('span', { class: 'stat-value' }, pagesRead.toLocaleString('en-IN')), el('span', {}, 'Pages read')),
      el('li', { class: 'stat' }, el('span', { class: 'stat-value' }, String(books.filter((b) => b.status === 'want').length)), el('span', {}, 'Want to read'))),

    el('section', { class: 'panel', 'aria-labelledby': 'reading-title' },
      el('div', { class: 'panel-head' },
        el('h2', { id: 'reading-title' }, 'Currently reading'),
        el('a', { href: '#/library?status=reading' }, 'See all')),
      reading.length
        ? el('ul', { class: 'reading-list' }, reading.map((b) => el('li', { class: 'reading-item' },
          cover(b, 'sm'),
          el('div', { class: 'reading-info' },
            el('h3', {}, el('a', { href: `#/book/${b.id}` }, b.title)),
            el('p', { class: 'muted' }, b.author),
            progressBar(b),
            el('p', { class: 'small' }, `Page ${b.progress} of ${b.pages} · ${percent(b)}%`)))))
        : el('div', { class: 'empty' },
          el('p', {}, 'You are not reading anything right now.'),
          el('a', { class: 'button', href: '#/library?status=want' }, 'Pick something from your want-to-read list'))),

    el('section', { class: 'panel', 'aria-labelledby': 'recent-title' },
      el('h2', { id: 'recent-title' }, 'Recently finished'),
      recent.length
        ? el('ul', { class: 'recent-list' }, recent.map((b) => el('li', {},
          el('a', { href: `#/book/${b.id}` }, b.title), ` by ${b.author}`,
          el('span', { class: 'muted small' }, ` · ${formatDate(b.finishedAt)}`))))
        : el('p', { class: 'muted' }, 'Books you finish will appear here.')));

  return { title: 'Dashboard', node };
}
