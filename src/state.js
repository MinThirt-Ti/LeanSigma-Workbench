import { SAMPLE_SCENARIOS, STORAGE_KEY } from './constants.js';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function defaultSource(label) {
  return { kind: 'sample', label: `Sample: ${label}` };
}

/**
 * Generates deep-cloned factory defaults for all 7 analytical modules.
 */
export function createDefaultState(scenarioKey = 'cnc') {
  const src = SAMPLE_SCENARIOS[scenarioKey] || SAMPLE_SCENARIOS.cnc;
  const cloned = deepClone(src);
  const srcBadge = defaultSource(cloned.label);
  return {
    activeTab: 'capability',
    scenarioKey: cloned.key,
    scenarioName: cloned.label,
    capability: { ...cloned.capability, source: { ...srcBadge } },
    oee: { ...cloned.oee, source: { ...srcBadge } },
    takt: { ...cloned.takt, source: { ...srcBadge } },
    pareto: { ...cloned.pareto, source: { ...srcBadge } },
    vsm: { ...cloned.vsm, source: { ...srcBadge } },
    fives: { ...cloned.fives, source: { ...srcBadge } },
    ishikawa: { ...cloned.ishikawa, source: { ...srcBadge } },
  };
}

/**
 * Deep-merges saved v1/v2 workspace payloads against current defaults so older
 * JSON snapshots or localStorage state migrate cleanly without missing fields.
 */
export function migrateState(parsed) {
  const def = createDefaultState();
  if (!parsed || typeof parsed !== 'object') return def;

  const fallbackSource = (mod, defSrc) =>
    mod && mod.source && mod.source.label ? mod.source : { ...defSrc };

  const cap = { ...def.capability, ...(parsed.capability || {}) };
  if (!Array.isArray(cap.samples)) cap.samples = def.capability.samples;
  if (!cap.mode) cap.mode = Array.isArray(parsed.capability?.samples) ? 'data' : 'simulator';
  if (!cap.distModel) cap.distModel = 'auto';
  cap.source = fallbackSource(parsed.capability, def.capability.source);

  const oee = { ...def.oee, ...(parsed.oee || {}) };
  if (!Array.isArray(oee.logs)) oee.logs = def.oee.logs;
  if (!oee.mode) oee.mode = Array.isArray(parsed.oee?.logs) ? 'log' : 'single';
  if (!oee.filterLine) oee.filterLine = 'ALL';
  oee.source = fallbackSource(parsed.oee, def.oee.source);

  const takt = { ...def.takt, ...(parsed.takt || {}) };
  if (!Array.isArray(takt.stations) || takt.stations.length === 0) takt.stations = def.takt.stations;
  takt.source = fallbackSource(parsed.takt, def.takt.source);

  const pareto = { ...def.pareto, ...(parsed.pareto || {}) };
  if (!Array.isArray(pareto.items) || pareto.items.length === 0) pareto.items = def.pareto.items;
  if (!Array.isArray(pareto.events)) pareto.events = def.pareto.events;
  if (!pareto.mode) pareto.mode = Array.isArray(parsed.pareto?.events) ? 'events' : 'summary';
  if (!pareto.metric) pareto.metric = 'count';
  if (!pareto.filterValue) pareto.filterValue = 'ALL';
  pareto.source = fallbackSource(parsed.pareto, def.pareto.source);

  const vsm = { ...def.vsm, ...(parsed.vsm || {}) };
  if (!Array.isArray(vsm.steps) || vsm.steps.length === 0) vsm.steps = def.vsm.steps;
  vsm.source = fallbackSource(parsed.vsm, def.vsm.source);

  const fives = { ...def.fives, ...(parsed.fives || {}) };
  if (!Array.isArray(fives.pillars) || fives.pillars.length === 0) fives.pillars = def.fives.pillars;
  if (!Array.isArray(fives.actions)) fives.actions = def.fives.actions;
  fives.source = fallbackSource(parsed.fives, def.fives.source);

  const ishikawa = {
    ...def.ishikawa,
    ...(parsed.ishikawa || {}),
    ribs: {
      ...def.ishikawa.ribs,
      ...((parsed.ishikawa && parsed.ishikawa.ribs) || {}),
    },
  };
  ishikawa.source = fallbackSource(parsed.ishikawa, def.ishikawa.source);

  return {
    activeTab: parsed.activeTab || def.activeTab,
    scenarioKey: parsed.scenarioKey || def.scenarioKey,
    scenarioName: parsed.scenarioName || def.scenarioName,
    capability: cap,
    oee,
    takt,
    pareto,
    vsm,
    fives,
    ishikawa,
  };
}

let state = loadInitialState();

function loadInitialState() {
  if (typeof localStorage === 'undefined') return createDefaultState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.capability && parsed.oee && parsed.takt && parsed.pareto && parsed.vsm && parsed.fives && parsed.ishikawa) {
        return migrateState(parsed);
      }
    }
  } catch (err) {
    console.warn('Workspace restore fallback to defaults:', err);
  }
  return createDefaultState();
}

export function getState() {
  return state;
}

export function setState(next) {
  state = migrateState(next);
  persistState();
  return state;
}

export function setModuleSource(moduleKey, kind, label) {
  if (state[moduleKey]) {
    state[moduleKey].source = { kind, label };
  }
}

export function resetState(scenarioKey = 'cnc') {
  const prevTab = state.activeTab;
  state = createDefaultState(scenarioKey);
  state.activeTab = prevTab;
  persistState();
  return state;
}

export function loadScenario(scenarioKey) {
  const prevTab = state.activeTab;
  state = createDefaultState(scenarioKey);
  state.activeTab = prevTab;
  persistState();
  return state;
}

export function persistState() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('LocalStorage write skipped:', err);
  }
}

export function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}
