export function computeVSMMetrics(steps) {
  const list = Array.isArray(steps) ? steps : [];
  const totalVASec = list.reduce((a, s) => a + Math.max(0, Number(s.cycle) || 0), 0);
  const totalQueueHrs = list.reduce((a, s) => a + Math.max(0, Number(s.queue) || 0), 0);
  const totalLeadSec = totalQueueHrs * 3600 + totalVASec;
  const totalLeadHrs = totalLeadSec / 3600;
  const pce = totalLeadSec > 0 ? (totalVASec / totalLeadSec) * 100 : 0;
  const totalOps = list.reduce((a, s) => a + Math.max(0, Number(s.operators) || 0), 0);
  return { totalVASec, totalQueueHrs, totalLeadSec, totalLeadHrs, pce, totalOps, count: list.length };
}

export function identifyVSMBottleneck(steps) {
  const list = Array.isArray(steps) ? steps : [];
  if (list.length === 0) return null;
  let bottleneck = list[0];
  for (const s of list) {
    if ((Number(s.cycle) || 0) > (Number(bottleneck.cycle) || 0)) {
      bottleneck = s;
    }
  }
  return bottleneck;
}
