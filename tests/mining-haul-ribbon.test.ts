// Mining haul ribbon — all-time heaviest single-run record. Tracked
// in MineHaulState.bestRun and captured at sleep time via
// resetMineHaul(player, day). The ribbon promotes count + gold
// independently so a pure-iron grind can hold the gold record while a
// multi-copper run holds the count record. haulYesterdayLine appends
// a "best run ever" suffix the morning a record fell; loreTabFooter
// surfaces a passive haulBestRunLine on the Gems tab.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  getMineHaul,
  haulBestRunLine,
  haulYesterdayLine,
  recordMined,
  resetMineHaul,
} from '../src/game/mining-haul';
import { GEMS } from '../src/game/gems';
import { loreTabFooter } from '../src/game/lore';
import { TimeOfDay } from '../src/game/time';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

describe('MineHaulState.bestRun — captured at sleep time', () => {
  it('is undefined on a fresh save', () => {
    const w = freshWorld();
    expect(getMineHaul(w.player).bestRun).toBeUndefined();
  });

  it('a sleep on an empty run does NOT mint a zero-ribbon', () => {
    const w = freshWorld();
    resetMineHaul(w.player, 4);
    expect(getMineHaul(w.player).bestRun).toBeUndefined();
  });

  it('first non-empty sleep captures count + countDay AND gold + goldDay', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'iron');
    resetMineHaul(w.player, 7);
    const best = getMineHaul(w.player).bestRun!;
    expect(best.count).toBe(3);
    expect(best.countDay).toBe(7);
    expect(best.gold).toBe(2 * GEMS.copper.sellPrice + GEMS.iron.sellPrice);
    expect(best.goldDay).toBe(7);
  });

  it('a smaller subsequent run does NOT overwrite the record', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'iron');
    resetMineHaul(w.player, 7);
    // Smaller run on day 12.
    recordMined(w.player, 'copper');
    resetMineHaul(w.player, 12);
    const best = getMineHaul(w.player).bestRun!;
    expect(best.count).toBe(3);
    expect(best.countDay).toBe(7);
  });

  it('a heavier subsequent run promotes both count + gold + the day fields', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    resetMineHaul(w.player, 7);
    // Bigger run on day 12.
    for (let i = 0; i < 5; i++) recordMined(w.player, 'iron');
    resetMineHaul(w.player, 12);
    const best = getMineHaul(w.player).bestRun!;
    expect(best.count).toBe(5);
    expect(best.countDay).toBe(12);
    expect(best.gold).toBe(5 * GEMS.iron.sellPrice);
    expect(best.goldDay).toBe(12);
  });

  it('split records: count from a copper run, gold from an iron run', () => {
    const w = freshWorld();
    // Day 7: 6 copper (high count, mid gold).
    for (let i = 0; i < 6; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 7);
    // Day 12: 2 ruby (low count, high gold).
    recordMined(w.player, 'ruby');
    recordMined(w.player, 'ruby');
    resetMineHaul(w.player, 12);
    const best = getMineHaul(w.player).bestRun!;
    // Count winner stays on day 7.
    expect(best.count).toBe(6);
    expect(best.countDay).toBe(7);
    // Gold winner moves to day 12.
    expect(best.gold).toBe(2 * GEMS.ruby.sellPrice);
    expect(best.goldDay).toBe(12);
  });
});

describe('haulYesterdayLine — record-fell suffix', () => {
  it('no suffix on a non-record dawn', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    resetMineHaul(w.player, 7);
    // Smaller run on day 12.
    recordMined(w.player, 'copper');
    resetMineHaul(w.player, 12);
    const line = haulYesterdayLine(getMineHaul(w.player));
    expect(line).toContain('1 copper');
    expect(line).not.toContain('best run ever');
  });

  it('"count + gold" suffix when both records fall in the same run', () => {
    const w = freshWorld();
    for (let i = 0; i < 4; i++) recordMined(w.player, 'iron');
    resetMineHaul(w.player, 7);
    const line = haulYesterdayLine(getMineHaul(w.player));
    expect(line).toContain('4 iron');
    expect(line).toContain('best run ever');
    expect(line).toContain('count + gold');
  });

  it('"for count!" suffix when only the count record fell', () => {
    const w = freshWorld();
    // Day 7: 1 ruby (sets the gold + count bars at 1 gem / ruby gold).
    recordMined(w.player, 'ruby');
    resetMineHaul(w.player, 7);
    // Day 12: 5 copper — beats count, falls short of gold.
    for (let i = 0; i < 5; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 12);
    const line = haulYesterdayLine(getMineHaul(w.player));
    expect(line).toContain('5 copper');
    expect(line).toContain('best run ever');
    expect(line).toContain('for count');
    expect(line).not.toContain('count + gold');
  });

  it('"for gold!" suffix when only the gold record fell', () => {
    const w = freshWorld();
    // Day 7: 6 copper.
    for (let i = 0; i < 6; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 7);
    // Day 12: 2 ruby — fewer gems, more gold.
    recordMined(w.player, 'ruby');
    recordMined(w.player, 'ruby');
    resetMineHaul(w.player, 12);
    const line = haulYesterdayLine(getMineHaul(w.player));
    expect(line).toContain('2 cave ruby');
    expect(line).toContain('best run ever');
    expect(line).toContain('for gold');
    expect(line).not.toContain('count + gold');
  });
});

