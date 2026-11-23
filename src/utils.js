export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function truncateText(str, maxLen) {
  const s = String(str || '');
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}

export function dateStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function formatPPM(ppm) {
  if (!Number.isFinite(ppm) || ppm < 0) return '0.0';
  if (ppm >= 10000) return Math.round(ppm).toLocaleString('en-US');
  if (ppm >= 100) return ppm.toFixed(1);
  if (ppm >= 1) return ppm.toFixed(2);
  if (ppm >= 0.001) return ppm.toFixed(3);
  return '<0.001';
}

export function formatNum(val, decimals = 2) {
  if (!Number.isFinite(val)) return '—';
  return val.toFixed(decimals);
}

export function csvRow(fields) {
  return fields
    .map((v) => {
      const s = String(v == null ? '' : v);
      return /[",\n\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}

export function tsvRow(fields) {
  return fields
    .map((v) => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' '))
    .join('\t');
}

export function triggerDownload(filename, content, mimeType) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('Clipboard copy unavailable');
  return true;
}
