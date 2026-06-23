// Mine haul ribbon journal page — per-gem breakdown of the captured
// bestRun composition surfaced as a secondary detail line under the
// lore Gems-tab footer.
//
// The aggregate haulBestRunLine reads "best run: 14 gems / 510g (day
// 23)" — useful for the headline but doesn't tell you WHAT was in the
// haul. The composition detail line reads "made of: 4 copper, 3 ruby,
// 2 emerald" so the player can see the gem mix that drove the record.
//
// On a split-record save (count + gold leaders set on different days)
// the detail line goes wider: "count run: 8 copper, 4 iron - gold
// run: 1 ruby, 1 emerald" so the player can compare the two records'
// compositions side-by-side.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  bestRunCompositionLine,
  bestRunSplitCompositionLine,
  getMineHaul,
  recordMined,
  resetMineHaul,
} from '../src/game/mining-haul';
import { loreTabDetailLine } from '../src/game/lore';
import type { GemKey } from '../src/game/gems';
import { GEMS } from '../src/game/gems';

function priciestGem(): GemKey {
  let priciest: GemKey = 'copper';
  let maxPrice = 0;
  for (const k of Object.keys(GEMS) as GemKey[]) {
    if (GEMS[k].sellPrice > maxPrice) {
      maxPrice = GEMS[k].sellPrice;
      priciest = k;
    }
  }
  return priciest;
}

describe('bestRunCompositionLine — silence conditions', () => {
  it('returns empty when no run captured yet', () => {
    const w = new World();
    expect(bestRunCompositionLine(getMineHaul(w.player))).toBe('');
  });

  it('returns empty when bestRun is set but composition wasn\'t snapshotted (older-save backfill)', () => {
    const w = new World();
    const state = getMineHaul(w.player);
    state.bestRun = { count: 5, countDay: 2, gold: 60, goldDay: 2 };
    expect(bestRunCompositionLine(state)).toBe('');
  });

  it('returns empty when composition is present but every entry is zero', () => {
    const w = new World();
    const state = getMineHaul(w.player);
    state.bestRun = {
      count: 5,
      countDay: 2,
      gold: 60,
      goldDay: 2,
      countComposition: {},
    };
    expect(bestRunCompositionLine(state)).toBe('');
  });
});

describe('bestRunCompositionLine — single-record save', () => {
  it('names every gem in the count-leader composition', () => {
    const w = new World();
    const p = w.player;
    for (let i = 0; i < 4; i++) recordMined(p, 'copper');
    recordMined(p, 'iron');
    recordMined(p, 'iron');
    resetMineHaul(p, 5);
    const line = bestRunCompositionLine(getMineHaul(p));
    expect(line).toContain('made of:');
    expect(line).toContain('4 copper');
    expect(line).toContain('2 iron');
  });

  it('walks GEM_KEYS in catalog order (deterministic wording)', () => {
    const w = new World();
    const p = w.player;
    // Pile a few gems in non-catalog order to ensure the formatter
    // doesn't surface them in insertion order.
    recordMined(p, 'iron');
    recordMined(p, 'copper');
    recordMined(p, 'copper');
    recordMined(p, 'iron');
    resetMineHaul(p, 5);
    const line = bestRunCompositionLine(getMineHaul(p));
    // Copper appears first in GEM_KEYS, iron next — so the line
    // surfaces copper before iron regardless of insertion order.
    expect(line.indexOf('copper')).toBeLessThan(line.indexOf('iron'));
  });

  it('falls back to goldComposition when countComposition is missing', () => {
    const w = new World();
    const state = getMineHaul(w.player);
    state.bestRun = {
      count: 5,
      countDay: 2,
      gold: 200,
      goldDay: 2,
      goldComposition: { iron: 2, ruby: 1 } as Partial<Record<GemKey, number>>,
    };
    const line = bestRunCompositionLine(state);
    expect(line).toContain('iron');
    expect(line).toContain('ruby');
  });
});

describe('bestRunSplitCompositionLine — silence conditions', () => {
  it('returns empty when no record captured', () => {
    const w = new World();
    expect(bestRunSplitCompositionLine(getMineHaul(w.player))).toBe('');
  });

  it('returns empty when both records were set on the same day', () => {
    const w = new World();
    const p = w.player;
    for (let i = 0; i < 5; i++) recordMined(p, 'copper');
    resetMineHaul(p, 4);
    expect(bestRunSplitCompositionLine(getMineHaul(p))).toBe('');
  });

  it('returns empty when compositions are missing (older-save backfill)', () => {
    const w = new World();
    const state = getMineHaul(w.player);
    state.bestRun = { count: 5, countDay: 2, gold: 100, goldDay: 4 };
    expect(bestRunSplitCompositionLine(state)).toBe('');
  });
});

