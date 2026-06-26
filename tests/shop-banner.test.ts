// Seasonal shop banner — per-season style descriptor for the cloth that
// flies over Maple's shop.

import { describe, it, expect } from 'vitest';
import {
  shopBannerStyle,
  motifPixelCount,
  SHOP_BANNER_STYLES,
} from '../src/game/shop-banner';
import { SEASONS } from '../src/game/time';

describe('shopBannerStyle', () => {
  it('returns a distinct style per season', () => {
    const labels = [0, 1, 2, 3].map((s) => shopBannerStyle(s).label);
    expect(labels).toEqual([...SEASONS]);
    // All four cloth colours differ.
    const cloths = new Set([0, 1, 2, 3].map((s) => shopBannerStyle(s).cloth));
    expect(cloths.size).toBe(4);
  });

  it('labels match the canonical SEASONS names', () => {
    expect(shopBannerStyle(0).label).toBe('Spring');
    expect(shopBannerStyle(1).label).toBe('Summer');
    expect(shopBannerStyle(2).label).toBe('Fall');
    expect(shopBannerStyle(3).label).toBe('Winter');
  });

  it('wraps out-of-range and negative seasons safely', () => {
    expect(shopBannerStyle(4)).toBe(SHOP_BANNER_STYLES[0]);
    expect(shopBannerStyle(7)).toBe(SHOP_BANNER_STYLES[3]);
    expect(shopBannerStyle(-1)).toBe(SHOP_BANNER_STYLES[3]);
  });

  it('uses git-safe hex colours (no emoji, leading #)', () => {
    for (const s of [0, 1, 2, 3] as const) {
      const st = shopBannerStyle(s);
      for (const c of [st.cloth, st.clothDark, st.accent]) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
      expect(st.label).toMatch(/^[A-Za-z]+$/);
    }
  });
});

describe('shop banner motifs', () => {
  it('every motif is a 5x5 bitmap of 0/1 cells', () => {
    for (const s of [0, 1, 2, 3] as const) {
      const m = shopBannerStyle(s).motif;
      expect(m.length).toBe(5);
      for (const row of m) {
        expect(row.length).toBe(5);
        for (const cell of row) expect(cell === 0 || cell === 1).toBe(true);
      }
    }
  });

  it('every motif lights at least a few pixels (none is blank)', () => {
    for (const s of [0, 1, 2, 3] as const) {
      expect(motifPixelCount(shopBannerStyle(s))).toBeGreaterThanOrEqual(5);
    }
  });

  it('the four motifs are not all identical', () => {
    const fingerprints = new Set(
      [0, 1, 2, 3].map((s) => JSON.stringify(shopBannerStyle(s).motif)),
    );
    expect(fingerprints.size).toBeGreaterThan(1);
  });

  it('motifs are horizontally symmetric (read cleanly at pixel scale)', () => {
    for (const s of [0, 1, 2, 3] as const) {
      for (const row of shopBannerStyle(s).motif) {
        expect(row[0]).toBe(row[4]);
        expect(row[1]).toBe(row[3]);
      }
    }
  });
});
