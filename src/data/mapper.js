import { isNumericToken } from './parser.js';

export const MODULE_SCHEMAS = {
  capability: {
    label: 'Capability (Measurements)',
    fields: [
      {
        key: 'value',
        label: 'Measurement Value',
        type: 'number',
        required: true,
        aliases: /^(val|value|meas|measurement|reading|dim|dimension|diam|diameter|weight|thick|thickness|data|sample|result|score|x)$/i,
      },
    ],
  },
  oee: {
    label: 'OEE (Shift Production Log)',
    fields: [
      {
        key: 'date',
        label: 'Date',
        type: 'date',
        required: false,
        aliases: /^(date|day|timestamp|shift_date|prod_date)$/i,
      },
      {
        key: 'shiftName',
        label: 'Shift Name',
        type: 'text',
        required: false,
        aliases: /^(shift_name|shift_id|shift|crew|period)$/i,
      },
      {
        key: 'line',
        label: 'Line / Machine',
        type: 'text',
        required: false,
        aliases: /^(line|machine|asset|cell|equip|equipment|workcenter|station)$/i,
      },
      {
        key: 'planned',
        label: 'Planned Time (min)',
        type: 'number',
        required: true,
        aliases: /^(planned|planned_min|planned_time|shift_min|avail_min|sched|scheduled_min)$/i,
      },
      {
        key: 'downtime',
        label: 'Downtime (min)',
        type: 'number',
        required: true,
        aliases: /^(downtime|downtime_min|down|stop|stop_min|loss_min|breakdown)$/i,
      },
      {
        key: 'cycle',
        label: 'Ideal Cycle (sec)',
        type: 'number',
        required: true,
        aliases: /^(cycle|cycle_sec|ideal_cycle|ct|ideal_ct|std_cycle)$/i,
      },
      {
        key: 'output',
        label: 'Total Output (units)',
        type: 'number',
        required: true,
        aliases: /^(output|total_output|total|total_qty|qty|count|prod|produced|units|parts)$/i,
      },
      {
        key: 'scrap',
        label: 'Scrap / Rejects (units)',
        type: 'number',
        required: false,
        aliases: /^(scrap|scrap_qty|reject|rejects|ng|ng_qty|defect|defects|bad)$/i,
      },
    ],
  },
  pareto: {
    label: 'Pareto (Defect / Downtime Log)',
    fields: [
      {
        key: 'category',
        label: 'Defect / Reason Category',
        type: 'text',
        required: true,
        aliases: /^(defect|defect_reason|reason|cause|category|code|issue|mode|type|failure|problem|stop_reason)$/i,
      },
      {
        key: 'weight',
        label: 'Weight (Cost / Duration / Qty)',
        type: 'number',
        required: false,
        aliases: /^(cost|scrap_cost|scrap_cost_usd|duration|mins|min|minutes|hours|hrs|loss|count|qty|amount|value|weight|rework)$/i,
      },
      {
        key: 'group',
        label: 'Line / Shift Group',
        type: 'text',
        required: false,
        aliases: /^(line|machine|shift|area|dept|station|cell|group)$/i,
      },
    ],
  },
  takt: {
    label: 'Takt (Workstations)',
    fields: [
      {
        key: 'name',
        label: 'Station Name',
        type: 'text',
        required: true,
        aliases: /^(station|workstation|step|op|operation|process|name)$/i,
      },
      {
        key: 'va',
        label: 'Value-Added (sec)',
        type: 'number',
        required: true,
        aliases: /^(va|va_sec|value|value_add|cycle|ct|cycle_sec)$/i,
      },
      {
        key: 'bnva',
        label: 'BNVA (sec)',
        type: 'number',
        required: false,
        aliases: /^(bnva|bnva_sec|nva_req|support|essential_nva)$/i,
      },
      {
        key: 'waste',
        label: 'Waste (sec)',
        type: 'number',
        required: false,
        aliases: /^(waste|waste_sec|muda|wait|nva)$/i,
      },
    ],
  },
  vsm: {
    label: 'VSM (Process Chain Steps)',
    fields: [
      {
        key: 'name',
        label: 'Step Name',
        type: 'text',
        required: true,
        aliases: /^(step|process|station|op|operation|name)$/i,
      },
      {
        key: 'cycle',
        label: 'Cycle Time (sec)',
        type: 'number',
        required: true,
        aliases: /^(cycle|cycle_sec|ct|va|va_sec)$/i,
      },
      {
        key: 'changeover',
        label: 'Changeover (min)',
        type: 'number',
        required: false,
        aliases: /^(changeover|changeover_min|co|c_o|setup|setup_min)$/i,
      },
      {
        key: 'uptime',
        label: 'Uptime (%)',
        type: 'number',
        required: false,
        aliases: /^(uptime|uptime_pct|avail|availability|oee)$/i,
      },
      {
        key: 'operators',
        label: 'Operators',
        type: 'number',
        required: false,
        aliases: /^(ops|operators|headcount|hc|staff)$/i,
      },
      {
        key: 'queue',
        label: 'Queue Wait (hrs)',
        type: 'number',
        required: false,
        aliases: /^(queue|queue_hrs|wait|wip|inv|inventory|lead|lead_hrs)$/i,
      },
    ],
  },
};

