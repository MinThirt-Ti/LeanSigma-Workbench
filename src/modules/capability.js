import { PALETTE } from '../constants.js';
import { getState, persistState, setModuleSource } from '../state.js';
import { renderAllSourceBadges } from '../ui/sourceBadge.js';
import { escapeHtml, formatPPM } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { computeEmpiricalCapability, computeParametricCapability } from './capabilityMath.js';

const CAP_DOM_MIN = 0;
const CAP_DOM_MAX = 100;
const CAP_LEFT = 60;
const CAP_RIGHT = 940;
const CAP_WIDTH = CAP_RIGHT - CAP_LEFT;
const CAP_BASE_Y = 340;
const CAP_MAX_H = 195;

let capDragging = null;
let capDragOffset = 0;
let capDataDragging = null;
let capDataDomain = { left: 72, plotW: 868, domMin: 0, domSpan: 100, step: 0.1 };

function capDomToX(val) {
  return CAP_LEFT + ((val - CAP_DOM_MIN) / (CAP_DOM_MAX - CAP_DOM_MIN)) * CAP_WIDTH;
}

function capXToDom(svgX) {
  return CAP_DOM_MIN + ((svgX - CAP_LEFT) / CAP_WIDTH) * (CAP_DOM_MAX - CAP_DOM_MIN);
}

function capCurveY(x) {
  const { mu, sigma } = getState().capability;
  const z = (x - mu) / sigma;
  const density = Math.exp(-0.5 * z * z);
  const peakH = Math.min(CAP_MAX_H, Math.max(75, (4.5 / sigma) * 172));
  return CAP_BASE_Y - density * peakH;
}

function capBuildArea(xStart, xEnd, samples) {
  const a = Math.max(CAP_DOM_MIN, Math.min(CAP_DOM_MAX, xStart));
  const b = Math.max(CAP_DOM_MIN, Math.min(CAP_DOM_MAX, xEnd));
  if (b - a <= 0.0001) return '';
  let d = `M ${capDomToX(a).toFixed(2)} ${CAP_BASE_Y}`;
  for (let i = 0; i <= samples; i++) {
    const domX = a + (i / samples) * (b - a);
    d += ` L ${capDomToX(domX).toFixed(2)} ${capCurveY(domX).toFixed(2)}`;
  }
  d += ` L ${capDomToX(b).toFixed(2)} ${CAP_BASE_Y} Z`;
  return d;
}

function capBuildOutline(samples) {
  let d = '';
  for (let i = 0; i <= samples; i++) {
    const domX = CAP_DOM_MIN + (i / samples) * (CAP_DOM_MAX - CAP_DOM_MIN);
    d += (i === 0 ? 'M ' : ' L ') + `${capDomToX(domX).toFixed(2)} ${capCurveY(domX).toFixed(2)}`;
  }
  return d;
}

export function initCapabilityGrid() {
  const grid = document.getElementById('cap-grid');
  const axis = document.getElementById('cap-axis');
  if (!grid || !axis) return;
  let gHtml = '';
  let aHtml = `<line x1="${CAP_LEFT}" y1="412" x2="${CAP_RIGHT}" y2="412" stroke="${PALETTE.border}" stroke-width="2" />`;
  for (let v = 0; v <= 100; v += 2) {
    const x = capDomToX(v);
    const major = v % 10 === 0;
    if (major) {
      gHtml += `<line x1="${x.toFixed(1)}" y1="115" x2="${x.toFixed(1)}" y2="${CAP_BASE_Y}" stroke="${PALETTE.border}" stroke-width="1" />`;
    }
    aHtml += `<line x1="${x.toFixed(1)}" y1="412" x2="${x.toFixed(1)}" y2="${major ? 420 : 416}" stroke="${major ? PALETTE.icemint : PALETTE.border}" stroke-width="${major ? 1.5 : 1}" />`;
    if (major) {
      aHtml += `<text x="${x.toFixed(1)}" y="433" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11">${v}</text>`;
    }
  }
  grid.innerHTML = gHtml;
  axis.innerHTML = aHtml;
}

function renderCapBracket(container, cfg) {
  const { x1, x2, y, extTop, extBottom, label, color, pillBg, pillBorder, textColor, offsetX } = cfg;
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const span = right - left;
  const mid = (left + right) / 2;
  const px = mid + (offsetX || 0);
  const pw = Math.max(88, label.length * 7.5 + 18);
  const outward = span < pw + 22;
  const a = 6;
  let h = '';
  h += `<line x1="${x1.toFixed(1)}" y1="${extTop}" x2="${x1.toFixed(1)}" y2="${extBottom}" stroke="${color}" stroke-width="1.3" stroke-dasharray="3 2" />`;
  h += `<line x1="${x2.toFixed(1)}" y1="${extTop}" x2="${x2.toFixed(1)}" y2="${extBottom}" stroke="${color}" stroke-width="1.3" stroke-dasharray="3 2" />`;
  if (outward) {
    h += `<line x1="${(left - 16).toFixed(1)}" y1="${y}" x2="${(right + 16).toFixed(1)}" y2="${y}" stroke="${color}" stroke-width="1.6" />`;
    h += `<polygon points="${left.toFixed(1)},${y} ${(left - a).toFixed(1)},${y - 4} ${(left - a).toFixed(1)},${y + 4}" fill="${color}" />`;
    h += `<polygon points="${right.toFixed(1)},${y} ${(right + a).toFixed(1)},${y - 4} ${(right + a).toFixed(1)},${y + 4}" fill="${color}" />`;
  } else {
    h += `<line x1="${left.toFixed(1)}" y1="${y}" x2="${right.toFixed(1)}" y2="${y}" stroke="${color}" stroke-width="1.6" />`;
    h += `<polygon points="${left.toFixed(1)},${y} ${(left + a).toFixed(1)},${y - 4} ${(left + a).toFixed(1)},${y + 4}" fill="${color}" />`;
    h += `<polygon points="${right.toFixed(1)},${y} ${(right - a).toFixed(1)},${y - 4} ${(right - a).toFixed(1)},${y + 4}" fill="${color}" />`;
  }
  if (Math.abs(offsetX || 0) > 2) {
    h += `<line x1="${mid.toFixed(1)}" y1="${y}" x2="${px.toFixed(1)}" y2="${y}" stroke="${color}" stroke-width="1.2" stroke-dasharray="2 2" />`;
  }
  h += `<g transform="translate(${px.toFixed(1)}, ${y})">
    <rect x="${(-pw / 2).toFixed(1)}" y="-11" width="${pw.toFixed(1)}" height="22" rx="4" fill="${pillBg}" stroke="${pillBorder}" stroke-width="1.5" />
    <text x="0" y="4" text-anchor="middle" fill="${textColor}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">${escapeHtml(label)}</text>
  </g>`;
  container.innerHTML = h;
}

function styleCapBadge(el, val) {
  if (val < 0) {
    el.textContent = 'Violation';
    el.style.borderColor = PALETTE.crimson;
    el.style.color = PALETTE.rose;
    el.style.backgroundColor = PALETTE.crimson;
  } else if (val < 1.0) {
    el.textContent = 'Incapable';
    el.style.borderColor = PALETTE.crimson;
    el.style.color = PALETTE.crimson;
    el.style.backgroundColor = PALETTE.canvas;
  } else if (val < 1.33) {
    el.textContent = 'Marginal';
    el.style.borderColor = PALETTE.copper;
    el.style.color = PALETTE.copper;
    el.style.backgroundColor = PALETTE.canvas;
  } else {
    el.textContent = 'Capable';
    el.style.borderColor = PALETTE.emerald;
    el.style.color = PALETTE.emerald;
    el.style.backgroundColor = PALETTE.canvas;
  }
}

