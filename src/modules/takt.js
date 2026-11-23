import { PALETTE } from '../constants.js';
import { getState, nextId, persistState } from '../state.js';
import { escapeHtml, truncateText } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { computeTaktMetrics } from './taktMath.js';
import { seedIshikawaFromCrossLink } from './ishikawa.js';

export function renderTaktChartOnly() {
  const state = getState();
  const m = computeTaktMetrics(state.takt);
  const stations = state.takt.stations;

  const inA = document.getElementById('takt-in-avail');
  const inD = document.getElementById('takt-in-demand');
  if (inA && document.activeElement !== inA) inA.value = state.takt.available;
  if (inD && document.activeElement !== inD) inD.value = state.takt.demand;

  document.getElementById('takt-val-takt').textContent = `${m.takt.toFixed(1)}s`;
  document.getElementById('takt-val-bottle').textContent = `${m.bottleneck.total.toFixed(1)}s`;
  document.getElementById('takt-val-bottle').style.color = m.bottleneck.total > m.takt ? PALETTE.crimson : PALETTE.emerald;
  document.getElementById('takt-sub-bottle').textContent = m.bottleneck.name;
  document.getElementById('takt-val-eff').textContent = `${m.eff.toFixed(1)}%`;
  document.getElementById('takt-val-head').textContent = m.headcount.toFixed(2);

  const svg = document.getElementById('svg-takt');
  if (!svg) return;
  const left = 72;
  const right = 920;
  const top = 50;
  const bottom = 328;
  const plotH = bottom - top;

  const maxVal = Math.max(m.takt * 1.22, m.bottleneck.total * 1.18, 20);
  const yAt = (v) => bottom - (v / maxVal) * plotH;

  let html = `<rect x="0" y="0" width="960" height="390" fill="${PALETTE.canvas}" />`;

  for (let i = 0; i <= 5; i++) {
    const val = (maxVal * i) / 5;
    const y = yAt(val);
    html += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${PALETTE.border}" stroke-width="1" />`;
    html += `<text x="${left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11">${val.toFixed(0)}s</text>`;
  }

  html += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${PALETTE.icemint}" stroke-width="2" />`;

  if (stations.length > 0) {
    const slotW = (right - left) / stations.length;
    const barW = Math.min(86, slotW * 0.56);

    stations.forEach((st, idx) => {
      const cx = left + slotW * idx + slotW / 2;
      const bx = cx - barW / 2;
      const va = Math.max(0, st.va || 0);
      const bnva = Math.max(0, st.bnva || 0);
      const waste = Math.max(0, st.waste || 0);
      const tot = va + bnva + waste;
      const over = tot > m.takt;

      const yVaTop = yAt(va);
      const yBnvaTop = yAt(va + bnva);
      const yWasteTop = yAt(tot);

      if (va > 0) {
        html += `<rect x="${bx.toFixed(1)}" y="${yVaTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${(bottom - yVaTop).toFixed(1)}" fill="${PALETTE.emerald}" stroke="${PALETTE.canvas}" stroke-width="1.5" />`;
      }
      if (bnva > 0) {
        html += `<rect x="${bx.toFixed(1)}" y="${yBnvaTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${(yVaTop - yBnvaTop).toFixed(1)}" fill="${PALETTE.teal}" stroke="${PALETTE.canvas}" stroke-width="1.5" />`;
      }
      if (waste > 0) {
        html += `<rect x="${bx.toFixed(1)}" y="${yWasteTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${(yBnvaTop - yWasteTop).toFixed(1)}" fill="${PALETTE.crimson}" stroke="${PALETTE.canvas}" stroke-width="1.5" />`;
      }

      if (over) {
        html += `<rect x="${(bx - 3).toFixed(1)}" y="${(yWasteTop - 3).toFixed(1)}" width="${(barW + 6).toFixed(1)}" height="${(bottom - yWasteTop + 3).toFixed(1)}" fill="none" stroke="${PALETTE.crimson}" stroke-width="2.2" rx="3" />`;
        html += `<rect x="${(cx - 26).toFixed(1)}" y="${(yWasteTop - 36).toFixed(1)}" width="52" height="17" rx="3" fill="${PALETTE.crimson}" />`;
        html += `<text x="${cx.toFixed(1)}" y="${(yWasteTop - 24).toFixed(1)}" text-anchor="middle" fill="#FFFFFF" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10" font-weight="700">OVER</text>`;
      }

      html += `<text x="${cx.toFixed(1)}" y="${(yWasteTop - 7).toFixed(1)}" text-anchor="middle" fill="${over ? PALETTE.rose : PALETTE.emerald}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" font-weight="700">${tot.toFixed(0)}s</text>`;
      html += `<text x="${cx.toFixed(1)}" y="${bottom + 22}" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700">${escapeHtml(truncateText(st.name, 13))}</text>`;
      html += `<text x="${cx.toFixed(1)}" y="${bottom + 38}" text-anchor="middle" fill="${PALETTE.teal}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10">VA ${va}s</text>`;
    });
  }

  const yTakt = yAt(m.takt);
  html += `<line x1="${left}" y1="${yTakt.toFixed(1)}" x2="${right}" y2="${yTakt.toFixed(1)}" stroke="${PALETTE.magenta}" stroke-width="2.8" stroke-dasharray="8 5" />`;
  html += `<rect x="${(right - 122).toFixed(1)}" y="${(yTakt - 25).toFixed(1)}" width="122" height="21" rx="4" fill="${PALETTE.panel}" stroke="${PALETTE.magenta}" stroke-width="1.5" />`;
  html += `<text x="${(right - 61).toFixed(1)}" y="${(yTakt - 11).toFixed(1)}" text-anchor="middle" fill="${PALETTE.rose}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">TAKT ${m.takt.toFixed(1)}s</text>`;

  svg.innerHTML = html;
}

