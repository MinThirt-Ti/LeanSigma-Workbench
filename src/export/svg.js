import { PALETTE, SVG_NS, TAB_NAMES } from '../constants.js';
import { getState } from '../state.js';
import { dateStamp, escapeHtml, triggerDownload, truncateText } from '../utils.js';
import { showToast } from '../ui/toast.js';

const SVG_ELEMENT_MAP = {
  capability: 'svg-capability',
  oee: 'svg-oee',
  takt: 'svg-takt',
  pareto: 'svg-pareto',
  vsm: 'svg-vsm',
  fives: 'svg-fives',
  ishikawa: 'svg-ishikawa',
};

function txt(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  return (el.value !== undefined && el.tagName === 'INPUT' ? el.value : el.textContent || '').trim();
}

function getModuleSnapshotMeta(moduleKey) {
  if (moduleKey === 'capability') {
    const kpis = [
      { label: txt('cap-lbl-1') || 'Cp', value: txt('cap-val-cp'), sub: txt('cap-sub-cp'), accent: PALETTE.icemint },
      { label: txt('cap-lbl-2') || 'Cpk', value: txt('cap-val-cpk'), sub: txt('cap-bottleneck'), accent: PALETTE.emerald },
      { label: txt('cap-lbl-3') || 'Mean', value: txt('cap-val-cpu'), sub: txt('cap-sub-cpu'), accent: PALETTE.icemint },
      { label: txt('cap-lbl-4') || 'Sigma', value: txt('cap-val-cpl'), sub: txt('cap-sub-cpl'), accent: PALETTE.icemint },
      { label: txt('cap-lbl-5') || 'PPM', value: txt('cap-val-ppm'), sub: txt('cap-yield'), accent: PALETTE.copper },
      { label: txt('cap-lbl-6') || 'Stability', value: txt('cap-val-sigma'), sub: txt('cap-sub-sigma'), accent: PALETTE.magenta },
    ];
    const imrCard = document.getElementById('cap-imr-card');
    const companionId = imrCard && !imrCard.classList.contains('hidden') ? 'svg-capability-imr' : null;
    return { kpis, companionId };
  }
  if (moduleKey === 'oee') {
    const kpis = [
      { label: 'OEE', value: txt('oee-val-main'), sub: txt('oee-badge-main'), accent: PALETTE.emerald },
      { label: 'Availability', value: txt('oee-val-avail'), sub: txt('oee-sub-avail'), accent: PALETTE.crimson },
      { label: 'Performance', value: txt('oee-val-perf'), sub: txt('oee-sub-perf'), accent: PALETTE.copper },
      { label: 'Quality', value: txt('oee-val-qual'), sub: txt('oee-sub-qual'), accent: PALETTE.magenta },
      { label: 'Good Units', value: txt('oee-val-good'), sub: txt('oee-sub-good'), accent: PALETTE.emerald },
    ];
    const trendCard = document.getElementById('oee-trend-card');
    const companionId = trendCard && !trendCard.classList.contains('hidden') ? 'svg-oee-trend' : null;
    return { kpis, companionId };
  }
  if (moduleKey === 'takt') {
    return {
      kpis: [
        { label: 'Takt', value: txt('takt-val-takt'), sub: 'Target Cycle Pace', accent: PALETTE.magenta },
        { label: 'Bottleneck', value: txt('takt-val-bottle'), sub: txt('takt-sub-bottle'), accent: PALETTE.crimson },
        { label: 'Efficiency', value: txt('takt-val-eff'), sub: 'Line Balance', accent: PALETTE.emerald },
        { label: 'Headcount', value: txt('takt-val-head'), sub: 'Min Operators', accent: PALETTE.icemint },
      ],
      companionId: null,
    };
  }
  if (moduleKey === 'pareto') {
    return {
      kpis: [
        { label: 'Total', value: txt('par-val-total'), sub: 'Aggregated Impact', accent: PALETTE.icemint },
        { label: 'Vital Few', value: txt('par-val-vital'), sub: txt('par-sub-vital'), accent: PALETTE.magenta },
        { label: 'Top Driver', value: txt('par-val-top'), sub: txt('par-sub-top'), accent: PALETTE.crimson },
      ],
      companionId: null,
    };
  }
  if (moduleKey === 'vsm') {
    return {
      kpis: [
        { label: 'Lead Time', value: txt('vsm-val-lead'), sub: txt('vsm-sub-lead'), accent: PALETTE.crimson },
        { label: 'Value Time', value: txt('vsm-val-va'), sub: txt('vsm-sub-va'), accent: PALETTE.emerald },
        { label: 'PCE', value: txt('vsm-val-pce'), sub: 'Process Cycle Eff.', accent: PALETTE.magenta },
        { label: 'Steps', value: txt('vsm-val-steps'), sub: txt('vsm-sub-ops'), accent: PALETTE.icemint },
      ],
      companionId: null,
    };
  }
  if (moduleKey === 'fives') {
    return {
      kpis: [
        { label: '5S Score', value: txt('fives-val-score'), sub: txt('fives-sub-score'), accent: PALETTE.emerald },
        { label: 'Target', value: txt('fives-val-target'), sub: 'Benchmark', accent: PALETTE.magenta },
        { label: 'Lowest Pillar', value: txt('fives-val-lowest'), sub: txt('fives-sub-lowest'), accent: PALETTE.copper },
        { label: 'Open Actions', value: txt('fives-val-actions'), sub: 'Corrective Items', accent: PALETTE.crimson },
      ],
      companionId: null,
    };
  }
  if (moduleKey === 'ishikawa') {
    const ribs = getState().ishikawa?.ribs || {};
    let totalCauses = 0;
    let rootCount = 0;
    Object.values(ribs).forEach((arr) => {
      totalCauses += arr.length;
      rootCount += arr.filter((c) => c.root).length;
    });
    return {
      kpis: [
        { label: 'Problem Statement', value: truncateText(txt('ish-in-problem') || 'Effect', 34), sub: 'Fishbone Head', accent: PALETTE.crimson },
        { label: 'Total Causes', value: String(totalCauses), sub: 'Across 6M Ribs', accent: PALETTE.icemint },
        { label: 'Root Suspects', value: String(rootCount), sub: 'Flagged Factors', accent: PALETTE.magenta },
      ],
      companionId: null,
    };
  }
  return { kpis: [], companionId: null };
}

