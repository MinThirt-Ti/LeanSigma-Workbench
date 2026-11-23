import { PALETTE } from '../constants.js';
import { getState, nextId, persistState, setModuleSource } from '../state.js';
import { renderAllSourceBadges } from '../ui/sourceBadge.js';
import { escapeHtml, truncateText } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { switchTab } from '../ui/navigation.js';
import { computeVSMMetrics, identifyVSMBottleneck } from './vsmMath.js';
import { renderTakt } from './takt.js';
import { seedIshikawaFromCrossLink } from './ishikawa.js';

export function renderVSMChartOnly() {
  const state = getState();
  const m = computeVSMMetrics(state.vsm.steps);
  const steps = state.vsm.steps;

  document.getElementById('vsm-val-lead').textContent = `${m.totalLeadHrs.toFixed(2)}h`;
  document.getElementById('vsm-sub-lead').textContent = `${(m.totalLeadHrs / 24).toFixed(2)} Days`;
  document.getElementById('vsm-val-va').textContent = `${m.totalVASec.toFixed(0)}s`;
  document.getElementById('vsm-sub-va').textContent = `${(m.totalVASec / 60).toFixed(2)} Min`;
  document.getElementById('vsm-val-pce').textContent = `${m.pce.toFixed(2)}%`;
  document.getElementById('vsm-val-steps').textContent = String(m.count);
  document.getElementById('vsm-sub-ops').textContent = `${m.totalOps} Operators`;

  const svg = document.getElementById('svg-vsm');
  if (!svg) return;
  let html = `<rect x="0" y="0" width="1000" height="420" fill="${PALETTE.canvas}" />`;

  html += `<rect x="370" y="16" width="260" height="40" rx="4" fill="${PALETTE.card}" stroke="${PALETTE.magenta}" stroke-width="2" />`;
  html += `<text x="500" y="41" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="700">PRODUCTION CONTROL</text>`;

  html += `<rect x="24" y="20" width="96" height="34" rx="4" fill="${PALETTE.panel}" stroke="${PALETTE.teal}" stroke-width="1.8" />`;
  html += `<text x="72" y="41" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">SUPPLIER</text>`;

  html += `<rect x="880" y="20" width="96" height="34" rx="4" fill="${PALETTE.panel}" stroke="${PALETTE.emerald}" stroke-width="1.8" />`;
  html += `<text x="928" y="41" text-anchor="middle" fill="${PALETTE.emerald}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">CUSTOMER</text>`;

  html += `<line x1="120" y1="37" x2="370" y2="37" stroke="${PALETTE.teal}" stroke-width="1.5" stroke-dasharray="5 4" />`;
  html += `<line x1="630" y1="37" x2="880" y2="37" stroke="${PALETTE.emerald}" stroke-width="1.5" stroke-dasharray="5 4" />`;

  const n = steps.length;
  if (n > 0) {
    const marginL = 34;
    const marginR = 148;
    const usableW = 1000 - marginL - marginR;
    const segW = usableW / n;
    const boxW = Math.min(136, segW * 0.62);
    const triGap = segW - boxW;
    const boxY = 108;
    const boxH = 146;

    const ladderTopY = 308;
    const ladderBotY = 356;
    let ladderPath = '';

    steps.forEach((st, idx) => {
      const segX = marginL + idx * segW;
      const triCx = segX + triGap * 0.48;
      const bx = segX + triGap;
      const boxCx = bx + boxW / 2;

      const triY = boxY + 62;
      const triSz = Math.min(20, Math.max(12, triGap * 0.28));
      html += `<polygon points="${triCx.toFixed(1)},${(triY - triSz).toFixed(1)} ${(triCx - triSz).toFixed(1)},${(triY + triSz * 0.85).toFixed(1)} ${(triCx + triSz).toFixed(1)},${(triY + triSz * 0.85).toFixed(1)}" fill="${PALETTE.copper}" stroke="${PALETTE.rose}" stroke-width="1.5" />`;
      html += `<text x="${triCx.toFixed(1)}" y="${(triY + 6).toFixed(1)}" text-anchor="middle" fill="${PALETTE.canvas}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">I</text>`;
      html += `<text x="${triCx.toFixed(1)}" y="${(triY + triSz + 16).toFixed(1)}" text-anchor="middle" fill="${PALETTE.copper}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10.5" font-weight="700">${Number(st.queue).toFixed(1)}h</text>`;

      html += `<line x1="${(triCx + triSz + 2).toFixed(1)}" y1="${triY}" x2="${(bx - 4).toFixed(1)}" y2="${triY}" stroke="${PALETTE.icemint}" stroke-width="2" />`;
      html += `<polygon points="${bx.toFixed(1)},${triY} ${(bx - 7).toFixed(1)},${triY - 4} ${(bx - 7).toFixed(1)},${triY + 4}" fill="${PALETTE.icemint}" />`;

      html += `<line x1="${boxCx.toFixed(1)}" y1="56" x2="${boxCx.toFixed(1)}" y2="${boxY}" stroke="${PALETTE.border}" stroke-width="1.4" stroke-dasharray="4 3" />`;

      html += `<rect x="${bx.toFixed(1)}" y="${boxY}" width="${boxW.toFixed(1)}" height="${boxH}" rx="4" fill="${PALETTE.card}" stroke="${PALETTE.teal}" stroke-width="2" />`;
      html += `<rect x="${bx.toFixed(1)}" y="${boxY}" width="${boxW.toFixed(1)}" height="32" rx="3" fill="${PALETTE.indigo}" />`;
      html += `<text x="${boxCx.toFixed(1)}" y="${boxY + 21}" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="11.5" font-weight="700">${escapeHtml(truncateText(st.name, 13))}</text>`;

      const dataRows = [
        ['C/T', `${st.cycle}s`, PALETTE.emerald],
        ['C/O', `${st.changeover}m`, PALETTE.copper],
        ['Up', `${st.uptime}%`, PALETTE.icemint],
        ['Ops', `${st.operators}`, PALETTE.rose],
      ];
      dataRows.forEach(([k, v, col], rIdx) => {
        const ry = boxY + 52 + rIdx * 23;
        html += `<line x1="${(bx + 6).toFixed(1)}" y1="${ry - 14}" x2="${(bx + boxW - 6).toFixed(1)}" y2="${ry - 14}" stroke="${PALETTE.border}" stroke-width="1" />`;
        html += `<text x="${(bx + 10).toFixed(1)}" y="${ry}" fill="${PALETTE.teal}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10.5">${k}</text>`;
        html += `<text x="${(bx + boxW - 10).toFixed(1)}" y="${ry}" text-anchor="end" fill="${col}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">${v}</text>`;
      });

      const waitStartX = segX;
      const waitEndX = bx;
      const procEndX = bx + boxW;

      if (idx === 0) {
        ladderPath += `M ${waitStartX.toFixed(1)} ${ladderTopY}`;
      } else {
        ladderPath += ` L ${waitStartX.toFixed(1)} ${ladderTopY}`;
      }
      ladderPath += ` L ${waitEndX.toFixed(1)} ${ladderTopY} L ${waitEndX.toFixed(1)} ${ladderBotY} L ${procEndX.toFixed(1)} ${ladderBotY} L ${procEndX.toFixed(1)} ${ladderTopY}`;

      html += `<text x="${((waitStartX + waitEndX) / 2).toFixed(1)}" y="${ladderTopY - 8}" text-anchor="middle" fill="${PALETTE.crimson}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">${Number(st.queue).toFixed(1)}h</text>`;
      html += `<text x="${boxCx.toFixed(1)}" y="${ladderBotY + 18}" text-anchor="middle" fill="${PALETTE.emerald}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">${st.cycle}s</text>`;
    });

    html += `<path d="${ladderPath}" fill="none" stroke="${PALETTE.icemint}" stroke-width="2.5" stroke-linejoin="miter" />`;
    steps.forEach((st, idx) => {
      const segX = marginL + idx * segW;
      const bx = segX + triGap;
      html += `<line x1="${segX.toFixed(1)}" y1="${ladderTopY}" x2="${bx.toFixed(1)}" y2="${ladderTopY}" stroke="${PALETTE.crimson}" stroke-width="3.5" />`;
      html += `<line x1="${bx.toFixed(1)}" y1="${ladderBotY}" x2="${(bx + boxW).toFixed(1)}" y2="${ladderBotY}" stroke="${PALETTE.emerald}" stroke-width="3.5" />`;
    });
  }

  html += `<rect x="862" y="294" width="122" height="84" rx="4" fill="${PALETTE.card}" stroke="${PALETTE.magenta}" stroke-width="2" />`;
  html += `<text x="872" y="316" fill="${PALETTE.crimson}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">LT: ${m.totalLeadHrs.toFixed(1)}h</text>`;
  html += `<text x="872" y="338" fill="${PALETTE.emerald}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">VA: ${m.totalVASec.toFixed(0)}s</text>`;
  html += `<text x="872" y="362" fill="${PALETTE.magenta}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">PCE: ${m.pce.toFixed(2)}%</text>`;

  svg.innerHTML = html;
}

