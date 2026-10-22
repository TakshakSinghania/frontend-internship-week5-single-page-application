// Application state: the book list, the reading goal and the loading status.
// Views read from the store and call its actions; subscribers are told about every change.
import { today } from './dom.js';

const STORAGE_KEY = 'shelf-spa-state-v1';
const STATUSES = ['want', 'reading', 'finished'];

function sanitize(data) {
  // Saved data is untrusted: keep only well-formed books, clamp numbers, drop unknown fields.
  if (!data || !Array.isArray(data.books)) return null;
  const books = data.books
    .filter((b) => b && Number.isInteger(b.id) && typeof b.title === 'string' && typeof b.author === 'string' && STATUSES.includes(b.status))
    .map((b) => {
      const pages = Math.max(1, Math.min(5000, Number(b.pages) || 1));
      return {
        id: b.id, title: b.title.trim(), author: b.author.trim(), pages, genre: typeof b.genre === 'string' ? b.genre : 'Other',
        status: b.status, progress: Math.max(0, Math.min(pages, Number(b.progress) || 0)),
        rating: Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5 ? b.rating : null,
        addedAt: b.addedAt || today(), finishedAt: b.finishedAt || null, notes: typeof b.notes === 'string' ? b.notes : '',
      };
    });
  const goal = Number.isInteger(data.goal) && data.goal > 0 && data.goal <= 365 ? data.goal : 12;
  return { books, goal };
}

export function createStore({ dataUrl = 'data/books.json' } = {}) {
  let state = { status: 'idle', error: null, books: [], goal: 12 };
  const listeners = new Set();

  const emit = (type) => listeners.forEach((fn) => fn(type, state));
  const set = (patch, type) => {
    state = { ...state, ...patch };
    emit(type);
  };

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ books: state.books, goal: state.goal }));
    } catch {
      // storage blocked or full: changes last until the tab is closed
    }
  }

  function readSaved() {
    try {
      return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return null;
    }
  }

  async function load({ ignoreSaved = false } = {}) {
    const saved = ignoreSaved ? null : readSaved();
    if (saved) {
      set({ status: 'ready', error: null, ...saved }, 'status');
      return;
    }
    set({ status: 'loading', error: null }, 'status');
    try {
      const response = await fetch(dataUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`The server answered ${response.status} ${response.statusText}`.trim());
      const data = sanitize(await response.json());
      if (!data) throw new Error('The book data was not in the expected format.');
      set({ status: 'ready', ...data }, 'status');
      persist();
    } catch (error) {
      set({ status: 'error', error: error.message || 'Network error' }, 'status');
    }
  }

  function update(id, changes) {
    const book = state.books.find((b) => b.id === id);
    if (!book) return null;
    const next = { ...book, ...changes };
    if (changes.status && changes.status !== book.status) {
      if (changes.status === 'finished') Object.assign(next, { progress: next.pages, finishedAt: today() });
      if (changes.status === 'reading') Object.assign(next, { finishedAt: null, rating: null, progress: Math.min(next.progress, next.pages - 1) });
      if (changes.status === 'want') Object.assign(next, { progress: 0, finishedAt: null, rating: null });
    }
    if (changes.progress !== undefined && next.progress >= next.pages && next.status !== 'finished') {
      Object.assign(next, { status: 'finished', progress: next.pages, finishedAt: today() });
    }
    set({ books: state.books.map((b) => (b.id === id ? next : b)) }, 'books');
    persist();
    return next;
  }

  function add({ title, author, pages, genre, status }) {
    const id = state.books.reduce((max, b) => Math.max(max, b.id), 0) + 1;
    const book = {
      id, title: title.trim(), author: author.trim(), pages, genre, status,
      progress: status === 'finished' ? pages : 0, rating: null, addedAt: today(),
      finishedAt: status === 'finished' ? today() : null, notes: '',
    };
    set({ books: [...state.books, book] }, 'books');
    persist();
    return book;
  }

  function remove(id) {
    const book = state.books.find((b) => b.id === id);
    set({ books: state.books.filter((b) => b.id !== id) }, 'books');
    persist();
    return book;
  }

  function setGoal(goal) {
    set({ goal }, 'books');
    persist();
  }

  async function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    await load({ ignoreSaved: true });
  }

  return {
    get state() { return state; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    load, update, add, remove, setGoal, reset,
    find: (id) => state.books.find((b) => b.id === id),
  };
}
