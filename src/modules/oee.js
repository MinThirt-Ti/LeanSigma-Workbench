import { PALETTE } from '../constants.js';
import { getState, nextId, persistState } from '../state.js';
import { escapeHtml, truncateText } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { computeShiftLogOEE, computeSingleOEE } from './oeeMath.js';

function renderWaterfallSVG(m) {
  const svg = document.getElementById('svg-oee');
  if (!svg) return;
  const left = 72;
  const right = 928;
  const top = 46;
  const bottom = 320;
  const plotH = bottom - top;
  const maxMin = Math.max(1, m.planned);
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const yAt = (min) => bottom - (Math.max(0, min) / maxMin) * plotH;

  const steps = [
    { label: 'Planned', start: 0, end: m.planned, val: m.planned, color: PALETTE.indigo, isLoss: false },
    { label: 'Avail Loss', start: m.runTime, end: m.planned, val: -m.availLoss, color: PALETTE.crimson, isLoss: true },
    { label: 'Run Time', start: 0, end: m.runTime, val: m.runTime, color: PALETTE.teal, isLoss: false },
    { label: 'Perf Loss', start: m.netRunTime, end: m.runTime, val: -m.perfLoss, color: PALETTE.copper, isLoss: true },
    { label: 'Net Run', start: 0, end: m.netRunTime, val: m.netRunTime, color: PALETTE.indigo, isLoss: false },
    { label: 'Qual Loss', start: m.prodTime, end: m.netRunTime, val: -m.qualLoss, color: PALETTE.magenta, isLoss: true },
    { label: 'Productive', start: 0, end: m.prodTime, val: m.prodTime, color: PALETTE.emerald, isLoss: false },
  ];

  const slotW = (right - left) / steps.length;
  const barW = Math.min(82, slotW * 0.64);

  let html = `<rect x="0" y="0" width="960" height="390" fill="${PALETTE.canvas}" />`;

  for (let i = 0; i <= 4; i++) {
    const v = (maxMin * i) / 4;
    const y = yAt(v);
    html += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${PALETTE.border}" stroke-width="1" />`;
    html += `<text x="${left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11">${Math.round(v)}m</text>`;
  }

  html += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${PALETTE.icemint}" stroke-width="2" />`;

  steps.forEach((st, idx) => {
    const cx = left + slotW * idx + slotW / 2;
    const bx = cx - barW / 2;
    const yTop = yAt(st.end);
    const yBot = yAt(st.start);
    const h = Math.max(2, yBot - yTop);

    if (idx > 0) {
      const prevCx = left + slotW * (idx - 1) + slotW / 2;
      const prevRight = prevCx + barW / 2;
      html += `<line x1="${prevRight.toFixed(1)}" y1="${yTop.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${yTop.toFixed(1)}" stroke="${PALETTE.rose}" stroke-width="1.3" stroke-dasharray="4 3" />`;
    }

    html += `<rect x="${bx.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${st.color}" stroke="${PALETTE.canvas}" stroke-width="1.5" rx="3" />`;

    const valStr = st.isLoss ? `-${Math.abs(st.val).toFixed(0)}m` : `${st.val.toFixed(0)}m`;
    const pctStr = `${((Math.abs(st.val) / maxMin) * 100).toFixed(1)}%`;
    html += `<text x="${cx.toFixed(1)}" y="${(yTop - 16).toFixed(1)}" text-anchor="middle" fill="${st.isLoss ? PALETTE.rose : PALETTE.emerald}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" font-weight="700">${valStr}</text>`;
    html += `<text x="${cx.toFixed(1)}" y="${(yTop - 4).toFixed(1)}" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10">${pctStr}</text>`;
    html += `<text x="${cx.toFixed(1)}" y="${bottom + 22}" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700">${st.label}</text>`;
  });

  html += `<rect x="${left}" y="356" width="${right - left}" height="24" rx="4" fill="${PALETTE.card}" stroke="${PALETTE.border}" stroke-width="1.5" />`;
  html += `<text x="480" y="372" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">OEE ${pct(m.oee)}   |   Availability ${pct(m.avail)}   |   Performance ${pct(m.perf)}   |   Quality ${pct(m.qual)}</text>`;

  svg.innerHTML = html;
}

