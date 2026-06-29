// Money-log purse-direction arrow glyph — purseArrowGlyph() gives a 5x5
// pixel arrow per direction (up gain / down loss / flat break-even) so the
// trend reads up/down/flat as a shape before the "320g -> 412g" text. Pure
// bitmap, model-owned like the almanac/journal glyphs.

import { describe, it, expect } from 'vitest';
import { purseArrowGlyph } from '../src/game/money-log';

describe('purseArrowGlyph', () => {
  it('returns drawable cells for each direction', () => {
    expect(purseArrowGlyph('up').length).toBeGreaterThan(0);
    expect(purseArrowGlyph('down').length).toBeGreaterThan(0);
    expect(purseArrowGlyph('flat').length).toBeGreaterThan(0);
  });

  it('keeps cells inside a 5x5 grid', () => {
    for (const dir of ['up', 'down', 'flat'] as const) {
      for (const [cx, cy] of purseArrowGlyph(dir)) {
        expect(cx).toBeGreaterThanOrEqual(0);
        expect(cx).toBeLessThan(5);
        expect(cy).toBeGreaterThanOrEqual(0);
        expect(cy).toBeLessThan(5);
      }
    }
  });

  it('points the up-chevron apex at the top and down at the bottom', () => {
    const up = purseArrowGlyph('up');
    const down = purseArrowGlyph('down');
    // Up arrow has its single apex on row 0; down on the bottom row.
    expect(up.some(([, cy]) => cy === 0)).toBe(true);
    expect(down.some(([, cy]) => cy === 4)).toBe(true);
    // The two distinct directions never produce identical bitmaps.
    expect(JSON.stringify(up)).not.toBe(JSON.stringify(down));
  });

  it('draws flat as a single horizontal bar', () => {
    const flat = purseArrowGlyph('flat');
    const rows = new Set(flat.map(([, cy]) => cy));
    expect(rows.size).toBe(1); // all on one row
  });
});