describe('haulBestRunLine — passive ribbon formatter', () => {
  it('returns empty string when the player has never recorded a run', () => {
    const w = freshWorld();
    expect(haulBestRunLine(getMineHaul(w.player))).toBe('');
  });

  it('single-line "best run: N gems / Xg (day D)" when one run holds both records', () => {
    const w = freshWorld();
    for (let i = 0; i < 3; i++) recordMined(w.player, 'iron');
    resetMineHaul(w.player, 7);
    const line = haulBestRunLine(getMineHaul(w.player));
    expect(line).toContain('best run:');
    expect(line).toContain('3 gems');
    expect(line).toContain(`${3 * GEMS.iron.sellPrice}g`);
    expect(line).toContain('(day 7)');
  });

  it('split-line when count + gold records sit on different days', () => {
    const w = freshWorld();
    for (let i = 0; i < 6; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 7);
    recordMined(w.player, 'ruby');
    recordMined(w.player, 'ruby');
    resetMineHaul(w.player, 12);
    const line = haulBestRunLine(getMineHaul(w.player));
    expect(line).toContain('best run:');
    expect(line).toContain('6 gems');
    expect(line).toContain('(day 7)');
    expect(line).toContain(`${2 * GEMS.ruby.sellPrice}g`);
    expect(line).toContain('(day 12)');
  });

  it('singular phrasing for a 1-gem record run', () => {
    const w = freshWorld();
    recordMined(w.player, 'ruby');
    resetMineHaul(w.player, 7);
    const line = haulBestRunLine(getMineHaul(w.player));
    expect(line).toContain('1 gem ');
    expect(line).not.toContain('1 gems');
  });
});

describe('loreTabFooter — Gems tab surfaces the ribbon', () => {
  it('career-only when the player has lifetime gems but no recorded run', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    // Note: NO resetMineHaul -> no bestRun captured yet.
    const footer = loreTabFooter(w.player, 'Gems');
    expect(footer).toContain('career: 2 gems');
    expect(footer).not.toContain('best run');
  });

  it('career + ribbon once a run has been captured at sleep', () => {
    const w = freshWorld();
    recordMined(w.player, 'iron');
    recordMined(w.player, 'iron');
    recordMined(w.player, 'iron');
    resetMineHaul(w.player, 7);
    const footer = loreTabFooter(w.player, 'Gems');
    expect(footer).toContain('career: 3 gems');
    expect(footer).toContain('best run: 3 gems');
    expect(footer).toContain('(day 7)');
  });

  it('non-Gems tabs return empty regardless of ribbon state', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    resetMineHaul(w.player, 7);
    expect(loreTabFooter(w.player, 'Fish')).toBe('');
    expect(loreTabFooter(w.player, 'Folk')).toBe('');
    expect(loreTabFooter(w.player, 'Rumors')).toBe('');
  });
});

describe('persistence — bestRun round-trips', () => {
  it('serializeGame + applySnapshot preserve bestRun', () => {
    const game = {
      world: new World(),
      time: new TimeOfDay(),
    } as unknown as Game;
    recordMined(game.world.player, 'iron');
    recordMined(game.world.player, 'iron');
    resetMineHaul(game.world.player, 9);
    const snap = serializeGame(game);
    expect(snap.player.mineHaul?.bestRun).toMatchObject({
      count: 2,
      countDay: 9,
      gold: 2 * GEMS.iron.sellPrice,
      goldDay: 9,
    });
    const game2 = {
      world: new World(),
      time: new TimeOfDay(),
    } as unknown as Game;
    applySnapshot(game2, snap);
    expect(getMineHaul(game2.world.player).bestRun).toMatchObject({
      count: 2,
      countDay: 9,
      gold: 2 * GEMS.iron.sellPrice,
      goldDay: 9,
    });
  });

  it('a save with no bestRun (older saves) loads cleanly with bestRun undefined', () => {
    const game = {
      world: new World(),
      time: new TimeOfDay(),
    } as unknown as Game;
    // No mining + no sleep => bestRun stays undefined.
    const snap = serializeGame(game);
    expect(snap.player.mineHaul?.bestRun).toBeUndefined();
    const game2 = {
      world: new World(),
      time: new TimeOfDay(),
    } as unknown as Game;
    applySnapshot(game2, snap);
    expect(getMineHaul(game2.world.player).bestRun).toBeUndefined();
  });
});
