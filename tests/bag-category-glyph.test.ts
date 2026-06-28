// Bag empty-tab glyph — bagCategoryGlyph() resolves a representative glyph
// per bag category so an empty tab can show a large dim icon behind its
// "nothing here yet" text, teaching what the tab holds at a glance.

import { describe, it, expect } from 'vitest';
import { bagCategoryGlyph } from '../src/game/bag-glyph';
import { BAG_CATEGORIES, type BagCategory } from '../src/game/bag';

describe('bagCategoryGlyph', () => {
  it('resolves a glyph for every bag category', () => {
    for (const cat of BAG_CATEGORIES) {
      const g = bagCategoryGlyph(cat);
      expect(g).toBeTruthy();
      expect(typeof g.kind).toBe('string');
    }
  });

  it('maps each produce tab to its matching exemplar sprite', () => {
    expect(bagCategoryGlyph('Crops').kind).toBe('crop');
    expect(bagCategoryGlyph('Seeds').kind).toBe('crop');
    expect(bagCategoryGlyph('Fish').kind).toBe('fish');
    expect(bagCategoryGlyph('Gems').kind).toBe('gem');
    expect(bagCategoryGlyph('Forage').kind).toBe('forage');
    expect(bagCategoryGlyph('Kitchen').kind).toBe('egg');
  });

  it('falls back to the generic crate for Supplies (no single icon)', () => {
    expect(bagCategoryGlyph('Supplies').kind).toBe('supply');
  });

  it('Gems exemplar carries a real catalog colour', () => {
    const g = bagCategoryGlyph('Gems');
    expect(g.kind).toBe('gem');
    if (g.kind === 'gem') expect(g.color).toMatch(/^#/);
  });

  it('is total over the category union (no missing key throws)', () => {
    const all: BagCategory[] = [...BAG_CATEGORIES];
    expect(() => all.map(bagCategoryGlyph)).not.toThrow();
  });
});
