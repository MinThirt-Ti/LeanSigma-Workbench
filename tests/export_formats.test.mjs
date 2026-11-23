import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../src/state.js';
import { buildMarkdownReport } from '../src/export/markdown.js';
import { buildModuleCSV, buildModuleTSV } from '../src/export/csv.js';

test('buildMarkdownReport generates all 7 sections for Data Mode and Simulator Mode', () => {
  const dataState = createDefaultState('cnc');
  const mdData = buildMarkdownReport(dataState, '2026-11-22T16:50:00Z');
  assert.match(mdData, /# LeanSigma Operational Excellence Report/);
  assert.match(mdData, /Empirical Data: Bore Diameter/);
  assert.match(mdData, /## 2\. OEE \(7 Shift Logs/);
  assert.match(mdData, /## 4\. Pareto 80\/20 Analysis/);
  assert.match(mdData, /## 7\. Ishikawa Root Cause Summary/);

  const simState = createDefaultState('smt');
  simState.capability.mode = 'simulator';
  simState.oee.mode = 'single';
  const mdSim = buildMarkdownReport(simState, '2026-11-22T16:50:00Z');
  assert.match(mdSim, /Process Capability \(Simulator\)/);
  assert.match(mdSim, /OEE \(Single Shift\)/);
});

test('buildModuleCSV and buildModuleTSV emit valid tabular outputs for all 7 modules', () => {
  const state = createDefaultState('cnc');
  const keys = ['capability', 'oee', 'takt', 'pareto', 'vsm', 'fives', 'ishikawa'];
  for (const key of keys) {
    const csv = buildModuleCSV(state, key);
    const tsv = buildModuleTSV(state, key);
    assert.ok(csv.length > 20, `${key} CSV should not be empty`);
    assert.ok(tsv.includes('\t'), `${key} TSV should contain tab delimiters`);
  }
});
