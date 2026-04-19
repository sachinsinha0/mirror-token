import { RGBA } from './types';

/** Convert an RGBA (0–1 range) to a hex string like "#ff00aa". */
export function rgbaToHex(c: RGBA): string {
  var to255 = function(v: number) { return Math.round(v * 255); };
  var hex = function(v: number) { return to255(v).toString(16).padStart(2, '0'); };
  return '#' + hex(c.r) + hex(c.g) + hex(c.b);
}

/**
 * Parse a CSS font weight name (e.g. "Semi Bold", "Regular", "700") to a number.
 * Returns 400 for unrecognized strings (safest default = Regular).
 */
export function parseWeightToNumber(w: string): number {
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
  return isNaN(num) ? 400 : num;
}

/**
 * Normalize a font weight string for comparison.
 * "Semi Bold" → "semibold", "SemiBold" → "semibold"
 */
export function normalizeWeight(w: string): string {
  return w.toLowerCase().replace(/[\s-_]/g, '');
}

/**
 * Convert a numeric font weight to Figma's font style string.
 * Figma uses style names like "Regular", "Bold", "Semi Bold", etc.
 */
export function weightNumberToFigmaStyle(weight: number): string {
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