function renderSimulatorView(capState) {
  const m = computeParametricCapability(capState);
  const { mu, sigma, lsl, usl } = m;

  document.getElementById('cap-lbl-1').textContent = 'Cp';
  document.getElementById('cap-lbl-2').textContent = 'Cpk';
  document.getElementById('cap-lbl-3').textContent = 'Cpu';
  document.getElementById('cap-lbl-4').textContent = 'Cpl';
  document.getElementById('cap-lbl-5').textContent = 'PPM';
  document.getElementById('cap-lbl-6').textContent = 'Sigma';

  const syncInput = (id, val) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = val.toFixed(1);
  };
  syncInput('cap-in-mu', mu);
  document.getElementById('cap-sl-mu').value = mu.toFixed(1);
  syncInput('cap-in-sigma', sigma);
  document.getElementById('cap-sl-sigma').value = sigma.toFixed(1);
  syncInput('cap-in-lsl', lsl);
  document.getElementById('cap-sl-lsl').value = lsl.toFixed(1);
  syncInput('cap-in-usl', usl);
  document.getElementById('cap-sl-usl').value = usl.toFixed(1);

  const pts = [mu - 3 * sigma, mu - 2 * sigma, mu - sigma, mu, mu + sigma, mu + 2 * sigma, mu + 3 * sigma];
  document.getElementById('cap-fill-tl').setAttribute('d', capBuildArea(CAP_DOM_MIN, pts[0], 28));
  document.getElementById('cap-fill-m32').setAttribute('d', capBuildArea(pts[0], pts[1], 28));
  document.getElementById('cap-fill-m21').setAttribute('d', capBuildArea(pts[1], pts[2], 28));
  document.getElementById('cap-fill-m10').setAttribute('d', capBuildArea(pts[2], pts[3], 28));
  document.getElementById('cap-fill-p01').setAttribute('d', capBuildArea(pts[3], pts[4], 28));
  document.getElementById('cap-fill-p12').setAttribute('d', capBuildArea(pts[4], pts[5], 28));
  document.getElementById('cap-fill-p23').setAttribute('d', capBuildArea(pts[5], pts[6], 28));
  document.getElementById('cap-fill-tr').setAttribute('d', capBuildArea(pts[6], CAP_DOM_MAX, 28));

  document.getElementById('cap-defect-left').setAttribute('d', capBuildArea(CAP_DOM_MIN, lsl, 56));
  document.getElementById('cap-defect-right').setAttribute('d', capBuildArea(usl, CAP_DOM_MAX, 56));

  const outD = capBuildOutline(220);
  document.getElementById('cap-outline').setAttribute('d', outD);
  document.getElementById('cap-outline-hit').setAttribute('d', outD);

  let gLines = '';
  [pts[0], pts[1], pts[2], pts[4], pts[5], pts[6]].forEach((p) => {
    if (p > CAP_DOM_MIN && p < CAP_DOM_MAX) {
      const x = capDomToX(p);
      const y = capCurveY(p);
      if (CAP_BASE_Y - y > 4) {
        gLines += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${CAP_BASE_Y}" />`;
      }
    }
  });
  document.getElementById('cap-sigma-guides').innerHTML = gLines;

  const xMu = capDomToX(mu);
  const peakY = capCurveY(mu);
  document.getElementById('cap-mu-line').setAttribute('x1', xMu.toFixed(1));
  document.getElementById('cap-mu-line').setAttribute('x2', xMu.toFixed(1));
  document.getElementById('cap-mu-line').setAttribute('y1', Math.max(115, peakY - 6).toFixed(1));
  document.getElementById('cap-mu-hit').setAttribute('x1', xMu.toFixed(1));
  document.getElementById('cap-mu-hit').setAttribute('x2', xMu.toFixed(1));
  document.getElementById('cap-mu-badge').setAttribute('transform', `translate(${xMu.toFixed(1)}, ${Math.max(120, peakY - 16).toFixed(1)})`);
  document.getElementById('cap-mu-text').textContent = `μ = ${mu.toFixed(1)}`;

  const bars = ['cap-bar-m32', 'cap-bar-m21', 'cap-bar-m10', 'cap-bar-p01', 'cap-bar-p12', 'cap-bar-p23'];
  let divHtml = '';
  for (let i = 0; i < 6; i++) {
    const xs = Math.max(CAP_LEFT, Math.min(CAP_RIGHT, capDomToX(pts[i])));
    const xe = Math.max(CAP_LEFT, Math.min(CAP_RIGHT, capDomToX(pts[i + 1])));
    const el = document.getElementById(bars[i]);
    el.setAttribute('x', xs.toFixed(1));
    el.setAttribute('width', Math.max(0, xe - xs).toFixed(1));
    if (i > 0 && xs > CAP_LEFT && xs < CAP_RIGHT) {
      divHtml += `<line x1="${xs.toFixed(1)}" y1="343" x2="${xs.toFixed(1)}" y2="365" />`;
    }
  }
  document.getElementById('cap-bar-dividers').innerHTML = divHtml;
  const bxL = Math.max(CAP_LEFT, Math.min(CAP_RIGHT, capDomToX(pts[0])));
  const bxR = Math.max(CAP_LEFT, Math.min(CAP_RIGHT, capDomToX(pts[6])));
  document.getElementById('cap-bar-border').setAttribute('x', bxL.toFixed(1));
  document.getElementById('cap-bar-border').setAttribute('width', Math.max(0, bxR - bxL).toFixed(1));

  const sNames = ['-3σ', '-2σ', '-1σ', 'μ', '+1σ', '+2σ', '+3σ'];
  const oneSigPx = (sigma / 100) * CAP_WIDTH;
  let tickHtml = '';
  pts.forEach((p, idx) => {
    if (p < CAP_DOM_MIN - 0.5 || p > CAP_DOM_MAX + 0.5) return;
    if ((idx === 1 || idx === 2 || idx === 4 || idx === 5) && oneSigPx < 28) return;
    const x = Math.max(CAP_LEFT, Math.min(CAP_RIGHT, capDomToX(p)));
    const isMu = idx === 3;
    tickHtml += `<line x1="${x.toFixed(1)}" y1="365" x2="${x.toFixed(1)}" y2="372" stroke="${isMu ? PALETTE.emerald : PALETTE.icemint}" stroke-width="1.5" />`;
    tickHtml += `<text x="${x.toFixed(1)}" y="386" text-anchor="middle" fill="${isMu ? PALETTE.emerald : PALETTE.rose}">${sNames[idx]}</text>`;
  });
  document.getElementById('cap-sigma-ticks').innerHTML = tickHtml;

  const xLsl = capDomToX(lsl);
  const xUsl = capDomToX(usl);
  document.getElementById('cap-lsl-line').setAttribute('x1', xLsl.toFixed(1));
  document.getElementById('cap-lsl-line').setAttribute('x2', xLsl.toFixed(1));
  document.getElementById('cap-lsl-hit').setAttribute('x1', xLsl.toFixed(1));
  document.getElementById('cap-lsl-hit').setAttribute('x2', xLsl.toFixed(1));
  document.getElementById('cap-lsl-badge').setAttribute('transform', `translate(${xLsl.toFixed(1)}, 152)`);
  document.getElementById('cap-lsl-text').textContent = `LSL ${lsl.toFixed(1)}`;

  document.getElementById('cap-usl-line').setAttribute('x1', xUsl.toFixed(1));
  document.getElementById('cap-usl-line').setAttribute('x2', xUsl.toFixed(1));
  document.getElementById('cap-usl-hit').setAttribute('x1', xUsl.toFixed(1));
  document.getElementById('cap-usl-hit').setAttribute('x2', xUsl.toFixed(1));
  document.getElementById('cap-usl-badge').setAttribute('transform', `translate(${xUsl.toFixed(1)}, 152)`);
  document.getElementById('cap-usl-text').textContent = `USL ${usl.toFixed(1)}`;

  renderCapBracket(document.getElementById('cap-brk-spec'), {
    x1: xLsl,
    x2: xUsl,
    y: 34,
    extTop: 22,
    extBottom: 115,
    label: `USL - LSL = ${m.specW.toFixed(1)}`,
    color: PALETTE.magenta,
    pillBg: PALETTE.panel,
    pillBorder: PALETTE.magenta,
    textColor: PALETTE.rose,
  });

  const lowLbl = `μ - LSL = ${m.lowerM.toFixed(1)}`;
  const upLbl = `USL - μ = ${m.upperM.toFixed(1)}`;
  const midL = (xLsl + xMu) / 2;
  const midU = (xMu + xUsl) / 2;
  const minGap = (Math.max(88, lowLbl.length * 7.5 + 18) + Math.max(88, upLbl.length * 7.5 + 18)) / 2 + 12;
  let offL = 0;
  let offU = 0;
  if (Math.abs(midU - midL) < minGap) {
    const shift = (minGap - Math.abs(midU - midL)) / 2;
    if (midL <= midU) { offL = -shift; offU = shift; }
    else { offL = shift; offU = -shift; }
  }

  const lowNeg = m.lowerM < 0;
  renderCapBracket(document.getElementById('cap-brk-lower'), {
    x1: xLsl,
    x2: xMu,
    y: 82,
    extTop: 70,
    extBottom: 116,
    label: lowLbl,
    color: lowNeg ? PALETTE.crimson : PALETTE.icemint,
    pillBg: lowNeg ? PALETTE.crimson : PALETTE.card,
    pillBorder: lowNeg ? PALETTE.rose : PALETTE.teal,
    textColor: lowNeg ? '#FFFFFF' : PALETTE.icemint,
    offsetX: offL,
  });

  const upNeg = m.upperM < 0;
  renderCapBracket(document.getElementById('cap-brk-upper'), {
    x1: xMu,
    x2: xUsl,
    y: 82,
    extTop: 70,
    extBottom: 116,
    label: upLbl,
    color: upNeg ? PALETTE.crimson : PALETTE.icemint,
    pillBg: upNeg ? PALETTE.crimson : PALETTE.card,
    pillBorder: upNeg ? PALETTE.rose : PALETTE.teal,
    textColor: upNeg ? '#FFFFFF' : PALETTE.icemint,
    offsetX: offU,
  });

  renderCapBracket(document.getElementById('cap-brk-six'), {
    x1: bxL,
    x2: bxR,
    y: 460,
    extTop: 368,
    extBottom: 472,
    label: `6σ = ${(6 * sigma).toFixed(1)}`,
    color: PALETTE.emerald,
    pillBg: PALETTE.card,
    pillBorder: PALETTE.emerald,
    textColor: PALETTE.emerald,
  });

  document.getElementById('cap-val-cp').textContent = m.cp.toFixed(2);
  document.getElementById('cap-sub-cp').textContent = `(${usl.toFixed(1)} - ${lsl.toFixed(1)}) / ${(6 * sigma).toFixed(1)}`;
  styleCapBadge(document.getElementById('cap-badge-cp'), m.cp);

  document.getElementById('cap-val-cpk').textContent = m.cpk.toFixed(2);
  document.getElementById('cap-val-cpk').style.color = m.cpk < 1 ? PALETTE.crimson : m.cpk < 1.33 ? PALETTE.copper : PALETTE.emerald;
  styleCapBadge(document.getElementById('cap-badge-cpk'), m.cpk);

  document.getElementById('cap-val-cpu').textContent = m.cpu.toFixed(2);
  document.getElementById('cap-sub-cpu').textContent = `(${usl.toFixed(1)} - ${mu.toFixed(1)}) / ${(3 * sigma).toFixed(1)}`;
  document.getElementById('cap-val-cpl').textContent = m.cpl.toFixed(2);
  document.getElementById('cap-sub-cpl').textContent = `(${mu.toFixed(1)} - ${lsl.toFixed(1)}) / ${(3 * sigma).toFixed(1)}`;

  const cardCpu = document.getElementById('cap-card-cpu');
  const cardCpl = document.getElementById('cap-card-cpl');
  const bdgCpu = document.getElementById('cap-badge-cpu');
  const bdgCpl = document.getElementById('cap-badge-cpl');
  cardCpu.style.borderColor = PALETTE.border;
  cardCpl.style.borderColor = PALETTE.border;
  bdgCpu.textContent = 'Upper';
  bdgCpu.style.color = PALETTE.icemint;
  bdgCpu.style.borderColor = PALETTE.border;
  bdgCpl.textContent = 'Lower';
  bdgCpl.style.color = PALETTE.icemint;
  bdgCpl.style.borderColor = PALETTE.border;

  if (Math.abs(m.cpu - m.cpl) < 0.015) {
    document.getElementById('cap-bottleneck').textContent = 'Balanced';
  } else if (m.cpu < m.cpl) {
    document.getElementById('cap-bottleneck').textContent = 'Bottleneck: Cpu';
    cardCpu.style.borderColor = m.cpu < 1 ? PALETTE.crimson : PALETTE.copper;
    bdgCpu.textContent = 'Bottleneck';
    bdgCpu.style.color = PALETTE.crimson;
    bdgCpu.style.borderColor = PALETTE.crimson;
  } else {
    document.getElementById('cap-bottleneck').textContent = 'Bottleneck: Cpl';
    cardCpl.style.borderColor = m.cpl < 1 ? PALETTE.crimson : PALETTE.copper;
    bdgCpl.textContent = 'Bottleneck';
    bdgCpl.style.color = PALETTE.crimson;
    bdgCpl.style.borderColor = PALETTE.crimson;
  }

  document.getElementById('cap-val-ppm').textContent = formatPPM(m.ppm);
  document.getElementById('cap-val-ppm').style.color = m.ppm > 2700 ? PALETTE.crimson : PALETTE.icemint;
  document.getElementById('cap-yield').textContent = `Yield: ${m.yieldPct > 99.9999 ? '99.9999' : m.yieldPct.toFixed(4)}%`;
  const bdgPpm = document.getElementById('cap-badge-ppm');
  if (m.ppm > 2700) {
    bdgPpm.textContent = 'High';
    bdgPpm.style.borderColor = PALETTE.crimson;
    bdgPpm.style.color = PALETTE.crimson;
  } else if (m.ppm > 64) {
    bdgPpm.textContent = 'Moderate';
    bdgPpm.style.borderColor = PALETTE.copper;
    bdgPpm.style.color = PALETTE.copper;
  } else {
    bdgPpm.textContent = 'Low';
    bdgPpm.style.borderColor = PALETTE.olive;
    bdgPpm.style.color = PALETTE.emerald;
  }

  document.getElementById('cap-val-sigma').textContent = `${m.zMin.toFixed(2)}σ`;
  document.getElementById('cap-sub-sigma').textContent = `Zmin: ${m.zMin.toFixed(2)}`;
}

