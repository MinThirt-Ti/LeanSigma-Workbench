import { TAB_NAMES } from '../constants.js';
import { getState } from '../state.js';
import { copyToClipboard, csvRow, dateStamp, triggerDownload, tsvRow } from '../utils.js';
import { computeEmpiricalCapability, computeParametricCapability } from '../modules/capabilityMath.js';
import { computeShiftLogOEE, computeSingleOEE } from '../modules/oeeMath.js';
import { computeTaktMetrics } from '../modules/taktMath.js';
import { aggregateParetoEvents, computeParetoSorted } from '../modules/paretoMath.js';
import { showToast } from '../ui/toast.js';

function getModuleMatrix(state, key) {
  if (key === 'capability') {
    const cap = state.capability;
    if (cap.mode === 'data' && Array.isArray(cap.samples) && cap.samples.length >= 2) {
      const m = computeEmpiricalCapability(cap.samples, cap.lsl, cap.usl);
      const rows = [
        ['Metric', 'Value'],
        ['Mode', 'Data'],
        ['Label', cap.label || 'Measurement'],
        ['Samples', m.n],
        ['Mean', m.mean.toFixed(4)],
        ['SigmaOverall', m.overallSigma.toFixed(4)],
        ['SigmaWithin', m.withinSigma.toFixed(4)],
        ['LSL', m.lsl.toFixed(4)],
        ['USL', m.usl.toFixed(4)],
        ['Cp', m.cp.toFixed(4)],
        ['Cpk', m.cpk.toFixed(4)],
        ['Pp', m.pp.toFixed(4)],
        ['Ppk', m.ppk.toFixed(4)],
        ['ObservedOOS', m.oobCount],
        ['ObservedPPM', m.observedPPM.toFixed(2)],
        ['ExpectedPPM', m.expectedPPM.toFixed(2)],
        ['IMR_OOC_Count', m.imr.oocIndices.length],
        ['---', '---'],
        ['SampleIndex', 'Measurement'],
      ];
      m.samples.forEach((v, idx) => rows.push([idx + 1, v]));
      return rows;
    }
    const m = computeParametricCapability(cap);
    return [
      ['Metric', 'Value'],
      ['Mode', 'Simulator'],
      ['Mean', m.mu.toFixed(2)],
      ['Sigma', m.sigma.toFixed(2)],
      ['LSL', m.lsl.toFixed(2)],
      ['USL', m.usl.toFixed(2)],
      ['Cp', m.cp.toFixed(4)],
      ['Cpk', m.cpk.toFixed(4)],
      ['Cpu', m.cpu.toFixed(4)],
      ['Cpl', m.cpl.toFixed(4)],
      ['PPM', m.ppm.toFixed(3)],
      ['YieldPct', m.yieldPct.toFixed(4)],
      ['SigmaLevel', m.zMin.toFixed(3)],
    ];
  }

  if (key === 'oee') {
    const oeeState = state.oee;
    if (oeeState.mode === 'log' && Array.isArray(oeeState.logs) && oeeState.logs.length > 0) {
      const m = computeShiftLogOEE(oeeState.logs, oeeState.filterLine);
      const rows = [
        ['Date', 'Shift', 'Line', 'PlannedMin', 'DowntimeMin', 'CycleSec', 'OutputUnits', 'ScrapUnits', 'AvailabilityPct', 'PerformancePct', 'QualityPct', 'OEEPct'],
      ];
      oeeState.logs
        .filter((r) => oeeState.filterLine === 'ALL' || r.line === oeeState.filterLine)
        .forEach((r) => {
          const rm = computeSingleOEE({ shift: r.planned, downtime: r.downtime, cycle: r.cycle, output: r.output, scrap: r.scrap });
          rows.push([
            r.date,
            r.shiftName,
            r.line,
            r.planned,
            r.downtime,
            r.cycle,
            r.output,
            r.scrap,
            (rm.avail * 100).toFixed(2),
            (rm.perf * 100).toFixed(2),
            (rm.qual * 100).toFixed(2),
            (rm.oee * 100).toFixed(2),
          ]);
        });
      rows.push([
        'AGGREGATE',
        `${m.shiftCount} shifts`,
        oeeState.filterLine || 'ALL',
        m.planned,
        m.availLoss,
        '-',
        m.output,
        m.safeScrap,
        (m.avail * 100).toFixed(2),
        (m.perf * 100).toFixed(2),
        (m.qual * 100).toFixed(2),
        (m.oee * 100).toFixed(2),
      ]);
      return rows;
    }

    const m = computeSingleOEE(oeeState);
    return [
      ['Metric', 'Value'],
      ['ShiftMin', oeeState.shift],
      ['DowntimeMin', oeeState.downtime],
      ['CycleSec', oeeState.cycle],
      ['OutputUnits', oeeState.output],
      ['ScrapUnits', oeeState.scrap],
      ['GoodUnits', m.goodUnits],
      ['AvailabilityPct', (m.avail * 100).toFixed(2)],
      ['PerformancePct', (m.perf * 100).toFixed(2)],
      ['QualityPct', (m.qual * 100).toFixed(2)],
      ['OEEPct', (m.oee * 100).toFixed(2)],
    ];
  }

  if (key === 'takt') {
    const m = computeTaktMetrics(state.takt);
    const rows = [['Station', 'VA_Sec', 'BNVA_Sec', 'Waste_Sec', 'Total_Sec', 'Takt_Sec', 'Status']];
    state.takt.stations.forEach((s) => {
      const tot = s.va + s.bnva + s.waste;
      rows.push([s.name, s.va, s.bnva, s.waste, tot, m.takt.toFixed(2), tot > m.takt ? 'Over' : 'Balanced']);
    });
    return rows;
  }

  if (key === 'pareto') {
    const par = state.pareto;
    const sourceItems =
      par.mode === 'events'
        ? aggregateParetoEvents(par.events, { metric: par.metric, filterValue: par.filterValue })
        : par.items;
    const { rows: sorted } = computeParetoSorted(sourceItems);
    const rows = [['Category', 'Value', 'SharePct', 'CumulativePct', 'Class']];
    sorted.forEach((r) =>
      rows.push([r.name, r.count, r.share.toFixed(2), r.cum.toFixed(2), r.isVital ? 'Vital' : 'Trivial'])
    );
    return rows;
  }

  if (key === 'vsm') {
    const rows = [['Step', 'CycleSec', 'ChangeoverMin', 'UptimePct', 'Operators', 'QueueHrs']];
    state.vsm.steps.forEach((s) => rows.push([s.name, s.cycle, s.changeover, s.uptime, s.operators, s.queue]));
    return rows;
  }

  if (key === 'fives') {
    const rows = [['Pillar', 'Criterion', 'Score', 'Target']];
    state.fives.pillars.forEach((p) => {
      p.criteria.forEach((c) => rows.push([p.name, c.label, c.score, state.fives.target]));
    });
    return rows;
  }

  if (key === 'ishikawa') {
    const rows = [['Problem', 'Rib', 'Cause', 'RootSuspect']];
    Object.keys(state.ishikawa.ribs).forEach((rib) => {
      state.ishikawa.ribs[rib].forEach((c) => rows.push([state.ishikawa.problem, rib, c.text, c.root ? 'Yes' : 'No']));
    });
    return rows;
  }

  return [];
}

