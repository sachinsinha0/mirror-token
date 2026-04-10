import { ColorToken, RGBA, TypographyGroup } from './types';

var debugLog: string[] = [];
function log(msg: string) {
  console.log('[Mirror Token] ' + msg);
  debugLog.push(msg);
}
export function getDebugLog(): string[] {
  var result = debugLog.slice();
  debugLog = [];
  return result;
}

function rgbaToHex(c: RGBA): string {
  var to255 = function(v: number) { return Math.round(v * 255); };
  var hex = function(v: number) { return to255(v).toString(16).padStart(2, '0'); };
  return '#' + hex(c.r) + hex(c.g) + hex(c.b);
}

function isRGBA(value: unknown): value is RGBA {
  return typeof value === 'object' && value !== null && 'r' in value && 'g' in value && 'b' in value;
}

function isVariableAlias(value: unknown): value is { type: 'VARIABLE_ALIAS'; id: string } {
  return typeof value === 'object' && value !== null && (value as any).type === 'VARIABLE_ALIAS';
}

async function resolveColorValue(value: unknown, depth: number): Promise<RGBA | null> {
  if (depth > 5) return null;
  if (isRGBA(value)) {
    return { r: (value as any).r, g: (value as any).g, b: (value as any).b, a: (value as any).a != null ? (value as any).a : 1 };
  }
  if (isVariableAlias(value)) {
    try {
      var v = await figma.variables.getVariableByIdAsync(value.id);
      if (v && v.resolvedType === 'COLOR') {
        var m = Object.keys(v.valuesByMode)[0];
        return resolveColorValue(v.valuesByMode[m], depth + 1);
      }
    } catch (e) {}
  }
  return null;
}

function parseWeightName(w: string): number {
  var lower = w.toLowerCase().replace(/[\s-_]/g, '');
  if (lower === 'thin' || lower === 'hairline') return 100;
  if (lower === 'extralight' || lower === 'ultralight') return 200;
  if (lower === 'light') return 300;
  if (lower === 'regular' || lower === 'normal') return 400;
  if (lower === 'medium') return 500;
  if (lower === 'semibold' || lower === 'demibold') return 600;
  if (lower === 'bold') return 700;
  if (lower === 'extrabold' || lower === 'ultrabold') return 800;
  if (lower === 'black' || lower === 'heavy') return 900;
  var num = parseInt(w, 10);
  return isNaN(num) ? 400 : num;
}

function extractSolidColor(paints: readonly Paint[]): RGBA | null {
  for (var i = 0; i < paints.length; i++) {
    if (paints[i].type === 'SOLID') {
      var s = paints[i] as SolidPaint;
      return { r: s.color.r, g: s.color.g, b: s.color.b, a: s.opacity != null ? s.opacity : 1 };
    }
  }
  return null;
}

async function addVarToken(varId: string, tokens: ColorToken[], seen: Set<string>): Promise<boolean> {
  var key = 'var:' + varId;
  if (seen.has(key)) return false;
  try {
    var v = await figma.variables.getVariableByIdAsync(varId);
    if (!v || v.resolvedType !== 'COLOR') return false;
    var modeIds = Object.keys(v.valuesByMode);
    if (modeIds.length === 0) return false;
    var allColors: RGBA[] = [];
    var primaryColor: RGBA | null = null;
    for (var mi = 0; mi < modeIds.length; mi++) {
      var resolved = await resolveColorValue(v.valuesByMode[modeIds[mi]], 0);
      if (resolved) { allColors.push(resolved); if (!primaryColor) primaryColor = resolved; }
    }
    if (!primaryColor || allColors.length === 0) return false;
    var cn = 'Library';
    try { var col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId); if (col) cn = col.name; } catch (e) {}
    seen.add(key);
    tokens.push({ id: v.id, key: v.key, name: v.name, source: 'variable', collectionName: cn, color: primaryColor, hex: rgbaToHex(primaryColor), allColors: allColors });
    return true;
  } catch (e) { return false; }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise(function(resolve) {
    var done = false;
    var timer = setTimeout(function() { if (!done) { done = true; resolve(null); } }, ms);
    promise.then(function(val) { if (!done) { done = true; clearTimeout(timer); resolve(val); } }, function() { if (!done) { done = true; clearTimeout(timer); resolve(null); } });
  });
}

