import { TAB_NAMES, TAB_ORDER } from '../constants.js';
import { getState, persistState } from '../state.js';

export function switchTab(tabKey, { updateHash = true } = {}) {
  const state = getState();
  const safeKey = TAB_NAMES[tabKey] ? tabKey : 'capability';
  state.activeTab = safeKey;

  const labelEl = document.getElementById('header-active-label');
  if (labelEl) labelEl.textContent = TAB_NAMES[safeKey];

  document.title = `LeanSigma — ${TAB_NAMES[safeKey]}`;

  document.querySelectorAll('.rail-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === safeKey);
  });
  document.querySelectorAll('.module-section').forEach((sec) => {
    sec.classList.toggle('hidden', sec.id !== `module-${safeKey}`);
  });

  if (updateHash && typeof window !== 'undefined') {
    const targetHash = `#${safeKey}`;
    if (window.location.hash !== targetHash) {
      try {
        history.replaceState(null, '', targetHash);
      } catch {
        window.location.hash = targetHash;
      }
    }
  }

  persistState();
}

export function resolveInitialTab() {
  if (typeof window !== 'undefined' && window.location.hash) {
    const candidate = window.location.hash.replace(/^#/, '').toLowerCase();
    if (TAB_NAMES[candidate]) return candidate;
  }
  return getState().activeTab || 'capability';
}

export function bindNavigationEvents({ onOpenImport, onCloseImport, isImportOpen }) {
  document.querySelectorAll('.rail-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  window.addEventListener('hashchange', () => {
    const candidate = window.location.hash.replace(/^#/, '').toLowerCase();
    if (TAB_NAMES[candidate]) {
      switchTab(candidate, { updateHash: false });
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isImportOpen && isImportOpen()) {
      e.preventDefault();
      if (onCloseImport) onCloseImport();
      return;
    }

    const tgt = e.target;
    const isEditing =
      tgt &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(tgt.tagName) || tgt.isContentEditable);
    if (isEditing || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key >= '1' && e.key <= '8') {
      const idx = parseInt(e.key, 10) - 1;
      if (TAB_ORDER[idx]) {
        e.preventDefault();
        switchTab(TAB_ORDER[idx]);
      }
      return;
    }

    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      if (onOpenImport) onOpenImport();
    }
  });
}
