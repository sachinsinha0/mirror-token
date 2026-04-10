import { RGBA, ColorToken, ColorMatch, Confidence } from './types';

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
// Matching
// ============================================================

function rgbaToHex(c: RGBA): string {
  var to255 = function(v: number) { return Math.round(v * 255); };
  var hex = function(v: number) { return to255(v).toString(16).padStart(2, '0'); };
  return '#' + hex(c.r) + hex(c.g) + hex(c.b);
}

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

  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    var colors = token.allColors || [token.color];

    for (var ci = 0; ci < colors.length; ci++) {
      // Fast path: exact RGBA match (including alpha)
      if (rgbaMatch(rawColor, colors[ci])) {
        return {
          tokenId: token.id,
          tokenName: token.name,
          tokenSource: token.source,
          collectionName: token.collectionName,
          hex: rgbaToHex(rawColor),
          distance: 0,
          confidence: 'exact',
        };
      }

      var d = colorDistance(rawColor, colors[ci]);
      if (d < bestDistance) {
        bestDistance = d;
        bestToken = token;
      }
    }
  }

  if (!bestToken) return null;

  var confidence = getConfidence(bestDistance);
  if (!confidence) return null;

  return {
    tokenId: bestToken.id,
    tokenName: bestToken.name,
    tokenSource: bestToken.source,
    collectionName: bestToken.collectionName,
    hex: bestToken.hex,
    distance: bestDistance,
    confidence: confidence,
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

/**
 * Normalize font weight strings for comparison.
 * "Semi Bold" → "semibold", "SemiBold" → "semibold"
 */
function normalizeWeight(w: string): string {
  return w.toLowerCase().replace(/[\s-_]/g, '');
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
