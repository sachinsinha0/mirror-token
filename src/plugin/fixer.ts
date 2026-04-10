import { ColorIssue, TextIssue } from './types';

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
          boundPaint = JSON.parse(JSON.stringify(boundPaint));
          boundPaint.opacity = originalOpacity;
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
          boundStroke = JSON.parse(JSON.stringify(boundStroke));
          boundStroke.opacity = originalStrokeOpacity;
        }
        strokes[issue.paintIndex] = boundStroke;
        (node as any).strokes = strokes;
      }

      return true;

    } else if (issue.match.tokenSource === 'paint-style') {
      if (issue.property === 'fill' && 'fillStyleId' in node) {
        (node as any).fillStyleId = issue.match.tokenId;
        return true;
      } else if (issue.property === 'stroke' && 'strokeStyleId' in node) {
        (node as any).strokeStyleId = issue.match.tokenId;
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('[Mirror Token] Fix failed for node ' + issue.nodeId + ':', err);
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
      console.log('[Mirror Token] Linking "' + textNode.name + '" → text style "' + group.name + '" (id=' + group.textStyleId + ')');

      try {
        // Also try to load the style's font
        var style = figma.getStyleById(group.textStyleId);
        if (style && style.type === 'TEXT') {
          var tsFont = (style as TextStyle).fontName;
          await figma.loadFontAsync(tsFont);
        }
      } catch (e) {
        console.log('[Mirror Token]   Could not pre-load style font: ' + String(e));
      }

      try {
        textNode.textStyleId = group.textStyleId;
        console.log('[Mirror Token]   textStyleId set successfully');
        return true;
      } catch (e) {
        console.error('[Mirror Token]   textStyleId assignment failed: ' + String(e));
        // Fall through to value-based fix
      }
    }

    // FALLBACK: Apply values directly
    console.log('[Mirror Token] Fallback: applying values for "' + group.name + '" to "' + textNode.name + '"');

    var targetWeight = weightNumberToFigmaStyle(group.fontWeight || 400);
    try {
      var family = 'Inter';
      if (textNode.fontName !== figma.mixed) { family = (textNode.fontName as FontName).family; }
      await figma.loadFontAsync({ family: family, style: targetWeight });
    } catch (e) {}

    var changed = false;

    if (group.fontSize !== null && textNode.fontSize !== figma.mixed) {
      try { textNode.fontSize = group.fontSize; changed = true; } catch (e) {
        console.error('[Mirror Token]   fontSize failed: ' + String(e));
      }
    }
    if (group.fontWeight !== null && textNode.fontName !== figma.mixed) {
      try {
        var cf = textNode.fontName as FontName;
        textNode.fontName = { family: cf.family, style: targetWeight };
        changed = true;
      } catch (e) {
        console.error('[Mirror Token]   fontWeight failed: ' + String(e));
      }
    }

    return changed || true;
  } catch (err) {
    console.error('[Mirror Token] Text fix failed for node ' + issue.nodeId + ':', err);
    return false;
  }
}

/**
 * Convert a numeric font weight to Figma's font style string.
 * Figma uses style names like "Regular", "Bold", "Semi Bold", etc.
 */
function weightNumberToFigmaStyle(weight: number): string {
  if (weight <= 100) return 'Thin';
  if (weight <= 200) return 'Extra Light';
  if (weight <= 300) return 'Light';
  if (weight <= 400) return 'Regular';
  if (weight <= 500) return 'Medium';
  if (weight <= 600) return 'Semi Bold';
  if (weight <= 700) return 'Bold';
  if (weight <= 800) return 'Extra Bold';
  return 'Black';
}

/**
 * Fix an entire text group: apply a single textStyleId to all node IDs.
 */
export async function fixTextGroupNodes(
  nodeIds: string[],
  textStyleId: string,
  onProgress: (done: number, total: number) => void
): Promise<{ fixed: number; failed: number }> {
  var fixed = 0;
  var failed = 0;

  // Pre-load the style's font
  try {
    var style = figma.getStyleById(textStyleId);
    if (style && style.type === 'TEXT') {
      await figma.loadFontAsync((style as TextStyle).fontName);
    }
  } catch (e) {
    console.log('[Mirror Token] Could not pre-load style font: ' + String(e));
  }

  for (var i = 0; i < nodeIds.length; i++) {
    try {
      var node = await figma.getNodeByIdAsync(nodeIds[i]);
      if (!node || node.type !== 'TEXT') { failed++; continue; }

      var textNode = node as TextNode;
      await loadAllFontsForNode(textNode);
      textNode.textStyleId = textStyleId;
      fixed++;
    } catch (e) {
      console.error('[Mirror Token] Group fix failed for ' + nodeIds[i] + ': ' + String(e));
      failed++;
    }

    if ((i + 1) % 20 === 0 || i === nodeIds.length - 1) {
      onProgress(i + 1, nodeIds.length);
    }
  }

  return { fixed: fixed, failed: failed };
}
