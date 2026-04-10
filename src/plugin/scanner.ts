import { ColorIssue, TextIssue, TextGroup, ScanResults, RGBA, ColorToken, TypographyGroup, Confidence } from './types';
import { findBestColorMatch } from './matcher';

var BATCH_SIZE = 500;
var issueCounter = 0;

function nextId(): string {
  return 'issue-' + (++issueCounter);
}

function rgbaToHex(c: RGBA): string {
  var to255 = function(v: number) { return Math.round(v * 255); };
  var hex = function(v: number) { return to255(v).toString(16).padStart(2, '0'); };
  return '#' + hex(c.r) + hex(c.g) + hex(c.b);
}

function hasFills(node: SceneNode): node is SceneNode & { fills: readonly Paint[] } {
  return 'fills' in node && Array.isArray((node as any).fills);
}

function hasStrokes(node: SceneNode): node is SceneNode & { strokes: readonly Paint[] } {
  return 'strokes' in node && Array.isArray((node as any).strokes);
}

/**
 * Match a text node's properties against typography groups.
 * Returns the best matching group based on fontSize (primary) and fontWeight (secondary).
 */
function findBestTypographyMatch(
  fontSize: number,
  fontWeight: string,
  groups: TypographyGroup[]
): { group: TypographyGroup; confidence: Confidence } | null {
  var bestGroup: TypographyGroup | null = null;
  var bestScore = -1;

  // Normalize weight string to number for comparison
  var weightNum = parseWeightToNumber(fontWeight);

  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (g.fontSize === null) continue;

    var score = 0;
    var exactSize = false;

    // Font size match (most important)
    if (g.fontSize === fontSize) {
      score += 10;
      exactSize = true;
    } else if (Math.abs(g.fontSize - fontSize) <= 1) {
      score += 4;
    } else {
      continue; // fontSize must be close — skip entirely if not
    }

    // Font weight match (secondary)
    if (g.fontWeight !== null && weightNum > 0) {
      if (g.fontWeight === weightNum) {
        score += 5;
      } else if (Math.abs(g.fontWeight - weightNum) <= 100) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestGroup = g;
    }
  }

  if (!bestGroup || bestScore < 4) return null;

  // Confidence: "exact" only when both size AND weight match perfectly
  var confidence: Confidence =
    bestScore >= 15 ? 'exact' :
    bestScore >= 10 ? 'high' :
    bestScore >= 6 ? 'medium' : 'low';

  return { group: bestGroup, confidence: confidence };
}

/** Convert CSS weight names to numbers */
function parseWeightToNumber(w: string): number {
  var lower = w.toLowerCase().replace(/[\s-_]/g, '');
  if (lower === 'thin' || lower === 'hairline') return 100;
  if (lower === 'extralight' || lower === 'ultralight') return 200;
  if (lower === 'light') return 300;
  if (lower === 'regular' || lower === 'normal' || lower === 'book') return 400;
  if (lower === 'medium') return 500;
  if (lower === 'semibold' || lower === 'demibold') return 600;
  if (lower === 'bold') return 700;
  if (lower === 'extrabold' || lower === 'ultrabold') return 800;
  if (lower === 'black' || lower === 'heavy') return 900;
  var num = parseInt(w, 10);
  return isNaN(num) ? 0 : num;
}

