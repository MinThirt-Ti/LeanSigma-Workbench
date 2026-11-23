export function aggregateParetoEvents(events, { metric = 'count', filterValue = 'ALL' } = {}) {
  const list = Array.isArray(events) ? events : [];
  const filtered =
    filterValue && filterValue !== 'ALL'
      ? list.filter((e) => String(e.group || '').trim() === filterValue)
      : list;

  const grouped = new Map();
  for (const ev of filtered) {
    const name = String(ev.category || '').trim() || 'Uncategorized';
    const inc = metric === 'weight' ? Math.max(0, Number(ev.weight) || 0) : 1;
    grouped.set(name, (grouped.get(name) || 0) + inc);
  }

  let id = 1;
  return Array.from(grouped.entries()).map(([name, count]) => ({
    id: id++,
    name,
    count: Math.round(count * 100) / 100,
  }));
}

export function getParetoGroups(events) {
  return Array.from(
    new Set(
      (Array.isArray(events) ? events : [])
        .map((e) => String(e.group || '').trim())
        .filter((g) => g && g !== 'All')
    )
  );
}

export function computeParetoSorted(items) {
  const sorted = [...(Array.isArray(items) ? items : [])]
    .map((it) => ({ ...it, count: Math.max(0, Number(it.count) || 0) }))
    .sort((a, b) => b.count - a.count);
  const total = sorted.reduce((acc, it) => acc + it.count, 0);
  let running = 0;
  let vitalCount = 0;
  let reached80 = false;

  const rows = sorted.map((it, idx) => {
    const prevCum = total > 0 ? (running / total) * 100 : 0;
    running += it.count;
    const share = total > 0 ? (it.count / total) * 100 : 0;
    const cum = total > 0 ? (running / total) * 100 : 0;
    const isVital = !reached80 && total > 0;
    if (isVital) {
      vitalCount++;
      if (cum >= 80) reached80 = true;
    }
    return { ...it, share, cum, prevCum, isVital, isTop: idx === 0 && it.count > 0 };
  });

  return { rows, total, vitalCount };
}
