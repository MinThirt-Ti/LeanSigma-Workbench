import { PALETTE } from '../constants.js';
import { getState, nextId, persistState } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { compute5SMetrics } from './fivesMath.js';

export function render5SRadarAndKPIs() {
  const state = getState();
  const m = compute5SMetrics(state.fives);

  document.getElementById('fives-sl-target').value = m.target.toFixed(1);
  document.getElementById('fives-lbl-target').textContent = m.target.toFixed(1);

  document.getElementById('fives-val-score').textContent = `${m.overallPct.toFixed(1)}%`;
  document.getElementById('fives-sub-score').textContent = `${m.overallMean.toFixed(2)} Mean`;
  document.getElementById('fives-val-target').textContent = m.target.toFixed(2);
  document.getElementById('fives-val-lowest').textContent = m.lowest.name;
  document.getElementById('fives-sub-lowest').textContent = `${m.lowest.avg.toFixed(2)} Mean`;
  document.getElementById('fives-val-actions').textContent = String(m.openActions);

  const svg = document.getElementById('svg-fives');
  if (!svg) return;
  const cx = 260;
  const cy = 218;
  const radius = 148;
  const n = 5;

  const pt = (axisIdx, level) => {
    const angle = -Math.PI / 2 + (axisIdx * 2 * Math.PI) / n;
    const r = (level / 5) * radius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  let html = `<rect x="0" y="0" width="520" height="420" fill="${PALETTE.canvas}" />`;

  for (let lvl = 1; lvl <= 5; lvl++) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const p = pt(i, lvl);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    html += `<polygon points="${pts.join(' ')}" fill="none" stroke="${PALETTE.border}" stroke-width="${lvl === 5 ? 2 : 1.2}" />`;
    const lblPt = pt(0, lvl);
    html += `<text x="${(lblPt.x + 8).toFixed(1)}" y="${(lblPt.y + 4).toFixed(1)}" fill="${PALETTE.teal}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10">${lvl}</text>`;
  }

  m.pillars.forEach((p, idx) => {
    const outer = pt(idx, 5);
    html += `<line x1="${cx}" y1="${cy}" x2="${outer.x.toFixed(1)}" y2="${outer.y.toFixed(1)}" stroke="${PALETTE.border}" stroke-width="1.2" />`;
    const lp = pt(idx, 5.95);
    html += `<text x="${lp.x.toFixed(1)}" y="${(lp.y + 4).toFixed(1)}" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="12.5" font-weight="700">${p.name}</text>`;
    html += `<text x="${lp.x.toFixed(1)}" y="${(lp.y + 18).toFixed(1)}" text-anchor="middle" fill="${p.avg >= m.target ? PALETTE.emerald : PALETTE.copper}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">${p.avg.toFixed(2)}</text>`;
  });

  const targetPts = m.pillars.map((_, i) => {
    const p = pt(i, m.target);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  });
  html += `<polygon points="${targetPts.join(' ')}" fill="none" stroke="${PALETTE.magenta}" stroke-width="2.5" stroke-dasharray="6 4" />`;

  const actualPts = m.pillars.map((pil, i) => {
    const p = pt(i, pil.avg);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  });
  html += `<polygon points="${actualPts.join(' ')}" fill="${PALETTE.teal}" fill-opacity="0.34" stroke="${PALETTE.emerald}" stroke-width="3" />`;

  m.pillars.forEach((pil, i) => {
    const p = pt(i, pil.avg);
    html += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${PALETTE.canvas}" stroke="${PALETTE.emerald}" stroke-width="2.5" />`;
  });

  svg.innerHTML = html;
}