function renderDataModeView(capState) {
  const requested = capState.distModel || 'auto';
  const m = computeEmpiricalCapability(capState.samples, capState.lsl, capState.usl, requested);
  const distModel = m ? m.distModel : requested;

  document.getElementById('cap-dist-auto')?.classList.toggle('active', requested === 'auto');
  document.getElementById('cap-dist-normal')?.classList.toggle('active', requested === 'normal');
  document.getElementById('cap-dist-lognormal')?.classList.toggle('active', requested === 'lognormal');
  document.getElementById('cap-dist-weibull')?.classList.toggle('active', requested === 'weibull');
  document.getElementById('cap-dist-loglogistic')?.classList.toggle('active', requested === 'loglogistic');
  document.getElementById('cap-dist-nonparam')?.classList.toggle('active', requested === 'nonparametric');

  const adBadge = document.getElementById('cap-ad-badge');
  if (adBadge && m) {
    const bestLabel = m.fitRankings?.find((r) => r.key === m.bestFitKey)?.label || m.bestFitKey;
    if (!m.ad.testable) {
      adBadge.textContent = 'AD: n<4';
      adBadge.style.borderColor = PALETTE.border;
      adBadge.style.color = PALETTE.icemint;
    } else if (m.ad.isNormal) {
      adBadge.textContent = `AD Normal (p=${m.ad.pValue.toFixed(3)}) • Best: ${bestLabel}`;
      adBadge.style.borderColor = PALETTE.emerald;
      adBadge.style.color = PALETTE.emerald;
    } else {
      adBadge.textContent = `Non-Normal (p=${m.ad.pValue.toFixed(3)}) • Best: ${bestLabel}`;
      adBadge.style.borderColor = PALETTE.copper;
      adBadge.style.color = PALETTE.copper;
    }
  }

  const syncField = (id, val) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = val;
  };
  syncField('cap-data-label', capState.label || 'Measurements');
  syncField('cap-data-unit', capState.unit || '');
  syncField('cap-data-lsl', capState.lsl);
  syncField('cap-data-usl', capState.usl);
  const rawEl = document.getElementById('cap-data-raw');
  if (rawEl && document.activeElement !== rawEl) {
    rawEl.value = (capState.samples || []).join(', ');
  }

  const dataRoot = document.getElementById('cap-data-root');
  const imrSvg = document.getElementById('svg-capability-imr');

  if (!m) {
    if (dataRoot) {
      dataRoot.innerHTML = `<text x="500" y="245" text-anchor="middle" fill="${PALETTE.rose}" font-family="ui-monospace, monospace" font-size="14">Enter or import at least 2 numeric measurements to compute empirical capability</text>`;
    }
    if (imrSvg) {
      imrSvg.innerHTML = `<rect x="0" y="0" width="1000" height="270" fill="${PALETTE.canvas}" /><text x="500" y="135" text-anchor="middle" fill="${PALETTE.teal}" font-family="ui-monospace, monospace" font-size="13">Waiting for >= 2 measurements</text>`;
    }
    return;
  }

  // Update 6 KPI cards for Empirical Analysis
  document.getElementById('cap-lbl-1').textContent = distModel === 'normal' ? 'Cp / Pp' : 'Pp (Overall)';
  document.getElementById('cap-val-cp').textContent = (distModel === 'normal' ? m.cp : m.pp).toFixed(2);
  document.getElementById('cap-sub-cp').textContent =
    distModel === 'normal' ? `Pp: ${m.pp.toFixed(2)} (Spec ${m.specW.toFixed(2)})` : `Model: ${distModel}`;
  styleCapBadge(document.getElementById('cap-badge-cp'), distModel === 'normal' ? m.cp : m.pp);

  const distLabelMap = {
    normal: 'Normal',
    lognormal: 'Lognormal',
    weibull: 'Weibull',
    loglogistic: 'Log-Logistic',
    nonparametric: 'ISO Non-Param',
  };
  const activeDistLabel = distLabelMap[distModel] || distModel;

  const primaryCap = distModel === 'normal' ? m.cpk : m.ppk;
  document.getElementById('cap-lbl-2').textContent = distModel === 'normal' ? 'Cpk / Ppk' : `Ppk (${activeDistLabel})`;
  document.getElementById('cap-val-cpk').textContent = primaryCap.toFixed(2);
  document.getElementById('cap-val-cpk').style.color = primaryCap < 1 ? PALETTE.crimson : primaryCap < 1.33 ? PALETTE.copper : PALETTE.emerald;
  document.getElementById('cap-bottleneck').textContent =
    distModel === 'normal' ? `Ppk: ${m.ppk.toFixed(2)} (${m.cpu < m.cpl ? 'Upper' : 'Lower'})` : `Normal Cpk: ${m.cpk.toFixed(2)}`;
  styleCapBadge(document.getElementById('cap-badge-cpk'), primaryCap);

  const cardCpu = document.getElementById('cap-card-cpu');
  const cardCpl = document.getElementById('cap-card-cpl');
  cardCpu.style.borderColor = PALETTE.border;
  cardCpl.style.borderColor = PALETTE.border;

  const centerVal = m.activeFit ? m.activeFit.qMid : m.median;
  document.getElementById('cap-lbl-3').textContent = distModel === 'normal' ? 'Sample Mean' : 'Median (P50)';
  document.getElementById('cap-val-cpu').textContent = centerVal.toFixed(3);
  document.getElementById('cap-sub-cpu').textContent = `n = ${m.n} ${capState.unit || ''}`.trim();
  const bdgCpu = document.getElementById('cap-badge-cpu');
  bdgCpu.textContent = distModel === 'normal' ? 'x̄' : 'P50';
  bdgCpu.style.color = PALETTE.emerald;
  bdgCpu.style.borderColor = PALETTE.emerald;

  document.getElementById('cap-lbl-4').textContent = 'Sigma (s / σ̂)';
  document.getElementById('cap-val-cpl').textContent = m.overallSigma.toFixed(3);
  document.getElementById('cap-sub-cpl').textContent = `Within σ̂: ${m.withinSigma.toFixed(3)}`;
  const bdgCpl = document.getElementById('cap-badge-cpl');
  bdgCpl.textContent = 'Dispersion';
  bdgCpl.style.color = PALETTE.icemint;
  bdgCpl.style.borderColor = PALETTE.border;

  document.getElementById('cap-lbl-5').textContent = 'Observed PPM';
  document.getElementById('cap-val-ppm').textContent = formatPPM(m.observedPPM);
  document.getElementById('cap-val-ppm').style.color = m.oobCount > 0 ? PALETTE.crimson : PALETTE.emerald;
  document.getElementById('cap-yield').textContent = `OOS: ${m.oobCount}/${m.n} (Exp ${formatPPM(m.expectedPPM)})`;
  const bdgPpm = document.getElementById('cap-badge-ppm');
  if (m.oobCount > 0) {
    bdgPpm.textContent = `${m.oobCount} OOS`;
    bdgPpm.style.borderColor = PALETTE.crimson;
    bdgPpm.style.color = PALETTE.crimson;
  } else {
    bdgPpm.textContent = '0 OOS';
    bdgPpm.style.borderColor = PALETTE.olive;
    bdgPpm.style.color = PALETTE.emerald;
  }

  document.getElementById('cap-lbl-6').textContent = 'I-MR Stability';
  const valSig = document.getElementById('cap-val-sigma');
  valSig.textContent = m.imr.isStable ? 'Stable' : `${m.imr.oocIndices.length} OOC`;
  valSig.style.color = m.imr.isStable ? PALETTE.emerald : PALETTE.crimson;
  document.getElementById('cap-sub-sigma').textContent = `UCL ${m.imr.uclI.toFixed(2)} | LCL ${m.imr.lclI.toFixed(2)}`;

  // Render Dynamic-Axis Empirical Histogram + Fitted Curve in #cap-data-root
  const left = 72;
  const right = 940;
  const top = 66;
  const bottom = 354;
  const plotW = right - left;
  const plotH = bottom - top;

  const spreadLow = m.activeFit ? m.activeFit.qLow : m.quantiles.p00135;
  const spreadHigh = m.activeFit ? m.activeFit.qHigh : m.quantiles.p99865;

  const domMin = Math.min(m.min, m.lsl, spreadLow) - m.overallSigma * 0.45;
  const domMax = Math.max(m.max, m.usl, spreadHigh) + m.overallSigma * 0.45;
  const domSpan = Math.max(1e-6, domMax - domMin);
  const xAt = (v) => left + ((v - domMin) / domSpan) * plotW;

  // Save domain mapping for interactive Data Mode LSL/USL dragging
  const decimals = domSpan < 1 ? 4 : domSpan < 10 ? 3 : domSpan < 100 ? 2 : 1;
  capDataDomain = { left, plotW, domMin, domSpan, decimals };

  const kdeBw = Math.max(1e-6, 1.06 * m.overallSigma * Math.pow(m.n, -0.2));
  const kdePdf = (x) => {
    let s = 0;
    for (let i = 0; i < m.n; i++) {
      const z = (x - m.samples[i]) / kdeBw;
      s += Math.exp(-0.5 * z * z);
    }
    return s / (m.n * kdeBw * Math.sqrt(2 * Math.PI));
  };
  const activePdf = m.activeFit ? m.activeFit.pdf : kdePdf;

  let peakCurve = 0;
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const xv = domMin + (i / steps) * domSpan;
    const d = activePdf(xv);
    if (Number.isFinite(d) && d > peakCurve) peakCurve = d;
  }
  const maxDensity = Math.max(peakCurve * 1.15, ...m.bins.map((b) => b.density * 1.12), 1e-6);
  const yAtDensity = (d) => bottom - (d / maxDensity) * plotH;

  let h = '';
  const modelLabel = distModel === 'normal' ? `Cpk=${m.cpk.toFixed(2)}, Ppk=${m.ppk.toFixed(2)}` : `${activeDistLabel} Ppk=${m.ppk.toFixed(2)}`;
  const titleText = `${capState.label || 'Measurements'}${capState.unit ? ` (${capState.unit})` : ''} — n=${m.n}, ${modelLabel}`;
  h += `<text x="${left}" y="30" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" data-cap-dbl="label" style="cursor:pointer;"><title>Double-click to rename Characteristic</title>${escapeHtml(titleText)}</text>`;

  for (let i = 0; i <= 4; i++) {
    const y = top + (plotH * i) / 4;
    h += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${PALETTE.border}" stroke-width="1" />`;
  }

  m.bins.forEach((b) => {
    const bx = xAt(b.x0);
    const bw = Math.max(2, xAt(b.x1) - bx - 2);
    const by = yAtDensity(b.density);
    const bh = Math.max(0, bottom - by);
    const fill = b.outOfSpec ? PALETTE.crimson : PALETTE.teal;
    const stroke = b.outOfSpec ? PALETTE.rose : PALETTE.emerald;
    if (bh > 0) {
      h += `<rect x="${(bx + 1).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${fill}" fill-opacity="0.72" stroke="${stroke}" stroke-width="1.2" rx="2" />`;
      if (b.count > 0) {
        h += `<text x="${(bx + 1 + bw / 2).toFixed(1)}" y="${(by - 5).toFixed(1)}" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10" font-weight="700">${b.count}</text>`;
      }
    }
  });

  // Fitted Curve (Normal, Lognormal, or Non-Parametric KDE)
  let curveD = '';
  for (let i = 0; i <= steps; i++) {
    const xv = domMin + (i / steps) * domSpan;
    const xp = xAt(xv);
    const yp = yAtDensity(activePdf(xv));
    curveD += (i === 0 ? 'M ' : ' L ') + `${xp.toFixed(1)} ${yp.toFixed(1)}`;
  }
  h += `<path d="${curveD}" fill="none" stroke="${PALETTE.emerald}" stroke-width="3" stroke-linejoin="round" />`;

  // Within-subgroup Normal Curve (Normal mode only)
  if (distModel === 'normal') {
    const withinPdf = (x) => {
      const z = (x - m.mean) / m.withinSigma;
      return Math.exp(-0.5 * z * z) / (m.withinSigma * Math.sqrt(2 * Math.PI));
    };
    let withinD = '';
    for (let i = 0; i <= steps; i++) {
      const xv = domMin + (i / steps) * domSpan;
      const xp = xAt(xv);
      const yp = Math.max(top - 10, yAtDensity(withinPdf(xv)));
      withinD += (i === 0 ? 'M ' : ' L ') + `${xp.toFixed(1)} ${yp.toFixed(1)}`;
    }
    h += `<path d="${withinD}" fill="none" stroke="${PALETTE.icemint}" stroke-width="1.8" stroke-dasharray="5 4" />`;
  }

  // Center line (Mean for Normal, Median P50 for Lognormal / Non-Parametric)
  const xCenter = xAt(centerVal);
  const centerLbl = distModel === 'normal' ? `x̄ ${centerVal.toFixed(2)}` : `P50 ${centerVal.toFixed(2)}`;
  h += `<line x1="${xCenter.toFixed(1)}" y1="${top}" x2="${xCenter.toFixed(1)}" y2="${bottom}" stroke="${PALETTE.emerald}" stroke-width="2" stroke-dasharray="4 3" />`;
  h += `<rect x="${(xCenter - 46).toFixed(1)}" y="${top - 22}" width="92" height="20" rx="4" fill="${PALETTE.panel}" stroke="${PALETTE.emerald}" stroke-width="1.5" />`;
  h += `<text x="${xCenter.toFixed(1)}" y="${top - 8}" text-anchor="middle" fill="${PALETTE.emerald}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10.5" font-weight="700">${centerLbl}</text>`;

  // Draggable & OOB-safe LSL & USL lines
  const xLslRaw = Math.max(left, Math.min(right, xAt(m.lsl)));
  const xUslRaw = Math.max(left, Math.min(right, xAt(m.usl)));
  const badgeW = 96;
  const halfB = badgeW / 2;
  const xLslBadge = Math.max(left + halfB, Math.min(right - halfB, xLslRaw));
  const xUslBadge = Math.max(left + halfB, Math.min(right - halfB, xUslRaw));
  const specsOverlap = Math.abs(xUslBadge - xLslBadge) < badgeW + 6;

  const drawSpec = (xp, bx, val, label, key, yOff) => {
    h += `<g class="drag-ew" data-cap-data-drag="${key}" data-cap-dbl="${key}">`;
    h += `<line x1="${xp.toFixed(1)}" y1="${top - 6}" x2="${xp.toFixed(1)}" y2="${bottom + 8}" stroke="${PALETTE.magenta}" stroke-width="2.5" stroke-dasharray="6 4" />`;
    h += `<line x1="${xp.toFixed(1)}" y1="${top - 6}" x2="${xp.toFixed(1)}" y2="${bottom + 8}" stroke="transparent" stroke-width="22" />`;
    h += `<rect x="${(bx - halfB).toFixed(1)}" y="${yOff}" width="${badgeW}" height="22" rx="4" fill="${PALETTE.panel}" stroke="${PALETTE.magenta}" stroke-width="1.8" />`;
    h += `<text x="${bx.toFixed(1)}" y="${yOff + 15}" text-anchor="middle" fill="${PALETTE.rose}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10.5" font-weight="700">${label} ${val.toFixed(2)}</text>`;
    h += `<title>Drag to move ${label}, double-click to type exact value</title></g>`;
  };
  drawSpec(xLslRaw, xLslBadge, m.lsl, 'LSL', 'lsl', top + 8);
  drawSpec(xUslRaw, xUslBadge, m.usl, 'USL', 'usl', specsOverlap ? top + 34 : top + 8);

  // Dynamic X Axis ticks
  h += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${PALETTE.icemint}" stroke-width="2" />`;
  const tickN = 8;
  for (let i = 0; i <= tickN; i++) {
    const val = domMin + (domSpan * i) / tickN;
    const tx = xAt(val);
    h += `<line x1="${tx.toFixed(1)}" y1="${bottom}" x2="${tx.toFixed(1)}" y2="${bottom + 6}" stroke="${PALETTE.icemint}" stroke-width="1.5" />`;
    h += `<text x="${tx.toFixed(1)}" y="${bottom + 20}" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11">${val.toFixed(2)}</text>`;
  }

  // ±3σ / 6σ Equivalent Process Spread Bar (99.73% band)
  const xSpLow = Math.max(left, Math.min(right, xAt(spreadLow)));
  const xSpHigh = Math.max(left, Math.min(right, xAt(spreadHigh)));
  const xSpMid = Math.max(left, Math.min(right, xAt(centerVal)));
  const lowTag = distModel === 'normal' ? `-3σ (${spreadLow.toFixed(2)})` : `P0.135 (${spreadLow.toFixed(2)})`;
  const highTag = distModel === 'normal' ? `+3σ (${spreadHigh.toFixed(2)})` : `P99.865 (${spreadHigh.toFixed(2)})`;
  const spreadTitle = distModel === 'normal' ? `6σ = ${(spreadHigh - spreadLow).toFixed(2)}` : `99.73% Spread = ${(spreadHigh - spreadLow).toFixed(2)}`;

  h += `<line x1="${xSpLow.toFixed(1)}" y1="${top}" x2="${xSpLow.toFixed(1)}" y2="404" stroke="${PALETTE.copper}" stroke-width="1.4" stroke-dasharray="3 3" />`;
  h += `<line x1="${xSpHigh.toFixed(1)}" y1="${top}" x2="${xSpHigh.toFixed(1)}" y2="404" stroke="${PALETTE.copper}" stroke-width="1.4" stroke-dasharray="3 3" />`;
  h += `<rect x="${xSpLow.toFixed(1)}" y="392" width="${Math.max(2, xSpHigh - xSpLow).toFixed(1)}" height="12" rx="3" fill="${PALETTE.copper}" fill-opacity="0.35" stroke="${PALETTE.copper}" stroke-width="1.5" />`;
  h += `<line x1="${xSpMid.toFixed(1)}" y1="390" x2="${xSpMid.toFixed(1)}" y2="406" stroke="${PALETTE.emerald}" stroke-width="2" />`;
  h += `<text x="${xSpLow.toFixed(1)}" y="421" text-anchor="${xSpLow < left + 75 ? 'start' : 'middle'}" fill="${PALETTE.copper}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10.5" font-weight="700">${lowTag}</text>`;
  h += `<text x="${xSpHigh.toFixed(1)}" y="421" text-anchor="${xSpHigh > right - 75 ? 'end' : 'middle'}" fill="${PALETTE.copper}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10.5" font-weight="700">${highTag}</text>`;
  if (xSpHigh - xSpLow > 180) {
    h += `<text x="${((xSpLow + xSpHigh) / 2).toFixed(1)}" y="421" text-anchor="middle" fill="${PALETTE.rose}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10.5" font-weight="700">${spreadTitle}</text>`;
  }

  // Bottom summary strip
  h += `<rect x="${left}" y="440" width="${plotW}" height="28" rx="4" fill="${PALETTE.card}" stroke="${PALETTE.border}" stroke-width="1.5" />`;
  h += `<text x="506" y="458" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11" font-weight="700">${distModel === 'normal' ? `Overall Ppk ${m.ppk.toFixed(2)}  |  Within Cpk ${m.cpk.toFixed(2)}` : `${activeDistLabel} Ppk ${m.ppk.toFixed(2)}`}   |   ${spreadTitle}   |   Observed Yield: ${m.observedYieldPct.toFixed(2)}%</text>`;

  dataRoot.innerHTML = h;

  // Render Companion I-MR Run Chart
  if (imrSvg) {
    renderIMRChart(imrSvg, m);
  }
}

