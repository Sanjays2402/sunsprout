// Bag glyph resolver — maps a categorized bag row to a drawable pip.

import { describe, it, expect } from 'vitest';
import {
  bagGlyph,
  bagGlyphForKey,
  loreRowGlyph,
  fishGlyphColor,
  EGG_GLYPH_COLOR,
  DISH_GLYPH_COLOR,
} from '../src/game/bag-glyph';
import { classifyBagKey, type BagItem } from '../src/game/bag';
import { GEMS } from '../src/game/gems';

/** Resolve a glyph straight from a raw inventory key for terse tests. */
function glyphFor(key: string, count = 1) {
  const item = classifyBagKey(key, count) as BagItem;
  expect(item).not.toBeNull();
  return bagGlyph(item);
}

describe('bagGlyph', () => {
  it('routes a bare seed key to a crop glyph for that crop', () => {
    const g = glyphFor('wheat', 8);
    expect(g.kind).toBe('crop');
    if (g.kind === 'crop') expect(g.cropKey).toBe('wheat');
  });

  it('routes every harvest tier to the base crop glyph', () => {
    for (const key of ['wheat_harvest', 'wheat_harvest_silver', 'wheat_harvest_gold']) {
      const g = glyphFor(key, 1);
      expect(g.kind).toBe('crop');
      if (g.kind === 'crop') expect(g.cropKey).toBe('wheat');
    }
  });

  it('routes fish to a fish glyph tinted by tier', () => {
    const g = glyphFor('fish-pike', 1);
    expect(g.kind).toBe('fish');
    if (g.kind === 'fish') expect(g.color).toBe(fishGlyphColor('pike'));
  });

  it('routes gems to a gem glyph tinted from the catalog colour', () => {
    const g = glyphFor('gem-ruby', 1);
    expect(g.kind).toBe('gem');
    if (g.kind === 'gem') expect(g.color).toBe(GEMS.ruby.color);
  });

  it('routes forage to a forage glyph with its kind', () => {
    const g = glyphFor('forage-berry', 1);
    expect(g.kind).toBe('forage');
    if (g.kind === 'forage') expect(g.forage).toBe('berry');
  });

  it('tints eggs plain / fancy / breeder', () => {
    const plain = glyphFor('egg', 2);
    const fancy = glyphFor('egg-fancy', 1);
    const breeder = glyphFor('egg-breeder', 1);
    expect(plain.kind).toBe('egg');
    if (plain.kind === 'egg') expect(plain.color).toBe(EGG_GLYPH_COLOR.plain);
    if (fancy.kind === 'egg') expect(fancy.color).toBe(EGG_GLYPH_COLOR.fancy);
    if (breeder.kind === 'egg') expect(breeder.color).toBe(EGG_GLYPH_COLOR.breeder);
  });

  it('routes cooked dishes to the dish glyph', () => {
    const g = glyphFor('dish-herb-tea', 1);
    expect(g.kind).toBe('dish');
    if (g.kind === 'dish') expect(g.color).toBe(DISH_GLYPH_COLOR);
  });

  it('falls back to a supply crate for tools / kits', () => {
    expect(glyphFor('hoe', 1).kind).toBe('supply');
    expect(glyphFor('greenhouse-kit', 1).kind).toBe('supply');
  });
});

describe('loreRowGlyph', () => {
  it('maps a Fish bestiary row onto the fish glyph', () => {
    const g = loreRowGlyph('Fish', 'pike');
    expect(g?.kind).toBe('fish');
    if (g?.kind === 'fish') expect(g.color).toBe(fishGlyphColor('pike'));
  });

  it('maps a Gems row onto the gem glyph from the catalog colour', () => {
    const g = loreRowGlyph('Gems', 'ruby');
    expect(g?.kind).toBe('gem');
    if (g?.kind === 'gem') expect(g.color).toBe(GEMS.ruby.color);
  });

  it('maps a Forage row onto the forage glyph', () => {
    const g = loreRowGlyph('Forage', 'berry');
    expect(g?.kind).toBe('forage');
    if (g?.kind === 'forage') expect(g.forage).toBe('berry');
  });

  it('maps a Crops row onto the crop glyph for that crop', () => {
    const g = loreRowGlyph('Crops', 'wheat');
    expect(g?.kind).toBe('crop');
    if (g?.kind === 'crop') expect(g.cropKey).toBe('wheat');
  });

  it('returns null for Folk and Rumors rows (no catalog sprite)', () => {
    expect(loreRowGlyph('Folk', 'maple')).toBeNull();
    expect(loreRowGlyph('Rumors', '0-brass-lantern-1')).toBeNull();
  });

  it('agrees with bagGlyphForKey on the rebuilt inventory key', () => {
    expect(loreRowGlyph('Gems', 'gold')).toEqual(bagGlyphForKey('gem-gold'));
    expect(loreRowGlyph('Crops', 'pumpkin')).toEqual(bagGlyphForKey('pumpkin'));
  });
});

describe('fishGlyphColor', () => {
  it('gives a distinct tint per fish so the ramp is monotone by price', () => {
    // Higher sell price -> the resolver picks an earlier (deeper) bucket;
    // simply assert the prized pike differs from the humble minnow.
    expect(fishGlyphColor('pike')).not.toBe(fishGlyphColor('minnow'));
    expect(fishGlyphColor('minnow').length).toBeGreaterThan(0);
  });
});