export function parseCleanNumber(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
  const s = String(val == null ? '' : val).trim();
  if (!s) return NaN;
  const cleaned = s.replace(/[$,%\s]/g, '').replace(/,/g, '');
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function isLikelyDate(val) {
  const s = String(val == null ? '' : val).trim();
  if (!s || isNumericToken(s)) return false;
  return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s);
}

/**
 * Classifies each column as 'number', 'date', or 'text' from sample rows.
 */
export function detectColumnTypes(headers, rows) {
  const sample = rows.slice(0, 50);
  return headers.map((_, colIdx) => {
    const vals = sample.map((r) => String(r[colIdx] == null ? '' : r[colIdx]).trim()).filter(Boolean);
    if (vals.length === 0) return 'text';
    const numCount = vals.filter((v) => isNumericToken(v)).length;
    if (numCount / vals.length >= 0.8) return 'number';
    const dateCount = vals.filter((v) => isLikelyDate(v)).length;
    if (dateCount / vals.length >= 0.7) return 'date';
    return 'text';
  });
}

function normalizeHeaderToken(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Suggests column index mapping { fieldKey: colIndex | -1 } using header regexes and column types.
 */
export function suggestMapping(headers, rows, moduleKey) {
  const schema = MODULE_SCHEMAS[moduleKey];
  if (!schema) return {};

  const types = detectColumnTypes(headers, rows);
  const usedCols = new Set();
  const mapping = {};

  const scoreCandidate = (field, colIdx) => {
    const rawHeader = String(headers[colIdx] || '').trim();
    const normHeader = normalizeHeaderToken(rawHeader);
    const colType = types[colIdx];
    let score = 0;

    if (field.aliases.test(normHeader) || field.aliases.test(rawHeader)) {
      score += 100;
    } else {
      // Partial substring containment bonus
      const parts = field.aliases.source.replace(/^\^\(|\)\$$/g, '').split('|');
      if (parts.some((p) => p.length >= 3 && normHeader.includes(p))) {
        score += 45;
      }
    }

    if (field.type === colType) score += 20;
    else if (field.type === 'number' && colType !== 'number') score -= 60;
    else if (field.type === 'text' && colType === 'number') score -= 30;

    return score;
  };

  schema.fields.forEach((field) => {
    let bestIdx = -1;
    let bestScore = 0;
    for (let c = 0; c < headers.length; c++) {
      if (usedCols.has(c)) continue;
      const sc = scoreCandidate(field, c);
      if (sc > bestScore) {
        bestScore = sc;
        bestIdx = c;
      }
    }
    if (bestIdx !== -1 && bestScore >= 35) {
      mapping[field.key] = bestIdx;
      usedCols.add(bestIdx);
    } else {
      mapping[field.key] = -1;
    }
  });

  // Fallback for single-column or unlabeled numeric capability paste
  if (moduleKey === 'capability' && mapping.value === -1) {
    const firstNum = types.findIndex((t) => t === 'number');
    if (firstNum !== -1) mapping.value = firstNum;
  }

  // Fallback for Pareto category if only one text column exists
  if (moduleKey === 'pareto' && mapping.category === -1) {
    const firstText = types.findIndex((t, idx) => t === 'text' && !usedCols.has(idx));
    if (firstText !== -1) mapping.category = firstText;
  }

  return mapping;
}

/**
 * Converts raw table rows into typed module records according to user-confirmed mapping.
 */
export function transformMappedRows(headers, rows, mapping, moduleKey) {
  const schema = MODULE_SCHEMAS[moduleKey];
  if (!schema) throw new Error(`Unknown target module: ${moduleKey}`);

  const warnings = [];
  schema.fields.forEach((f) => {
    if (f.required && (mapping[f.key] == null || mapping[f.key] < 0 || mapping[f.key] >= headers.length)) {
      warnings.push(`Required field "${f.label}" is not mapped`);
    }
  });
  if (warnings.length > 0) {
    return { data: [], importedCount: 0, skippedCount: rows.length, warnings };
  }

  const getCell = (row, key) => {
    const idx = mapping[key];
    if (idx == null || idx < 0 || idx >= row.length) return '';
    return row[idx];
  };

  const data = [];
  let skippedCount = 0;

  if (moduleKey === 'capability') {
    for (const row of rows) {
      const val = parseCleanNumber(getCell(row, 'value'));
      if (Number.isFinite(val)) data.push(val);
      else skippedCount++;
    }
  } else if (moduleKey === 'oee') {
    let id = 1;
    for (const row of rows) {
      const planned = parseCleanNumber(getCell(row, 'planned'));
      const downtime = parseCleanNumber(getCell(row, 'downtime'));
      const cycle = parseCleanNumber(getCell(row, 'cycle'));
      const output = parseCleanNumber(getCell(row, 'output'));
      const scrapRaw = parseCleanNumber(getCell(row, 'scrap'));
      if (!Number.isFinite(planned) || !Number.isFinite(downtime) || !Number.isFinite(cycle) || !Number.isFinite(output)) {
        skippedCount++;
        continue;
      }
      data.push({
        id: id++,
        date: String(getCell(row, 'date') || '').trim() || new Date().toISOString().slice(0, 10),
        shiftName: String(getCell(row, 'shiftName') || '').trim() || `Shift ${id - 1}`,
        line: String(getCell(row, 'line') || '').trim() || 'Line-1',
        planned: Math.max(1, planned),
        downtime: Math.max(0, downtime),
        cycle: Math.max(0.1, cycle),
        output: Math.max(0, output),
        scrap: Number.isFinite(scrapRaw) ? Math.max(0, scrapRaw) : 0,
      });
    }
  } else if (moduleKey === 'pareto') {
    let id = 1;
    for (const row of rows) {
      const category = String(getCell(row, 'category') || '').trim();
      if (!category) {
        skippedCount++;
        continue;
      }
      const wRaw = parseCleanNumber(getCell(row, 'weight'));
      const weight = Number.isFinite(wRaw) ? Math.max(0, wRaw) : 1;
      const group = String(getCell(row, 'group') || '').trim() || 'All';
      data.push({ id: id++, category, weight, group });
    }
  } else if (moduleKey === 'takt') {
    let id = 1;
    for (const row of rows) {
      const name = String(getCell(row, 'name') || '').trim();
      const va = parseCleanNumber(getCell(row, 'va'));
      if (!name || !Number.isFinite(va)) {
        skippedCount++;
        continue;
      }
      const bnva = parseCleanNumber(getCell(row, 'bnva'));
      const waste = parseCleanNumber(getCell(row, 'waste'));
      data.push({
        id: id++,
        name,
        va: Math.max(0, va),
        bnva: Number.isFinite(bnva) ? Math.max(0, bnva) : 0,
        waste: Number.isFinite(waste) ? Math.max(0, waste) : 0,
      });
    }
  } else if (moduleKey === 'vsm') {
    let id = 1;
    for (const row of rows) {
      const name = String(getCell(row, 'name') || '').trim();
      const cycle = parseCleanNumber(getCell(row, 'cycle'));
      if (!name || !Number.isFinite(cycle)) {
        skippedCount++;
        continue;
      }
      const changeover = parseCleanNumber(getCell(row, 'changeover'));
      const uptime = parseCleanNumber(getCell(row, 'uptime'));
      const operators = parseCleanNumber(getCell(row, 'operators'));
      const queue = parseCleanNumber(getCell(row, 'queue'));
      data.push({
        id: id++,
        name,
        cycle: Math.max(0.1, cycle),
        changeover: Number.isFinite(changeover) ? Math.max(0, changeover) : 10,
        uptime: Number.isFinite(uptime) ? Math.min(100, Math.max(1, uptime)) : 95,
        operators: Number.isFinite(operators) ? Math.max(1, Math.round(operators)) : 1,
        queue: Number.isFinite(queue) ? Math.max(0, queue) : 2.0,
      });
    }
  }

  return {
    data,
    importedCount: data.length,
    skippedCount,
    warnings,
  };
}
