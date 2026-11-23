import { getState, setState } from '../state.js';
import { dateStamp, triggerDownload } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { switchTab } from '../ui/navigation.js';

export function downloadJSONWorkspace() {
  const payload = JSON.stringify(getState(), null, 2);
  triggerDownload(`leansigma_workspace_${dateStamp()}.json`, payload, 'application/json;charset=utf-8');
  showToast('Saved Workspace JSON');
}

export function importJSONFile(file, renderAll) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (
        !parsed ||
        !parsed.capability ||
        !parsed.oee ||
        !parsed.takt ||
        !parsed.pareto ||
        !parsed.vsm ||
        !parsed.fives ||
        !parsed.ishikawa
      ) {
        showToast('Invalid workspace JSON structure', true);
        return;
      }
      const next = setState(parsed);
      if (renderAll) renderAll();
      switchTab(next.activeTab || 'capability');
      showToast('Workspace JSON Loaded');
    } catch {
      showToast('Failed to parse JSON file', true);
    }
  };
  reader.readAsText(file);
}
