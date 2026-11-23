import { TAB_NAMES } from '../constants.js';
import { getState } from '../state.js';
import { escapeHtml } from '../utils.js';

const MODULE_KEYS = ['capability', 'oee', 'takt', 'pareto', 'vsm', 'fives', 'ishikawa'];

function badgeClasses(kind) {
  if (kind === 'file' || kind === 'paste') {
    return 'border-emerald-mint text-emerald-mint bg-navy-canvas';
  }
  if (kind === 'manual' || kind === 'link') {
    return 'border-teal-slate text-icemint bg-navy-canvas';
  }
  return 'border-copper text-copper bg-navy-canvas';
}

export function renderAllSourceBadges() {
  const state = getState();
  MODULE_KEYS.forEach((key) => {
    const el = document.getElementById(`src-badge-${key}`);
    if (!el) return;
    const src = state[key]?.source || { kind: 'sample', label: 'Sample' };
    el.className = `inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono font-semibold rounded-xs border ${badgeClasses(src.kind)}`;
    el.textContent = src.label;
  });

  // Also refresh Data & Export Hub source overview table if present
  const overviewBody = document.getElementById('exp-sources-body');
  if (overviewBody) {
    overviewBody.innerHTML = MODULE_KEYS.map((key) => {
      const src = state[key]?.source || { kind: 'sample', label: 'Sample' };
      return `
        <tr class="hover:bg-navy-panel text-xs">
          <td class="py-2 pr-3 font-bold text-rose-dusty">${escapeHtml(TAB_NAMES[key])}</td>
          <td class="py-2 px-2">
            <span class="px-2 py-0.5 font-mono font-semibold rounded-xs border ${badgeClasses(src.kind)}">${escapeHtml(src.label)}</span>
          </td>
          <td class="py-2 pl-2 text-right whitespace-nowrap space-x-1.5">
            <button type="button" data-raw-mod="${key}" class="ind-btn py-1 px-2 text-[11px] btn-view-raw">View Raw</button>
            ${
              ['capability', 'oee', 'takt', 'pareto', 'vsm'].includes(key)
                ? `<button type="button" data-imp-mod="${key}" class="ind-btn ind-btn-primary py-1 px-2 text-[11px] btn-hub-import">Import</button>`
                : ''
            }
          </td>
        </tr>
      `;
    }).join('');
  }
}

export function getRawTableForModule(key) {
  const state = getState();
  if (key === 'capability') {
    if (state.capability.mode === 'data') {
      return {
        title: `Capability Raw Samples (${state.capability.label || 'Measurements'})`,
        headers: ['#', `Value (${state.capability.unit || 'unit'})`, 'Status'],
        rows: (state.capability.samples || []).map((v, i) => [
          i + 1,
          v,
          v < state.capability.lsl || v > state.capability.usl ? 'Out of Spec' : 'In Spec',
        ]),
      };
    }
    return {
      title: 'Capability Simulator Parameters',
      headers: ['Parameter', 'Value'],
      rows: [
        ['Mean (μ)', state.capability.mu],
        ['Std Dev (σ)', state.capability.sigma],
        ['LSL', state.capability.lsl],
        ['USL', state.capability.usl],
      ],
    };
  }
  if (key === 'oee') {
    if (state.oee.mode === 'log') {
      return {
        title: 'OEE Shift Production Log',
        headers: ['Date', 'Shift', 'Line', 'Planned (m)', 'Downtime (m)', 'Cycle (s)', 'Output', 'Scrap'],
        rows: (state.oee.logs || []).map((r) => [
          r.date,
          r.shiftName,
          r.line,
          r.planned,
          r.downtime,
          r.cycle,
          r.output,
          r.scrap,
        ]),
      };
    }
    return {
      title: 'OEE Single Shift Inputs',
      headers: ['Field', 'Value'],
      rows: [
        ['Shift (min)', state.oee.shift],
        ['Downtime (min)', state.oee.downtime],
        ['Cycle (sec)', state.oee.cycle],
        ['Output', state.oee.output],
        ['Scrap', state.oee.scrap],
      ],
    };
  }
  if (key === 'takt') {
    return {
      title: 'Takt Workstations',
      headers: ['Station', 'VA (s)', 'BNVA (s)', 'Waste (s)', 'Total (s)'],
      rows: (state.takt.stations || []).map((s) => [
        s.name,
        s.va,
        s.bnva,
        s.waste,
        (Number(s.va) || 0) + (Number(s.bnva) || 0) + (Number(s.waste) || 0),
      ]),
    };
  }
  if (key === 'pareto') {
    if (state.pareto.mode === 'events') {
      return {
        title: 'Pareto Raw Event Log',
        headers: ['#', 'Category', 'Weight', 'Group'],
        rows: (state.pareto.events || []).map((e, i) => [i + 1, e.category, e.weight, e.group]),
      };
    }
    return {
      title: 'Pareto Summary Categories',
      headers: ['Category', 'Count'],
      rows: (state.pareto.items || []).map((it) => [it.name, it.count]),
    };
  }
  if (key === 'vsm') {
    return {
      title: 'VSM Process Steps',
      headers: ['Step', 'Cycle (s)', 'Changeover (m)', 'Uptime (%)', 'Operators', 'Queue (h)'],
      rows: (state.vsm.steps || []).map((s) => [s.name, s.cycle, s.changeover, s.uptime, s.operators, s.queue]),
    };
  }
  if (key === 'fives') {
    const rows = [];
    (state.fives.pillars || []).forEach((p) => {
      p.criteria.forEach((c) => rows.push([p.name, c.label, c.score]));
    });
    return {
      title: '5S Audit Criteria Scores',
      headers: ['Pillar', 'Criterion', 'Score (1-5)'],
      rows,
    };
  }
  if (key === 'ishikawa') {
    const rows = [];
    Object.entries(state.ishikawa.ribs || {}).forEach(([rib, list]) => {
      list.forEach((c) => rows.push([rib, c.text, c.root ? 'Root Suspect' : 'Factor']));
    });
    return {
      title: `Ishikawa Causes — ${state.ishikawa.problem}`,
      headers: ['6M Rib', 'Cause', 'Flag'],
      rows,
    };
  }
  return { title: 'Raw Data', headers: [], rows: [] };
}

export function openRawDataModal(moduleKey) {
  const modal = document.getElementById('raw-data-modal');
  const titleEl = document.getElementById('raw-modal-title');
  const subEl = document.getElementById('raw-modal-sub');
  const tableEl = document.getElementById('raw-modal-table');
  if (!modal || !tableEl) return;

  const src = getState()[moduleKey]?.source?.label || 'Unknown';
  const { title, headers, rows } = getRawTableForModule(moduleKey);

  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = `${src} • ${rows.length} row(s)`;

  const thead = `<thead><tr class="border-b-2 border-navy-border text-teal-slate font-mono text-xs">${headers
    .map((h) => `<th class="py-2 px-3 text-left whitespace-nowrap">${escapeHtml(h)}</th>`)
    .join('')}</tr></thead>`;
  const tbody = `<tbody>${rows
    .slice(0, 200)
    .map(
      (r) =>
        `<tr class="border-b border-navy-border/50 text-icemint font-mono text-xs hover:bg-navy-panel">${r
          .map((c) => `<td class="py-1.5 px-3 whitespace-nowrap">${escapeHtml(c)}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody>`;

  tableEl.innerHTML = thead + tbody;
  modal.classList.remove('hidden');
}

export function closeRawDataModal() {
  document.getElementById('raw-data-modal')?.classList.add('hidden');
}
