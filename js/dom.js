// Small DOM helpers shared by the views. Text is always inserted as text nodes, never as HTML.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

export const STATUS_LABELS = { want: 'Want to read', reading: 'Reading', finished: 'Finished' };

export const percent = (book) => (book.pages ? Math.round((book.progress / book.pages) * 100) : 0);

export const formatDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Local date as YYYY-MM-DD (toISOString() is UTC and can report yesterday in India before 05:30).
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A coloured "cover" generated from the title, so no image files are needed.
export function cover(book, size = 'md') {
  let hash = 0;
  for (const ch of book.title) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return el('div', { class: `cover cover-${size}`, style: `--hue:${hash}`, 'aria-hidden': 'true' },
    el('span', {}, book.title));
}

export function progressBar(book, label) {
  const value = percent(book);
  return el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(value), 'aria-label': label || `${book.title} progress` },
    el('span', { style: `width:${value}%` }));
}
