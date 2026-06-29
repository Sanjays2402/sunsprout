// Crop-journal ribbon medal glyph — ribbonMedalGlyph() is the tiny rosette
// pip drawn before the heaviest-single-day "ribbon: N in a day" line so the
// record reads as an award at a glance. A static 5x7 bitmap; these tests pin
// its bounds + non-emptiness so the panel can paint it cell-by-cell.

import { describe, it, expect } from 'vitest';
import { ribbonMedalGlyph } from '../src/game/crop-journal';

describe('ribbonMedalGlyph', () => {
  it('is a non-empty cell list', () => {
    expect(ribbonMedalGlyph().length).toBeGreaterThan(0);
  });

  it('fits inside a 5x7 box so it tucks before the ribbon text', () => {
    for (const [cx, cy] of ribbonMedalGlyph()) {
      expect(cx).toBeGreaterThanOrEqual(0);
      expect(cx).toBeLessThanOrEqual(4);
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(6);
    }
  });

  it('has a disc head on the top rows and tails near the base', () => {
    const cells = ribbonMedalGlyph();
    const hasHead = cells.some(([, cy]) => cy <= 2);
    const hasTail = cells.some(([, cy]) => cy >= 5);
    expect(hasHead).toBe(true);
    expect(hasTail).toBe(true);
  });

  it('returns a fresh stable shape each call', () => {
    expect(ribbonMedalGlyph()).toEqual(ribbonMedalGlyph());
  });
});
