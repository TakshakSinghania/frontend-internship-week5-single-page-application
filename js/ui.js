// Shared UI pieces: toast messages and an accessible confirmation dialog (native <dialog>).
import { el } from './dom.js';

export function toast(message) {
  const region = document.getElementById('toasts');
  const node = el('p', { class: 'toast' }, message);
  region.append(node);
  setTimeout(() => node.remove(), 4000);
}

// Resolves true when the user confirms. Esc, the Cancel button or a click on the backdrop resolve false.
export function confirmDialog({ title, message, confirmLabel }) {
  const dialog = document.getElementById('confirm-dialog');
  const returnFocus = document.activeElement;
  dialog.querySelector('[data-dialog-title]').textContent = title;
  dialog.querySelector('[data-dialog-message]').textContent = message;
  dialog.querySelector('[data-dialog-confirm]').textContent = confirmLabel;
  dialog.returnValue = '';
  dialog.showModal();
  dialog.querySelector('[data-dialog-cancel]').focus(); // safer default for a destructive action

  return new Promise((resolve) => {
    const onClick = (event) => { if (event.target === dialog) dialog.close('cancel'); };
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('close', () => {
      dialog.removeEventListener('click', onClick);
      if (returnFocus?.isConnected) returnFocus.focus();
      resolve(dialog.returnValue === 'confirm');
    }, { once: true });
  });
}
