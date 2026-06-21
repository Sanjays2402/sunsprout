// Lore / bestiary — discovery predicates per category + panel
// integration smoke. The discovery flips when the underlying tally
// goes non-zero; locked rows hide the name.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  LORE_CATEGORIES,
  buildLoreRows,
  loreCompletion,
  loreProgress,
} from '../src/game/lore';
import { FISH_KEYS } from '../src/game/fish';
import { GEM_KEYS, gemInventoryKey } from '../src/game/gems';
import { FORAGE_KEYS, forageInventoryKey } from '../src/game/forage';
import { recordSown } from '../src/game/crop-journal';
import { startingHearts, creditTalk } from '../src/game/hearts';

function freshWorld(): World {
  const w = new World();
  w.player.hearts = startingHearts();
  return w;
}

describe('buildLoreRows — initial state', () => {
  it('starts with everything locked', () => {
    const w = freshWorld();
    const rows = buildLoreRows(w.player);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.discovered).toBe(false);
    }
  });

  it('includes every fish / gem / forage entry', () => {
    const w = freshWorld();
    const rows = buildLoreRows(w.player);
    const fishCount = rows.filter((r) => r.category === 'Fish').length;
    const gemCount = rows.filter((r) => r.category === 'Gems').length;
    const forageCount = rows.filter((r) => r.category === 'Forage').length;
    expect(fishCount).toBe(FISH_KEYS.length);
    expect(gemCount).toBe(GEM_KEYS.length);
    expect(forageCount).toBe(FORAGE_KEYS.length);
  });
});

describe('discovery flips on inventory', () => {
  it('catching a fish lights up its row', () => {
    const w = freshWorld();
    const fishKey = FISH_KEYS[0];
    w.player.inventory[`fish-${fishKey}`] = 1;
    const rows = buildLoreRows(w.player);
    const row = rows.find((r) => r.category === 'Fish' && r.id === fishKey);
    expect(row?.discovered).toBe(true);
    expect(row?.count).toBe(1);
  });

  it('mining a gem lights up its row', () => {
    const w = freshWorld();
    const gemKey = GEM_KEYS[2];
    w.player.inventory[gemInventoryKey(gemKey)] = 3;
    const rows = buildLoreRows(w.player);
    const row = rows.find((r) => r.category === 'Gems' && r.id === gemKey);
    expect(row?.discovered).toBe(true);
    expect(row?.count).toBe(3);
  });

  it('picking forage lights up its row', () => {
    const w = freshWorld();
    const forageKey = FORAGE_KEYS[0];
    w.player.inventory[forageInventoryKey(forageKey)] = 2;
    const rows = buildLoreRows(w.player);
    const row = rows.find((r) => r.category === 'Forage' && r.id === forageKey);
    expect(row?.discovered).toBe(true);
  });

  it('sowing a crop lights up its row', () => {
    const w = freshWorld();
    recordSown(w.player, 'wheat');
    const rows = buildLoreRows(w.player);
    const row = rows.find((r) => r.category === 'Crops' && r.id === 'wheat');
    expect(row?.discovered).toBe(true);
  });

  it('chatting with an NPC lights up the folk row', () => {
    const w = freshWorld();
    creditTalk(w.player.hearts!, 'maple', 3);
    const rows = buildLoreRows(w.player);
    const row = rows.find((r) => r.category === 'Folk' && r.id === 'maple');
    expect(row?.discovered).toBe(true);
  });
});

describe('loreCompletion / loreProgress', () => {
  it('completion = 0 on a fresh world', () => {
    const w = freshWorld();
    expect(loreCompletion(w.player)).toBe(0);
  });

  it('completion grows as discoveries land', () => {
    const w = freshWorld();
    const initial = loreCompletion(w.player);
    w.player.inventory[`fish-${FISH_KEYS[0]}`] = 1;
    w.player.inventory[gemInventoryKey(GEM_KEYS[0])] = 1;
    const after = loreCompletion(w.player);
    expect(after).toBeGreaterThan(initial);
    expect(after).toBeLessThan(1);
  });

  it('loreProgress lists one row per category in display order', () => {
    const w = freshWorld();
    const rows = loreProgress(w.player);
    expect(rows.map((r) => r.category)).toEqual([...LORE_CATEGORIES]);
    for (const p of rows) {
      expect(p.discovered).toBe(0);
      expect(p.total).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('locked rows keep their teaser', () => {
  it('every locked row has a non-empty teaser', () => {
    const w = freshWorld();
    const rows = buildLoreRows(w.player);
    for (const r of rows) {
      if (!r.discovered) expect(r.teaser.length).toBeGreaterThan(3);
    }
  });
});