describe('bestRunSplitCompositionLine — split-record save', () => {
  it('surfaces both compositions when count and gold records were set on different days', () => {
    const w = new World();
    const p = w.player;
    // Day 2: large count run (10 copper, 0 ruby — count record holds).
    for (let i = 0; i < 10; i++) recordMined(p, 'copper');
    resetMineHaul(p, 2);
    // Day 5: small but valuable gold run (2 priciest gem — gold record holds).
    const priciest = priciestGem();
    recordMined(p, priciest);
    recordMined(p, priciest);
    resetMineHaul(p, 5);
    const line = bestRunSplitCompositionLine(getMineHaul(p));
    expect(line).toContain('count run');
    expect(line).toContain('gold run');
    expect(line).toContain('10 copper');
    expect(line).toContain(priciest);
  });
});

describe('loreTabDetailLine — Gems tab wiring', () => {
  it('returns empty on non-Gems tabs', () => {
    const w = new World();
    expect(loreTabDetailLine(w.player, 'Fish')).toBe('');
    expect(loreTabDetailLine(w.player, 'Crops')).toBe('');
    expect(loreTabDetailLine(w.player, 'Forage')).toBe('');
    expect(loreTabDetailLine(w.player, 'Folk')).toBe('');
    expect(loreTabDetailLine(w.player, 'Rumors')).toBe('');
  });

  it('returns empty when player has no mining record', () => {
    const w = new World();
    expect(loreTabDetailLine(w.player, 'Gems')).toBe('');
  });

  it('returns the single-composition line for a same-day record', () => {
    const w = new World();
    const p = w.player;
    for (let i = 0; i < 5; i++) recordMined(p, 'copper');
    resetMineHaul(p, 3);
    const line = loreTabDetailLine(p, 'Gems');
    expect(line).toContain('made of:');
    expect(line).toContain('5 copper');
  });

  it('returns the split-composition line for a split-record save', () => {
    const w = new World();
    const p = w.player;
    for (let i = 0; i < 10; i++) recordMined(p, 'copper');
    resetMineHaul(p, 2);
    const priciest = priciestGem();
    recordMined(p, priciest);
    recordMined(p, priciest);
    resetMineHaul(p, 5);
    const line = loreTabDetailLine(p, 'Gems');
    expect(line).toContain('count run');
    expect(line).toContain('gold run');
  });

  it('split-composition path takes priority over single-composition path', () => {
    const w = new World();
    const p = w.player;
    // Set up a split-record save.
    for (let i = 0; i < 10; i++) recordMined(p, 'copper');
    resetMineHaul(p, 2);
    const priciest = priciestGem();
    for (let i = 0; i < 2; i++) recordMined(p, priciest);
    resetMineHaul(p, 5);
    const line = loreTabDetailLine(p, 'Gems');
    // Split-record format never contains "made of:" (that's the
    // single-composition wording).
    expect(line).not.toContain('made of:');
    expect(line).toContain('count run');
  });
});

describe('bestRun composition — captured at sleep time', () => {
  it('snapshots countComposition into bestRun on a fresh count record', () => {
    const w = new World();
    const p = w.player;
    for (let i = 0; i < 4; i++) recordMined(p, 'copper');
    recordMined(p, 'iron');
    resetMineHaul(p, 3);
    const state = getMineHaul(p);
    expect(state.bestRun?.countComposition).toEqual({ copper: 4, iron: 1 });
  });

  it('snapshots goldComposition independently when only gold record falls', () => {
    const w = new World();
    const p = w.player;
    // First run: low count + low gold.
    for (let i = 0; i < 3; i++) recordMined(p, 'copper');
    resetMineHaul(p, 2);
    // Second run: same count but priciest gem so gold record falls.
    const priciest = priciestGem();
    for (let i = 0; i < 3; i++) recordMined(p, priciest);
    resetMineHaul(p, 5);
    const state = getMineHaul(p);
    // Count record is still day 2 (3 == 3, no promotion).
    expect(state.bestRun?.countDay).toBe(2);
    expect(state.bestRun?.countComposition).toEqual({ copper: 3 });
    // Gold record fell on day 5 with the priciest composition.
    expect(state.bestRun?.goldDay).toBe(5);
    expect(state.bestRun?.goldComposition).toEqual({ [priciest]: 3 });
  });

  it('overwrites the composition when a new record falls', () => {
    const w = new World();
    const p = w.player;
    for (let i = 0; i < 3; i++) recordMined(p, 'copper');
    resetMineHaul(p, 2);
    // Bigger count run — should overwrite the composition.
    for (let i = 0; i < 6; i++) recordMined(p, 'iron');
    resetMineHaul(p, 5);
    const state = getMineHaul(p);
    expect(state.bestRun?.countComposition).toEqual({ iron: 6 });
    expect(state.bestRun?.countComposition?.copper).toBeFalsy();
  });
});
