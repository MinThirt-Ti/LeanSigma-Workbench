export function computeSingleOEE({ shift, downtime, cycle, output, scrap }) {
  const planned = Math.max(1, Number(shift) || 0);
  const availLoss = Math.min(planned, Math.max(0, Number(downtime) || 0));
  const runTime = Math.max(0, planned - availLoss);
  const avail = runTime / planned;

  const safeCycle = Math.max(0.1, Number(cycle) || 1);
  const safeOutput = Math.max(0, Number(output) || 0);
  const idealRunMin = (safeOutput * safeCycle) / 60;
  const perf = runTime > 0 ? idealRunMin / runTime : 0;
  const netRunTime = Math.min(runTime, idealRunMin);
  const perfLoss = Math.max(0, runTime - netRunTime);

  const safeScrap = Math.min(safeOutput, Math.max(0, Number(scrap) || 0));
  const goodUnits = Math.max(0, safeOutput - safeScrap);
  const qual = safeOutput > 0 ? goodUnits / safeOutput : 0;

  const prodTime = Math.min(netRunTime, (goodUnits * safeCycle) / 60);
  const qualLoss = Math.max(0, netRunTime - prodTime);

  const oee = avail * perf * qual;
  return {
    planned,
    availLoss,
    runTime,
    perfLoss,
    netRunTime,
    qualLoss,
    prodTime,
    avail,
    perf,
    qual,
    oee,
    goodUnits,
    safeScrap,
    output: safeOutput,
  };
}

export function computeShiftLogOEE(logs, filterLine = 'ALL') {
  const allLogs = Array.isArray(logs) ? logs : [];
  const lines = Array.from(new Set(allLogs.map((l) => String(l.line || '').trim()).filter(Boolean)));
  const activeLogs =
    filterLine && filterLine !== 'ALL'
      ? allLogs.filter((l) => String(l.line || '').trim() === filterLine)
      : allLogs;

  if (activeLogs.length === 0) {
    return {
      ...computeSingleOEE({ shift: 480, downtime: 0, cycle: 30, output: 0, scrap: 0 }),
      shiftCount: 0,
      lines,
      worstShift: null,
      series: [],
    };
  }

  let totalPlanned = 0;
  let totalDowntime = 0;
  let totalIdealRunMin = 0;
  let totalOutput = 0;
  let totalScrap = 0;
  let totalGood = 0;
  let totalProdTime = 0;

  const series = activeLogs.map((row) => {
    const m = computeSingleOEE({
      shift: row.planned,
      downtime: row.downtime,
      cycle: row.cycle,
      output: row.output,
      scrap: row.scrap,
    });
    totalPlanned += m.planned;
    totalDowntime += m.availLoss;
    const idealMin = (m.output * Math.max(0.1, Number(row.cycle) || 1)) / 60;
    totalIdealRunMin += idealMin;
    totalOutput += m.output;
    totalScrap += m.safeScrap;
    totalGood += m.goodUnits;
    totalProdTime += (m.goodUnits * Math.max(0.1, Number(row.cycle) || 1)) / 60;

    return {
      id: row.id,
      date: row.date || '',
      shiftName: row.shiftName || '',
      line: row.line || '',
      label: `${(row.date || '').slice(5)} ${row.shiftName || ''}`.trim() || `#${row.id}`,
      avail: m.avail,
      perf: m.perf,
      qual: m.qual,
      oee: m.oee,
      goodUnits: m.goodUnits,
    };
  });

  const planned = Math.max(1, totalPlanned);
  const availLoss = Math.min(planned, totalDowntime);
  const runTime = Math.max(0, planned - availLoss);
  const avail = runTime / planned;

  const perf = runTime > 0 ? totalIdealRunMin / runTime : 0;
  const netRunTime = Math.min(runTime, totalIdealRunMin);
  const perfLoss = Math.max(0, runTime - netRunTime);

  const qual = totalOutput > 0 ? totalGood / totalOutput : 0;
  const prodTime = Math.min(netRunTime, totalProdTime);
  const qualLoss = Math.max(0, netRunTime - prodTime);

  const oee = avail * perf * qual;

  let worstShift = series[0];
  for (const s of series) {
    if (s.oee < worstShift.oee) worstShift = s;
  }

  return {
    planned,
    availLoss,
    runTime,
    perfLoss,
    netRunTime,
    qualLoss,
    prodTime,
    avail,
    perf,
    qual,
    oee,
    goodUnits: totalGood,
    safeScrap: totalScrap,
    output: totalOutput,
    shiftCount: activeLogs.length,
    lines,
    worstShift,
    series,
  };
}