function renderIMRChart(svg, m) {
  const left = 72;
  const right = 940;
  const top = 36;
  const bottom = 224;
  const plotW = right - left;
  const plotH = bottom - top;

  const allVals = [...m.samples, m.imr.uclI, m.imr.lclI];
  const minY = Math.min(...allVals);
  const maxY = Math.max(...allVals);
  const pad = Math.max(1e-6, (maxY - minY) * 0.14);
  const yMin = minY - pad;
  const yMax = maxY + pad;

  const xIdx = (i) => left + (m.n === 1 ? plotW / 2 : (i / (m.n - 1)) * plotW);
  const yVal = (v) => bottom - ((v - yMin) / (yMax - yMin)) * plotH;

  let html = `<rect x="0" y="0" width="1000" height="270" fill="${PALETTE.canvas}" />`;

  // Horizontal control zones
  [
    { v: m.imr.uclI, lbl: `UCL ${m.imr.uclI.toFixed(2)}`, col: PALETTE.crimson, dash: '6 4' },
    { v: m.imr.clI, lbl: `CL ${m.imr.clI.toFixed(2)}`, col: PALETTE.emerald, dash: '4 3' },
    { v: m.imr.lclI, lbl: `LCL ${m.imr.lclI.toFixed(2)}`, col: PALETTE.crimson, dash: '6 4' },
  ].forEach((line) => {
    const y = yVal(line.v);
    html += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${line.col}" stroke-width="1.8" stroke-dasharray="${line.dash}" />`;
    html += `<text x="${left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${line.col}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10" font-weight="700">${line.lbl}</text>`;
  });

  // Baseline
  html += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="${PALETTE.border}" stroke-width="1.5" />`;

  // Series polyline
  const polyPts = m.samples.map((v, i) => `${xIdx(i).toFixed(1)},${yVal(v).toFixed(1)}`).join(' ');
  html += `<polyline points="${polyPts}" fill="none" stroke="${PALETTE.icemint}" stroke-width="2" />`;

  const oocSet = new Set(m.imr.oocIndices);
  m.samples.forEach((v, i) => {
    const cx = xIdx(i);
    const cy = yVal(v);
    const isOoc = oocSet.has(i);
    html += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${isOoc ? 5.5 : 3.5}" fill="${isOoc ? PALETTE.crimson : PALETTE.emerald}" stroke="${isOoc ? PALETTE.rose : PALETTE.canvas}" stroke-width="1.5" />`;
    if (isOoc) {
      html += `<text x="${cx.toFixed(1)}" y="${(cy - 9).toFixed(1)}" text-anchor="middle" fill="${PALETTE.rose}" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700">#${i + 1}</text>`;
    }
  });

  // Sample index ticks
  const step = Math.max(1, Math.ceil(m.n / 12));
  for (let i = 0; i < m.n; i += step) {
    html += `<text x="${xIdx(i).toFixed(1)}" y="${bottom + 18}" text-anchor="middle" fill="${PALETTE.teal}" font-family="ui-monospace, monospace" font-size="10">${i + 1}</text>`;
  }

  const ruleText = m.imr.isStable
    ? 'I-Chart: Process in statistical control (No Rule 1 or 8-pt run violations)'
    : `I-Chart Alert: ${m.imr.oocIndices.length} special-cause point(s) at sample(s) ${m.imr.oocIndices.map((i) => `#${i + 1}`).join(', ')}`;
  html += `<text x="${left}" y="20" fill="${m.imr.isStable ? PALETTE.emerald : PALETTE.rose}" font-family="ui-monospace, monospace" font-size="11" font-weight="700">${escapeHtml(ruleText)}</text>`;

  svg.innerHTML = html;
}

