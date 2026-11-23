import { getState } from '../state.js';
import { copyToClipboard, dateStamp, formatPPM, triggerDownload } from '../utils.js';
import { computeEmpiricalCapability, computeParametricCapability } from '../modules/capabilityMath.js';
import { computeShiftLogOEE, computeSingleOEE } from '../modules/oeeMath.js';
import { computeTaktMetrics } from '../modules/taktMath.js';
import { aggregateParetoEvents, computeParetoSorted } from '../modules/paretoMath.js';
import { computeVSMMetrics, identifyVSMBottleneck } from '../modules/vsmMath.js';
import { compute5SMetrics } from '../modules/fivesMath.js';
import { showToast } from '../ui/toast.js';

export function buildMarkdownReport(state, timestampStr = new Date().toISOString()) {
  const capState = state.capability;
  const isCapData = capState.mode === 'data' && Array.isArray(capState.samples) && capState.samples.length >= 2;
  const capEmp = isCapData ? computeEmpiricalCapability(capState.samples, capState.lsl, capState.usl) : null;
  const capSim = !isCapData ? computeParametricCapability(capState) : null;

  const oeeState = state.oee;
  const isOeeLog = oeeState.mode === 'log' && Array.isArray(oeeState.logs) && oeeState.logs.length > 0;
  const oee = isOeeLog ? computeShiftLogOEE(oeeState.logs, oeeState.filterLine) : computeSingleOEE(oeeState);

  const takt = computeTaktMetrics(state.takt);

  const parItems =
    state.pareto.mode === 'events'
      ? aggregateParetoEvents(state.pareto.events, { metric: state.pareto.metric, filterValue: state.pareto.filterValue })
      : state.pareto.items;
  const par = computeParetoSorted(parItems);

  const vsm = computeVSMMetrics(state.vsm.steps);
  const vsmBottle = identifyVSMBottleneck(state.vsm.steps);
  const f5 = compute5SMetrics(state.fives);

  const lines = [];
  lines.push(`# LeanSigma Operational Excellence Report`);
  lines.push('');
  lines.push(`- **Scenario**: ${state.scenarioName || 'Custom Workspace'}`);
  lines.push(`- **Generated**: ${timestampStr}`);
  lines.push('');

  lines.push(`## 1. Process Capability (${isCapData ? `Empirical Data: ${capState.label || 'Measurements'}, n=${capEmp.n}` : 'Simulator'})`);
  lines.push('');
  if (capEmp) {
    lines.push(`| Metric | Value |`);
    lines.push(`| :--- | :--- |`);
    lines.push(`| Mean ($\bar{x}$) | ${capEmp.mean.toFixed(3)} ${capState.unit || ''} |`);
    lines.push(`| Overall $\sigma$ / Within $\hat{\sigma}$ | ${capEmp.overallSigma.toFixed(3)} / ${capEmp.withinSigma.toFixed(3)} |`);
    lines.push(`| Spec Limits (LSL – USL) | ${capEmp.lsl.toFixed(3)} – ${capEmp.usl.toFixed(3)} |`);
    lines.push(`| $C_p$ / $C_{pk}$ | ${capEmp.cp.toFixed(2)} / **${capEmp.cpk.toFixed(2)}** |`);
    lines.push(`| $P_p$ / $P_{pk}$ | ${capEmp.pp.toFixed(2)} / **${capEmp.ppk.toFixed(2)}** |`);
    lines.push(`| Observed OOS / PPM | ${capEmp.oobCount} (${formatPPM(capEmp.observedPPM)} PPM) |`);
    lines.push(`| I-MR Stability | ${capEmp.imr.isStable ? 'In Control' : `${capEmp.imr.oocIndices.length} Out-of-Control point(s)`} |`);
  } else {
    lines.push(`| Metric | Value |`);
    lines.push(`| :--- | :--- |`);
    lines.push(`| Mean ($\mu$) / $\sigma$ | ${capSim.mu.toFixed(2)} / ${capSim.sigma.toFixed(2)} |`);
    lines.push(`| $C_p$ / $C_{pk}$ | ${capSim.cp.toFixed(2)} / **${capSim.cpk.toFixed(2)}** |`);
    lines.push(`| Expected PPM / Sigma Level | ${formatPPM(capSim.ppm)} / ${capSim.zMin.toFixed(2)}σ |`);
  }
  lines.push('');

  lines.push(`## 2. OEE (${isOeeLog ? `${oee.shiftCount} Shift Logs, Filter: ${oeeState.filterLine || 'ALL'}` : 'Single Shift'})`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`| :--- | :--- |`);
  lines.push(`| **OEE** | **${(oee.oee * 100).toFixed(1)}%** |`);
  lines.push(`| Availability | ${(oee.avail * 100).toFixed(1)}% (${oee.runTime.toFixed(0)}m / ${oee.planned.toFixed(0)}m) |`);
  lines.push(`| Performance | ${(oee.perf * 100).toFixed(1)}% |`);
  lines.push(`| Quality | ${(oee.qual * 100).toFixed(1)}% (${oee.goodUnits.toLocaleString('en-US')} good / ${oee.safeScrap} scrap) |`);
  lines.push('');

  lines.push(`## 3. Takt & Line Balance`);
  lines.push('');
  lines.push(`- **Takt Time**: ${takt.takt.toFixed(1)}s`);
  lines.push(`- **Bottleneck**: ${takt.bottleneck.name} (${takt.bottleneck.total.toFixed(1)}s)`);
  lines.push(`- **Line Balance Efficiency**: ${takt.eff.toFixed(1)}% | **Min Headcount**: ${takt.headcount.toFixed(2)}`);
  lines.push('');

  lines.push(`## 4. Pareto 80/20 Analysis`);
  lines.push('');
  lines.push(`- **Total**: ${par.total} | **Vital Few Driving 80%**: ${par.vitalCount} of ${par.rows.length}`);
  if (par.rows.length > 0) {
    lines.push('');
    lines.push(`| Category | Value | Share | Cumulative | Class |`);
    lines.push(`| :--- | :--- | :--- | :--- | :--- |`);
    par.rows.slice(0, 8).forEach((r) => {
      lines.push(`| ${r.name} | ${r.count} | ${r.share.toFixed(1)}% | ${r.cum.toFixed(1)}% | ${r.isVital ? 'Vital' : 'Trivial'} |`);
    });
  }
  lines.push('');

  lines.push(`## 5. Value Stream Map (VSM)`);
  lines.push('');
  lines.push(`- **Total Lead Time**: ${vsm.totalLeadHrs.toFixed(2)}h (${(vsm.totalLeadHrs / 24).toFixed(2)} days)`);
  lines.push(`- **Value-Added Time**: ${vsm.totalVASec.toFixed(0)}s | **PCE**: ${vsm.pce.toFixed(2)}%`);
  if (vsmBottle) {
    lines.push(`- **Cycle Bottleneck Step**: ${vsmBottle.name} (${vsmBottle.cycle}s cycle, ${vsmBottle.queue}h queue)`);
  }
  lines.push('');

  lines.push(`## 6. 5S Workplace Audit`);
  lines.push('');
  lines.push(`- **Overall Score**: ${f5.overallPct.toFixed(1)}% (${f5.overallMean.toFixed(2)} / 5.00 vs Target ${f5.target.toFixed(2)})`);
  lines.push(`- **Lowest Pillar**: ${f5.lowest.name} (${f5.lowest.avg.toFixed(2)}) | **Open Actions**: ${f5.openActions}`);
  lines.push('');

  lines.push(`## 7. Ishikawa Root Cause Summary`);
  lines.push('');
  lines.push(`- **Problem Statement**: ${state.ishikawa.problem}`);
  const rootSuspects = [];
  Object.entries(state.ishikawa.ribs || {}).forEach(([rib, causes]) => {
    causes.forEach((c) => {
      if (c.root) rootSuspects.push(`${rib}: ${c.text}`);
    });
  });
  lines.push(`- **Root Suspects (${rootSuspects.length})**:`);
  if (rootSuspects.length === 0) {
    lines.push(`  - None flagged yet`);
  } else {
    rootSuspects.forEach((rs) => lines.push(`  - ${rs}`));
  }

  return lines.join('\n');
}

export function downloadMarkdown() {
  const md = buildMarkdownReport(getState());
  triggerDownload(`leansigma_report_${dateStamp()}.md`, md, 'text/markdown;charset=utf-8');
  showToast('Downloaded Markdown Executive Report');
}

export async function copyMarkdown() {
  try {
    const md = buildMarkdownReport(getState());
    await copyToClipboard(md);
    showToast('Copied Markdown Report to clipboard');
  } catch (err) {
    showToast(err.message || 'Clipboard copy failed', true);
  }
}
