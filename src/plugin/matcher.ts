import { RGBA, ColorToken, ColorMatch, Confidence } from './types';
import { rgbaToHex, normalizeWeight } from './utils';

// ============================================================
// CIE76 Delta-E color distance in CIELAB space
// ============================================================

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  var rl = linearize(r);
  var gl = linearize(g);
  var bl = linearize(b);
  return [
    0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl,
    0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl,
    0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl,
  ];
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  var xn = 0.95047, yn = 1.0, zn = 1.08883;
  var f = function(t: number): number {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  };
  return [116 * f(y / yn) - 16, 500 * (f(x / xn) - f(y / yn)), 200 * (f(y / yn) - f(z / zn))];
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  var xyz = rgbToXyz(r, g, b);
  return xyzToLab(xyz[0], xyz[1], xyz[2]);
}

/** Delta-E with alpha penalty: same RGB but different alpha = large distance */
function colorDistance(c1: RGBA, c2: RGBA): number {
  var lab1 = rgbToLab(c1.r, c1.g, c1.b);
  var lab2 = rgbToLab(c2.r, c2.g, c2.b);

  var labDist = Math.sqrt(
    (lab1[0] - lab2[0]) * (lab1[0] - lab2[0]) +
    (lab1[1] - lab2[1]) * (lab1[1] - lab2[1]) +
    (lab1[2] - lab2[2]) * (lab1[2] - lab2[2])
  );

  // Alpha difference penalty: alpha ranges 0–1, scale to match Lab range
  // A 0.06 vs 1.0 alpha difference = 0.94 * 50 = 47 penalty (huge, won't match)
  var a1 = c1.a != null ? c1.a : 1;
  var a2 = c2.a != null ? c2.a : 1;
  var alphaPenalty = Math.abs(a1 - a2) * 50;

  return labDist + alphaPenalty;
}

// ============================================================
// CIELAB Cache for token colors
// ============================================================

interface CachedTokenColor {
  color: RGBA;
  lab: [number, number, number];
  alpha: number;
}

interface CachedToken {
  token: ColorToken;
  colors: CachedTokenColor[];
}

var tokenCache: CachedToken[] = [];

/** Pre-compute Lab values for all token colors. Call once after loading tokens. */
export function prepareTokenCache(tokens: ColorToken[]): void {
  tokenCache = [];
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    var colors = t.allColors || [t.color];
    var cached: CachedTokenColor[] = [];
    for (var ci = 0; ci < colors.length; ci++) {
      var c = colors[ci];
      cached.push({
        color: c,
        lab: rgbToLab(c.r, c.g, c.b),
        alpha: c.a != null ? c.a : 1,
      });
    }
    tokenCache.push({ token: t, colors: cached });
  }
}

/** Compute distance using pre-computed Lab (for token) vs fresh Lab (for input) */
function cachedColorDistance(inputLab: [number, number, number], inputAlpha: number, cached: CachedTokenColor): number {
  var labDist = Math.sqrt(
    (inputLab[0] - cached.lab[0]) * (inputLab[0] - cached.lab[0]) +
    (inputLab[1] - cached.lab[1]) * (inputLab[1] - cached.lab[1]) +
    (inputLab[2] - cached.lab[2]) * (inputLab[2] - cached.lab[2])
  );
  var alphaPenalty = Math.abs(inputAlpha - cached.alpha) * 50;
  return labDist + alphaPenalty;
}

// ============================================================
// Matching
// ============================================================

/** Check if two RGBA values are effectively identical (within rounding) */
function rgbaMatch(c1: RGBA, c2: RGBA): boolean {
  var to255 = function(v: number) { return Math.round(v * 255); };
  var a1 = c1.a != null ? c1.a : 1;
  var a2 = c2.a != null ? c2.a : 1;
  return (
    to255(c1.r) === to255(c2.r) &&
    to255(c1.g) === to255(c2.g) &&
    to255(c1.b) === to255(c2.b) &&
    Math.round(a1 * 100) === Math.round(a2 * 100) // alpha to 1% precision
  );
}

