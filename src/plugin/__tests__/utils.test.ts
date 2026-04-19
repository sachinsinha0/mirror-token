import { describe, it, expect } from 'vitest';
import { rgbaToHex, parseWeightToNumber, normalizeWeight, weightNumberToFigmaStyle } from '../utils';

describe('rgbaToHex', () => {
  it('converts pure red', () => {
    expect(rgbaToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#ff0000');
  });

  it('converts pure white', () => {
    expect(rgbaToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#ffffff');
  });

  it('converts pure black', () => {
    expect(rgbaToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000');
  });

  it('converts mid-gray', () => {
    expect(rgbaToHex({ r: 0.5, g: 0.5, b: 0.5, a: 1 })).toBe('#808080');
  });

  it('ignores alpha in hex output', () => {
    expect(rgbaToHex({ r: 1, g: 0, b: 0, a: 0.5 })).toBe('#ff0000');
  });
});

describe('parseWeightToNumber', () => {
  it('parses named weights', () => {
    expect(parseWeightToNumber('Thin')).toBe(100);
    expect(parseWeightToNumber('Extra Light')).toBe(200);
    expect(parseWeightToNumber('Light')).toBe(300);
    expect(parseWeightToNumber('Regular')).toBe(400);
    expect(parseWeightToNumber('Medium')).toBe(500);
    expect(parseWeightToNumber('Semi Bold')).toBe(600);
    expect(parseWeightToNumber('Bold')).toBe(700);
    expect(parseWeightToNumber('Extra Bold')).toBe(800);
    expect(parseWeightToNumber('Black')).toBe(900);
  });

  it('handles case and spacing variations', () => {
    expect(parseWeightToNumber('BOLD')).toBe(700);
    expect(parseWeightToNumber('semi-bold')).toBe(600);
    expect(parseWeightToNumber('SemiBold')).toBe(600);
    expect(parseWeightToNumber('extra_light')).toBe(200);
  });

  it('parses numeric strings', () => {
    expect(parseWeightToNumber('400')).toBe(400);
    expect(parseWeightToNumber('700')).toBe(700);
  });

  it('returns 400 for unknown values', () => {
    expect(parseWeightToNumber('Fancy')).toBe(400);
    expect(parseWeightToNumber('')).toBe(400);
  });

  it('handles aliases', () => {
    expect(parseWeightToNumber('Normal')).toBe(400);
    expect(parseWeightToNumber('Book')).toBe(400);
    expect(parseWeightToNumber('Hairline')).toBe(100);
    expect(parseWeightToNumber('Heavy')).toBe(900);
    expect(parseWeightToNumber('DemiBold')).toBe(600);
    expect(parseWeightToNumber('UltraLight')).toBe(200);
    expect(parseWeightToNumber('UltraBold')).toBe(800);
  });
});

describe('normalizeWeight', () => {
  it('lowercases and strips separators', () => {
    expect(normalizeWeight('Semi Bold')).toBe('semibold');
    expect(normalizeWeight('extra-light')).toBe('extralight');
    expect(normalizeWeight('BOLD')).toBe('bold');
    expect(normalizeWeight('Regular')).toBe('regular');
  });
});

describe('weightNumberToFigmaStyle', () => {
  it('maps numbers to Figma style names', () => {
    expect(weightNumberToFigmaStyle(100)).toBe('Thin');
    expect(weightNumberToFigmaStyle(200)).toBe('Extra Light');
    expect(weightNumberToFigmaStyle(300)).toBe('Light');
    expect(weightNumberToFigmaStyle(400)).toBe('Regular');
    expect(weightNumberToFigmaStyle(500)).toBe('Medium');
    expect(weightNumberToFigmaStyle(600)).toBe('Semi Bold');
    expect(weightNumberToFigmaStyle(700)).toBe('Bold');
    expect(weightNumberToFigmaStyle(800)).toBe('Extra Bold');
    expect(weightNumberToFigmaStyle(900)).toBe('Black');
  });

  it('rounds down to nearest bracket', () => {
    expect(weightNumberToFigmaStyle(450)).toBe('Medium');
    expect(weightNumberToFigmaStyle(550)).toBe('Semi Bold');
    expect(weightNumberToFigmaStyle(650)).toBe('Bold');
  });

  it('round-trips with parseWeightToNumber', () => {
    const styles = ['Thin', 'Regular', 'Medium', 'Bold', 'Black'];
    for (const style of styles) {
      const num = parseWeightToNumber(style);
      expect(weightNumberToFigmaStyle(num)).toBe(style);
    }
  });
});