function renderTrendSVG(series) {
  const svg = document.getElementById('svg-oee-trend');
  if (!svg) return;
  const left = 64;
  const right = 928;
  const top = 28;
  const bottom = 212;
  const plotW = right - left;
  const plotH = bottom - top;

  let html = `<rect x="0" y="0" width="960" height="256" fill="${PALETTE.canvas}" />`;

  for (let p = 0; p <= 100; p += 25) {
    const y = bottom - (p / 100) * plotH;
    html += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${PALETTE.border}" stroke-width="1" />`;
    html += `<text x="${left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${PALETTE.icemint}" font-family="ui-monospace, monospace" font-size="10">${p}%</text>`;
  }

  // 85% World Class benchmark
  const y85 = bottom - 0.85 * plotH;
  html += `<line x1="${left}" y1="${y85.toFixed(1)}" x2="${right}" y2="${y85.toFixed(1)}" stroke="${PALETTE.copper}" stroke-width="1.8" stroke-dasharray="6 4" />`;
  html += `<text x="${right - 4}" y="${(y85 - 6).toFixed(1)}" text-anchor="end" fill="${PALETTE.copper}" font-family="ui-monospace, monospace" font-size="10" font-weight="700">85% WORLD CLASS</text>`;

  html += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${PALETTE.icemint}" stroke-width="1.8" />`;

  if (series.length > 0) {
    const xAt = (idx) => left + (series.length === 1 ? plotW / 2 : (idx / (series.length - 1)) * plotW);
    const yAt = (ratio) => bottom - Math.max(0, Math.min(1.05, ratio)) * plotH;

    const drawSeries = (key, color, width, dash = '') => {
      const pts = series.map((s, i) => `${xAt(i).toFixed(1)},${yAt(s[key]).toFixed(1)}`).join(' ');
      html += `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linejoin="round" />`;
    };

    drawSeries('avail', PALETTE.crimson, 1.8, '4 3');
    drawSeries('perf', PALETTE.copper, 1.8, '4 3');
    drawSeries('qual', PALETTE.magenta, 1.8, '4 3');
    drawSeries('oee', PALETTE.emerald, 3);

    series.forEach((s, i) => {
      const cx = xAt(i);
      const cy = yAt(s.oee);
      html += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${PALETTE.canvas}" stroke="${PALETTE.emerald}" stroke-width="2.2" />`;
      html += `<text x="${cx.toFixed(1)}" y="${(cy - 9).toFixed(1)}" text-anchor="middle" fill="${PALETTE.emerald}" font-family="ui-monospace, monospace" font-size="10" font-weight="700">${(s.oee * 100).toFixed(0)}%</text>`;
      if (series.length <= 12 || i % Math.ceil(series.length / 10) === 0) {
        html += `<text x="${cx.toFixed(1)}" y="${bottom + 18}" text-anchor="middle" fill="${PALETTE.rose}" font-family="ui-monospace, monospace" font-size="10">${escapeHtml(truncateText(s.label, 12))}</text>`;
      }
    });
  }

  svg.innerHTML = html;
}