export function renderCapability() {
  const cap = getState().capability;
  const isData = cap.mode === 'data';

  document.getElementById('cap-mode-data')?.classList.toggle('active', isData);
  document.getElementById('cap-mode-sim')?.classList.toggle('active', !isData);

  document.getElementById('cap-legend-sim')?.classList.toggle('hidden', isData);
  document.getElementById('cap-legend-data')?.classList.toggle('hidden', !isData);

  document.getElementById('cap-sim-controls')?.classList.toggle('hidden', isData);
  document.getElementById('cap-sim-presets')?.classList.toggle('hidden', isData);
  document.getElementById('cap-data-controls')?.classList.toggle('hidden', !isData);
  document.getElementById('cap-data-presets')?.classList.toggle('hidden', !isData);
  document.getElementById('cap-imr-card')?.classList.toggle('hidden', !isData);

  const simRoot = document.getElementById('cap-sim-root');
  const dataRoot = document.getElementById('cap-data-root');
  if (simRoot) {
    simRoot.classList.toggle('hidden', isData);
    simRoot.setAttribute('data-export-hidden', isData ? 'true' : 'false');
  }
  if (dataRoot) {
    dataRoot.classList.toggle('hidden', !isData);
    dataRoot.setAttribute('data-export-hidden', isData ? 'false' : 'true');
  }

  const dragStatus = document.getElementById('cap-drag-status');
  if (dragStatus) {
    dragStatus.textContent = isData ? `Empirical (n=${(cap.samples || []).length})` : 'Ready';
  }

  if (isData) {
    renderDataModeView(cap);
  } else {
    renderSimulatorView(cap);
  }
}

