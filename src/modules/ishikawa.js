import { PALETTE } from '../constants.js';
import { getState, nextId, persistState, setModuleSource } from '../state.js';
import { renderAllSourceBadges } from '../ui/sourceBadge.js';
import { escapeHtml, truncateText } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { switchTab } from '../ui/navigation.js';

export const ISH_RIB_CFG = [
  { key: 'Man', side: 'top', spineX: 250, headX: 165, color: PALETTE.emerald },
  { key: 'Machine', side: 'top', spineX: 500, headX: 415, color: PALETTE.teal },
  { key: 'Method', side: 'top', spineX: 745, headX: 660, color: PALETTE.copper },
  { key: 'Material', side: 'bot', spineX: 250, headX: 165, color: PALETTE.indigo },
  { key: 'Measurement', side: 'bot', spineX: 500, headX: 415, color: PALETTE.rose },
  { key: 'Environment', side: 'bot', spineX: 745, headX: 660, color: PALETTE.olive },
];

export function renderIshikawaDiagram() {
  const state = getState();
  const probInput = document.getElementById('ish-in-problem');
  if (probInput && document.activeElement !== probInput) {
    probInput.value = state.ishikawa.problem;
  }

  const svg = document.getElementById('svg-ishikawa');
  if (!svg) return;
  const spineY = 240;
  const spineStart = 44;
  const headBoxX = 812;
  const headBoxW = 166;

  let html = `<rect x="0" y="0" width="1000" height="480" fill="${PALETTE.canvas}" />`;
  html += `<polygon points="18,214 44,240 18,266 28,240" fill="${PALETTE.indigo}" stroke="${PALETTE.teal}" stroke-width="1.5" />`;
  html += `<line x1="${spineStart}" y1="${spineY}" x2="${headBoxX}" y2="${spineY}" stroke="${PALETTE.icemint}" stroke-width="4" />`;
  html += `<polygon points="${headBoxX},${spineY} ${headBoxX - 12},${spineY - 8} ${headBoxX - 12},${spineY + 8}" fill="${PALETTE.icemint}" />`;

  html += `<rect x="${headBoxX}" y="${spineY - 46}" width="${headBoxW}" height="92" rx="6" fill="${PALETTE.card}" stroke="${PALETTE.crimson}" stroke-width="3" />`;
  html += `<rect x="${headBoxX}" y="${spineY - 46}" width="${headBoxW}" height="24" rx="4" fill="${PALETTE.crimson}" />`;
  html += `<text x="${headBoxX + headBoxW / 2}" y="${spineY - 30}" text-anchor="middle" fill="#FFFFFF" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">PROBLEM</text>`;

  const words = (state.ishikawa.problem || 'Effect').split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach((w) => {
    if ((cur + ' ' + w).trim().length > 18 && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  });
  if (cur) lines.push(cur);
  lines.slice(0, 3).forEach((ln, lIdx) => {
    html += `<text x="${headBoxX + headBoxW / 2}" y="${spineY - 4 + lIdx * 17}" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700">${escapeHtml(truncateText(ln, 20))}</text>`;
  });

  ISH_RIB_CFG.forEach((rib) => {
    const isTop = rib.side === 'top';
    const tipY = isTop ? 58 : 422;
    const causes = state.ishikawa.ribs[rib.key] || [];

    html += `<line x1="${rib.headX}" y1="${tipY}" x2="${rib.spineX}" y2="${spineY}" stroke="${rib.color}" stroke-width="3" />`;

    const pillY = isTop ? 24 : 434;
    html += `<rect x="${rib.headX - 64}" y="${pillY}" width="128" height="28" rx="4" fill="${PALETTE.card}" stroke="${rib.color}" stroke-width="2" />`;
    html += `<text x="${rib.headX}" y="${pillY + 18}" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700">${rib.key.toUpperCase()}</text>`;

    const visibleCauses = causes.slice(0, 6);
    const count = visibleCauses.length;
    visibleCauses.forEach((c, idx) => {
      const frac = (idx + 1) / (count + 1);
      const anchorX = rib.headX + (rib.spineX - rib.headX) * frac;
      const anchorY = tipY + (spineY - tipY) * frac;
      const boneLen = 46;
      const endX = anchorX - boneLen;

      const strokeCol = c.root ? PALETTE.magenta : PALETTE.icemint;
      const textCol = c.root ? PALETTE.rose : PALETTE.icemint;

      html += `<line x1="${endX.toFixed(1)}" y1="${anchorY.toFixed(1)}" x2="${anchorX.toFixed(1)}" y2="${anchorY.toFixed(1)}" stroke="${strokeCol}" stroke-width="${c.root ? 2.4 : 1.5}" />`;
      html += `<circle cx="${anchorX.toFixed(1)}" cy="${anchorY.toFixed(1)}" r="${c.root ? 4 : 2.8}" fill="${c.root ? PALETTE.crimson : rib.color}" />`;

      const displayTxt = truncateText(c.text, 22);
      if (c.root) {
        const tw = Math.min(160, Math.max(76, displayTxt.length * 6.5 + 14));
        html += `<rect x="${(endX - tw - 4).toFixed(1)}" y="${(anchorY - 11).toFixed(1)}" width="${tw.toFixed(1)}" height="20" rx="3" fill="${PALETTE.crimson}" stroke="${PALETTE.magenta}" stroke-width="1.3" />`;
        html += `<text x="${(endX - 10).toFixed(1)}" y="${(anchorY + 3).toFixed(1)}" text-anchor="end" fill="#FFFFFF" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="700">${escapeHtml(displayTxt)}</text>`;
      } else {
        html += `<text x="${(endX - 6).toFixed(1)}" y="${(anchorY + 3.5).toFixed(1)}" text-anchor="end" fill="${textCol}" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="600">${escapeHtml(displayTxt)}</text>`;
      }
    });
  });

  svg.innerHTML = html;
}

export function renderIshikawaLists() {
  const state = getState();
  const grid = document.getElementById('ish-ribs-grid');
  if (!grid) return;

  grid.innerHTML = ISH_RIB_CFG.map((rib) => {
    const list = state.ishikawa.ribs[rib.key] || [];
    return `
      <div class="ind-well p-3 space-y-2" style="border-top: 4px solid ${rib.color}">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase text-rose-dusty">${rib.key}</span>
          <span class="font-mono text-xs text-teal-slate">${list.length}</span>
        </div>
        <div class="space-y-1.5">
          ${
            list.length === 0
              ? '<div class="text-xs font-mono text-teal-slate py-1">No causes listed</div>'
              : list
                  .map(
                    (c, idx) => `
                      <div class="flex items-center justify-between gap-2 p-2 rounded-xs bg-navy-card border ${c.root ? 'border-magenta' : 'border-navy-border'}">
                        <span class="text-xs ${c.root ? 'text-rose-dusty font-bold' : 'text-icemint'} truncate" title="${escapeHtml(c.text)}">${escapeHtml(c.text)}</span>
                        <div class="flex items-center gap-1 shrink-0">
                          <button type="button" data-rib="${rib.key}" data-idx="${idx}" class="ish-toggle-root px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs border cursor-pointer ${c.root ? 'bg-crimson border-magenta text-white' : 'bg-navy-canvas border-navy-border text-icemint'}">Root</button>
                          <button type="button" data-rib="${rib.key}" data-idx="${idx}" class="ish-del-cause px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs bg-navy-canvas border border-crimson text-crimson cursor-pointer">X</button>
                        </div>
                      </div>
                    `
                  )
                  .join('')
          }
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.ish-toggle-root').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const r = e.target.dataset.rib;
      const i = parseInt(e.target.dataset.idx, 10);
      state.ishikawa.ribs[r][i].root = !state.ishikawa.ribs[r][i].root;
      renderIshikawa();
      persistState();
    });
  });

  grid.querySelectorAll('.ish-del-cause').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const r = e.target.dataset.rib;
      const i = parseInt(e.target.dataset.idx, 10);
      state.ishikawa.ribs[r].splice(i, 1);
      renderIshikawa();
      persistState();
    });
  });
}

export function renderIshikawa() {
  renderIshikawaDiagram();
  renderIshikawaLists();
}

export function seedIshikawaFromCrossLink({ problem, rib = 'Machine', cause = '' }) {
  const state = getState();
  if (problem) state.ishikawa.problem = problem;
  if (cause && state.ishikawa.ribs[rib]) {
    const arr = state.ishikawa.ribs[rib];
    const exists = arr.some((c) => c.text.trim().toLowerCase() === cause.trim().toLowerCase());
    if (!exists) {
      arr.unshift({ id: nextId(arr), text: cause, root: true });
    }
  }
  setModuleSource('ishikawa', 'link', `Cross-linked (${rib})`);
  renderIshikawa();
  renderAllSourceBadges();
  persistState();
  switchTab('ishikawa');
  showToast(`Sent to Ishikawa: ${truncateText(problem || cause, 34)}`);
}

export function bindIshikawaEvents() {
  document.getElementById('ish-in-problem')?.addEventListener('input', (e) => {
    getState().ishikawa.problem = e.target.value;
    renderIshikawaDiagram();
    persistState();
  });

  document.getElementById('btn-ish-add')?.addEventListener('click', () => {
    const state = getState();
    const rib = document.getElementById('ish-sel-rib').value;
    const inp = document.getElementById('ish-in-cause');
    const txt = inp.value.trim();
    if (!txt) {
      showToast('Enter cause text', true);
      return;
    }
    const arr = state.ishikawa.ribs[rib];
    arr.push({ id: nextId(arr), text: txt, root: false });
    inp.value = '';
    renderIshikawa();
    persistState();
  });
}
