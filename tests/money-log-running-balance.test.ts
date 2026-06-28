// Money-log running balance — per-row "= Ng" trailing figure anchored on
// the player's current gold, reconstructed by walking the newest-first log.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  logGold,
  runningBalances,
  runningBalanceMap,
  applyMoneyFilter,
  groupMoneyEntriesByDay,
  getMoneyLog,
} from '../src/game/money-log';

describe('runningBalances', () => {
  it('returns an empty list for an empty ledger', () => {
    const w = new World();
    expect(runningBalances(w.player)).toEqual([]);
  });

  it("the newest row's balance equals the player's current gold", () => {
    const w = new World();
    w.player.gold = 250;
    logGold(w.player, 100, 'well: harvest', 1);
    logGold(w.player, -30, 'shop: seeds', 1);
    const rows = runningBalances(w.player);
    // Newest first → rows[0] is the most recent change.
    expect(rows[0].balance).toBe(250);
  });

  it('older rows subtract every newer delta from the current gold', () => {
    const w = new World();
    // Simulate: start 100, +50 (=150), -20 (=130), +80 (=210).
    w.player.gold = 210;
    logGold(w.player, 50, 'a', 1); // oldest of the three
    logGold(w.player, -20, 'b', 1);
    logGold(w.player, 80, 'c', 1); // newest
    const rows = runningBalances(w.player);
    // Order newest-first: c, b, a.
    expect(rows.map((r) => r.entry.reason)).toEqual(['c', 'b', 'a']);
    expect(rows[0].balance).toBe(210); // after c
    expect(rows[1].balance).toBe(130); // after b (210 - 80)
    expect(rows[2].balance).toBe(150); // after a (210 - 80 + 20)
  });

  it('each row balance equals the previous (older) balance plus this delta', () => {
    const w = new World();
    w.player.gold = 500;
    for (let i = 0; i < 8; i++) {
      logGold(w.player, i % 2 === 0 ? 40 : -15, `e${i}`, 1);
    }
    const rows = runningBalances(w.player);
    // Walking from oldest (last) to newest (first): balance grows by delta.
    for (let i = rows.length - 1; i > 0; i--) {
      const older = rows[i];
      const newer = rows[i - 1];
      expect(newer.balance).toBe(older.balance + newer.entry.delta);
    }
  });
});

describe('runningBalanceMap', () => {
  it('keys each entry to its whole-log balance by reference', () => {
    const w = new World();
    w.player.gold = 90;
    logGold(w.player, 30, 'a', 1);
    logGold(w.player, -10, 'b', 1);
    logGold(w.player, 70, 'c', 1);
    const map = runningBalanceMap(w.player);
    const log = getMoneyLog(w.player);
    // Every live entry object is a key.
    for (const e of log) expect(map.has(e)).toBe(true);
    // The balance matches the full-log reconstruction.
    const direct = runningBalances(w.player);
    for (const row of direct) expect(map.get(row.entry)).toBe(row.balance);
  });

  it('a filtered slice still reads the whole-log balance through the map', () => {
    const w = new World();
    w.player.gold = 200;
    logGold(w.player, 100, 'well: harvest', 1); // sale
    logGold(w.player, -40, 'shop: seeds', 1); // purchase (hidden under a sales filter)
    logGold(w.player, 140, 'inn: stew', 1); // sale
    const map = runningBalanceMap(w.player);
    const sales = applyMoneyFilter(getMoneyLog(w.player), 'sales');
    // The shown sales rows keep their TRUE balance even though the purchase
    // row between them is filtered out (hidden rows still count).
    const full = runningBalances(w.player);
    for (const e of sales) {
      const expected = full.find((r) => r.entry === e)!.balance;
      expect(map.get(e)).toBe(expected);
    }
    // Specifically: newest sale (inn) reads current gold; older sale (well)
    // subtracts the inn (+140) AND the hidden seeds purchase (-40).
    const innRow = sales.find((e) => e.reason === 'inn: stew')!;
    const wellRow = sales.find((e) => e.reason === 'well: harvest')!;
    expect(map.get(innRow)).toBe(200);
    expect(map.get(wellRow)).toBe(200 - 140 + 40);
  });

  it('preserves entry identity through the day-group pipeline', () => {
    const w = new World();
    w.player.gold = 60;
    logGold(w.player, 20, 'a', 1);
    logGold(w.player, 40, 'b', 2);
    const map = runningBalanceMap(w.player);
    const groups = groupMoneyEntriesByDay(getMoneyLog(w.player));
    for (const g of groups) {
      for (const e of g.entries) {
        expect(map.get(e)).not.toBeUndefined();
      }
    }
  });
});