// ============================================================
// COLOR TOKENS
// ============================================================

export function resetDebugLog(): void {
  debugLog = [];
}

export async function loadColorTokens(): Promise<ColorToken[]> {
  var tokens: ColorToken[] = [];
  var seen = new Set<string>();
  var startTime = Date.now();

  // S1: Local Variable Collections
  try {
    var localCols = await figma.variables.getLocalVariableCollectionsAsync();
    log('S1 Local collections: ' + localCols.length);
    for (var ci = 0; ci < localCols.length; ci++) {
      for (var vi = 0; vi < localCols[ci].variableIds.length; vi++) {
        await addVarToken(localCols[ci].variableIds[vi], tokens, seen);
      }
    }
  } catch (e) { log('S1 FAILED: ' + String(e)); }
  log('After S1: ' + tokens.length);

  // S2: getLocalVariablesAsync
  try {
    var api = figma.variables as any;
    if (typeof api.getLocalVariablesAsync === 'function') {
      var allV = await api.getLocalVariablesAsync('COLOR');
      log('S2 getLocalVariablesAsync: ' + (allV ? allV.length : 0));
      if (allV) { for (var av = 0; av < allV.length; av++) { await addVarToken(allV[av].id, tokens, seen); } }
    }
  } catch (e) { log('S2 FAILED: ' + String(e)); }
  log('After S2: ' + tokens.length);

  // S3: Library Variable Collections
  try {
    var libApi = figma.teamLibrary as any;
    var libVarCols = await libApi.getAvailableLibraryVariableCollectionsAsync();
    log('S3 Library var collections: ' + libVarCols.length);
    for (var lci = 0; lci < libVarCols.length; lci++) {
      try {
        var libVars = await libApi.getVariablesInLibraryCollectionAsync(libVarCols[lci].key);
        var colorVars = [];
        for (var lvi = 0; lvi < libVars.length; lvi++) { if (libVars[lvi].resolvedType === 'COLOR') colorVars.push(libVars[lvi]); }
        log('  "' + libVarCols[lci].name + '": ' + colorVars.length + ' COLOR vars');
        for (var cvi = 0; cvi < colorVars.length; cvi++) {
          try {
            var imp = await withTimeout(figma.variables.importVariableByKeyAsync(colorVars[cvi].key), 3000);
            if (imp) await addVarToken((imp as any).id, tokens, seen);
          } catch (e) {}
          if ((cvi + 1) % 20 === 0) log('    Imported ' + (cvi + 1) + '/' + colorVars.length);
        }
      } catch (ce) { log('    Error: ' + String(ce)); }
    }
  } catch (e) { log('S3 FAILED: ' + String(e)); }
  log('After S3: ' + tokens.length + ' (' + (Date.now() - startTime) + 'ms)');

  // S4: Local Paint Styles
  try {
    var localPS = await figma.getLocalPaintStylesAsync();
    log('S4 Local paint styles: ' + localPS.length);
    for (var pi = 0; pi < localPS.length; pi++) {
      var pc = extractSolidColor(localPS[pi].paints);
      if (pc) { var pk = 'style:' + localPS[pi].id; if (!seen.has(pk)) { seen.add(pk); tokens.push({ id: localPS[pi].id, key: localPS[pi].key, name: localPS[pi].name, source: 'paint-style', collectionName: 'Local', color: pc, hex: rgbaToHex(pc), allColors: [pc] }); } }
    }
  } catch (e) { log('S4 FAILED: ' + String(e)); }
  log('After S4: ' + tokens.length);

  // S5: Library Paint Styles
  try {
    var libPSApi = figma.teamLibrary as any;
    var libPS = await libPSApi.getAvailableLibraryPaintStylesAsync();
    log('S5 Library paint styles: ' + libPS.length);
    for (var lpi = 0; lpi < libPS.length; lpi++) {
      try {
        var is2 = await withTimeout(figma.importStyleByKeyAsync(libPS[lpi].key), 3000);
        if (is2 && (is2 as any).type === 'PAINT') {
          var ps2 = is2 as PaintStyle;
          var lc2 = extractSolidColor(ps2.paints);
          if (lc2) { var lk2 = 'style:' + ps2.id; if (!seen.has(lk2)) { seen.add(lk2); tokens.push({ id: ps2.id, key: ps2.key, name: ps2.name, source: 'paint-style', collectionName: libPS[lpi].libraryName || 'Library', color: lc2, hex: rgbaToHex(lc2), allColors: [lc2] }); } }
        }
      } catch (e) {}
      if ((lpi + 1) % 20 === 0) log('    S5 imported ' + (lpi + 1) + '/' + libPS.length);
    }
  } catch (e) { log('S5 FAILED: ' + String(e)); }
  log('After S5: ' + tokens.length + ' (' + (Date.now() - startTime) + 'ms)');

  // S6: Discover from existing node bindings
  try {
    log('S6 Discovering from bindings...');
    var allNodes = figma.currentPage.findAll();
    var dVarIds = new Set<string>();
    var dStyleIds = new Set<string>();
    for (var ni = 0; ni < allNodes.length; ni++) {
      var nd = allNodes[ni];
      var bv = (nd as any).boundVariables;
      if (bv) {
        var fields = ['fills', 'strokes', 'fill', 'stroke'];
        for (var bf = 0; bf < fields.length; bf++) {
          var fld = bv[fields[bf]];
          if (fld) {
            if (Array.isArray(fld)) { for (var fi = 0; fi < fld.length; fi++) { if (fld[fi] && fld[fi].id) dVarIds.add(fld[fi].id); } }
            else if (fld.id) { dVarIds.add(fld.id); }
          }
        }
      }
      if ('fillStyleId' in nd) { var fsId = (nd as any).fillStyleId; if (fsId && typeof fsId === 'string' && fsId !== '') dStyleIds.add(fsId); }
      if ('strokeStyleId' in nd) { var ssId = (nd as any).strokeStyleId; if (ssId && typeof ssId === 'string' && ssId !== '') dStyleIds.add(ssId); }
    }
    log('  Found ' + dVarIds.size + ' bound vars, ' + dStyleIds.size + ' styles');
    var vArr: string[] = []; dVarIds.forEach(function(id) { vArr.push(id); });
    for (var dvi = 0; dvi < vArr.length; dvi++) { await addVarToken(vArr[dvi], tokens, seen); }
    var sArr: string[] = []; dStyleIds.forEach(function(id) { sArr.push(id); });
    for (var dsi = 0; dsi < sArr.length; dsi++) {
      var sk = 'style:' + sArr[dsi]; if (seen.has(sk)) continue;
      try { var fs = figma.getStyleById(sArr[dsi]); if (fs && fs.type === 'PAINT') { var fp = fs as PaintStyle; var fc = extractSolidColor(fp.paints); if (fc) { seen.add(sk); tokens.push({ id: fp.id, key: fp.key, name: fp.name, source: 'paint-style', collectionName: 'Library', color: fc, hex: rgbaToHex(fc), allColors: [fc] }); } } } catch (e) {}
    }
  } catch (e) { log('S6 FAILED: ' + String(e)); }
  log('After S6: ' + tokens.length);

  log('COLOR TOKENS DONE in ' + (Date.now() - startTime) + 'ms — ' + tokens.length + ' tokens');
  for (var di = 0; di < Math.min(5, tokens.length); di++) {
    log('  ' + tokens[di].hex + ' "' + tokens[di].name + '" [' + tokens[di].source + '] a=' + tokens[di].color.a.toFixed(2));
  }
  return tokens;
}

