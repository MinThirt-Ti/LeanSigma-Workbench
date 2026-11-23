import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAndersonDarling, computeEmpiricalCapability, computeParametricCapability } from '../src/modules/capabilityMath.js';
import { computeShiftLogOEE, computeSingleOEE } from '../src/modules/oeeMath.js';
import { aggregateParetoEvents, computeParetoSorted } from '../src/modules/paretoMath.js';
import { computeTaktMetrics } from '../src/modules/taktMath.js';
import { computeVSMMetrics, identifyVSMBottleneck } from '../src/modules/vsmMath.js';
import { compute5SMetrics } from '../src/modules/fivesMath.js';
import { createDefaultState } from '../src/state.js';

test('computeParametricCapability computes centered 4-sigma metrics accurately', () => {
  const m = computeParametricCapability({ mu: 50, sigma: 5, lsl: 30, usl: 70 });
  assert.ok(Math.abs(m.cp - 1.3333) < 0.01);
  assert.ok(Math.abs(m.cpk - 1.3333) < 0.01);
  assert.ok(Math.abs(m.ppm - 63.34) < 0.5);
});

test('computeEmpiricalCapability computes within/overall indices, bins, and I-MR OOC rules', () => {
  // Stable alternating sequence with 1 extreme outlier at index 10 (Rule 1)
  const samples = [50, 52, 48, 51, 49, 50, 51, 49, 50, 52, 95, 50, 49, 51];
  const m = computeEmpiricalCapability(samples, 40, 60);
  assert.equal(m.n, 14);
  assert.equal(m.oobCount, 1);
  assert.equal(m.oobHigh, 1);
  assert.equal(m.oobLow, 0);
  assert.ok(Math.abs(m.observedPPM - (1 / 14) * 1e6) < 0.01);

  const totalBinCount = m.bins.reduce((acc, b) => acc + b.count, 0);
  assert.equal(totalBinCount, 14);
  assert.ok(m.imr.oocRule1.includes(10));
  assert.equal(m.imr.isStable, false);

  // Rule 2: 8 consecutive points strictly above CL
  const shiftRun = [10, 10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20, 20];
  const mRun = computeEmpiricalCapability(shiftRun, 0, 30);
  assert.ok(mRun.imr.oocRule2.length >= 8);
  assert.equal(mRun.imr.isStable, false);
});

test('computeAndersonDarling and non-normal capability modes handle skewed data', () => {
  // Strongly right-skewed failure-time style dataset
  const skewed = [2.1, 2.4, 2.8, 3.0, 3.2, 3.5, 4.1, 4.8, 5.5, 7.2, 9.8, 14.5, 22.0, 35.0];
  const ad = computeAndersonDarling(skewed);
  assert.equal(ad.testable, true);
  assert.equal(ad.isNormal, false);
  assert.ok(ad.pValue < 0.05);

  const lnCap = computeEmpiricalCapability(skewed, 1.0, 40.0, 'lognormal');
  assert.equal(lnCap.distModel, 'lognormal');
  assert.ok(Number.isFinite(lnCap.ppk));

  const wbCap = computeEmpiricalCapability(skewed, 1.0, 40.0, 'weibull');
  assert.equal(wbCap.distModel, 'weibull');
  assert.ok(Number.isFinite(wbCap.ppk));

  const llCap = computeEmpiricalCapability(skewed, 1.0, 40.0, 'loglogistic');
  assert.equal(llCap.distModel, 'loglogistic');
  assert.ok(Number.isFinite(llCap.ppk));

  const autoCap = computeEmpiricalCapability(skewed, 1.0, 40.0, 'auto');
  assert.notEqual(autoCap.distModel, 'normal');
  assert.ok(autoCap.fitRankings.length === 4);

  const npCap = computeEmpiricalCapability(skewed, 1.0, 40.0, 'nonparametric');
  assert.equal(npCap.distModel, 'nonparametric');
  assert.ok(Number.isFinite(npCap.ppk));
  assert.ok(npCap.median > 0);
});

test('computeSingleOEE and computeShiftLogOEE aggregate and filter properly', () => {
  const single = computeSingleOEE({ shift: 480, downtime: 48, cycle: 30, output: 864, scrap: 0 });
  assert.ok(Math.abs(single.avail - 0.9) < 1e-6);
  assert.ok(Math.abs(single.perf - 1.0) < 1e-6);
  assert.ok(Math.abs(single.qual - 1.0) < 1e-6);
  assert.ok(Math.abs(single.oee - 0.9) < 1e-6);

  const logs = [
    { id: 1, date: '2026-11-20', shiftName: 'Day', line: 'L1', planned: 480, downtime: 48, cycle: 30, output: 864, scrap: 0 },
    { id: 2, date: '2026-11-20', shiftName: 'Night', line: 'L2', planned: 480, downtime: 240, cycle: 30, output: 480, scrap: 48 },
  ];
  const all = computeShiftLogOEE(logs, 'ALL');
  assert.equal(all.shiftCount, 2);
  assert.deepEqual(all.lines, ['L1', 'L2']);
  assert.equal(all.worstShift.line, 'L2');

  const onlyL1 = computeShiftLogOEE(logs, 'L1');
  assert.equal(onlyL1.shiftCount, 1);
  assert.ok(Math.abs(onlyL1.oee - 0.9) < 1e-6);
});

test('aggregateParetoEvents and computeParetoSorted classify vital few accurately', () => {
  const events = [
    { id: 1, category: 'Burr', weight: 10, group: 'A' },
    { id: 2, category: 'Burr', weight: 10, group: 'A' },
    { id: 3, category: 'Burr', weight: 10, group: 'B' },
    { id: 4, category: 'Tolerance', weight: 500, group: 'B' },
  ];

  const byCount = computeParetoSorted(aggregateParetoEvents(events, { metric: 'count', filterValue: 'ALL' }));
  assert.equal(byCount.total, 4);
  assert.equal(byCount.rows[0].name, 'Burr');

  const byWeight = computeParetoSorted(aggregateParetoEvents(events, { metric: 'weight', filterValue: 'ALL' }));
  assert.equal(byWeight.total, 530);
  assert.equal(byWeight.rows[0].name, 'Tolerance');
  assert.equal(byWeight.vitalCount, 1);

  const groupA = aggregateParetoEvents(events, { metric: 'count', filterValue: 'A' });
  assert.equal(groupA.length, 1);
  assert.equal(groupA[0].count, 2);
});

test('Takt, VSM, and 5S pure math engines calculate expected KPIs', () => {
  const def = createDefaultState('cnc');
  const takt = computeTaktMetrics(def.takt);
  assert.equal(takt.takt, 60);
  assert.equal(takt.bottleneck.name, 'Machining');
  assert.equal(takt.bottleneck.total, 70);

  const vsm = computeVSMMetrics(def.vsm.steps);
  const bottle = identifyVSMBottleneck(def.vsm.steps);
  assert.equal(vsm.totalVASec, 265);
  assert.equal(bottle.name, 'Welding');

  const f5 = compute5SMetrics(def.fives);
  assert.equal(f5.lowest.name, 'Sustain');
  assert.equal(f5.openActions, 2);
});