export function buildModuleCSV(state, key) {
  return getModuleMatrix(state, key).map(csvRow).join('\n');
}

export function buildModuleTSV(state, key) {
  return getModuleMatrix(state, key).map(tsvRow).join('\n');
}

export function downloadCSV(key) {
  const state = getState();
  if (key === 'all') {
    const keys = ['capability', 'oee', 'takt', 'pareto', 'vsm', 'fives', 'ishikawa'];
    const combined = keys.map((k) => `### ${TAB_NAMES[k].toUpperCase()} ###\n${buildModuleCSV(state, k)}`).join('\n\n');
    triggerDownload(`leansigma_all_tables_${dateStamp()}.csv`, combined, 'text/csv;charset=utf-8');
    showToast('Exported Combined CSV');
    return;
  }
  triggerDownload(`leansigma_${key}_${dateStamp()}.csv`, buildModuleCSV(state, key), 'text/csv;charset=utf-8');
  showToast(`Exported ${TAB_NAMES[key] || key} CSV`);
}

export async function copyModuleTSV(key) {
  try {
    const state = getState();
    const tsv = buildModuleTSV(state, key);
    if (!tsv) {
      showToast('No tabular data available to copy', true);
      return;
    }
    await copyToClipboard(tsv);
    showToast(`Copied ${TAB_NAMES[key] || key} table (Excel TSV ready)`);
  } catch (err) {
    showToast(err.message || 'Clipboard copy failed', true);
  }
}