// ============================================================
// TYPOGRAPHY VARIABLES
// ============================================================

import { TypographyGroup } from './types';

/**
 * Load typography variables from the "Typography" collection.
 * Variables are FLOAT type (fontSize, lineHeight, letterSpacing, fontWeight).
 * They're grouped by prefix: "h1/fontSize", "h1/lineHeight" → group "h1".
 */
export async function loadTypographyGroups(): Promise<TypographyGroup[]> {
  var groups: Record<string, TypographyGroup> = {};
  var varCount = 0;

  function getOrCreate(name: string): TypographyGroup {
    if (!groups[name]) {
      groups[name] = {
        name: name,
        textStyleId: null,
        fontSize: null, fontSizeVarId: null,
        lineHeight: null, lineHeightVarId: null,
        letterSpacing: null, letterSpacingVarId: null,
        fontWeight: null, fontWeightVarId: null,
      };
    }
    return groups[name];
  }

  async function processVariable(v: any): Promise<void> {
    if (!v || (v.resolvedType !== 'FLOAT' && v.resolvedType !== 'STRING')) return;

    var name = v.name as string; // e.g. "h1/fontSize" or "Body/body1/lineHeight"
    var parts = name.split('/');
    if (parts.length < 2) return;

    var prop = parts[parts.length - 1].toLowerCase(); // last part = property
    var groupName = parts.slice(0, parts.length - 1).join('/'); // everything before = group name

    // Get resolved value
    var modeId = Object.keys(v.valuesByMode)[0];
    if (!modeId) return;
    var val = v.valuesByMode[modeId];

    // Handle aliases
    if (isVariableAlias(val)) {
      try {
        var aliased = await figma.variables.getVariableByIdAsync(val.id);
        if (aliased) {
          var aliasMode = Object.keys(aliased.valuesByMode)[0];
          val = aliased.valuesByMode[aliasMode];
        }
      } catch (e) { return; }
    }

    if (typeof val !== 'number') return;

    var group = getOrCreate(groupName);
    varCount++;

    if (prop === 'fontsize' || prop === 'font-size' || prop === 'size') {
      group.fontSize = val;
      group.fontSizeVarId = v.id;
    } else if (prop === 'lineheight' || prop === 'line-height') {
      group.lineHeight = val;
      group.lineHeightVarId = v.id;
    } else if (prop === 'letterspacing' || prop === 'letter-spacing' || prop === 'tracking') {
      group.letterSpacing = val;
      group.letterSpacingVarId = v.id;
    } else if (prop === 'fontweight' || prop === 'font-weight' || prop === 'weight') {
      group.fontWeight = val;
      group.fontWeightVarId = v.id;
    }
  }

  // The Olympus library publishes TEXT STYLES (not Typography Variables).
  // Load them via every available method.

  // T0: Try multiple API paths to load library text styles
  var textStyleMap: Record<string, TextStyle> = {}; // name → TextStyle

  // First: enumerate what's available on figma.teamLibrary
  try {
    var tlMethods: string[] = [];
    for (var k in figma.teamLibrary) { tlMethods.push(k); }
    log('T0 figma.teamLibrary methods: [' + tlMethods.join(', ') + ']');
  } catch (e) { log('T0 enumerate failed: ' + String(e)); }

  // Try every possible method name for getting library text styles
  var textStyleMethods = [
    'getAvailableLibraryTextStylesAsync',
    'getAvailableLibraryStylesAsync',
    'getAvailableTextStylesAsync',
    'getTextStylesAsync',
  ];
  for (var mi2 = 0; mi2 < textStyleMethods.length; mi2++) {
    var methodName = textStyleMethods[mi2];
    try {
      var fn = (figma.teamLibrary as any)[methodName];
      if (fn) {
        log('T0a Trying figma.teamLibrary.' + methodName + '...');
        var libTS = await fn.call(figma.teamLibrary);
        log('T0a ' + methodName + ' returned ' + (libTS ? libTS.length : 0) + ' items');
        if (libTS && libTS.length > 0) {
          // Log first few to understand the structure
          for (var tli = 0; tli < Math.min(3, libTS.length); tli++) {
            log('  [' + tli + '] keys: ' + Object.keys(libTS[tli]).join(',') + ' name=' + (libTS[tli].name || '?'));
          }
          for (var tsi = 0; tsi < libTS.length; tsi++) {
            try {
              var impTS = await withTimeout(figma.importStyleByKeyAsync(libTS[tsi].key), 5000);
              if (impTS && impTS.type === 'TEXT') {
                textStyleMap[(impTS as TextStyle).name] = impTS as TextStyle;
              }
            } catch (e) {}
            if ((tsi + 1) % 10 === 0) log('  Imported ' + (tsi + 1) + '/' + libTS.length);
          }
          log('T0a Loaded ' + Object.keys(textStyleMap).length + ' text styles via ' + methodName);
          break; // Found a working method
        }
      }
    } catch (e) {
      log('T0a ' + methodName + ' FAILED: ' + String(e));
    }
  }

  // Also try figma-level methods
  if (Object.keys(textStyleMap).length === 0) {
    var figmaMethods = ['getRemoteTextStylesAsync', 'getPublishedTextStylesAsync'];
    for (var fm = 0; fm < figmaMethods.length; fm++) {
      try {
        var ffn = (figma as any)[figmaMethods[fm]];
        if (ffn) {
          log('T0b Trying figma.' + figmaMethods[fm] + '...');
          var result = await ffn.call(figma);
          log('T0b ' + figmaMethods[fm] + ' returned ' + (result ? result.length : 0));
          if (result && result.length > 0) {
            for (var ri = 0; ri < result.length; ri++) {
              if (result[ri].type === 'TEXT') {
                textStyleMap[result[ri].name] = result[ri] as TextStyle;
              }
            }
            break;
          }
        }
      } catch (e) {
        log('T0b ' + figmaMethods[fm] + ' FAILED: ' + String(e));
      }
    }
  }

  // T0c: Discover text styles from existing text node bindings
  try {
    log('T0c Discovering text styles from bindings...');
    var allNodes2 = figma.currentPage.findAll();
    for (var ni2 = 0; ni2 < allNodes2.length; ni2++) {
      if (allNodes2[ni2].type !== 'TEXT') continue;
      var tsId2 = (allNodes2[ni2] as TextNode).textStyleId;
      if (tsId2 && typeof tsId2 === 'string' && tsId2 !== '') {
        try {
          var ds2 = figma.getStyleById(tsId2);
          if (ds2 && ds2.type === 'TEXT' && !textStyleMap[ds2.name]) {
            textStyleMap[ds2.name] = ds2 as TextStyle;
          }
        } catch (e) {}
      }
    }
    log('T0c Total text styles after discovery: ' + Object.keys(textStyleMap).length);
  } catch (e) { log('T0c FAILED: ' + String(e)); }

  // Build typography groups from loaded text styles
  var tsNames = Object.keys(textStyleMap);
  log('TEXT STYLES FOUND: ' + tsNames.length);

  for (var tni = 0; tni < tsNames.length; tni++) {
    var ts = textStyleMap[tsNames[tni]];
    var gName = ts.name; // e.g. "Headline 1", "Body 2", "Typography/Headline 1"
    var group = getOrCreate(gName);
    group.textStyleId = ts.id;
    group.fontSize = ts.fontSize;
    group.fontWeight = parseWeightName(ts.fontName.style);
    // Extract lineHeight
    var lh = ts.lineHeight as any;
    if (lh && lh.unit === 'PERCENT') {
      group.lineHeight = lh.value / 100;
    } else if (lh && lh.unit === 'PIXELS') {
      group.lineHeight = ts.fontSize > 0 ? lh.value / ts.fontSize : null;
    }
    // Extract letterSpacing
    var ls = ts.letterSpacing as any;
    if (ls && ls.unit === 'PIXELS') {
      group.letterSpacing = ls.value;
    } else if (ls && ls.unit === 'PERCENT') {
      group.letterSpacing = (ls.value / 100) * ts.fontSize;
    }
    varCount++;
    log('  "' + gName + '" id=' + ts.id + ' ' + ts.fontSize + 'px ' + ts.fontName.style + ' (weight=' + group.fontWeight + ')');
  }

  // If no text styles were loaded from the API, fall back to hardcoded Olympus data
  if (tsNames.length === 0) {
    log('T1 No text styles from API — using hardcoded Olympus theme...');
    var olympusTypo = [
      { name: 'Headline 1', fontSize: 32, fontWeight: 600 },
      { name: 'Headline 2', fontSize: 28, fontWeight: 600 },
      { name: 'Headline 3', fontSize: 24, fontWeight: 600 },
      { name: 'Headline 4', fontSize: 20, fontWeight: 600 },
      { name: 'Headline 5', fontSize: 18, fontWeight: 600 },
      { name: 'Subtitle 1', fontSize: 16, fontWeight: 500 },
      { name: 'Subtitle 2', fontSize: 14, fontWeight: 500 },
      { name: 'Body 1', fontSize: 16, fontWeight: 400 },
      { name: 'Body 2', fontSize: 14, fontWeight: 400 },
      { name: 'Caption', fontSize: 12, fontWeight: 400 },
      { name: 'Overline', fontSize: 10, fontWeight: 600 },
    ];
    for (var oti = 0; oti < olympusTypo.length; oti++) {
      var ot = olympusTypo[oti];
      var fg = getOrCreate(ot.name);
      fg.fontSize = ot.fontSize;
      fg.fontWeight = ot.fontWeight;
      varCount++;
    }
  }

  // Convert to array and filter to groups that have at least fontSize
  var result: TypographyGroup[] = [];
  var groupNames = Object.keys(groups);
  for (var gi = 0; gi < groupNames.length; gi++) {
    var g = groups[groupNames[gi]];
    if (g.fontSize !== null) {
      result.push(g);
    }
  }

  log('TYPOGRAPHY: processed ' + varCount + ' vars → ' + result.length + ' groups with fontSize');
  for (var di = 0; di < Math.min(10, result.length); di++) {
    log('  "' + result[di].name + '" size=' + result[di].fontSize +
      ' weight=' + result[di].fontWeight +
      ' lh=' + result[di].lineHeight +
      ' ls=' + result[di].letterSpacing +
      ' styleId=' + (result[di].textStyleId || 'none'));
  }

  return result;
}