function renderOEELogTable(oeeState, lines) {
  const filterSel = document.getElementById('oee-filter-line');
  if (filterSel) {
    const prev = oeeState.filterLine || 'ALL';
    filterSel.innerHTML =
      `<option value="ALL">All Lines (${oeeState.logs.length} shifts)</option>` +
      lines.map((ln) => `<option value="${escapeHtml(ln)}">${escapeHtml(ln)}</option>`).join('');
    filterSel.value = lines.includes(prev) ? prev : 'ALL';
    oeeState.filterLine = filterSel.value;
  }

  const tbody = document.getElementById('oee-log-body');
  if (!tbody) return;

  const filtered = oeeState.logs
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => oeeState.filterLine === 'ALL' || row.line === oeeState.filterLine);

  tbody.innerHTML = filtered
    .map(({ row, idx }) => {
      const rm = computeSingleOEE({
        shift: row.planned,
        downtime: row.downtime,
        cycle: row.cycle,
        output: row.output,
        scrap: row.scrap,
      });
      const oeePct = (rm.oee * 100).toFixed(1);
      const colCls = rm.oee >= 0.85 ? 'text-emerald-mint border-emerald-mint' : rm.oee >= 0.65 ? 'text-copper border-copper' : 'text-crimson border-crimson';
      return `
        <tr class="hover:bg-navy-panel">
          <td class="py-1.5 pr-2"><input type="text" data-idx="${idx}" data-field="date" value="${escapeHtml(row.date)}" class="ind-input w-28 text-xs oee-log-edit" /></td>
          <td class="py-1.5 px-1"><input type="text" data-idx="${idx}" data-field="shiftName" value="${escapeHtml(row.shiftName)}" class="ind-input ind-input-text w-20 text-xs oee-log-edit" /></td>
          <td class="py-1.5 px-1"><input type="text" data-idx="${idx}" data-field="line" value="${escapeHtml(row.line)}" class="ind-input ind-input-text w-24 text-xs oee-log-edit" /></td>
          <td class="py-1.5 px-1"><input type="number" min="1" data-idx="${idx}" data-field="planned" value="${row.planned}" class="ind-input w-18 text-right text-xs oee-log-edit" /></td>
          <td class="py-1.5 px-1"><input type="number" min="0" data-idx="${idx}" data-field="downtime" value="${row.downtime}" class="ind-input w-18 text-right text-xs oee-log-edit" /></td>
          <td class="py-1.5 px-1"><input type="number" min="0.1" step="0.5" data-idx="${idx}" data-field="cycle" value="${row.cycle}" class="ind-input w-16 text-right text-xs oee-log-edit" /></td>
          <td class="py-1.5 px-1"><input type="number" min="0" data-idx="${idx}" data-field="output" value="${row.output}" class="ind-input w-20 text-right text-xs oee-log-edit" /></td>
          <td class="py-1.5 px-1"><input type="number" min="0" data-idx="${idx}" data-field="scrap" value="${row.scrap}" class="ind-input w-16 text-right text-xs oee-log-edit" /></td>
          <td class="py-1.5 px-2"><span id="oee-row-pct-${idx}" class="px-2 py-0.5 text-xs font-mono font-bold rounded-xs border bg-navy-canvas ${colCls}">${oeePct}%</span></td>
          <td class="py-1.5 pl-1 text-right"><button type="button" data-idx="${idx}" class="ind-btn ind-btn-danger py-1 px-2 text-xs oee-log-del">Delete</button></td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('.oee-log-edit').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      const f = e.target.dataset.field;
      const row = oeeState.logs[i];
      if (!row) return;
      if (['date', 'shiftName', 'line'].includes(f)) {
        row[f] = e.target.value;
      } else {
        row[f] = Math.max(0, parseFloat(e.target.value) || 0);
      }
      const rm = computeSingleOEE({
        shift: row.planned,
        downtime: row.downtime,
        cycle: row.cycle,
        output: row.output,
        scrap: row.scrap,
      });
      const pill = document.getElementById(`oee-row-pct-${i}`);
      if (pill) {
        pill.textContent = `${(rm.oee * 100).toFixed(1)}%`;
      }
      renderOEEChartsAndKPIs();
      persistState();
    });
  });

  tbody.querySelectorAll('.oee-log-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (oeeState.logs.length <= 1) {
        showToast('At least one shift row required', true);
        return;
      }
      const i = parseInt(e.target.dataset.idx, 10);
      oeeState.logs.splice(i, 1);
      renderOEE();
      persistState();
    });
  });
}

function renderOEEChartsAndKPIs() {
  const o = getState().oee;
  const isLog = o.mode === 'log';
  const m = isLog ? computeShiftLogOEE(o.logs, o.filterLine) : computeSingleOEE(o);

  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const clampW = (v) => `${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%`;

  document.getElementById('oee-val-main').textContent = pct(m.oee);
  document.getElementById('oee-bar-main').style.width = clampW(m.oee);
  const badge = document.getElementById('oee-badge-main');
  if (m.oee >= 0.85) {
    badge.textContent = 'World Class';
    badge.style.color = PALETTE.emerald;
    badge.style.borderColor = PALETTE.emerald;
    document.getElementById('oee-val-main').style.color = PALETTE.emerald;
  } else if (m.oee >= 0.65) {
    badge.textContent = 'Standard';
    badge.style.color = PALETTE.copper;
    badge.style.borderColor = PALETTE.copper;
    document.getElementById('oee-val-main').style.color = PALETTE.icemint;
  } else {
    badge.textContent = 'Low';
    badge.style.color = PALETTE.crimson;
    badge.style.borderColor = PALETTE.crimson;
    document.getElementById('oee-val-main').style.color = PALETTE.crimson;
  }

  document.getElementById('oee-val-avail').textContent = pct(m.avail);
  document.getElementById('oee-sub-avail').textContent = `${m.runTime.toFixed(0)}m`;
  document.getElementById('oee-bar-avail').style.width = clampW(m.avail);

  document.getElementById('oee-val-perf').textContent = pct(m.perf);
  document.getElementById('oee-sub-perf').textContent = `${m.netRunTime.toFixed(0)}m`;
  document.getElementById('oee-bar-perf').style.width = clampW(m.perf);

  document.getElementById('oee-val-qual').textContent = pct(m.qual);
  document.getElementById('oee-sub-qual').textContent = `${m.safeScrap} scrap`;
  document.getElementById('oee-bar-qual').style.width = clampW(m.qual);

  document.getElementById('oee-val-good').textContent = m.goodUnits.toLocaleString('en-US');
  document.getElementById('oee-sub-good').textContent = `of ${m.output}`;
  document.getElementById('oee-bar-good').style.width = clampW(m.qual);

  renderWaterfallSVG(m);
  if (isLog) {
    renderTrendSVG(m.series || []);
  }
  return m;
}

export function renderOEE() {
  const o = getState().oee;
  const isLog = o.mode === 'log';

  document.getElementById('oee-mode-log')?.classList.toggle('active', isLog);
  document.getElementById('oee-mode-single')?.classList.toggle('active', !isLog);

  document.getElementById('oee-single-presets')?.classList.toggle('hidden', isLog);
  document.getElementById('oee-single-controls')?.classList.toggle('hidden', isLog);
  document.getElementById('oee-log-toolbar')?.classList.toggle('hidden', !isLog);
  document.getElementById('oee-trend-card')?.classList.toggle('hidden', !isLog);
  document.getElementById('oee-log-table-card')?.classList.toggle('hidden', !isLog);

  if (!isLog) {
    const sync = (inId, slId, val) => {
      const el = document.getElementById(inId);
      if (el && document.activeElement !== el) el.value = val;
      const sl = document.getElementById(slId);
      if (sl) sl.value = val;
    };
    sync('oee-in-shift', 'oee-sl-shift', o.shift);
    sync('oee-in-down', 'oee-sl-down', o.downtime);
    sync('oee-in-cycle', 'oee-sl-cycle', o.cycle);
    sync('oee-in-output', 'oee-sl-output', o.output);
    sync('oee-in-scrap', 'oee-sl-scrap', o.scrap);
  }

  const m = renderOEEChartsAndKPIs();
  if (isLog) {
    renderOEELogTable(o, m.lines || []);
  }
}

export function bindOEEEvents({ onOpenImport }) {
  document.getElementById('oee-mode-log')?.addEventListener('click', () => {
    getState().oee.mode = 'log';
    renderOEE();
    persistState();
  });
  document.getElementById('oee-mode-single')?.addEventListener('click', () => {
    getState().oee.mode = 'single';
    renderOEE();
    persistState();
  });

  document.getElementById('btn-oee-import')?.addEventListener('click', () => {
    if (onOpenImport) onOpenImport('oee');
  });

  document.getElementById('oee-filter-line')?.addEventListener('change', (e) => {
    getState().oee.filterLine = e.target.value;
    renderOEE();
    persistState();
  });

  document.getElementById('btn-oee-add-row')?.addEventListener('click', () => {
    const o = getState().oee;
    const last = o.logs[o.logs.length - 1] || { line: 'Line-1', planned: 480, cycle: 30 };
    o.logs.push({
      id: nextId(o.logs),
      date: new Date().toISOString().slice(0, 10),
      shiftName: 'Day',
      line: o.filterLine !== 'ALL' ? o.filterLine : last.line || 'Line-1',
      planned: last.planned || 480,
      downtime: 30,
      cycle: last.cycle || 30,
      output: 780,
      scrap: 12,
    });
    renderOEE();
    persistState();
  });

  const bind = (inId, slId, key, min, max) => {
    document.getElementById(slId)?.addEventListener('input', (e) => {
      getState().oee[key] = Math.max(min, Math.min(max, parseFloat(e.target.value) || 0));
      renderOEE();
      persistState();
    });
    document.getElementById(inId)?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!Number.isNaN(v)) {
        getState().oee[key] = Math.max(min, Math.min(max, v));
        renderOEE();
        persistState();
      }
    });
  };
  bind('oee-in-shift', 'oee-sl-shift', 'shift', 60, 1440);
  bind('oee-in-down', 'oee-sl-down', 'downtime', 0, 1440);
  bind('oee-in-cycle', 'oee-sl-cycle', 'cycle', 1, 600);
  bind('oee-in-output', 'oee-sl-output', 'output', 0, 10000);
  bind('oee-in-scrap', 'oee-sl-scrap', 'scrap', 0, 5000);

  const presets = {
    world: { shift: 480, downtime: 20, cycle: 30, output: 885, scrap: 8 },
    average: { shift: 480, downtime: 58, cycle: 30, output: 710, scrap: 24 },
    bottleneck: { shift: 480, downtime: 115, cycle: 30, output: 540, scrap: 48 },
  };
  document.querySelectorAll('.oee-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = presets[btn.dataset.preset];
      if (p) {
        Object.assign(getState().oee, p);
        renderOEE();
        persistState();
      }
    });
  });
}
