export function compute5SMetrics(fivesState) {
  const pillarsList = Array.isArray(fivesState?.pillars) ? fivesState.pillars : [];
  const pillars = pillarsList.map((p) => {
    const crit = Array.isArray(p.criteria) && p.criteria.length > 0 ? p.criteria : [{ score: 0 }];
    const avg = crit.reduce((a, c) => a + (Number(c.score) || 0), 0) / crit.length;
    return { name: p.name, avg };
  });

  const overallMean = pillars.length > 0 ? pillars.reduce((a, p) => a + p.avg, 0) / pillars.length : 0;
  const overallPct = (overallMean / 5) * 100;
  let lowest = pillars[0] || { name: 'None', avg: 0 };
  pillars.forEach((p) => {
    if (p.avg < lowest.avg) lowest = p;
  });
  const actions = Array.isArray(fivesState?.actions) ? fivesState.actions : [];
  const openActions = actions.filter((a) => a.status === 'Open').length;
  return {
    pillars,
    overallMean,
    overallPct,
    lowest,
    openActions,
    target: Number(fivesState?.target) || 4.0,
  };
}
