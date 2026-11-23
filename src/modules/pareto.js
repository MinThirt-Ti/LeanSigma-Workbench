import { PALETTE } from '../constants.js';
import { getState, nextId, persistState } from '../state.js';
import { escapeHtml, truncateText } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { aggregateParetoEvents, computeParetoSorted, getParetoGroups } from './paretoMath.js';
import { seedIshikawaFromCrossLink } from './ishikawa.js';

function getActiveItems(parState) {
  if (parState.mode === 'events') {
    return aggregateParetoEvents(parState.events, {
      metric: parState.metric,
      filterValue: parState.filterValue,
    });
  }
  return parState.items;
}

export function renderParetoChartOnly() {
  const par = getState().pareto;
  const items = getActiveItems(par);
  const { rows, total, vitalCount } = computeParetoSorted(items);

  document.getElementById('par-val-total').textContent =
    par.mode === 'events' && par.metric === 'weight'
      ? total.toLocaleString('en-US', { maximumFractionDigits: 1 })
      : total.toLocaleString('en-US');
  document.getElementById('par-val-vital').textContent = String(vitalCount);
  document.getElementById('par-sub-vital').textContent = `of ${rows.length} Categories`;
  if (rows.length > 0 && total > 0) {
    document.getElementById('par-val-top').textContent = truncateText(rows[0].name, 14);
    document.getElementById('par-sub-top').textContent = `${rows[0].share.toFixed(1)}% Share (${rows[0].count})`;
  } else {
    document.getElementById('par-val-top').textContent = 'None';
    document.getElementById('par-sub-top').textContent = '0.0% Share';
  }

  const svg = document.getElementById('svg-pareto');
  if (!svg) return;
  const left = 68;
  const right = 888;
  const top = 46;
  const bottom = 324;
  const plotH = bottom - top;
  const maxCount = Math.max(10, ...rows.map((r) => r.count)) * 1.15;

  const yCount = (c) => bottom - (c / maxCount) * plotH;
  const yPct = (p) => bottom - (p / 100) * plotH;

  let html = `<rect x="0" y="0" width="960" height="390" fill="${PALETTE.canvas}" />`;

  for (let i = 0; i <= 5; i++) {
    const p = i * 20;
    const y = yPct(p);
    const cVal = (maxCount * i) / 5;
    html += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${PALETTE.border}" stroke-width="1" />`;
    html += `<text x="${left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11">${Math.round(cVal)}</text>`;
    html += `<text x="${right + 10}" y="${(y + 4).toFixed(1)}" text-anchor="start" fill="${PALETTE.magenta}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11">${p}%</text>`;
  }

  html += `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="${PALETTE.icemint}" stroke-width="1.5" />`;
  html += `<line x1="${right}" y1="${top}" x2="${right}" y2="${bottom}" stroke="${PALETTE.magenta}" stroke-width="1.5" />`;
  html += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${PALETTE.icemint}" stroke-width="2" />`;

  const y80 = yPct(80);
  html += `<line x1="${left}" y1="${y80.toFixed(1)}" x2="${right}" y2="${y80.toFixed(1)}" stroke="${PALETTE.copper}" stroke-width="2" stroke-dasharray="7 4" />`;
  html += `<rect x="${left + 8}" y="${(y80 - 22).toFixed(1)}" width="74" height="18" rx="3" fill="${PALETTE.panel}" stroke="${PALETTE.copper}" stroke-width="1.2" />`;
  html += `<text x="${left + 45}" y="${(y80 - 9).toFixed(1)}" text-anchor="middle" fill="${PALETTE.copper}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10" font-weight="700">80% RULE</text>`;

  if (rows.length > 0) {
    const slotW = (right - left) / rows.length;
    const barW = Math.min(72, slotW * 0.62);
    let polyPts = '';

    rows.forEach((r, idx) => {
      const cx = left + slotW * idx + slotW / 2;
      const bx = cx - barW / 2;
      const yTop = yCount(r.count);
      const h = Math.max(2, bottom - yTop);
      const fill = r.isTop ? PALETTE.crimson : r.isVital ? PALETTE.indigo : PALETTE.teal;

      html += `<rect class="par-hover-bar" data-name="${escapeHtml(r.name)}" data-count="${r.count}" data-share="${r.share.toFixed(1)}" data-cum="${r.cum.toFixed(1)}" x="${bx.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="${PALETTE.canvas}" stroke-width="1.5" rx="2" />`;
      html += `<text x="${cx.toFixed(1)}" y="${(yTop - 6).toFixed(1)}" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">${r.count}</text>`;
      html += `<text x="${cx.toFixed(1)}" y="${bottom + 20}" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700">${escapeHtml(truncateText(r.name, 10))}</text>`;

      const py = yPct(r.cum);
      polyPts += `${cx.toFixed(1)},${py.toFixed(1)} `;
    });

    html += `<polyline points="${polyPts.trim()}" fill="none" stroke="${PALETTE.magenta}" stroke-width="3" stroke-linejoin="round" />`;

    rows.forEach((r, idx) => {
      const cx = left + slotW * idx + slotW / 2;
      const py = yPct(r.cum);
      html += `<circle class="par-hover-bar" data-name="${escapeHtml(r.name)}" data-count="${r.count}" data-share="${r.share.toFixed(1)}" data-cum="${r.cum.toFixed(1)}" cx="${cx.toFixed(1)}" cy="${py.toFixed(1)}" r="5.5" fill="${PALETTE.canvas}" stroke="${PALETTE.magenta}" stroke-width="2.5" />`;
      html += `<text x="${cx.toFixed(1)}" y="${(py - 11).toFixed(1)}" text-anchor="middle" fill="${PALETTE.rose}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10" font-weight="700">${r.cum.toFixed(0)}%</text>`;
    });
  }

  svg.innerHTML = html;

  const tip = document.getElementById('pareto-tooltip');
  svg.querySelectorAll('.par-hover-bar').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      tip.textContent = `${el.dataset.name}: ${el.dataset.count} (${el.dataset.share}% share, ${el.dataset.cum}% cum)`;
      tip.classList.remove('hidden');
    });
    el.addEventListener('mouseleave', () => tip.classList.add('hidden'));
  });
}

