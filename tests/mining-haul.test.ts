// Mining haul tally — per-run gem ledger that resets on sleep.
// Drives a "yesterday's haul" recap on the dawn toast so the player
// can celebrate (or curse) the prior day's expedition.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  getMineHaul,
  haulCount,
  haulGold,
  haulStatusLine,
  haulYesterdayLine,
  recordMined,
  resetMineHaul,
} from '../src/game/mining-haul';
import { GEMS } from '../src/game/gems';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

describe('getMineHaul default', () => {
  it('starts with empty counts + empty lastRun', () => {
    const w = freshWorld();
    const state = getMineHaul(w.player);
    expect(state.counts).toEqual({});
    expect(state.lastRun.counts).toEqual({});
    expect(state.lastRun.gold).toBe(0);
  });
});

describe('recordMined', () => {
  it('bumps the per-gem tally', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'ruby');
    const state = getMineHaul(w.player);
    expect(state.counts.copper).toBe(2);
    expect(state.counts.ruby).toBe(1);
    expect(state.counts.iron ?? 0).toBe(0);
  });
});

describe('haulCount + haulGold', () => {
  it('sums the running counts', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'iron');
    const state = getMineHaul(w.player);
    expect(haulCount(state)).toBe(3);
    expect(haulGold(state)).toBe(
      2 * GEMS.copper.sellPrice + GEMS.iron.sellPrice,
    );
  });

  it('returns 0 for a fresh tally', () => {
    const w = freshWorld();
    const state = getMineHaul(w.player);
    expect(haulCount(state)).toBe(0);
    expect(haulGold(state)).toBe(0);
  });
});

describe('resetMineHaul', () => {
  it('clears the running tally and stashes a lastRun snapshot', () => {
    const w = freshWorld();
    recordMined(w.player, 'iron');
    recordMined(w.player, 'silver');
    const before = haulGold(getMineHaul(w.player));
    expect(before).toBe(GEMS.iron.sellPrice + GEMS.silver.sellPrice);
    const out = resetMineHaul(w.player);
    expect(out.total).toBe(2);
    expect(out.gold).toBe(before);
    expect(out.counts.iron).toBe(1);
    const state = getMineHaul(w.player);
    expect(state.counts).toEqual({});
    expect(state.lastRun.counts.iron).toBe(1);
    expect(state.lastRun.counts.silver).toBe(1);
    expect(state.lastRun.gold).toBe(before);
  });

  it('idempotent on an empty tally', () => {
    const w = freshWorld();
    const out = resetMineHaul(w.player);
    expect(out.total).toBe(0);
    expect(out.gold).toBe(0);
    const state = getMineHaul(w.player);
    expect(state.lastRun.counts).toEqual({});
    expect(state.lastRun.gold).toBe(0);
  });

  it('overwrites a prior lastRun snapshot', () => {
    const w = freshWorld();
    recordMined(w.player, 'ruby');
    resetMineHaul(w.player);
    expect(getMineHaul(w.player).lastRun.counts.ruby).toBe(1);
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    resetMineHaul(w.player);
    // Old ruby snapshot is gone — only the most recent run survives.
    expect(getMineHaul(w.player).lastRun.counts.ruby ?? 0).toBe(0);
    expect(getMineHaul(w.player).lastRun.counts.copper).toBe(2);
  });
});

describe('haulYesterdayLine', () => {
  it('is empty when yesterday had no haul', () => {
    const w = freshWorld();
    expect(haulYesterdayLine(getMineHaul(w.player))).toBe('');
  });

  it('names every gem with a count + total worth', () => {
    const w = freshWorld();
    recordMined(w.player, 'copper');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'ruby');
    resetMineHaul(w.player);
    const line = haulYesterdayLine(getMineHaul(w.player));
    expect(line).toContain('2 copper nugget');
    expect(line).toContain('1 cave ruby');
    const expected = 2 * GEMS.copper.sellPrice + GEMS.ruby.sellPrice;
    expect(line).toContain(`${expected}g`);
  });

  it('catalogue-order: copper before iron before silver before gold before ruby', () => {
    const w = freshWorld();
    recordMined(w.player, 'ruby');
    recordMined(w.player, 'copper');
    recordMined(w.player, 'iron');
    resetMineHaul(w.player);
    const line = haulYesterdayLine(getMineHaul(w.player));
    const copperIdx = line.indexOf('copper');
    const ironIdx = line.indexOf('iron');
    const rubyIdx = line.indexOf('ruby');
    expect(copperIdx).toBeLessThan(ironIdx);
    expect(ironIdx).toBeLessThan(rubyIdx);
  });
});

describe('haulStatusLine', () => {
  it('reads naturally on an empty current run', () => {
    const w = freshWorld();
    const line = haulStatusLine(getMineHaul(w.player));
    expect(line).toMatch(/empty/i);
  });

  it('reports the running totals', () => {
    const w = freshWorld();
    recordMined(w.player, 'gold');
    recordMined(w.player, 'silver');
    const line = haulStatusLine(getMineHaul(w.player));
    expect(line).toContain('1 silver vein');
    expect(line).toContain('1 gold nugget');
    expect(line).toContain(`${GEMS.silver.sellPrice + GEMS.gold.sellPrice}g`);
  });
});
