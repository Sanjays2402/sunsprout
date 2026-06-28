// Money-log purse trend — the window's start -> end endpoints + signed
// move, distilled from the running balances so the panel can show a
// one-line trend over the whole logged window.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { logGold, purseTrend, runningBalances, netChange } from '../src/game/money-log';

describe('purseTrend', () => {
  it('returns null for an empty ledger (no span)', () => {
    const w = new World();
    expect(purseTrend(w.player)).toBeNull();
  });

  it('returns null for a single entry (no span to trend across)', () => {
    const w = new World();
    w.player.gold = 120;
    logGold(w.player, 20, 'a', 1);
    expect(purseTrend(w.player)).toBeNull();
  });

  it('reads end as the current gold and start as the pre-window purse', () => {
    const w = new World();
    // Simulate: start 100, +50 (=150), -20 (=130), +80 (=210).
    w.player.gold = 210;
    logGold(w.player, 50, 'a', 1); // oldest
    logGold(w.player, -20, 'b', 1);
    logGold(w.player, 80, 'c', 1); // newest
    const t = purseTrend(w.player)!;
    expect(t.end).toBe(210); // current gold
    expect(t.start).toBe(100); // purse before the oldest (+50) row posted
    expect(t.delta).toBe(110); // 210 - 100
    expect(t.direction).toBe('up');
  });

  it('delta equals netChange over the window', () => {
    const w = new World();
    w.player.gold = 500;
    for (let i = 0; i < 6; i++) {
      logGold(w.player, i % 2 === 0 ? 40 : -15, `e${i}`, 1);
    }
    const t = purseTrend(w.player)!;
    expect(t.delta).toBe(netChange(w.player));
    expect(t.end - t.start).toBe(t.delta);
  });

  it('classifies a net loss as down and a net wash as flat', () => {
    const down = new World();
    down.player.gold = 60;
    logGold(down.player, 100, 'a', 1);
    logGold(down.player, -180, 'b', 1); // net -80 across the window
    const dt = purseTrend(down.player)!;
    expect(dt.direction).toBe('down');
    expect(dt.delta).toBeLessThan(0);

    const flat = new World();
    flat.player.gold = 200;
    logGold(flat.player, 50, 'a', 1);
    logGold(flat.player, -50, 'b', 1); // net 0
    const ft = purseTrend(flat.player)!;
    expect(ft.direction).toBe('flat');
    expect(ft.delta).toBe(0);
    expect(ft.start).toBe(ft.end);
  });

  it('start aligns with the oldest running-balance row minus its delta', () => {
    const w = new World();
    w.player.gold = 90;
    logGold(w.player, 30, 'a', 1);
    logGold(w.player, -10, 'b', 1);
    logGold(w.player, 70, 'c', 1);
    const rows = runningBalances(w.player);
    const oldest = rows[rows.length - 1];
    const t = purseTrend(w.player)!;
    expect(t.start).toBe(oldest.balance - oldest.entry.delta);
  });
});
