// Lore-panel Gems tab footer — surfaces the player's lifetime mining
// career recap ("career: 142 gems / 3,820g"). Pure formatter so the
// panel UI doesn't grow a mining-haul import.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { loreTabFooter, LORE_CATEGORIES } from '../src/game/lore';
import { recordMined } from '../src/game/mining-haul';
import { GEMS } from '../src/game/gems';

describe('loreTabFooter — Gems tab career recap', () => {
  it('returns "career: 0 gems" when the player has never mined', () => {
    const w = new World();
    expect(loreTabFooter(w.player, 'Gems')).toBe('career: 0 gems');
  });

  it('returns the singular form for exactly one lifetime gem', () => {
    const w = new World();
    recordMined(w.player, 'copper');
    const expectedGold = GEMS.copper.sellPrice.toLocaleString('en-US');
    expect(loreTabFooter(w.player, 'Gems')).toBe(`career: 1 gem / ${expectedGold}g`);
  });

  it('aggregates counts and sell-prices across every gem type', () => {
    const w = new World();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'ruby');
    recordMined(w.player, 'silver');
    const expectedCount = 5;
    const expectedGold =
      GEMS.copper.sellPrice * 3 +
      GEMS.ruby.sellPrice +
      GEMS.silver.sellPrice;
    expect(loreTabFooter(w.player, 'Gems')).toBe(
      `career: ${expectedCount} gems / ${expectedGold.toLocaleString('en-US')}g`,
    );
  });

  it('formats large gold sums with thousands separators', () => {
    const w = new World();
    // Stack enough rubies to push past 1000g — the string MUST contain
    // a comma so big-haul saves still read cleanly.
    for (let i = 0; i < 40; i++) recordMined(w.player, 'ruby');
    const line = loreTabFooter(w.player, 'Gems');
    expect(line).toMatch(/career: 40 gems \/ [\d,]+g/);
    expect(line).toContain(',');
  });

  it('returns the empty string for non-Gems tabs', () => {
    const w = new World();
    recordMined(w.player, 'copper');
    for (const cat of LORE_CATEGORIES) {
      if (cat === 'Gems') continue;
      expect(loreTabFooter(w.player, cat)).toBe('');
    }
  });

  it('survives older saves without lifetimeCounts (mining-haul backfills)', () => {
    const w = new World();
    // Force a mineHaul state without the lifetimeCounts field — mirrors
    // an older save shape pre-batch-17.
    (w.player as { mineHaul?: { counts: Record<string, number>; lastRun: { counts: Record<string, number>; gold: number } } }).mineHaul = {
      counts: { copper: 5 },
      lastRun: { counts: {}, gold: 0 },
    };
    // No crash, returns the empty-career line because lifetime is 0.
    expect(loreTabFooter(w.player, 'Gems')).toBe('career: 0 gems');
  });
});
