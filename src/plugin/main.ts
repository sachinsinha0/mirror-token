import { UIMessage, PluginMessage, ScanResults, TypographyGroup } from './types';
import { loadColorTokens, loadTypographyGroups, getDebugLog, importTextStylesByKeys, resetDebugLog } from './variables';
import { scanNodes } from './scanner';
import { fixColorIssue, fixTextIssue, fixTextGroupNodes } from './fixer';

// Show the UI
figma.showUI(__html__, { width: 380, height: 560, themeColors: true });

// Skip hidden instance children for performance
figma.skipInvisibleInstanceChildren = true;

// Cache scan results and typography groups
var lastResults: ScanResults | null = null;
var cachedTypoGroups: TypographyGroup[] = [];

// ============================================================
// Message handler: UI → Plugin
// ============================================================

figma.ui.onmessage = async function(msg: UIMessage) {
  switch (msg.type) {
    case 'scan': {
      resetDebugLog();

      // If scan includes text style keys (fetched by UI via REST API), import them first
      if (msg.textStyleKeys && msg.textStyleKeys.length > 0) {
        send({ type: 'loading-tokens', message: 'Importing ' + msg.textStyleKeys.length + ' text styles...' });
        var importedStyles = await importTextStylesByKeys(msg.textStyleKeys);
        cachedTypoGroups = importedStyles;
        console.log('[Mirror Token] Imported ' + importedStyles.length + ' text styles before scan');
      }

      await handleScan(msg.scope);
      break;
    }

    case 'text-style-keys': {
      // UI fetched text style keys via REST API — import them
      console.log('[Mirror Token] Received ' + msg.keys.length + ' text style keys from REST API');
      var imported = await importTextStylesByKeys(msg.keys);
      console.log('[Mirror Token] Imported ' + imported.length + ' text styles');

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
      figma.root.setPluginData('figmaApiToken', msg.apiToken);
      figma.root.setPluginData('libraryFileKey', msg.libraryFileKey);
      console.log('[Mirror Token] Settings saved');
      break;
    }

    case 'load-settings': {
      var token = figma.root.getPluginData('figmaApiToken') || '';
      var fileKey = figma.root.getPluginData('libraryFileKey') || 'VCFZJgU9KnGWy7KtxBxSy1';
      send({ type: 'settings-loaded', apiToken: token, libraryFileKey: fileKey });
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
        } catch (e) {}
      }
      if (selectedNodes.length > 0) {
        figma.currentPage.selection = selectedNodes;
        figma.viewport.scrollAndZoomIntoView(selectedNodes);
      }
      console.log('[Mirror Token] Selected ' + selectedNodes.length + ' text nodes on canvas');
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
  }
};

// ============================================================
// Scan handler
// ============================================================

async function handleScan(scope: 'page' | 'selection') {
  var nodes: SceneNode[] =
    scope === 'selection'
      ? figma.currentPage.selection.slice()
      : figma.currentPage.findAll();

  send({ type: 'scan-started', totalNodes: nodes.length });
  send({ type: 'loading-tokens', message: 'Loading design system tokens...' });

  var colorTokens = await loadColorTokens();
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
    }
  );

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
}

function send(msg: PluginMessage) {
  figma.ui.postMessage(msg);
}
