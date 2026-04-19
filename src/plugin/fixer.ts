import { ColorIssue, TextIssue } from './types';
import { weightNumberToFigmaStyle } from './utils';

/**
 * Load ALL fonts used in a text node (handles mixed font ranges).
 * Must be called before modifying any text properties.
 */
async function loadAllFontsForNode(textNode: TextNode): Promise<void> {
  if (textNode.fontName === figma.mixed) {
    // Mixed fonts — load each character range's font
    var len = textNode.characters.length;
    var loadedFonts = new Set<string>();
    for (var i = 0; i < len; i++) {
      try {
        var fn = textNode.getRangeFontName(i, i + 1) as FontName;
        var fontKey = fn.family + '::' + fn.style;
        if (!loadedFonts.has(fontKey)) {
          loadedFonts.add(fontKey);
          await figma.loadFontAsync(fn);
        }
      } catch (e) {}
    }
  } else {
    await figma.loadFontAsync(textNode.fontName as FontName);
  }
}

/**
 * Fix a single unlinked color by binding it to a Variable or applying a Paint Style.
 * Preserves the original paint opacity so colors don't look "washed out".
 * Only applies exact/high confidence matches to avoid changing colors.
 */
export async function fixColorIssue(issue: ColorIssue): Promise<boolean> {
  if (!issue.match) return false;

  if (issue.match.confidence !== 'exact' && issue.match.confidence !== 'high') {
    return false;
  }

  var node = await figma.getNodeByIdAsync(issue.nodeId);
  if (!node) return false;

  try {
    if (issue.match.tokenSource === 'variable') {
      var variable = await figma.variables.getVariableByIdAsync(issue.match.tokenId);
      if (!variable) return false;

      if (issue.property === 'fill' && 'fills' in node) {
        var fills = (node as any).fills;
        if (fills === figma.mixed) return false;
        fills = fills.slice();
        var paint = fills[issue.paintIndex];
        if (!paint || paint.type !== 'SOLID') return false;

        var originalOpacity = paint.opacity != null ? paint.opacity : 1;
        var boundPaint = figma.variables.setBoundVariableForPaint(paint, 'color', variable);
        if (boundPaint.opacity !== originalOpacity) {
          var clonedPaint = JSON.parse(JSON.stringify(boundPaint)) as { opacity: number } & typeof boundPaint;
          clonedPaint.opacity = originalOpacity;
          boundPaint = clonedPaint;
        }
        fills[issue.paintIndex] = boundPaint;
        (node as any).fills = fills;

      } else if (issue.property === 'stroke' && 'strokes' in node) {
        var strokes = (node as any).strokes;
        if (strokes === figma.mixed) return false;
        strokes = strokes.slice();
        var strokePaint = strokes[issue.paintIndex];
        if (!strokePaint || strokePaint.type !== 'SOLID') return false;

        var originalStrokeOpacity = strokePaint.opacity != null ? strokePaint.opacity : 1;
        var boundStroke = figma.variables.setBoundVariableForPaint(strokePaint, 'color', variable);
        if (boundStroke.opacity !== originalStrokeOpacity) {
          var clonedStroke = JSON.parse(JSON.stringify(boundStroke)) as { opacity: number } & typeof boundStroke;
          clonedStroke.opacity = originalStrokeOpacity;
          boundStroke = clonedStroke;
        }
        strokes[issue.paintIndex] = boundStroke;
        (node as any).strokes = strokes;
      }

      return true;

    } else if (issue.match.tokenSource === 'paint-style') {
      if (issue.property === 'fill' && 'setFillStyleIdAsync' in node) {
        await (node as any).setFillStyleIdAsync(issue.match.tokenId);
        return true;
      } else if (issue.property === 'stroke' && 'setStrokeStyleIdAsync' in node) {
        await (node as any).setStrokeStyleIdAsync(issue.match.tokenId);
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('[Mirror Link] Fix failed for node ' + issue.nodeId + ':', err);
    return false;
  }
}

/**
 * Fix a single unlinked text node.
 * Strategy:
 *   1. If variable IDs are available → bind variables (best: creates real link)
 *   2. Otherwise → apply the correct values directly from the Olympus theme
 *      (makes text match the design system even without variable binding)
 */
export async function fixTextIssue(issue: TextIssue): Promise<boolean> {
  var group = issue.suggestedGroupData;
  if (!group) return false;

  var node = await figma.getNodeByIdAsync(issue.nodeId);
  if (!node || node.type !== 'TEXT') return false;

  var textNode = node as TextNode;

  try {
    // Load ALL fonts used in this text node (required before any text changes)
    await loadAllFontsForNode(textNode);

    // BEST: Apply Text Style directly (creates a real link in Figma)
    if (group.textStyleId) {
      console.log('[Mirror Link] Linking "' + textNode.name + '" → text style "' + group.name + '" (id=' + group.textStyleId + ')');

      try {
        // Also try to load the style's font
        var style = await figma.getStyleByIdAsync(group.textStyleId);
        if (style && style.type === 'TEXT') {
          var tsFont = (style as TextStyle).fontName;
          await figma.loadFontAsync(tsFont);
        }
      } catch (e) {
        console.log('[Mirror Link]   Could not pre-load style font: ' + String(e));
      }

      try {
        await textNode.setTextStyleIdAsync(group.textStyleId);
        console.log('[Mirror Link]   textStyleId set successfully');
        return true;
      } catch (e) {
        console.error('[Mirror Link]   setTextStyleIdAsync failed: ' + String(e));
        // Fall through to value-based fix
      }
    }

    // FALLBACK: Apply values directly
    console.log('[Mirror Link] Fallback: applying values for "' + group.name + '" to "' + textNode.name + '"');

    var targetWeight = weightNumberToFigmaStyle(group.fontWeight || 400);
    try {
      var family = 'Inter';
      if (textNode.fontName !== figma.mixed) { family = (textNode.fontName as FontName).family; }
      await figma.loadFontAsync({ family: family, style: targetWeight });
    } catch (e) {
      console.warn('[Mirror Link] Font load failed:', e);
    }

    var changed = false;

    if (group.fontSize !== null && textNode.fontSize !== figma.mixed) {
      try { textNode.fontSize = group.fontSize; changed = true; } catch (e) {
        console.error('[Mirror Link]   fontSize failed: ' + String(e));
      }
    }
    if (group.fontWeight !== null && textNode.fontName !== figma.mixed) {
      try {
        var cf = textNode.fontName as FontName;
        textNode.fontName = { family: cf.family, style: targetWeight };
        changed = true;
      } catch (e) {
        console.error('[Mirror Link]   fontWeight failed: ' + String(e));
      }
    }

    return changed;
  } catch (err) {
    console.error('[Mirror Link] Text fix failed for node ' + issue.nodeId + ':', err);
    return false;
  }
}

/**
 * Fix an entire text group: apply a single textStyleId to all node IDs.
 * Returns per-node reasons for any failures so UI can surface them.
 */
export async function fixTextGroupNodes(
  nodeIds: string[],
  textStyleId: string,
  onProgress: (done: number, total: number) => void
): Promise<{ fixed: number; failed: number; failureReasons: string[] }> {
  var fixed = 0;
  var failed = 0;
  var failureReasons: string[] = [];

  console.log('[Mirror Link] fix-text-group: starting with ' + nodeIds.length + ' nodes, styleId=' + textStyleId);

  // Pre-load the style's font
  var styleValid = false;
  try {
    var style = await figma.getStyleByIdAsync(textStyleId);
    if (!style) {
      console.error('[Mirror Link] Style not found for id=' + textStyleId);
      failureReasons.push('Style not found (id=' + textStyleId + '). Style may not be imported yet.');
    } else if (style.type !== 'TEXT') {
      console.error('[Mirror Link] Style is not TEXT type: ' + style.type);
      failureReasons.push('Style is not a text style (type=' + style.type + ')');
    } else {
      await figma.loadFontAsync((style as TextStyle).fontName);
      styleValid = true;
      console.log('[Mirror Link] Pre-loaded style font: ' + (style as TextStyle).fontName.family + ' ' + (style as TextStyle).fontName.style);
    }
  } catch (e) {
    console.error('[Mirror Link] Could not pre-load style font: ' + String(e));
    failureReasons.push('Failed to load style font: ' + String(e));
  }

  if (!styleValid) {
    // No point trying individual nodes if the style itself is invalid
    return { fixed: 0, failed: nodeIds.length, failureReasons: failureReasons };
  }

  for (var i = 0; i < nodeIds.length; i++) {
    var nodeId = nodeIds[i];
    try {
      var node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        failed++;
        failureReasons.push(nodeId + ': node not found');
        continue;
      }
      if (node.type !== 'TEXT') {
        failed++;
        failureReasons.push(nodeId + ': not a text node (type=' + node.type + ')');
        continue;
      }

      var textNode = node as TextNode;
      await loadAllFontsForNode(textNode);
      await textNode.setTextStyleIdAsync(textStyleId);

      // Verify it actually applied
      if (textNode.textStyleId === textStyleId) {
        fixed++;
      } else {
        failed++;
        failureReasons.push(textNode.name + ': assignment did not persist (actual=' + String(textNode.textStyleId) + ')');
        console.warn('[Mirror Link] setTextStyleIdAsync did not persist on "' + textNode.name + '"');
      }
    } catch (e) {
      failed++;
      var reason = nodeId + ': ' + String(e);
      failureReasons.push(reason);
      console.error('[Mirror Link] Group fix failed for ' + reason);
    }

    if ((i + 1) % 20 === 0 || i === nodeIds.length - 1) {
      onProgress(i + 1, nodeIds.length);
    }
  }

  console.log('[Mirror Link] fix-text-group done: ' + fixed + ' fixed, ' + failed + ' failed');
  return { fixed: fixed, failed: failed, failureReasons: failureReasons };
}
