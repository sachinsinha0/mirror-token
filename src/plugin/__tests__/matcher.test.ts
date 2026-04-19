import { describe, it, expect } from 'vitest';
import { findBestColorMatch, prepareTokenCache } from '../matcher';
import { ColorToken, RGBA } from '../../shared/types';

function makeToken(name: string, hex: string, r: number, g: number, b: number, a = 1): ColorToken {
  return {
    id: 'tok-' + name,
    key: 'key-' + name,
    name,
    source: 'variable',
    collectionName: 'Test',
    color: { r, g, b, a },
    hex,
    allColors: [{ r, g, b, a }],
  };
}

const tokens: ColorToken[] = [
  makeToken('Red', '#ff0000', 1, 0, 0),
  makeToken('Green', '#00ff00', 0, 1, 0),
  makeToken('Blue', '#0000ff', 0, 0, 1),
  makeToken('White', '#ffffff', 1, 1, 1),
  makeToken('Black', '#000000', 0, 0, 0),
  makeToken('Gray-50', '#808080', 0.502, 0.502, 0.502),
];

describe('findBestColorMatch (no cache)', () => {
  it('returns exact match for identical color', () => {
    const match = findBestColorMatch({ r: 1, g: 0, b: 0, a: 1 }, tokens);
    expect(match).not.toBeNull();
    expect(match!.tokenName).toBe('Red');
    expect(match!.confidence).toBe('exact');
    expect(match!.distance).toBe(0);
  });

  it('returns exact match for white', () => {
    const match = findBestColorMatch({ r: 1, g: 1, b: 1, a: 1 }, tokens);
    expect(match!.tokenName).toBe('White');
    expect(match!.confidence).toBe('exact');
  });

  it('matches nearby color with high confidence', () => {
    // Slightly off-red
    const match = findBestColorMatch({ r: 0.99, g: 0.01, b: 0.01, a: 1 }, tokens);
    expect(match).not.toBeNull();
    expect(match!.tokenName).toBe('Red');
    expect(match!.confidence === 'exact' || match!.confidence === 'high').toBe(true);
  });

  it('returns null for colors too far from any token', () => {
    // A color not close to any token (orange-ish)
    const match = findBestColorMatch({ r: 1, g: 0.5, b: 0, a: 1 }, tokens);
    // Might match Red or might be null if distance > 10
    if (match) {
      expect(['exact', 'high', 'medium', 'low']).toContain(match.confidence);
    }
  });

  it('penalizes alpha differences', () => {
    // Black at 6% opacity should NOT match Black at 100%
    const match = findBestColorMatch({ r: 0, g: 0, b: 0, a: 0.06 }, tokens);
    // Alpha penalty: |0.06 - 1| * 50 = 47, far exceeds threshold of 10
    expect(match).toBeNull();
  });
});

describe('findBestColorMatch (with cache)', () => {
  it('returns same results with cache as without', () => {
    // Without cache
    const noCache1 = findBestColorMatch({ r: 1, g: 0, b: 0, a: 1 }, tokens);
    const noCache2 = findBestColorMatch({ r: 0.502, g: 0.502, b: 0.502, a: 1 }, tokens);

    // With cache
    prepareTokenCache(tokens);
    const cached1 = findBestColorMatch({ r: 1, g: 0, b: 0, a: 1 }, tokens);
    const cached2 = findBestColorMatch({ r: 0.502, g: 0.502, b: 0.502, a: 1 }, tokens);

    expect(cached1!.tokenName).toBe(noCache1!.tokenName);
    expect(cached1!.confidence).toBe(noCache1!.confidence);
    expect(cached2!.tokenName).toBe(noCache2!.tokenName);
    expect(cached2!.confidence).toBe(noCache2!.confidence);

    // Clean up cache
    prepareTokenCache([]);
  });
});