export function renderVSMTable() {
  const state = getState();
  const tbody = document.getElementById('vsm-table-body');
  if (!tbody) return;

  tbody.innerHTML = state.vsm.steps
    .map((st, idx) => `
      <tr class="hover:bg-navy-panel">
        <td class="py-2 pr-2"><input type="text" data-idx="${idx}" data-field="name" value="${escapeHtml(st.name)}" class="ind-input ind-input-text w-32 vsm-edit" /></td>
        <td class="py-2 px-2"><input type="number" min="1" max="9999" data-idx="${idx}" data-field="cycle" value="${st.cycle}" class="ind-input w-20 text-right vsm-edit" /></td>
        <td class="py-2 px-2"><input type="number" min="0" max="999" data-idx="${idx}" data-field="changeover" value="${st.changeover}" class="ind-input w-20 text-right vsm-edit" /></td>
        <td class="py-2 px-2"><input type="number" min="1" max="100" data-idx="${idx}" data-field="uptime" value="${st.uptime}" class="ind-input w-20 text-right vsm-edit" /></td>
        <td class="py-2 px-2"><input type="number" min="1" max="50" data-idx="${idx}" data-field="operators" value="${st.operators}" class="ind-input w-16 text-right vsm-edit" /></td>
        <td class="py-2 px-2"><input type="number" min="0" max="500" step="0.5" data-idx="${idx}" data-field="queue" value="${st.queue}" class="ind-input w-20 text-right vsm-edit" /></td>
        <td class="py-2 pl-2 text-right whitespace-nowrap space-x-1">
          <button type="button" data-idx="${idx}" data-dir="-1" class="ind-btn py-1 px-2 text-xs vsm-move" title="Move Left">&lt;</button>
          <button type="button" data-idx="${idx}" data-dir="1" class="ind-btn py-1 px-2 text-xs vsm-move" title="Move Right">&gt;</button>
          <button type="button" data-idx="${idx}" class="ind-btn ind-btn-danger py-1 px-2 text-xs vsm-del">Delete</button>
        </td>
      </tr>
    `)
    .join('');

  tbody.querySelectorAll('.vsm-edit').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      const f = e.target.dataset.field;
      if (f === 'name') {
        state.vsm.steps[i].name = e.target.value;
      } else {
        state.vsm.steps[i][f] = Math.max(0, parseFloat(e.target.value) || 0);
      }
      renderVSMChartOnly();
      persistState();
    });
  });

  tbody.querySelectorAll('.vsm-move').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      const d = parseInt(e.target.dataset.dir, 10);
      const target = i + d;
      if (target < 0 || target >= state.vsm.steps.length) return;
      const tmp = state.vsm.steps[i];
      state.vsm.steps[i] = state.vsm.steps[target];
      state.vsm.steps[target] = tmp;
      renderVSM();
      persistState();
    });
  });

  tbody.querySelectorAll('.vsm-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (state.vsm.steps.length <= 1) {
        showToast('At least one process step required', true);
        return;
      }
      const i = parseInt(e.target.dataset.idx, 10);
      state.vsm.steps.splice(i, 1);
      renderVSM();
      persistState();
    });
  });
}