export function bindCapabilityEvents({ onOpenImport }) {
  const svg = document.getElementById('svg-capability');
  const status = document.getElementById('cap-drag-status');

  document.getElementById('cap-mode-data')?.addEventListener('click', () => {
    getState().capability.mode = 'data';
    renderCapability();
    persistState();
  });
  document.getElementById('cap-mode-sim')?.addEventListener('click', () => {
    getState().capability.mode = 'simulator';
    renderCapability();
    persistState();
  });
  document.getElementById('btn-cap-import')?.addEventListener('click', () => {
    if (onOpenImport) onOpenImport('capability');
  });

  const setDist = (model) => {
    const cap = getState().capability;
    if (['lognormal', 'weibull', 'loglogistic'].includes(model) && (cap.samples || []).some((v) => v <= 0)) {
      showToast(`${model} requires all measurements > 0`, true);
      return;
    }
    cap.distModel = model;
    renderCapability();
    persistState();
  };
  document.getElementById('cap-dist-auto')?.addEventListener('click', () => setDist('auto'));
  document.getElementById('cap-dist-normal')?.addEventListener('click', () => setDist('normal'));
  document.getElementById('cap-dist-lognormal')?.addEventListener('click', () => setDist('lognormal'));
  document.getElementById('cap-dist-weibull')?.addEventListener('click', () => setDist('weibull'));
  document.getElementById('cap-dist-loglogistic')?.addEventListener('click', () => setDist('loglogistic'));
  document.getElementById('cap-dist-nonparam')?.addEventListener('click', () => setDist('nonparametric'));

  // Data Mode inputs
  document.getElementById('cap-data-label')?.addEventListener('input', (e) => {
    getState().capability.label = e.target.value;
    renderCapability();
    persistState();
  });
  document.getElementById('cap-data-unit')?.addEventListener('input', (e) => {
    getState().capability.unit = e.target.value;
    renderCapability();
    persistState();
  });
  document.getElementById('cap-data-lsl')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v)) {
      getState().capability.lsl = v;
      renderCapability();
      persistState();
    }
  });
  document.getElementById('cap-data-usl')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v)) {
      getState().capability.usl = v;
      renderCapability();
      persistState();
    }
  });
  document.getElementById('btn-cap-apply-raw')?.addEventListener('click', () => {
    const raw = document.getElementById('cap-data-raw')?.value || '';
    const nums = raw
      .replace(/\$/g, '')
      .split(/[\n\t;]+|,(?!\d{3}(?:\D|$))|\s+/)
      .map((s) => Number(s.trim().replace(/,/g, '')))
      .filter((v) => Number.isFinite(v));
    if (nums.length < 2) {
      showToast('Provide at least 2 numeric measurements', true);
      return;
    }
    const cap = getState().capability;
    cap.samples = nums;
    const emp = computeEmpiricalCapability(nums, cap.lsl, cap.usl);
    // If existing LSL/USL are way outside the new dataset scale (e.g. switching from 50 to 25.0), auto-frame once
    if (emp && (cap.usl < emp.min - 10 * emp.overallSigma || cap.lsl > emp.max + 10 * emp.overallSigma)) {
      cap.lsl = Number((emp.mean - 3.5 * emp.overallSigma).toFixed(3));
      cap.usl = Number((emp.mean + 3.5 * emp.overallSigma).toFixed(3));
    }
    setModuleSource('capability', 'manual', `Manual / Pasted (${nums.length} samples)`);
    renderCapability();
    renderAllSourceBadges();
    persistState();
    showToast(`Updated ${nums.length} measurements`);
  });

  // Simulator SVG Dragging
  function toSvgPt(cx, cy) {
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const ctm = svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
  }

  function startDrag(kind, cx, cy) {
    const cap = getState().capability;
    if (cap.mode !== 'simulator') return;
    capDragging = kind;
    const domX = capXToDom(toSvgPt(cx, cy).x);
    if (kind === 'mu') {
      capDragOffset = domX - cap.mu;
      status.textContent = 'Shifting Mean (μ)';
    } else if (kind === 'lsl') {
      capDragOffset = domX - cap.lsl;
      status.textContent = 'Adjusting LSL';
    } else if (kind === 'usl') {
      capDragOffset = domX - cap.usl;
      status.textContent = 'Adjusting USL';
    }
  }

  function moveDrag(cx, cy) {
    if (!capDragging) return;
    const cap = getState().capability;
    const raw = capXToDom(toSvgPt(cx, cy).x) - capDragOffset;
    const val = Math.round(raw * 10) / 10;
    if (capDragging === 'mu') {
      cap.mu = Math.max(5, Math.min(95, val));
    } else if (capDragging === 'lsl') {
      cap.lsl = Math.max(0, Math.min(cap.usl - 1, val));
    } else if (capDragging === 'usl') {
      cap.usl = Math.min(100, Math.max(cap.lsl + 1, val));
    }
    setModuleSource('capability', 'manual', `Manual / Pasted (${nums.length} samples)`);
    renderCapability();
    renderAllSourceBadges();
    persistState();
  }

  function endDrag() {
    if (capDataDragging) {
      capDataDragging = null;
      status.textContent = `Empirical (n=${(getState().capability.samples || []).length})`;
      renderCapability();
      return;
    }
    if (!capDragging) return;
    capDragging = null;
    status.textContent = 'Ready';
  }

  // Data Mode LSL/USL Dragging + Double-Click Inline Editor
  svg?.addEventListener('mousedown', (e) => {
    if (getState().capability.mode !== 'data') return;
    const hit = e.target.closest('[data-cap-data-drag]');
    if (!hit) return;
    e.preventDefault();
    capDataDragging = hit.dataset.capDataDrag;
    status.textContent = `Adjusting ${capDataDragging.toUpperCase()}`;
  });
  svg?.addEventListener(
    'touchstart',
    (e) => {
      if (getState().capability.mode !== 'data' || !e.touches.length) return;
      const hit = e.target.closest('[data-cap-data-drag]');
      if (!hit) return;
      e.preventDefault();
      capDataDragging = hit.dataset.capDataDrag;
      status.textContent = `Adjusting ${capDataDragging.toUpperCase()}`;
    },
    { passive: false }
  );

  function moveDataDrag(cx, cy) {
    const cap = getState().capability;
    const svgX = toSvgPt(cx, cy).x;
    const { left, plotW, domMin, domSpan, decimals } = capDataDomain;
    const ratio = Math.max(0, Math.min(1, (svgX - left) / plotW));
    const rawVal = domMin + ratio * domSpan;
    const factor = Math.pow(10, decimals);
    const val = Math.round(rawVal * factor) / factor;
    const minGap = Math.max(1 / factor, domSpan * 0.01);
    if (capDataDragging === 'lsl') {
      cap.lsl = Math.min(cap.usl - minGap, val);
    } else if (capDataDragging === 'usl') {
      cap.usl = Math.max(cap.lsl + minGap, val);
    }
    renderCapability();
    persistState();
  }

  const inlineInput = document.getElementById('cap-inline-edit');
  let inlineField = null;

  function commitInlineEdit() {
    if (!inlineField || !inlineInput) return;
    const cap = getState().capability;
    const raw = inlineInput.value.trim();
    if (inlineField === 'label') {
      if (raw) cap.label = raw;
    } else {
      const num = parseFloat(raw);
      if (Number.isFinite(num)) {
        if (inlineField === 'lsl') cap.lsl = num;
        else if (inlineField === 'usl') cap.usl = num;
      }
    }
    inlineField = null;
    inlineInput.classList.add('hidden');
    renderCapability();
    persistState();
  }

  svg?.addEventListener('dblclick', (e) => {
    if (getState().capability.mode !== 'data' || !inlineInput) return;
    const hit = e.target.closest('[data-cap-dbl]');
    if (!hit) return;
    const field = hit.dataset.capDbl;
    const cap = getState().capability;
    const wellRect = svg.parentElement.getBoundingClientRect();
    const tgtRect = hit.getBoundingClientRect();

    inlineField = field;
    inlineInput.value = field === 'label' ? cap.label || '' : String(cap[field]);
    inlineInput.style.left = `${Math.max(8, Math.min(wellRect.width - 180, tgtRect.left - wellRect.left))}px`;
    inlineInput.style.top = `${Math.max(8, tgtRect.top - wellRect.top)}px`;
    inlineInput.style.width = field === 'label' ? '220px' : '110px';
    inlineInput.classList.remove('hidden');
    inlineInput.focus();
    inlineInput.select();
  });

  inlineInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitInlineEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      inlineField = null;
      inlineInput.classList.add('hidden');
    }
  });
  inlineInput?.addEventListener('blur', commitInlineEdit);

  [
    ['cap-fills', 'mu'],
    ['cap-outline-grp', 'mu'],
    ['cap-mu-grp', 'mu'],
    ['cap-ruler-grp', 'mu'],
    ['cap-lsl-grp', 'lsl'],
    ['cap-usl-grp', 'usl'],
  ].forEach(([id, kind]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startDrag(kind, e.clientX, e.clientY);
    });
    el.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length) {
          e.preventDefault();
          startDrag(kind, e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );
  });

  window.addEventListener('mousemove', (e) => {
    if (capDataDragging) moveDataDrag(e.clientX, e.clientY);
    else if (capDragging) moveDrag(e.clientX, e.clientY);
  });
  window.addEventListener(
    'touchmove',
    (e) => {
      if (capDataDragging && e.touches.length) {
        e.preventDefault();
        moveDataDrag(e.touches[0].clientX, e.touches[0].clientY);
      } else if (capDragging && e.touches.length) {
        e.preventDefault();
        moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    { passive: false }
  );
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);
  window.addEventListener('touchcancel', endDrag);

  const bindPair = (slId, inId, setter) => {
    document.getElementById(slId)?.addEventListener('input', (e) => {
      setter(parseFloat(e.target.value));
      renderCapability();
      persistState();
    });
    document.getElementById(inId)?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (!Number.isNaN(v)) {
        setter(v);
        renderCapability();
        persistState();
      }
    });
    document.getElementById(inId)?.addEventListener('blur', renderCapability);
  };

  bindPair('cap-sl-mu', 'cap-in-mu', (v) => {
    getState().capability.mu = Math.max(5, Math.min(95, v));
  });
  bindPair('cap-sl-sigma', 'cap-in-sigma', (v) => {
    getState().capability.sigma = Math.max(1.5, Math.min(12, v));
  });
  bindPair('cap-sl-lsl', 'cap-in-lsl', (v) => {
    const cap = getState().capability;
    cap.lsl = Math.max(0, Math.min(cap.usl - 1, v));
  });
  bindPair('cap-sl-usl', 'cap-in-usl', (v) => {
    const cap = getState().capability;
    cap.usl = Math.min(100, Math.max(cap.lsl + 1, v));
  });

  const capPresets = {
    centered: { mu: 50, sigma: 4.5, lsl: 30, usl: 70 },
    shifted: { mu: 63, sigma: 5.0, lsl: 30, usl: 70 },
    tight: { mu: 50, sigma: 6.2, lsl: 38, usl: 62 },
    reset: { mu: 50, sigma: 5.0, lsl: 30, usl: 70 },
  };
  document.querySelectorAll('.cap-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = capPresets[btn.dataset.preset];
      if (p) {
        Object.assign(getState().capability, p);
        renderCapability();
        persistState();
      }
    });
  });
}
