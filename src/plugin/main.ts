import { UIMessage, PluginMessage, ScanResults, TypographyGroup, LibraryEntry } from './types';
import { loadColorTokens, loadTypographyGroups, getDebugLog, importTextStylesByKeys, resetDebugLog } from './variables';
import { scanNodes } from './scanner';
import { prepareTokenCache } from './matcher';
import { fixColorIssue, fixTextIssue, fixTextGroupNodes } from './fixer';

// Show the UI
figma.showUI(__html__, { width: 380, height: 560, themeColors: true });

// Skip hidden instance children for performance
figma.skipInvisibleInstanceChildren = true;

// Cache scan results and typography groups
var lastResults: ScanResults | null = null;
var cachedTypoGroups: TypographyGroup[] = [];
var scanCancelled = false;

// ============================================================
// Runtime message validation
// ============================================================

var VALID_TYPES = ['scan', 'text-style-keys', 'save-settings', 'load-settings', 'link-selected', 'fix-all', 'select-text-group', 'select-node', 'cancel-scan', 'fix-text-group', 'fix-text-groups-batch'];

function isValidMessage(msg: unknown): msg is UIMessage {
  if (!msg || typeof msg !== 'object') return false;
  var m = msg as Record<string, unknown>;
  if (typeof m.type !== 'string' || VALID_TYPES.indexOf(m.type) === -1) return false;
  return true;
}

// ============================================================
// Message handler: UI → Plugin
// ============================================================

