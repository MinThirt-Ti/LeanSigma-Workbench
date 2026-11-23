import { PALETTE, TAB_NAMES } from '../constants.js';
import { dateStamp, triggerDownload } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { serializeStandaloneSVG } from './svg.js';

function svgToPngBlob(svgString, scale = 2) {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const root = doc.documentElement;
    const width = parseFloat(root.getAttribute('width')) || 1000;
    const height = parseFloat(root.getAttribute('height')) || 480;

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = PALETTE.canvas;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) reject(new Error('PNG encoding failed'));
          else resolve(blob);
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize SVG'));
    };

    img.src = url;
  });
}

export async function downloadPNG(moduleKey, renderAll) {
  if (renderAll) renderAll();
  const svgStr = serializeStandaloneSVG(moduleKey);
  if (!svgStr) {
    showToast('Switch to an analytical module to export PNG', true);
    return;
  }
  try {
    const blob = await svgToPngBlob(svgStr, 2);
    triggerDownload(`leansigma_${moduleKey}_${dateStamp()}.png`, blob, 'image/png');
    showToast(`Exported ${TAB_NAMES[moduleKey] || moduleKey} PNG`);
  } catch (err) {
    showToast(err.message || 'PNG export failed', true);
  }
}

export async function copyPNGToClipboard(moduleKey, renderAll) {
  if (renderAll) renderAll();
  const svgStr = serializeStandaloneSVG(moduleKey);
  if (!svgStr) {
    showToast('Switch to an analytical module first', true);
    return;
  }
  try {
    if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
      throw new Error('Image clipboard API not supported in this browser context');
    }
    const blob = await svgToPngBlob(svgStr, 2);
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
    showToast(`Copied ${TAB_NAMES[moduleKey] || moduleKey} PNG to clipboard`);
  } catch (err) {
    showToast(err.message || 'Could not copy image to clipboard', true);
  }
}