export function renderTaktTable() {
  const state = getState();
  const m = computeTaktMetrics(state.takt);
  const tbody = document.getElementById('takt-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.takt.stations
    .map((st, idx) => {
      const tot = (st.va || 0) + (st.bnva || 0) + (st.waste || 0);
      const over = tot > m.takt;
      return `
        <tr class="hover:bg-navy-panel">
          <td class="py-2 pr-3"><input type="text" data-idx="${idx}" data-field="name" value="${escapeHtml(st.name)}" class="ind-input ind-input-text w-36 takt-edit" /></td>
          <td class="py-2 px-2"><input type="number" min="0" max="600" data-idx="${idx}" data-field="va" value="${st.va}" class="ind-input w-20 text-right takt-edit" /></td>
          <td class="py-2 px-2"><input type="number" min="0" max="600" data-idx="${idx}" data-field="bnva" value="${st.bnva}" class="ind-input w-20 text-right takt-edit" /></td>
          <td class="py-2 px-2"><input type="number" min="0" max="600" data-idx="${idx}" data-field="waste" value="${st.waste}" class="ind-input w-20 text-right takt-edit" /></td>
          <td class="py-2 px-2 font-mono font-bold" id="takt-row-tot-${idx}">${tot.toFixed(0)}s</td>
          <td class="py-2 px-2"><span id="takt-row-st-${idx}" class="px-2 py-0.5 text-xs font-mono font-bold rounded-xs border ${over ? 'border-crimson text-crimson bg-navy-canvas' : 'border-emerald-mint text-emerald-mint bg-navy-canvas'}">${over ? 'Over' : 'Balanced'}</span></td>
          <td class="py-2 pl-2 text-right"><button type="button" data-idx="${idx}" class="ind-btn ind-btn-danger py-1 px-2.5 text-xs takt-del">Delete</button></td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('.takt-edit').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      const f = e.target.dataset.field;
      if (f === 'name') {
        state.takt.stations[i].name = e.target.value;
      } else {
        state.takt.stations[i][f] = Math.max(0, parseFloat(e.target.value) || 0);
      }
      const st = state.takt.stations[i];
      const tot = (st.va || 0) + (st.bnva || 0) + (st.waste || 0);
      const curTakt = computeTaktMetrics(state.takt).takt;
      const totCell = document.getElementById(`takt-row-tot-${i}`);
      const stCell = document.getElementById(`takt-row-st-${i}`);
      if (totCell) totCell.textContent = `${tot.toFixed(0)}s`;
      if (stCell) {
        const over = tot > curTakt;
        stCell.textContent = over ? 'Over' : 'Balanced';
        stCell.className = `px-2 py-0.5 text-xs font-mono font-bold rounded-xs border ${over ? 'border-crimson text-crimson bg-navy-canvas' : 'border-emerald-mint text-emerald-mint bg-navy-canvas'}`;
      }
      renderTaktChartOnly();
      persistState();
    });
  });

  tbody.querySelectorAll('.takt-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (state.takt.stations.length <= 1) {
        showToast('At least one station required', true);
        return;
      }
      const i = parseInt(e.target.dataset.idx, 10);
      state.takt.stations.splice(i, 1);
      renderTakt();
      persistState();
    });
  });
}

export function renderTakt() {
  renderTaktChartOnly();
  renderTaktTable();
}

export function bindTaktEvents({ onOpenImport }) {
  document.getElementById('takt-in-avail')?.addEventListener('input', (e) => {
    getState().takt.available = Math.max(60, parseFloat(e.target.value) || 60);
    renderTakt();
    persistState();
  });
  document.getElementById('takt-in-demand')?.addEventListener('input', (e) => {
    getState().takt.demand = Math.max(1, parseFloat(e.target.value) || 1);
    renderTakt();
    persistState();
  });
  document.getElementById('btn-takt-add')?.addEventListener('click', () => {
    const state = getState();
    const n = state.takt.stations.length + 1;
    state.takt.stations.push({ id: nextId(state.takt.stations), name: `Station ${n}`, va: 30, bnva: 8, waste: 5 });
    renderTakt();
    persistState();
  });
  document.getElementById('btn-takt-import')?.addEventListener('click', () => {
    if (onOpenImport) onOpenImport('takt');
  });
  document.getElementById('btn-takt-to-ishikawa')?.addEventListener('click', () => {
    const m = computeTaktMetrics(getState().takt);
    seedIshikawaFromCrossLink({
      problem: `${m.bottleneck.name} Exceeds Takt (${m.bottleneck.total.toFixed(0)}s vs ${m.takt.toFixed(0)}s)`,
      rib: 'Method',
      cause: `Bottleneck station: ${m.bottleneck.name} (${m.bottleneck.total.toFixed(0)}s)`,
    });
  });
}
