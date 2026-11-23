export function computeTaktMetrics(taktState) {
  const avail = Math.max(1, Number(taktState?.available) || 1);
  const demand = Math.max(1, Number(taktState?.demand) || 1);
  const takt = avail / demand;
  const stations = Array.isArray(taktState?.stations) ? taktState.stations : [];
  let totalCycle = 0;
  let bottleneck = { name: 'None', total: 0 };

  stations.forEach((s) => {
    const tot = (Number(s.va) || 0) + (Number(s.bnva) || 0) + (Number(s.waste) || 0);
    totalCycle += tot;
    if (tot > bottleneck.total) bottleneck = { name: s.name, total: tot };
  });

  const eff =
    stations.length > 0 && bottleneck.total > 0
      ? (totalCycle / (stations.length * bottleneck.total)) * 100
      : 0;
  const headcount = takt > 0 ? totalCycle / takt : 0;
  return { avail, demand, takt, totalCycle, bottleneck, eff, headcount };
}