export function renderVSM() {
  renderVSMChartOnly();
  renderVSMTable();
}

export function bindVSMEvents({ onOpenImport }) {
  document.getElementById('btn-vsm-add')?.addEventListener('click', () => {
    const state = getState();
    if (state.vsm.steps.length >= 7) {
      showToast('Maximum 7 steps supported on map', true);
      return;
    }
    const n = state.vsm.steps.length + 1;
    state.vsm.steps.push({
      id: nextId(state.vsm.steps),
      name: `Process ${n}`,
      cycle: 50,
      changeover: 12,
      uptime: 95,
      operators: 1,
      queue: 3.0,
    });
    renderVSM();
    persistState();
  });

  document.getElementById('btn-vsm-import')?.addEventListener('click', () => {
    if (onOpenImport) onOpenImport('vsm');
  });

  document.getElementById('btn-vsm-to-takt')?.addEventListener('click', () => {
    const state = getState();
    state.takt.stations = state.vsm.steps.map((s, idx) => {
      const cyc = Math.max(1, Number(s.cycle) || 1);
      const va = Math.round(cyc * 0.75 * 10) / 10;
      const bnva = Math.round(cyc * 0.15 * 10) / 10;
      const waste = Math.max(0, Math.round((cyc - va - bnva) * 10) / 10);
      return {
        id: idx + 1,
        name: s.name,
        va,
        bnva,
        waste,
      };
    });
    setModuleSource('takt', 'link', `Synced from VSM (${state.takt.stations.length} steps)`);
    renderTakt();
    renderAllSourceBadges();
    persistState();
    switchTab('takt');
    showToast(`Synced ${state.takt.stations.length} VSM steps into Takt Yamazumi`);
  });

  document.getElementById('btn-vsm-to-ishikawa')?.addEventListener('click', () => {
    const bottle = identifyVSMBottleneck(getState().vsm.steps);
    if (!bottle) return;
    seedIshikawaFromCrossLink({
      problem: `${bottle.name} Cycle & Queue Bottleneck (${bottle.cycle}s / ${bottle.queue}h)`,
      rib: 'Method',
      cause: `VSM constraint: ${bottle.name} (${bottle.cycle}s C/T, ${bottle.changeover}m C/O)`,
    });
  });
}
