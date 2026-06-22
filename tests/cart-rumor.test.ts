// Roving merchant rumor — deterministic per-season hint Pip drops about
// the headliner he plans to feature on his next visit.
import { describe, it, expect } from 'vitest';
import {
  rumorFooterLine,
  rumorHeadlineLabelFor,
  rumorItemForSeason,
  rumorToastLine,
} from '../src/game/cart-rumor';
import { CART_CATALOG } from '../src/game/cart';

describe('rumorItemForSeason', () => {
  it('returns a real catalog row for every season', () => {
    for (let s = 0; s < 4; s++) {
      const row = rumorItemForSeason(s);
      expect(row).not.toBeNull();
      expect(CART_CATALOG.some((r) => r.key === row!.key)).toBe(true);
    }
  });

  it('never returns a decor row (avoids re-headlining wallpaper)', () => {
    for (let s = 0; s < 4; s++) {
      const row = rumorItemForSeason(s);
      expect(row!.key.startsWith('decor-')).toBe(false);
    }
  });

  it('is deterministic — same season always returns the same row', () => {
    for (let s = 0; s < 4; s++) {
      expect(rumorItemForSeason(s)?.key).toBe(rumorItemForSeason(s)?.key);
    }
  });

  it('rotates — not every season picks the same row', () => {
    const keys = new Set<string>();
    for (let s = 0; s < 4; s++) {
      keys.add(rumorItemForSeason(s)!.key);
    }
    // We don't require all 4 distinct (small pool, hash could collide).
    // We DO require >= 2 distinct so the feature isn't trivially static.
    expect(keys.size).toBeGreaterThanOrEqual(2);
  });
});

describe('rumorHeadlineLabelFor', () => {
  it('matches the item label', () => {
    for (let s = 0; s < 4; s++) {
      const row = rumorItemForSeason(s);
      expect(rumorHeadlineLabelFor(s)).toBe(row!.label);
    }
  });
});

describe('rumorToastLine', () => {
  it('contains the headliner label and Pip\'s voice', () => {
    const line = rumorToastLine(0);
    expect(line).toMatch(/Pip says/);
    expect(line).toMatch(/next season/);
    const label = rumorHeadlineLabelFor(0);
    expect(line).toContain(label);
  });
});

describe('rumorFooterLine', () => {
  it('mentions "Next visit" and the label', () => {
    const line = rumorFooterLine(2);
    expect(line).toMatch(/Next visit/);
    const label = rumorHeadlineLabelFor(2);
    expect(line).toContain(label);
  });
});
