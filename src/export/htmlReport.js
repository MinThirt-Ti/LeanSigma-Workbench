import { getState } from '../state.js';
import { dateStamp, escapeHtml, formatPPM, triggerDownload } from '../utils.js';
import { computeEmpiricalCapability, computeParametricCapability } from '../modules/capabilityMath.js';
import { computeShiftLogOEE, computeSingleOEE } from '../modules/oeeMath.js';
import { computeTaktMetrics } from '../modules/taktMath.js';
import { aggregateParetoEvents, computeParetoSorted } from '../modules/paretoMath.js';
import { computeVSMMetrics } from '../modules/vsmMath.js';
import { compute5SMetrics } from '../modules/fivesMath.js';
import { serializeStandaloneSVG } from './svg.js';
import { showToast } from '../ui/toast.js';

export function downloadHTMLReport(renderAll) {
  if (renderAll) renderAll();
  const state = getState();

  const isCapData = state.capability.mode === 'data' && Array.isArray(state.capability.samples) && state.capability.samples.length >= 2;
  const capEmp = isCapData ? computeEmpiricalCapability(state.capability.samples, state.capability.lsl, state.capability.usl) : null;
  const capSim = !isCapData ? computeParametricCapability(state.capability) : null;

  const isOeeLog = state.oee.mode === 'log' && Array.isArray(state.oee.logs) && state.oee.logs.length > 0;
  const oee = isOeeLog ? computeShiftLogOEE(state.oee.logs, state.oee.filterLine) : computeSingleOEE(state.oee);

  const takt = computeTaktMetrics(state.takt);
  const parItems =
    state.pareto.mode === 'events'
      ? aggregateParetoEvents(state.pareto.events, { metric: state.pareto.metric, filterValue: state.pareto.filterValue })
      : state.pareto.items;
  const par = computeParetoSorted(parItems);
  const vsm = computeVSMMetrics(state.vsm.steps);
  const f5 = compute5SMetrics(state.fives);
  const nowStr = new Date().toLocaleString();

  const svgSnap = (k) => (serializeStandaloneSVG(k) || '').replace(/^<\?xml[^>]*\?>\s*/, '');

  const capCards = capEmp
    ? `
      <div class="kpi"><div class="kpi-l">Cp</div><div class="kpi-v">${capEmp.cp.toFixed(2)}</div></div>
      <div class="kpi"><div class="kpi-l">Cpk (Within)</div><div class="kpi-v">${capEmp.cpk.toFixed(2)}</div></div>
      <div class="kpi"><div class="kpi-l">Ppk (Overall)</div><div class="kpi-v">${capEmp.ppk.toFixed(2)}</div></div>
      <div class="kpi"><div class="kpi-l">Obs PPM</div><div class="kpi-v">${formatPPM(capEmp.observedPPM)}</div></div>
      <div class="kpi"><div class="kpi-l">Samples</div><div class="kpi-v">${capEmp.n}</div></div>
      <div class="kpi"><div class="kpi-l">I-MR Stability</div><div class="kpi-v">${capEmp.imr.isStable ? 'Stable' : `${capEmp.imr.oocIndices.length} OOC`}</div></div>`
    : `
      <div class="kpi"><div class="kpi-l">Cp</div><div class="kpi-v">${capSim.cp.toFixed(2)}</div></div>
      <div class="kpi"><div class="kpi-l">Cpk</div><div class="kpi-v">${capSim.cpk.toFixed(2)}</div></div>
      <div class="kpi"><div class="kpi-l">Cpu</div><div class="kpi-v">${capSim.cpu.toFixed(2)}</div></div>
      <div class="kpi"><div class="kpi-l">Cpl</div><div class="kpi-v">${capSim.cpl.toFixed(2)}</div></div>
      <div class="kpi"><div class="kpi-l">PPM</div><div class="kpi-v">${formatPPM(capSim.ppm)}</div></div>
      <div class="kpi"><div class="kpi-l">Sigma</div><div class="kpi-v">${capSim.zMin.toFixed(2)}σ</div></div>`;

  const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LeanSigma Executive Report</title>
  <style>
    body { background: #0A113E; color: #B4DDD8; font-family: Inter, system-ui, sans-serif; margin: 0; padding: 32px; }
    .wrap { max-width: 1080px; margin: 0 auto; }
    .hdr { background: #111952; border: 2px solid #D929CF; border-radius: 8px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { margin: 0; color: #E9C7C5; font-size: 24px; letter-spacing: 1px; }
    h2 { color: #E9C7C5; margin: 0 0 12px 0; font-size: 18px; border-bottom: 2px solid #253182; padding-bottom: 6px; }
    .sec { background: #111952; border: 2px solid #253182; border-radius: 8px; padding: 20px; margin-bottom: 24px; page-break-inside: avoid; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpi { background: #0A113E; border: 2px solid #253182; border-radius: 6px; padding: 12px; }
    .kpi-l { font-size: 11px; text-transform: uppercase; color: #E9C7C5; font-weight: 700; }
    .kpi-v { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 20px; font-weight: 700; color: #45E1A5; margin-top: 4px; }
    .svg-box { background: #0A113E; border: 2px solid #253182; border-radius: 6px; padding: 8px; }
    .svg-box svg { width: 100%; height: auto; display: block; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; color: #59A8A2; }
    @media print {
      body { background: #FFFFFF; color: #0A113E; padding: 12px; }
      .hdr, .sec, .kpi { background: #FFFFFF; color: #0A113E; border-color: #253182; }
      h1, h2, .kpi-l { color: #0A113E; }
      .kpi-v { color: #0A113E; }
      .sec { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <div>
        <h1>LEANSIGMA EXECUTIVE REPORT</h1>
        <div class="mono">${escapeHtml(state.scenarioName || 'Operational Excellence Snapshot')}</div>
      </div>
      <div class="mono">${escapeHtml(nowStr)}</div>
    </div>

    <div class="sec">
      <h2>Capability (${isCapData ? `Data Mode: ${escapeHtml(state.capability.label || 'Measurements')}` : 'Simulator Mode'})</h2>
      <div class="kpi-grid">${capCards}</div>
      <div class="svg-box">${svgSnap('capability')}</div>
    </div>

    <div class="sec">
      <h2>OEE (${isOeeLog ? `Shift Log: ${oee.shiftCount} Shifts` : 'Single Shift'})</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-l">OEE</div><div class="kpi-v">${(oee.oee * 100).toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-l">Availability</div><div class="kpi-v">${(oee.avail * 100).toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-l">Performance</div><div class="kpi-v">${(oee.perf * 100).toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-l">Quality</div><div class="kpi-v">${(oee.qual * 100).toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-l">Good Units</div><div class="kpi-v">${oee.goodUnits}</div></div>
      </div>
      <div class="svg-box">${svgSnap('oee')}</div>
    </div>

    <div class="sec">
      <h2>Takt</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-l">Takt</div><div class="kpi-v">${takt.takt.toFixed(1)}s</div></div>
        <div class="kpi"><div class="kpi-l">Bottleneck</div><div class="kpi-v">${takt.bottleneck.total.toFixed(1)}s</div></div>
        <div class="kpi"><div class="kpi-l">Efficiency</div><div class="kpi-v">${takt.eff.toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-l">Headcount</div><div class="kpi-v">${takt.headcount.toFixed(2)}</div></div>
      </div>
      <div class="svg-box">${svgSnap('takt')}</div>
    </div>

    <div class="sec">
      <h2>Pareto</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-l">Total</div><div class="kpi-v">${par.total}</div></div>
        <div class="kpi"><div class="kpi-l">Vital</div><div class="kpi-v">${par.vitalCount}</div></div>
        <div class="kpi"><div class="kpi-l">Top</div><div class="kpi-v">${par.rows[0] ? escapeHtml(par.rows[0].name) : 'None'}</div></div>
      </div>
      <div class="svg-box">${svgSnap('pareto')}</div>
    </div>

    <div class="sec">
      <h2>VSM</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-l">Lead Time</div><div class="kpi-v">${vsm.totalLeadHrs.toFixed(2)}h</div></div>
        <div class="kpi"><div class="kpi-l">Value Time</div><div class="kpi-v">${vsm.totalVASec.toFixed(0)}s</div></div>
        <div class="kpi"><div class="kpi-l">PCE</div><div class="kpi-v">${vsm.pce.toFixed(2)}%</div></div>
        <div class="kpi"><div class="kpi-l">Steps</div><div class="kpi-v">${vsm.count}</div></div>
      </div>
      <div class="svg-box">${svgSnap('vsm')}</div>
    </div>

    <div class="sec">
      <h2>5S</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-l">Score</div><div class="kpi-v">${f5.overallPct.toFixed(1)}%</div></div>
        <div class="kpi"><div class="kpi-l">Target</div><div class="kpi-v">${f5.target.toFixed(2)}</div></div>
        <div class="kpi"><div class="kpi-l">Lowest</div><div class="kpi-v">${escapeHtml(f5.lowest.name)}</div></div>
        <div class="kpi"><div class="kpi-l">Actions</div><div class="kpi-v">${f5.openActions}</div></div>
      </div>
      <div class="svg-box">${svgSnap('fives')}</div>
    </div>

    <div class="sec">
      <h2>Ishikawa</h2>
      <div class="mono" style="margin-bottom:12px;">Problem: ${escapeHtml(state.ishikawa.problem)}</div>
      <div class="svg-box">${svgSnap('ishikawa')}</div>
    </div>
  </div>
</body>
</html>`;

  triggerDownload(`leansigma_executive_report_${dateStamp()}.html`, reportHtml, 'text/html;charset=utf-8');
  showToast('Downloaded Executive HTML Report');
}