function cleanClonedSvgInner(svgEl, targetW) {
  const clone = svgEl.cloneNode(true);
  clone.querySelectorAll('[data-export-hidden="true"], .hidden').forEach((el) => el.remove());
  const vb = (clone.getAttribute('viewBox') || '0 0 1000 480').split(/\s+/).map(Number);
  const vbW = vb[2] || 1000;
  const vbH = vb[3] || 480;
  const scaledH = Math.round((vbH / vbW) * targetW);
  const inner = new XMLSerializer().serializeToString(clone);
  return { vbW, vbH, scaledH, serialized: inner.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''), viewBox: `${vb[0] || 0} ${vb[1] || 0} ${vbW} ${vbH}` };
}

/**
 * Serializes a complete standalone SVG snapshot for a module, including header,
 * data source provenance, KPI cards, primary chart, and companion chart (if active).
 */
export function serializeStandaloneSVG(moduleKey) {
  const id = SVG_ELEMENT_MAP[moduleKey];
  const svgEl = id ? document.getElementById(id) : null;
  if (!svgEl) return null;

  const totalW = 1040;
  const padX = 20;
  const innerW = totalW - padX * 2;
  const headerH = 62;
  const kpiH = 74;
  const gap = 14;

  const { kpis, companionId } = getModuleSnapshotMeta(moduleKey);
  const primary = cleanClonedSvgInner(svgEl, innerW);
  const compEl = companionId ? document.getElementById(companionId) : null;
  const companion = compEl ? cleanClonedSvgInner(compEl, innerW) : null;

  const kpiTop = headerH + gap;
  const primaryTop = kpiTop + (kpis.length > 0 ? kpiH + gap : 0);
  const companionTop = primaryTop + primary.scaledH + gap;
  const totalH = companion
    ? companionTop + companion.scaledH + padX
    : primaryTop + primary.scaledH + padX;

  const sourceLabel = getState()[moduleKey]?.source?.label || 'LeanSigma';
  const titleLabel = `LEANSIGMA — ${(TAB_NAMES[moduleKey] || moduleKey).toUpperCase()}`;
  const timeLabel = new Date().toLocaleString();

  let kpiSvg = '';
  if (kpis.length > 0) {
    const kGap = 10;
    const cardW = (innerW - kGap * (kpis.length - 1)) / kpis.length;
    kpis.forEach((k, idx) => {
      const x = padX + idx * (cardW + kGap);
      kpiSvg += `
        <rect x="${x.toFixed(1)}" y="${kpiTop}" width="${cardW.toFixed(1)}" height="${kpiH}" rx="6" fill="${PALETTE.card}" stroke="${PALETTE.border}" stroke-width="1.5" />
        <text x="${(x + 12).toFixed(1)}" y="${kpiTop + 20}" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="700">${escapeHtml(k.label.toUpperCase())}</text>
        <text x="${(x + 12).toFixed(1)}" y="${kpiTop + 46}" fill="${k.accent}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="${k.value.length > 14 ? '13' : '19'}" font-weight="700">${escapeHtml(truncateText(k.value, 28))}</text>
        <text x="${(x + 12).toFixed(1)}" y="${kpiTop + 63}" fill="${PALETTE.teal}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="10">${escapeHtml(truncateText(k.sub, 28))}</text>
      `;
    });
  }

  const companionSvg = companion
    ? `
      <rect x="${padX}" y="${companionTop}" width="${innerW}" height="${companion.scaledH}" rx="6" fill="${PALETTE.canvas}" stroke="${PALETTE.border}" stroke-width="1.5" />
      <svg x="${padX}" y="${companionTop}" width="${innerW}" height="${companion.scaledH}" viewBox="${companion.viewBox}">
        ${companion.serialized}
      </svg>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <style>text { font-family: Inter, system-ui, -apple-system, sans-serif; }</style>
  <rect x="0" y="0" width="${totalW}" height="${totalH}" fill="${PALETTE.canvas}" />
  <rect x="${padX}" y="12" width="${innerW}" height="${headerH - 12}" rx="6" fill="${PALETTE.card}" stroke="${PALETTE.magenta}" stroke-width="1.8" />
  <text x="${padX + 16}" y="38" fill="${PALETTE.rose}" font-size="16" font-weight="700" letter-spacing="0.8">${escapeHtml(titleLabel)}</text>
  <text x="${padX + 16}" y="54" fill="${PALETTE.emerald}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11">${escapeHtml(sourceLabel)}</text>
  <text x="${totalW - padX - 16}" y="44" text-anchor="end" fill="${PALETTE.teal}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="11">${escapeHtml(timeLabel)}</text>
  ${kpiSvg}
  <rect x="${padX}" y="${primaryTop}" width="${innerW}" height="${primary.scaledH}" rx="6" fill="${PALETTE.canvas}" stroke="${PALETTE.border}" stroke-width="1.5" />
  <svg x="${padX}" y="${primaryTop}" width="${innerW}" height="${primary.scaledH}" viewBox="${primary.viewBox}">
    ${primary.serialized}
  </svg>
  ${companionSvg}
</svg>`;
}

export function downloadSVG(moduleKey, renderAll) {
  if (renderAll) renderAll();
  const svgStr = serializeStandaloneSVG(moduleKey);
  if (!svgStr) {
    showToast('Switch to an analytical module to export SVG', true);
    return;
  }
  triggerDownload(`leansigma_${moduleKey}_${dateStamp()}.svg`, svgStr, 'image/svg+xml;charset=utf-8');
  showToast(`Exported ${TAB_NAMES[moduleKey] || moduleKey} SVG Snapshot`);
}