figma.ui.onmessage = async function(msg: UIMessage) {
  if (!isValidMessage(msg)) {
    console.warn('[Mirror Link] Ignored invalid message:', msg);
    return;
  }

  switch (msg.type) {
    case 'scan': {
      resetDebugLog();

      // If scan includes text style keys (fetched by UI via REST API), import them first
      if (msg.textStyleKeys && msg.textStyleKeys.length > 0) {
        send({ type: 'loading-tokens', message: 'Importing ' + msg.textStyleKeys.length + ' text styles...' });
        var importedStyles = await importTextStylesByKeys(msg.textStyleKeys);
        cachedTypoGroups = importedStyles;
        console.log('[Mirror Link] Imported ' + importedStyles.length + ' text styles before scan');
      }

      await handleScan(msg.scope);
      break;
    }

    case 'text-style-keys': {
      // UI fetched text style keys via REST API — import them
      console.log('[Mirror Link] Received ' + msg.keys.length + ' text style keys from REST API');
      var imported = await importTextStylesByKeys(msg.keys);
      console.log('[Mirror Link] Imported ' + imported.length + ' text styles');

      // Merge with cached typography groups
      cachedTypoGroups = imported;
      send({ type: 'text-styles-imported', count: imported.length });

      // Re-scan if we have previous results (to update text matches)
      if (lastResults) {
        await handleScan('page');
      }
      break;
    }

    case 'save-settings': {
      // API token goes to clientStorage (per-user, encrypted, not shared with file editors)
      await figma.clientStorage.setAsync('figmaApiToken', msg.apiToken);
      // Library file keys stay in pluginData (non-sensitive, shared across team)
      figma.root.setPluginData('libraryFileKeys', JSON.stringify(msg.libraryFileKeys));
      console.log('[Mirror Link] Settings saved (' + msg.libraryFileKeys.length + ' libraries)');
      break;
    }

    case 'load-settings': {
      // Migrate: if token exists in pluginData (old insecure storage), move to clientStorage and wipe
      var legacyToken = figma.root.getPluginData('figmaApiToken');
      if (legacyToken) {
        await figma.clientStorage.setAsync('figmaApiToken', legacyToken);
        figma.root.setPluginData('figmaApiToken', '');
        console.log('[Mirror Link] Migrated API token from pluginData to clientStorage');
      }

      // Migrate: old single libraryFileKey → new array format
      var legacySingleKey = figma.root.getPluginData('libraryFileKey');
      var libraryFileKeys: LibraryEntry[] = [];
      var rawKeys = figma.root.getPluginData('libraryFileKeys');
      if (rawKeys) {
        try { libraryFileKeys = JSON.parse(rawKeys); } catch (e) { console.warn('[Mirror Link] Corrupt libraryFileKeys data, resetting:', e); }
      }
      if (libraryFileKeys.length === 0 && legacySingleKey) {
        libraryFileKeys = [{ key: legacySingleKey, label: 'Library' }];
        figma.root.setPluginData('libraryFileKeys', JSON.stringify(libraryFileKeys));
        figma.root.setPluginData('libraryFileKey', '');
        console.log('[Mirror Link] Migrated single libraryFileKey to array format');
      }

      var token = (await figma.clientStorage.getAsync('figmaApiToken')) || '';
      send({ type: 'settings-loaded', apiToken: token, libraryFileKeys: libraryFileKeys });
      break;
    }

    case 'link-selected': {
      if (!lastResults) return;

      var selColorIssues = lastResults.colorIssues.filter(function(i) {
        return msg.colorIssueIds.indexOf(i.id) !== -1 && i.match;
      });
      var selTextIssues = lastResults.textIssues.filter(function(i) {
        return msg.textIssueIds.indexOf(i.id) !== -1 && i.suggestedGroupData;
      });

      var total = selColorIssues.length + selTextIssues.length;
      send({ type: 'fix-started', total: total });

      var fixed = 0, failed = 0, done = 0;

      for (var ci = 0; ci < selColorIssues.length; ci++) {
        if (await fixColorIssue(selColorIssues[ci])) fixed++; else failed++;
        done++;
        if (done % 10 === 0 || done === total) send({ type: 'fix-progress', done: done, total: total });
      }

      for (var ti = 0; ti < selTextIssues.length; ti++) {
        if (await fixTextIssue(selTextIssues[ti])) fixed++; else failed++;
        done++;
        if (done % 10 === 0 || done === total) send({ type: 'fix-progress', done: done, total: total });
      }

      send({ type: 'fix-complete', fixed: fixed, failed: failed });
      await handleScan('page');
      break;
    }

    case 'fix-all': {
      if (!lastResults) return;

      var confidenceOrder = ['exact', 'high', 'medium', 'low'];
      var threshold = confidenceOrder.indexOf(msg.minConfidence);

      var allColorIssues = lastResults.colorIssues.filter(function(i) {
        return i.match && confidenceOrder.indexOf(i.match.confidence) <= threshold;
      });
      var allTextIssues = lastResults.textIssues.filter(function(i) {
        return i.confidence && confidenceOrder.indexOf(i.confidence) <= threshold;
      });

      var allTotal = allColorIssues.length + allTextIssues.length;
      send({ type: 'fix-started', total: allTotal });

      var allFixed = 0, allFailed = 0, allDone = 0;

      for (var aci = 0; aci < allColorIssues.length; aci++) {
        if (await fixColorIssue(allColorIssues[aci])) allFixed++; else allFailed++;
        allDone++;
        if (allDone % 10 === 0 || allDone === allTotal) send({ type: 'fix-progress', done: allDone, total: allTotal });
      }

      for (var ati = 0; ati < allTextIssues.length; ati++) {
        if (await fixTextIssue(allTextIssues[ati])) allFixed++; else allFailed++;
        allDone++;
        if (allDone % 10 === 0 || allDone === allTotal) send({ type: 'fix-progress', done: allDone, total: allTotal });
      }

      send({ type: 'fix-complete', fixed: allFixed, failed: allFailed });
      await handleScan('page');
      break;
    }

    case 'select-text-group': {
      // Select all nodes in the group on the Figma canvas
      var selectedNodes: SceneNode[] = [];
      for (var sni = 0; sni < msg.nodeIds.length; sni++) {
        try {
          var sn = await figma.getNodeByIdAsync(msg.nodeIds[sni]);
          if (sn) selectedNodes.push(sn as SceneNode);
        } catch (e) { console.warn('[Mirror Link] Node lookup failed:', msg.nodeIds[sni], e); }
      }
      if (selectedNodes.length > 0) {
        figma.currentPage.selection = selectedNodes;
        figma.viewport.scrollAndZoomIntoView(selectedNodes);
      }
      console.log('[Mirror Link] Selected ' + selectedNodes.length + ' text nodes on canvas');
      break;
    }

    case 'fix-text-group': {
      send({ type: 'fix-started', total: msg.nodeIds.length });
      var groupResult = await fixTextGroupNodes(
        msg.nodeIds,
        msg.textStyleId,
        function(done: number, total: number) {
          send({ type: 'fix-progress', done: done, total: total });
        }
      );
      // Surface failure reasons via debug log
      if (groupResult.failureReasons.length > 0) {
        var debugLines = ['=== TEXT GROUP APPLY FAILURES ==='];
        for (var fri = 0; fri < groupResult.failureReasons.length; fri++) {
          debugLines.push('  ' + groupResult.failureReasons[fri]);
        }
        send({ type: 'debug-log', lines: debugLines });
      }
      send({ type: 'fix-complete', fixed: groupResult.fixed, failed: groupResult.failed });
      // Refresh scan to remove fixed nodes from list
      await handleScan('page');
      break;
    }

    case 'fix-text-groups-batch': {
      var batchTotal = 0;
      for (var bi = 0; bi < msg.assignments.length; bi++) batchTotal += msg.assignments[bi].nodeIds.length;
      send({ type: 'fix-started', total: batchTotal });

      var batchFixed = 0, batchFailed = 0, batchDone = 0;
      var batchFailureReasons: string[] = [];

      for (var ai = 0; ai < msg.assignments.length; ai++) {
        var assignment = msg.assignments[ai];
        var res = await fixTextGroupNodes(
          assignment.nodeIds,
          assignment.textStyleId,
          function(done: number, _total: number) {
            send({ type: 'fix-progress', done: batchDone + done, total: batchTotal });
          }
        );
        batchFixed += res.fixed;
        batchFailed += res.failed;
        batchDone += assignment.nodeIds.length;
        for (var fri2 = 0; fri2 < res.failureReasons.length; fri2++) {
          batchFailureReasons.push(res.failureReasons[fri2]);
        }
      }

      if (batchFailureReasons.length > 0) {
        var debugLines2 = ['=== BATCH APPLY FAILURES ==='];
        for (var fri3 = 0; fri3 < batchFailureReasons.length; fri3++) {
          debugLines2.push('  ' + batchFailureReasons[fri3]);
        }
        send({ type: 'debug-log', lines: debugLines2 });
      }
      send({ type: 'fix-complete', fixed: batchFixed, failed: batchFailed });
      await handleScan('page');
      break;
    }

    case 'cancel-scan': {
      scanCancelled = true;
      console.log('[Mirror Link] Scan cancelled by user');
      break;
    }

    case 'select-node': {
      var selectNode = await figma.getNodeByIdAsync(msg.nodeId);
      if (selectNode) {
        figma.currentPage.selection = [selectNode as SceneNode];
        figma.viewport.scrollAndZoomIntoView([selectNode as SceneNode]);
      }
      break;
    }

    default: {
      console.warn('[Mirror Link] Unrecognized message type:', (msg as any).type);
      break;
    }
  }
};