// ============================================================
// REST API: Import text styles by key
// ============================================================

/**
 * Import text styles using keys fetched by the UI via REST API.
 * This is the official Figma-recommended workaround for accessing
 * library text styles, since figma.teamLibrary has no text style methods.
 */
export async function importTextStylesByKeys(
  keys: Array<{ key: string; name: string }>
): Promise<TypographyGroup[]> {
  var groups: TypographyGroup[] = [];

  log('T-REST: Importing ' + keys.length + ' text styles by key...');

  for (var i = 0; i < keys.length; i++) {
    try {
      var imported = await figma.importStyleByKeyAsync(keys[i].key);
      if (!imported || imported.type !== 'TEXT') continue;

      var ts = imported as TextStyle;
      var fontWeight = parseWeightName(ts.fontName.style);
      var lineHeight: number | null = null;
      var letterSpacing: number | null = null;

      var lh = ts.lineHeight as any;
      if (lh && lh.unit === 'PERCENT') { lineHeight = lh.value / 100; }
      else if (lh && lh.unit === 'PIXELS' && ts.fontSize > 0) { lineHeight = lh.value / ts.fontSize; }

      var ls = ts.letterSpacing as any;
      if (ls && ls.unit === 'PIXELS') { letterSpacing = ls.value; }
      else if (ls && ls.unit === 'PERCENT') { letterSpacing = (ls.value / 100) * ts.fontSize; }

      groups.push({
        name: ts.name,
        textStyleId: ts.id,
        fontSize: ts.fontSize,
        fontSizeVarId: null,
        lineHeight: lineHeight,
        lineHeightVarId: null,
        letterSpacing: letterSpacing,
        letterSpacingVarId: null,
        fontWeight: fontWeight,
        fontWeightVarId: null,
      });
    } catch (e) {
      log('  Failed to import "' + keys[i].name + '": ' + String(e));
    }
    if ((i + 1) % 10 === 0) log('  T-REST imported ' + (i + 1) + '/' + keys.length);
  }

  log('T-REST: Successfully imported ' + groups.length + ' text styles');
  for (var di = 0; di < Math.min(10, groups.length); di++) {
    log('  "' + groups[di].name + '" id=' + groups[di].textStyleId + ' ' + groups[di].fontSize + 'px weight=' + groups[di].fontWeight);
  }

  return groups;
}
