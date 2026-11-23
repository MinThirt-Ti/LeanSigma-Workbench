import { bindCapabilityEvents, initCapabilityGrid, renderCapability } from './modules/capability.js';
import { bindOEEEvents, renderOEE } from './modules/oee.js';
import { bindTaktEvents, renderTakt } from './modules/takt.js';
import { bindParetoEvents, renderPareto } from './modules/pareto.js';
import { bindVSMEvents, renderVSM } from './modules/vsm.js';
import { bind5SEvents, render5S } from './modules/fives.js';
import { bindIshikawaEvents, renderIshikawa } from './modules/ishikawa.js';
import { bindExportAndHeaderEvents, syncScenarioSelect, updateExportClock } from './modules/export.js';
import { bindImportDrawer, closeImportDrawer, isImportDrawerOpen, openImportDrawer } from './data/importDrawer.js';
import { bindNavigationEvents, resolveInitialTab, switchTab } from './ui/navigation.js';
import { renderAllSourceBadges } from './ui/sourceBadge.js';

export function renderAllModules() {
  renderCapability();
  renderOEE();
  renderTakt();
  renderPareto();
  renderVSM();
  render5S();
  renderIshikawa();
  renderAllSourceBadges();
}

function bootstrap() {
  initCapabilityGrid();

  const ctx = {
    renderAll: renderAllModules,
    onOpenImport: openImportDrawer,
    onCloseImport: closeImportDrawer,
    isImportOpen: isImportDrawerOpen,
  };

  bindCapabilityEvents(ctx);
  bindOEEEvents(ctx);
  bindTaktEvents(ctx);
  bindParetoEvents(ctx);
  bindVSMEvents(ctx);
  bind5SEvents();
  bindIshikawaEvents();
  bindImportDrawer(ctx);
  bindExportAndHeaderEvents(ctx);
  bindNavigationEvents(ctx);

  syncScenarioSelect();
  renderAllModules();
  switchTab(resolveInitialTab(), { updateHash: false });
  updateExportClock();
  setInterval(updateExportClock, 1000);
}

bootstrap();