// ============================================================
// Scan handler
// ============================================================

async function handleScan(scope: 'page' | 'selection') {
  try {
    scanCancelled = false;
    var nodes: SceneNode[] =
      scope === 'selection'
        ? figma.currentPage.selection.slice()
        : figma.currentPage.findAll();

    send({ type: 'scan-started', totalNodes: nodes.length });
    send({ type: 'loading-tokens', message: 'Loading design system tokens...' });

    var colorTokens = await loadColorTokens();
    prepareTokenCache(colorTokens);
    send({ type: 'loading-tokens', message: 'Loading typography...' });

    // Use cached REST API text styles if available, otherwise load from other strategies
    var typoGroups: TypographyGroup[];
    if (cachedTypoGroups.length > 0) {
      typoGroups = cachedTypoGroups;
    } else {
      typoGroups = await loadTypographyGroups();
    }

    send({ type: 'loading-tokens', message: 'Scanning ' + nodes.length + ' nodes...' });

    var results = await scanNodes(
      nodes,
      colorTokens,
      typoGroups,
      function(processed: number, total: number) {
        send({ type: 'scan-progress', processed: processed, total: total });
      },
      function() { return scanCancelled; }
    );

    if (scanCancelled) {
      send({ type: 'scan-error', message: 'Scan cancelled' });
      return;
    }

    results.colorTokensLoaded = colorTokens.length;
    results.textStylesLoaded = typoGroups.length;
    lastResults = results;

    // Add scan summary diagnostics to debug log
    var debugLines = getDebugLog();
    debugLines.push('');
    debugLines.push('=== SCAN SUMMARY ===');
    debugLines.push('Typography groups used: ' + typoGroups.length + (cachedTypoGroups.length > 0 ? ' (from REST API)' : ' (fallback)'));
    debugLines.push('Color issues: ' + results.colorIssues.length + ' (matched: ' + results.colorIssues.filter(function(i) { return i.match !== null; }).length + ')');

    var textMatched = results.textIssues.filter(function(i) { return i.suggestedGroupData !== null; }).length;
    var textWithStyleId = results.textIssues.filter(function(i) { return i.suggestedGroupData !== null && i.suggestedGroupData.textStyleId !== null; }).length;
    debugLines.push('Text issues: ' + results.textIssues.length + ' (matched: ' + textMatched + ', with styleId: ' + textWithStyleId + ')');

    // Log a few matched text issues for verification
    var matchedTextIssues = results.textIssues.filter(function(i) { return i.suggestedGroupData !== null; });
    for (var mti = 0; mti < Math.min(5, matchedTextIssues.length); mti++) {
      var mt = matchedTextIssues[mti];
      debugLines.push('  "' + mt.nodeName + '" ' + mt.fontSize + 'px ' + mt.fontWeight + ' → "' + mt.suggestedStyleName + '" styleId=' + (mt.suggestedGroupData ? mt.suggestedGroupData.textStyleId : 'null'));
    }
    // Also log unmatched for debugging
    var unmatchedText = results.textIssues.filter(function(i) { return i.suggestedGroupData === null; });
    if (unmatchedText.length > 0) {
      debugLines.push('Unmatched text examples:');
      for (var uti = 0; uti < Math.min(5, unmatchedText.length); uti++) {
        debugLines.push('  "' + unmatchedText[uti].nodeName + '" ' + unmatchedText[uti].fontSize + 'px ' + unmatchedText[uti].fontWeight);
      }
    }

    send({ type: 'debug-log', lines: debugLines });
    send({ type: 'scan-complete', results: results });
  } catch (err) {
    console.error('[Mirror Link] Scan failed:', err);
    send({ type: 'debug-log', lines: ['SCAN ERROR: ' + String(err)] });
    send({ type: 'scan-error', message: String(err) });
  }
}

function send(msg: PluginMessage) {
  figma.ui.postMessage(msg);
}

// ============================================================
// Design Mirror integration: auto-scan on recent import
// (placed after handleScan and send are defined)
// ============================================================

(function checkDesignMirrorImport() {
  try {
    var lastImport = figma.root.getPluginData('designMirrorLastImport');
    if (lastImport) {
      var importTime = parseInt(lastImport, 10);
      var elapsed = Date.now() - importTime;
      if (elapsed < 60000) {
        console.log('[Mirror Link] Design Mirror import detected (' + Math.round(elapsed / 1000) + 's ago) — auto-scanning');
        setTimeout(function() {
          send({ type: 'loading-tokens', message: 'Auto-scan triggered by Design Mirror import...' });
          handleScan('page');
        }, 500);
      }
    }
  } catch (e) {
    console.log('[Mirror Link] Design Mirror check skipped:', e);
  }
})();
