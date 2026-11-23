import { PALETTE } from '../constants.js';

let toastTimer = null;

export function showToast(msg, isError = false) {
  const bar = document.getElementById('toast-bar');
  const dot = document.getElementById('toast-dot');
  const text = document.getElementById('toast-message');
  if (!bar || !dot || !text) return;
  text.textContent = msg;
  bar.style.borderColor = isError ? PALETTE.crimson : PALETTE.emerald;
  dot.style.backgroundColor = isError ? PALETTE.crimson : PALETTE.emerald;
  bar.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => bar.classList.add('hidden'), 3000);
}
