// Almanac kind glyphs — almanacKindGlyph() returns a pure 5x5 pixel bitmap
// per event kind, so each agenda row leads with a recognisable symbol (cake
// / tent / cart / rosette / heart) instead of a one-letter tag.

import { describe, it, expect } from 'vitest';
import { almanacKindGlyph, type AlmanacKind } from '../src/game/almanac';

const KINDS: AlmanacKind[] = ['festival', 'birthday', 'cart', 'tournament', 'personal'];

describe('almanacKindGlyph', () => {
  it('returns a non-empty cell list for every kind', () => {
    for (const kind of KINDS) {
      const cells = almanacKindGlyph(kind);
      expect(cells.length).toBeGreaterThan(0);
    }
  });

  it('keeps every cell inside the 5x5 grid', () => {
    for (const kind of KINDS) {
      for (const [cx, cy] of almanacKindGlyph(kind)) {
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cx).toBeLessThanOrEqual(4);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cy).toBeLessThanOrEqual(4);
      }
    }
  });

  it('has no duplicate cells within a glyph (no overdraw)', () => {
    for (const kind of KINDS) {
      const cells = almanacKindGlyph(kind);
      const seen = new Set(cells.map(([cx, cy]) => `${cx},${cy}`));
      expect(seen.size).toBe(cells.length);
    }
  });

  it('gives each kind a DISTINCT silhouette', () => {
    // The glyphs must differ from one another, otherwise the icon adds no
    // information over the old shared letter slot.
    const sigs = KINDS.map((k) =>
      almanacKindGlyph(k)
        .map(([cx, cy]) => `${cx},${cy}`)
        .sort()
        .join('|'),
    );
    expect(new Set(sigs).size).toBe(KINDS.length);
  });

  it('is stable across calls (same reference shape)', () => {
    expect(almanacKindGlyph('birthday')).toBe(almanacKindGlyph('birthday'));
  });
});