export function renderParetoTable() {
  const par = getState().pareto;
  const tbody = document.getElementById('pareto-table-body');
  if (!tbody) return;

  if (par.mode === 'events') {
    const groups = getParetoGroups(par.events);
    const filterSel = document.getElementById('par-filter-group');
    if (filterSel) {
      const prev = par.filterValue || 'ALL';
      filterSel.innerHTML =
        `<option value="ALL">All Groups (${par.events.length} events)</option>` +
        groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
      filterSel.value = groups.includes(prev) ? prev : 'ALL';
      par.filterValue = filterSel.value;
    }

    const items = getActiveItems(par);
    const { rows } = computeParetoSorted(items);
    tbody.innerHTML = rows
      .map(
        (r) => `
          <tr class="hover:bg-navy-panel">
            <td class="py-2 pr-3 font-semibold text-rose-dusty">${escapeHtml(r.name)}</td>
            <td class="py-2 px-2 font-mono text-icemint">${r.count}</td>
            <td class="py-2 px-2 font-mono text-icemint">${r.share.toFixed(1)}%</td>
            <td class="py-2 px-2 font-mono text-magenta">${r.cum.toFixed(1)}%</td>
            <td class="py-2 px-2">
              <span class="px-2 py-0.5 text-xs font-mono font-bold rounded-xs border ${r.isVital ? 'border-magenta text-rose-dusty bg-indigo-royal' : 'border-teal-slate text-teal-slate bg-navy-canvas'}">${r.isVital ? 'Vital' : 'Trivial'}</span>
            </td>
            <td class="py-2 pl-2 text-right">
              <button type="button" data-cat="${escapeHtml(r.name)}" data-share="${r.share.toFixed(1)}" data-count="${r.count}" class="ind-btn py-1 px-2.5 text-xs par-to-ish">→ Ishikawa</button>
            </td>
          </tr>
        `
      )
      .join('');

    tbody.querySelectorAll('.par-to-ish').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const { cat, share, count } = e.target.dataset;
        seedIshikawaFromCrossLink({
          problem: `${cat} Defects (${share}% of Pareto)`,
          rib: 'Machine',
          cause: `Pareto driver: ${cat} (${count})`,
        });
      });
    });

    // Also render recent raw events list
    const evBody = document.getElementById('par-events-body');
    if (evBody) {
      const visible = par.events
        .map((ev, idx) => ({ ev, idx }))
        .filter(({ ev }) => par.filterValue === 'ALL' || ev.group === par.filterValue);
      evBody.innerHTML = visible
        .slice(0, 40)
        .map(
          ({ ev, idx }) => `
            <tr class="hover:bg-navy-panel text-xs">
              <td class="py-1.5 pr-2 text-rose-dusty">${escapeHtml(ev.category)}</td>
              <td class="py-1.5 px-2 font-mono text-icemint">${ev.weight}</td>
              <td class="py-1.5 px-2 font-mono text-teal-slate">${escapeHtml(ev.group || 'All')}</td>
              <td class="py-1.5 pl-2 text-right"><button type="button" data-idx="${idx}" class="ind-btn ind-btn-danger py-0.5 px-2 text-[11px] par-ev-del">X</button></td>
            </tr>
          `
        )
        .join('');
      evBody.querySelectorAll('.par-ev-del').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const i = parseInt(e.target.dataset.idx, 10);
          par.events.splice(i, 1);
          renderPareto();
          persistState();
        });
      });
    }
    return;
  }

  // Summary Table Mode
  const { rows } = computeParetoSorted(par.items);
  const mapById = new Map(rows.map((r) => [r.id, r]));
  tbody.innerHTML = par.items
    .map((item, idx) => {
      const stat = mapById.get(item.id) || { share: 0, cum: 0, isVital: false };
      return `
        <tr class="hover:bg-navy-panel">
          <td class="py-2 pr-3"><input type="text" data-idx="${idx}" data-field="name" value="${escapeHtml(item.name)}" class="ind-input ind-input-text w-40 par-edit" /></td>
          <td class="py-2 px-2"><input type="number" min="0" max="99999" data-idx="${idx}" data-field="count" value="${item.count}" class="ind-input w-24 text-right par-edit" /></td>
          <td class="py-2 px-2 font-mono text-icemint" id="par-share-${item.id}">${stat.share.toFixed(1)}%</td>
          <td class="py-2 px-2 font-mono text-magenta" id="par-cum-${item.id}">${stat.cum.toFixed(1)}%</td>
          <td class="py-2 px-2"><span id="par-cls-${item.id}" class="px-2 py-0.5 text-xs font-mono font-bold rounded-xs border ${stat.isVital ? 'border-magenta text-rose-dusty bg-indigo-royal' : 'border-teal-slate text-teal-slate bg-navy-canvas'}">${stat.isVital ? 'Vital' : 'Trivial'}</span></td>
          <td class="py-2 pl-2 text-right whitespace-nowrap space-x-1">
            <button type="button" data-cat="${escapeHtml(item.name)}" data-share="${stat.share.toFixed(1)}" data-count="${item.count}" class="ind-btn py-1 px-2 text-xs par-to-ish">→ Ishikawa</button>
            <button type="button" data-idx="${idx}" class="ind-btn ind-btn-danger py-1 px-2 text-xs par-del">Delete</button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('.par-edit').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const i = parseInt(e.target.dataset.idx, 10);
      const f = e.target.dataset.field;
      if (f === 'name') {
        par.items[i].name = e.target.value;
      } else {
        par.items[i].count = Math.max(0, parseInt(e.target.value, 10) || 0);
      }
      renderParetoChartOnly();
      const { rows: updated } = computeParetoSorted(par.items);
      updated.forEach((r) => {
        const sEl = document.getElementById(`par-share-${r.id}`);
        const cEl = document.getElementById(`par-cum-${r.id}`);
        const kEl = document.getElementById(`par-cls-${r.id}`);
        if (sEl) sEl.textContent = `${r.share.toFixed(1)}%`;
        if (cEl) cEl.textContent = `${r.cum.toFixed(1)}%`;
        if (kEl) {
          kEl.textContent = r.isVital ? 'Vital' : 'Trivial';
          kEl.className = `px-2 py-0.5 text-xs font-mono font-bold rounded-xs border ${r.isVital ? 'border-magenta text-rose-dusty bg-indigo-royal' : 'border-teal-slate text-teal-slate bg-navy-canvas'}`;
        }
      });
      persistState();
    });
  });

  tbody.querySelectorAll('.par-to-ish').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const { cat, share, count } = e.target.dataset;
      seedIshikawaFromCrossLink({
        problem: `${cat} Defects (${share}% of Pareto)`,
        rib: 'Machine',
        cause: `Pareto driver: ${cat} (${count})`,
      });
    });
  });

  tbody.querySelectorAll('.par-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (par.items.length <= 1) {
        showToast('At least one category required', true);
        return;
      }
      const i = parseInt(e.target.dataset.idx, 10);
      par.items.splice(i, 1);
      renderPareto();
      persistState();
    });
  });
}

export function renderPareto() {
  const par = getState().pareto;
  const isEvents = par.mode === 'events';

  document.getElementById('par-mode-events')?.classList.toggle('active', isEvents);
  document.getElementById('par-mode-summary')?.classList.toggle('active', !isEvents);
  document.getElementById('par-metric-count')?.classList.toggle('active', par.metric === 'count');
  document.getElementById('par-metric-weight')?.classList.toggle('active', par.metric === 'weight');

  document.getElementById('par-events-toolbar')?.classList.toggle('hidden', !isEvents);
  document.getElementById('par-events-card')?.classList.toggle('hidden', !isEvents);
  document.getElementById('btn-par-add')?.classList.toggle('hidden', isEvents);

  renderParetoChartOnly();
  renderParetoTable();
}

export function bindParetoEvents({ onOpenImport }) {
  document.getElementById('par-mode-events')?.addEventListener('click', () => {
    getState().pareto.mode = 'events';
    renderPareto();
    persistState();
  });
  document.getElementById('par-mode-summary')?.addEventListener('click', () => {
    getState().pareto.mode = 'summary';
    renderPareto();
    persistState();
  });

  document.getElementById('par-metric-count')?.addEventListener('click', () => {
    getState().pareto.metric = 'count';
    renderPareto();
    persistState();
  });
  document.getElementById('par-metric-weight')?.addEventListener('click', () => {
    getState().pareto.metric = 'weight';
    renderPareto();
    persistState();
  });

  document.getElementById('par-filter-group')?.addEventListener('change', (e) => {
    getState().pareto.filterValue = e.target.value;
    renderPareto();
    persistState();
  });

  document.getElementById('btn-par-import')?.addEventListener('click', () => {
    if (onOpenImport) onOpenImport('pareto');
  });

  document.getElementById('btn-par-to-ishikawa')?.addEventListener('click', () => {
    const par = getState().pareto;
    const { rows } = computeParetoSorted(getActiveItems(par));
    if (!rows.length) {
      showToast('No Pareto categories available', true);
      return;
    }
    const top = rows[0];
    seedIshikawaFromCrossLink({
      problem: `${top.name} Defects (${top.share.toFixed(1)}% of Pareto)`,
      rib: 'Machine',
      cause: `Top Pareto driver: ${top.name} (${top.count})`,
    });
  });

  document.getElementById('btn-par-add')?.addEventListener('click', () => {
    const par = getState().pareto;
    const n = par.items.length + 1;
    par.items.push({ id: nextId(par.items), name: `Defect ${n}`, count: 12 });
    renderPareto();
    persistState();
  });

  document.getElementById('btn-par-ev-add')?.addEventListener('click', () => {
    const par = getState().pareto;
    const catEl = document.getElementById('par-ev-cat');
    const wEl = document.getElementById('par-ev-weight');
    const gEl = document.getElementById('par-ev-group');
    const cat = catEl.value.trim();
    if (!cat) {
      showToast('Enter a defect/reason category', true);
      return;
    }
    par.events.unshift({
      id: nextId(par.events),
      category: cat,
      weight: Math.max(0, parseFloat(wEl.value) || 1),
      group: gEl.value.trim() || 'All',
    });
    catEl.value = '';
    renderPareto();
    persistState();
  });
}
