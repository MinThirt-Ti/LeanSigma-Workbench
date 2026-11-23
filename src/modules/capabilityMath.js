export function erfc(x) {
  const z = Math.abs(x);
  const t = 1.0 / (1.0 + 0.5 * z);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0.0 ? ans : 2.0 - ans;
}

export function normalCDF(z) {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/**
 * Anderson-Darling Normality Test (Stephens 1986 modified A^2* and p-value).
 */
export function computeAndersonDarling(rawSamples) {
  const samples = (Array.isArray(rawSamples) ? rawSamples : [])
    .map(Number)
    .filter((v) => Number.isFinite(v));
  const n = samples.length;
  if (n < 4) {
    return { a2: 0, a2Star: 0, pValue: 1, isNormal: true, testable: false };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = sorted.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  const s = Math.sqrt(variance);
  if (s <= 1e-12) {
    return { a2: 0, a2Star: 0, pValue: 0.0001, isNormal: false, testable: true };
  }

  let sum = 0;
  const eps = 1e-12;
  for (let i = 0; i < n; i++) {
    const phiLow = Math.min(1 - eps, Math.max(eps, normalCDF((sorted[i] - mean) / s)));
    const phiHigh = Math.min(1 - eps, Math.max(eps, normalCDF((sorted[n - 1 - i] - mean) / s)));
    sum += ((2 * (i + 1) - 1) / n) * (Math.log(phiLow) + Math.log(1 - phiHigh));
  }
  const a2 = -n - sum;
  const a2Star = a2 * (1 + 0.75 / n + 2.25 / (n * n));

  let p;
  if (a2Star >= 0.6) {
    p = Math.exp(1.2937 - 5.709 * a2Star + 0.0186 * a2Star * a2Star);
  } else if (a2Star > 0.34) {
    p = Math.exp(0.9177 - 4.279 * a2Star - 1.38 * a2Star * a2Star);
  } else if (a2Star > 0.2) {
    p = 1 - Math.exp(-8.318 + 42.796 * a2Star - 59.938 * a2Star * a2Star);
  } else {
    p = 1 - Math.exp(-13.436 + 101.14 * a2Star - 223.73 * a2Star * a2Star);
  }
  const pValue = Math.min(0.9999, Math.max(0.0001, p));
  return { a2, a2Star, pValue, isNormal: pValue >= 0.05, testable: true };
}

export function empiricalQuantile(sorted, q) {
  if (!sorted.length) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function computeADFromSortedCDF(sortedU) {
  const n = sortedU.length;
  if (n < 2) return Infinity;
  const eps = 1e-12;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const uLow = Math.min(1 - eps, Math.max(eps, sortedU[i]));
    const uHigh = Math.min(1 - eps, Math.max(eps, sortedU[n - 1 - i]));
    sum += ((2 * (i + 1) - 1) / n) * (Math.log(uLow) + Math.log(1 - uHigh));
  }
  return -n - sum;
}

function olsSlopeIntercept(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  const slope = den > 1e-12 ? num / den : 1;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

/**
 * Fits Normal, Lognormal, Weibull, and Log-Logistic to samples and ranks them
 * by Anderson-Darling A^2 statistic.
 */
export function fitCandidateDistributions(sorted, mean, overallSigma, adNorm) {
  const n = sorted.length;
  const candidates = {};

  // 1. Normal
  const normU = sorted.map((x) => normalCDF((x - mean) / overallSigma));
  candidates.normal = {
    key: 'normal',
    label: 'Normal',
    a2: adNorm.testable ? adNorm.a2 : computeADFromSortedCDF(normU),
    qLow: mean - 3 * overallSigma,
    qMid: mean,
    qHigh: mean + 3 * overallSigma,
    cdf: (x) => normalCDF((x - mean) / overallSigma),
    pdf: (x) => {
      const z = (x - mean) / overallSigma;
      return Math.exp(-0.5 * z * z) / (overallSigma * Math.sqrt(2 * Math.PI));
    },
  };

  if (sorted[0] > 0 && n >= 3) {
    const logs = sorted.map((x) => Math.log(x));
    const muLog = logs.reduce((a, b) => a + b, 0) / n;
    const varLog = logs.reduce((a, v) => a + (v - muLog) ** 2, 0) / (n - 1);
    const sigLog = Math.max(1e-9, Math.sqrt(varLog));

    // 2. Lognormal
    const lnU = logs.map((y) => normalCDF((y - muLog) / sigLog));
    candidates.lognormal = {
      key: 'lognormal',
      label: 'Lognormal',
      muLog,
      sigLog,
      a2: computeADFromSortedCDF(lnU),
      qLow: Math.exp(muLog - 3 * sigLog),
      qMid: Math.exp(muLog),
      qHigh: Math.exp(muLog + 3 * sigLog),
      cdf: (x) => (x > 0 ? normalCDF((Math.log(x) - muLog) / sigLog) : 0),
      pdf: (x) => {
        if (x <= 0) return 0;
        const z = (Math.log(x) - muLog) / sigLog;
        return Math.exp(-0.5 * z * z) / (x * sigLog * Math.sqrt(2 * Math.PI));
      },
    };

    // Benard's median ranks for probability plotting
    const ranks = sorted.map((_, i) => (i + 1 - 0.3) / (n + 0.4));

    // 3. Weibull (2-parameter via rank regression on ln(x) vs ln(-ln(1-F)))
    const wY = ranks.map((f) => Math.log(-Math.log(1 - f)));
    const wFit = olsSlopeIntercept(logs, wY);
    const k = Math.max(0.05, wFit.slope);
    const lambda = Math.exp(-wFit.intercept / k);
    if (Number.isFinite(lambda) && lambda > 0) {
      const wCdf = (x) => (x > 0 ? 1 - Math.exp(-Math.pow(x / lambda, k)) : 0);
      const wQuant = (p) => lambda * Math.pow(-Math.log(1 - p), 1 / k);
      candidates.weibull = {
        key: 'weibull',
        label: 'Weibull',
        k,
        lambda,
        a2: computeADFromSortedCDF(sorted.map(wCdf)),
        qLow: wQuant(0.00135),
        qMid: wQuant(0.5),
        qHigh: wQuant(0.99865),
        cdf: wCdf,
        pdf: (x) => {
          if (x <= 0) return 0;
          const r = x / lambda;
          return (k / lambda) * Math.pow(r, k - 1) * Math.exp(-Math.pow(r, k));
        },
      };
    }

    // 4. Log-Logistic (2-parameter via rank regression on ln(x) vs ln(F/(1-F)))
    const llY = ranks.map((f) => Math.log(f / (1 - f)));
    const llFit = olsSlopeIntercept(logs, llY);
    const beta = Math.max(0.05, llFit.slope);
    const alpha = Math.exp(-llFit.intercept / beta);
    if (Number.isFinite(alpha) && alpha > 0) {
      const llCdf = (x) => (x > 0 ? 1 / (1 + Math.pow(x / alpha, -beta)) : 0);
      const llQuant = (p) => alpha * Math.pow(p / (1 - p), 1 / beta);
      candidates.loglogistic = {
        key: 'loglogistic',
        label: 'Log-Logistic',
        beta,
        alpha,
        a2: computeADFromSortedCDF(sorted.map(llCdf)),
        qLow: llQuant(0.00135),
        qMid: alpha,
        qHigh: llQuant(0.99865),
        cdf: llCdf,
        pdf: (x) => {
          if (x <= 0) return 0;
          const r = x / alpha;
          const rb = Math.pow(r, beta);
          return ((beta / alpha) * Math.pow(r, beta - 1)) / Math.pow(1 + rb, 2);
        },
      };
    }
  }

  const rankings = Object.values(candidates)
    .filter((c) => Number.isFinite(c.a2))
    .sort((a, b) => a.a2 - b.a2);

  let bestKey = rankings[0]?.key || 'normal';
  if (adNorm.testable && adNorm.isNormal && candidates.normal && rankings[0]) {
    if (candidates.normal.a2 - rankings[0].a2 < 0.08) {
      bestKey = 'normal';
    }
  }

  return { candidates, rankings, bestKey };
}

export function computeParametricCapability({ mu, sigma, lsl, usl }) {
  const safeSigma = Math.max(1e-9, sigma);
  const specW = usl - lsl;
  const upperM = usl - mu;
  const lowerM = mu - lsl;
  const cp = specW / (6 * safeSigma);
  const cpu = upperM / (3 * safeSigma);
  const cpl = lowerM / (3 * safeSigma);
  const cpk = Math.min(cpu, cpl);
  const pLower = normalCDF((lsl - mu) / safeSigma);
  const pUpper = normalCDF((mu - usl) / safeSigma);
  const ppm = (pLower + pUpper) * 1e6;
  const yieldPct = Math.max(0, (1 - (pLower + pUpper)) * 100);
  const zMin = Math.min(upperM / safeSigma, lowerM / safeSigma);
  return { mu, sigma: safeSigma, lsl, usl, specW, upperM, lowerM, cp, cpu, cpl, cpk, ppm, yieldPct, zMin };
}

/**
 * Computes empirical Process Capability (Cp/Cpk within-subgroup via MR-bar/d2,
 * Pp/Ppk overall sample std dev), observed defects, histogram bins, and I-MR
 * statistical control limits + Western Electric Run Rules 1 & 2.
 */
export function computeEmpiricalCapability(rawSamples, lslInput, uslInput, distModel = 'auto') {
  const samples = (Array.isArray(rawSamples) ? rawSamples : [])
    .map(Number)
    .filter((v) => Number.isFinite(v));

  if (samples.length < 2) {
    return null;
  }

  const n = samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const median = empiricalQuantile(sorted, 0.5);
  const ad = computeAndersonDarling(samples);
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const variance = samples.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  const overallSigma = Math.max(1e-9, Math.sqrt(variance));

  const movingRanges = [];
  for (let i = 1; i < n; i++) {
    movingRanges.push(Math.abs(samples[i] - samples[i - 1]));
  }
  const mrBar = movingRanges.reduce((a, b) => a + b, 0) / movingRanges.length;
  const d2 = 1.128; // Shewhart constant for n=2 moving range
  const withinSigma = mrBar > 0 ? mrBar / d2 : overallSigma;

  const lsl = Number.isFinite(Number(lslInput)) ? Number(lslInput) : mean - 3 * overallSigma;
  const usl = Number.isFinite(Number(uslInput)) ? Number(uslInput) : mean + 3 * overallSigma;
  const specW = usl - lsl;
  const upperM = usl - mean;
  const lowerM = mean - lsl;

  // Potential / Within-subgroup capability (Normal)
  const cp = specW / (6 * withinSigma);
  const cpu = upperM / (3 * withinSigma);
  const cpl = lowerM / (3 * withinSigma);
  const cpk = Math.min(cpu, cpl);

  // Overall performance indices (Normal default)
  let pp = specW / (6 * overallSigma);
  let ppu = upperM / (3 * overallSigma);
  let ppl = lowerM / (3 * overallSigma);
  let ppk = Math.min(ppu, ppl);

  // Observed out-of-spec defects
  let oobLow = 0;
  let oobHigh = 0;
  for (const x of samples) {
    if (x < lsl) oobLow++;
    else if (x > usl) oobHigh++;
  }
  const oobCount = oobLow + oobHigh;
  const observedPPM = (oobCount / n) * 1e6;
  const observedYieldPct = ((n - oobCount) / n) * 100;

  // Expected tail defect rate
  const pLower = normalCDF((lsl - mean) / overallSigma);
  const pUpper = normalCDF((mean - usl) / overallSigma);
  let expectedPPM = (pLower + pUpper) * 1e6;
  let expectedYieldPct = Math.max(0, (1 - (pLower + pUpper)) * 100);
  const zMin = Math.min(upperM / overallSigma, lowerM / overallSigma);

  // Fit candidate distributions (Normal, Lognormal, Weibull, Log-Logistic)
  const fit = fitCandidateDistributions(sorted, mean, overallSigma, ad);
  const p00135 = empiricalQuantile(sorted, 0.00135);
  const p99865 = empiricalQuantile(sorted, 0.99865);

  const requestedModel = distModel || 'auto';
  let activeDistModel = requestedModel === 'auto' ? fit.bestKey : requestedModel;
  if (activeDistModel !== 'nonparametric' && !fit.candidates[activeDistModel]) {
    activeDistModel = 'normal';
  }

  if (activeDistModel !== 'normal' && activeDistModel !== 'nonparametric') {
    const c = fit.candidates[activeDistModel];
    pp = specW / Math.max(1e-9, c.qHigh - c.qLow);
    ppu = (usl - c.qMid) / Math.max(1e-9, c.qHigh - c.qMid);
    ppl = (c.qMid - lsl) / Math.max(1e-9, c.qMid - c.qLow);
    ppk = Math.min(ppu, ppl);
    const fLow = c.cdf(lsl);
    const fHigh = 1 - c.cdf(usl);
    expectedPPM = (fLow + fHigh) * 1e6;
    expectedYieldPct = Math.max(0, (1 - (fLow + fHigh)) * 100);
  } else if (activeDistModel === 'nonparametric') {
    pp = specW / Math.max(1e-9, p99865 - p00135);
    ppu = (usl - median) / Math.max(1e-9, p99865 - median);
    ppl = (median - lsl) / Math.max(1e-9, median - p00135);
    ppk = Math.min(ppu, ppl);
    expectedPPM = observedPPM;
    expectedYieldPct = observedYieldPct;
  }

  // Histogram bins
  let minVal = samples[0];
  let maxVal = samples[0];
  for (const x of samples) {
    if (x < minVal) minVal = x;
    if (x > maxVal) maxVal = x;
  }
  const dataSpan = maxVal - minVal;
  const safeSpan = dataSpan > 1e-9 ? dataSpan : overallSigma * 6;
  const binCount = Math.max(7, Math.min(20, Math.ceil(Math.sqrt(n))));
  const padMin = dataSpan > 1e-9 ? minVal : minVal - safeSpan / 2;
  const binWidth = safeSpan / binCount;

  const bins = Array.from({ length: binCount }, (_, idx) => {
    const x0 = padMin + idx * binWidth;
    const x1 = padMin + (idx + 1) * binWidth;
    const mid = (x0 + x1) / 2;
    return {
      x0,
      x1,
      mid,
      count: 0,
      density: 0,
      outOfSpec: mid < lsl || mid > usl,
    };
  });

  for (const x of samples) {
    let idx = Math.floor((x - padMin) / binWidth);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  }
  bins.forEach((b) => {
    b.density = b.count / (n * binWidth);
  });

  // I-MR Control Chart & Western Electric Run Rules
  const clI = mean;
  const uclI = mean + 2.66 * mrBar;
  const lclI = mean - 2.66 * mrBar;
  const clMR = mrBar;
  const uclMR = 3.267 * mrBar;

  const oocRule1 = [];
  const oocRule2Set = new Set();
  let runSide = 0;
  let runStart = 0;

  for (let i = 0; i < n; i++) {
    const x = samples[i];
    if (x > uclI || x < lclI) {
      oocRule1.push(i);
    }
    const side = x > clI ? 1 : x < clI ? -1 : 0;
    if (side === 0 || side !== runSide) {
      runSide = side;
      runStart = i;
    } else if (i - runStart + 1 >= 8) {
      for (let k = runStart; k <= i; k++) oocRule2Set.add(k);
    }
  }

  const oocRule2 = Array.from(oocRule2Set).sort((a, b) => a - b);
  const oocIndices = Array.from(new Set([...oocRule1, ...oocRule2])).sort((a, b) => a - b);

  return {
    n,
    samples,
    mean,
    median,
    overallSigma,
    withinSigma,
    mrBar,
    ad,
    requestedModel,
    distModel: activeDistModel,
    bestFitKey: fit.bestKey,
    fitRankings: fit.rankings.map((r) => ({ key: r.key, label: r.label, a2: r.a2 })),
    activeFit: fit.candidates[activeDistModel] || null,
    lognormal: fit.candidates.lognormal || null,
    quantiles: { p00135, p50: median, p99865 },
    lsl,
    usl,
    specW,
    upperM,
    lowerM,
    cp,
    cpu,
    cpl,
    cpk,
    pp,
    ppu,
    ppl,
    ppk,
    oobLow,
    oobHigh,
    oobCount,
    observedPPM,
    observedYieldPct,
    expectedPPM,
    expectedYieldPct,
    zMin,
    min: minVal,
    max: maxVal,
    binWidth,
    bins,
    imr: {
      clI,
      uclI,
      lclI,
      clMR,
      uclMR,
      movingRanges,
      oocRule1,
      oocRule2,
      oocIndices,
      isStable: oocIndices.length === 0,
    },
  };
}