export function render5SMatrix() {
  const state = getState();
  const box = document.getElementById('fives-matrix');
  if (!box) return;

  box.innerHTML = state.fives.pillars
    .map((p, pIdx) => {
      const avg = p.criteria.reduce((a, c) => a + c.score, 0) / p.criteria.length;
      return `
        <div class="ind-well p-3 space-y-2.5">
          <div class="flex items-center justify-between border-b border-navy-border pb-1.5">
            <span class="text-sm font-bold text-rose-dusty">${p.name}</span>
            <span class="font-mono text-xs font-bold ${avg >= state.fives.target ? 'text-emerald-mint' : 'text-copper'}">${avg.toFixed(2)}</span>
          </div>
          <div class="space-y-2">
            ${p.criteria
              .map((c, cIdx) => `
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-xs text-icemint">${escapeHtml(c.label)}</span>
                  <div class="flex items-center gap-1">
                    ${[1, 2, 3, 4, 5]
                      .map((s) => `<button type="button" data-p="${pIdx}" data-c="${cIdx}" data-s="${s}" class="score-btn fives-score-btn ${c.score === s ? 'selected' : ''}">${s}</button>`)
                      .join('')}
                  </div>
                </div>
              `)
              .join('')}
          </div>
        </div>
      `;
    })
    .join('');

  box.querySelectorAll('.fives-score-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const p = parseInt(e.target.dataset.p, 10);
      const c = parseInt(e.target.dataset.c, 10);
      const s = parseInt(e.target.dataset.s, 10);
      state.fives.pillars[p].criteria[c].score = s;
      render5S();
      persistState();
    });
  });
}

export function render5SActions() {
  const state = getState();
  const tbody = document.getElementById('fives-actions-body');
  if (!tbody) return;

  tbody.innerHTML = state.fives.actions
    .map((a, idx) => `
      <tr class="hover:bg-navy-panel">
        <td class="py-2 pr-2 font-mono text-xs font-bold text-rose-dusty">${escapeHtml(a.pillar)}</td>
        <td class="py-2 px-2 text-icemint">${escapeHtml(a.item)}</td>
        <td class="py-2 px-2 font-mono text-xs text-teal-slate">${escapeHtml(a.owner)}</td>
        <td class="py-2 px-2">
          <button type="button" data-idx="${idx}" class="fives-toggle-st px-2.5 py-1 text-xs font-mono font-bold rounded-xs border cursor-pointer ${a.status === 'Open' ? 'border-crimson text-crimson bg-navy-canvas' : 'border-emerald-mint text-emerald-mint bg-navy-canvas'}">${a.status}</button>
        </td>
        <td class="py-2 pl-2 text-right">
          <button type="button" data-idx="${idx}" class="ind-btn ind-btn-danger py-1 px-2 text-xs fives-del-act">Delete</button>
        </td>
      </tr>
    `)
    .join('');

  tbody.querySelectorAll('.fives-toggle-st').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      state.fives.actions[i].status = state.fives.actions[i].status === 'Open' ? 'Closed' : 'Open';
      render5SRadarAndKPIs();
      render5SActions();
      persistState();
    });
  });

  tbody.querySelectorAll('.fives-del-act').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      state.fives.actions.splice(i, 1);
      render5SRadarAndKPIs();
      render5SActions();
      persistState();
    });
  });
}

export function render5S() {
  render5SRadarAndKPIs();
  render5SMatrix();
  render5SActions();
}

export function bind5SEvents() {
  document.getElementById('fives-sl-target')?.addEventListener('input', (e) => {
    getState().fives.target = parseFloat(e.target.value);
    render5S();
    persistState();
  });

  document.getElementById('btn-fives-add-action')?.addEventListener('click', () => {
    const state = getState();
    const pillar = document.getElementById('fives-act-pillar').value;
    const descEl = document.getElementById('fives-act-desc');
    const ownEl = document.getElementById('fives-act-owner');
    const desc = descEl.value.trim();
    if (!desc) {
      showToast('Enter corrective action description', true);
      return;
    }
    state.fives.actions.unshift({
      id: nextId(state.fives.actions),
      pillar,
      item: desc,
      owner: ownEl.value.trim() || 'Unassigned',
      status: 'Open',
    });
    descEl.value = '';
    ownEl.value = '';
    render5SRadarAndKPIs();
    render5SActions();
    persistState();
  });
}