function getConfidence(distance: number): Confidence | null {
  if (distance === 0) return 'exact';
  if (distance <= 2) return 'high';
  if (distance <= 5) return 'medium';
  if (distance <= 10) return 'low';
  return null;
}

/**
 * Find the best matching color token for a raw color.
 * Matches against ALL mode values of each token.
 * Includes alpha/opacity in the match — #000000 at 6% won't match #000000 at 100%.
 */
export function findBestColorMatch(
  rawColor: RGBA,
  tokens: ColorToken[]
): ColorMatch | null {
  var bestToken: ColorToken | null = null;
  var bestDistance = Infinity;

  // Use cached Lab values if available (much faster for large token sets)
  if (tokenCache.length > 0) {
    var inputLab = rgbToLab(rawColor.r, rawColor.g, rawColor.b);
    var inputAlpha = rawColor.a != null ? rawColor.a : 1;

    for (var ti = 0; ti < tokenCache.length; ti++) {
      var ct = tokenCache[ti];
      for (var ci = 0; ci < ct.colors.length; ci++) {
        if (rgbaMatch(rawColor, ct.colors[ci].color)) {
          return {
            tokenId: ct.token.id, tokenName: ct.token.name,
            tokenSource: ct.token.source, collectionName: ct.token.collectionName,
            hex: rgbaToHex(rawColor), distance: 0, confidence: 'exact',
          };
        }
        var d = cachedColorDistance(inputLab, inputAlpha, ct.colors[ci]);
        if (d < bestDistance) { bestDistance = d; bestToken = ct.token; }
      }
    }
  } else {
    // Fallback: no cache, compute on the fly
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var colors = token.allColors || [token.color];
      for (var fi = 0; fi < colors.length; fi++) {
        if (rgbaMatch(rawColor, colors[fi])) {
          return {
            tokenId: token.id, tokenName: token.name,
            tokenSource: token.source, collectionName: token.collectionName,
            hex: rgbaToHex(rawColor), distance: 0, confidence: 'exact',
          };
        }
        var fd = colorDistance(rawColor, colors[fi]);
        if (fd < bestDistance) { bestDistance = fd; bestToken = token; }
      }
    }
  }

  if (!bestToken) return null;
  var confidence = getConfidence(bestDistance);
  if (!confidence) return null;

  return {
    tokenId: bestToken.id, tokenName: bestToken.name,
    tokenSource: bestToken.source, collectionName: bestToken.collectionName,
    hex: bestToken.hex, distance: bestDistance, confidence: confidence,
  };
}

// ============================================================
// Text style matching
// ============================================================

interface TextStyleInfo {
  id: string;
  name: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
}

export function findBestTextMatch(
  fontSize: number,
  fontFamily: string,
  fontWeight: string,
  styles: TextStyleInfo[]
): { styleId: string; styleName: string; confidence: Confidence } | null {
  var bestStyle: TextStyleInfo | null = null;
  var bestScore = -1;

  var nWeight = normalizeWeight(fontWeight);

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];
    var score = 0;

    // Font size (most important)
    if (style.fontSize === fontSize) score += 5;
    else if (Math.abs(style.fontSize - fontSize) <= 1) score += 2;

    // Font weight — normalize "Semi Bold" vs "SemiBold" etc.
    if (normalizeWeight(style.fontWeight) === nWeight) score += 3;

    // Font family
    if (style.fontFamily.toLowerCase() === fontFamily.toLowerCase()) score += 2;

    if (score > bestScore) {
      bestScore = score;
      bestStyle = style;
    }
  }

  // Need at least fontSize match + weight match for a reasonable suggestion
  if (!bestStyle || bestScore < 5) return null;

  var confidence: Confidence =
    bestScore >= 10 ? 'exact' :
    bestScore >= 8 ? 'high' :
    bestScore >= 6 ? 'medium' : 'low';

  return {
    styleId: bestStyle.id,
    styleName: bestStyle.name,
    confidence: confidence,
  };
}