export async function scanNodes(
  nodes: readonly SceneNode[],
  colorTokens: ColorToken[],
  typoGroups: TypographyGroup[],
  onProgress: (processed: number, total: number) => void
): Promise<ScanResults> {
  var startTime = Date.now();
  var colorIssues: ColorIssue[] = [];
  var textIssues: TextIssue[] = [];
  var totalLinkedTokens = 0;

  var ignoredRaw = figma.root.getPluginData('ignoredIssues');
  var ignoredSet = new Set<string>(ignoredRaw ? JSON.parse(ignoredRaw) : []);

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];

    // --- Check fills ---
    if (hasFills(node)) {
      var fills = node.fills;
      if (fills !== figma.mixed) {
        for (var idx = 0; idx < fills.length; idx++) {
          var fill = fills[idx];
          if (fill.type !== 'SOLID') continue;

          var bound = (node as any).boundVariables
            && (node as any).boundVariables.fills
            && (node as any).boundVariables.fills[idx];
          var hasFillStyle = (node as any).fillStyleId
            && (node as any).fillStyleId !== ''
            && (node as any).fillStyleId !== figma.mixed;

          if (bound || hasFillStyle) { totalLinkedTokens++; continue; }

          var rawRGBA: RGBA = { r: fill.color.r, g: fill.color.g, b: fill.color.b, a: fill.opacity != null ? fill.opacity : 1 };
          var match = findBestColorMatch(rawRGBA, colorTokens);
          var ignoreKey = node.id + ':fill:' + idx;

          if (!ignoredSet.has(ignoreKey)) {
            colorIssues.push({ id: nextId(), nodeId: node.id, nodeName: node.name, property: 'fill', paintIndex: idx, rawHex: rgbaToHex(rawRGBA), rawRGBA: rawRGBA, match: match });
          }
        }
      }
    }

    // --- Check strokes ---
    if (hasStrokes(node)) {
      var strokes = node.strokes;
      if (strokes !== figma.mixed) {
        for (var si = 0; si < strokes.length; si++) {
          var stroke = strokes[si];
          if (stroke.type !== 'SOLID') continue;

          var strokeBound = (node as any).boundVariables
            && (node as any).boundVariables.strokes
            && (node as any).boundVariables.strokes[si];
          var hasStrokeStyle = (node as any).strokeStyleId
            && (node as any).strokeStyleId !== ''
            && (node as any).strokeStyleId !== figma.mixed;

          if (strokeBound || hasStrokeStyle) { totalLinkedTokens++; continue; }

          var strokeRGBA: RGBA = { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b, a: stroke.opacity != null ? stroke.opacity : 1 };
          var strokeMatch = findBestColorMatch(strokeRGBA, colorTokens);
          var strokeIgnoreKey = node.id + ':stroke:' + si;

          if (!ignoredSet.has(strokeIgnoreKey)) {
            colorIssues.push({ id: nextId(), nodeId: node.id, nodeName: node.name, property: 'stroke', paintIndex: si, rawHex: rgbaToHex(strokeRGBA), rawRGBA: strokeRGBA, match: strokeMatch });
          }
        }
      }
    }

    // --- Check text ---
    if (node.type === 'TEXT') {
      var textNode = node as TextNode;

      // Check if fontSize is already bound to a variable
      var hasBoundFontSize = (textNode as any).boundVariables
        && (textNode as any).boundVariables.fontSize;
      var hasStyleId = textNode.textStyleId
        && typeof textNode.textStyleId === 'string'
        && textNode.textStyleId !== '';

      if (hasBoundFontSize || hasStyleId) {
        totalLinkedTokens++;
      } else {
        var fontSize = textNode.fontSize;
        var fontName = textNode.fontName;

        if (fontSize === figma.mixed || fontName === figma.mixed) {
          textIssues.push({
            id: nextId(), nodeId: node.id, nodeName: node.name,
            fontSize: typeof fontSize === 'number' ? fontSize : 0,
            fontFamily: fontName !== figma.mixed ? fontName.family : 'Mixed',
            fontWeight: fontName !== figma.mixed ? fontName.style : 'Mixed',
            suggestedGroup: null, suggestedGroupData: null,
            suggestedStyleId: null, suggestedStyleName: null,
            confidence: null,
          });
        } else {
          var typoMatch = findBestTypographyMatch(fontSize as number, fontName.style, typoGroups);

          textIssues.push({
            id: nextId(), nodeId: node.id, nodeName: node.name,
            fontSize: fontSize as number,
            fontFamily: fontName.family,
            fontWeight: fontName.style,
            suggestedGroup: typoMatch ? typoMatch.group.name : null,
            suggestedGroupData: typoMatch ? typoMatch.group : null,
            suggestedStyleId: null,
            suggestedStyleName: typoMatch ? typoMatch.group.name : null,
            confidence: typoMatch ? typoMatch.confidence : null,
          });
        }
      }
    }

    if ((i + 1) % BATCH_SIZE === 0 || i === nodes.length - 1) {
      onProgress(i + 1, nodes.length);
    }
  }

  // Group text issues by font signature
  var groupMap: Record<string, TextGroup> = {};
  for (var ti = 0; ti < textIssues.length; ti++) {
    var issue = textIssues[ti];
    if (issue.fontSize === 0 && issue.fontFamily === 'Mixed') continue;
    var groupKey = issue.fontFamily + '/' + issue.fontWeight + '/' + issue.fontSize;
    if (!groupMap[groupKey]) {
      // Find best auto-match for this group
      var groupMatch = findBestTypographyMatch(issue.fontSize, issue.fontWeight, typoGroups);
      groupMap[groupKey] = {
        key: groupKey,
        fontFamily: issue.fontFamily,
        fontWeight: issue.fontWeight,
        fontSize: issue.fontSize,
        nodeIds: [],
        count: 0,
        suggestedStyleName: groupMatch ? groupMatch.group.name : null,
        suggestedStyleId: groupMatch ? groupMatch.group.textStyleId : null,
      };
    }
    groupMap[groupKey].nodeIds.push(issue.nodeId);
    groupMap[groupKey].count++;
  }

  var textGroups: TextGroup[] = [];
  var gKeys = Object.keys(groupMap);
  for (var gi = 0; gi < gKeys.length; gi++) {
    textGroups.push(groupMap[gKeys[gi]]);
  }
  // Sort by count descending
  textGroups.sort(function(a, b) { return b.count - a.count; });

  // Build available text styles list for dropdown
  var availableTextStyles: Array<{ id: string; name: string; fontSize: number; fontWeight: number }> = [];
  for (var tgi = 0; tgi < typoGroups.length; tgi++) {
    var tg = typoGroups[tgi];
    if (tg.textStyleId && tg.fontSize !== null) {
      availableTextStyles.push({
        id: tg.textStyleId,
        name: tg.name,
        fontSize: tg.fontSize,
        fontWeight: tg.fontWeight || 400,
      });
    }
  }

  return {
    colorIssues: colorIssues,
    textIssues: textIssues,
    textGroups: textGroups,
    availableTextStyles: availableTextStyles,
    totalNodesScanned: nodes.length,
    totalLinkedTokens: totalLinkedTokens,
    scanDurationMs: Date.now() - startTime,
    colorTokensLoaded: 0,
    textStylesLoaded: 0,
  };
}
