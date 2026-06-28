// Money-log purse sparkline extremes — purseSparklineExtremes() finds the
// window's high + low balance vertices so the panel can mark and name them
// (peak / low) on top of the sparkline trajectory.

import { describe, it, expect } from 'vitest';
import {
  logGold,
  purseSparkline,
  purseSparklineExtremes,
} from '../src/game/money-log';
import { World } from '../src/world/world';

describe('purseSparklineExtremes', () => {
  it('returns null for fewer than two rows (no span, lock-step with the sparkline)', () => {
    const w = new World();
    expect(purseSparklineExtremes(w.player)).toBeNull();
    w.player.gold = 50;
    logGold(w.player, 50, 'a', 1);
    expect(purseSparklineExtremes(w.player)).toBeNull();
  });

  it('reports the raw high and low gold values of the window', () => {
    const w = new World();
    // start 100, +50 (=150), -90 (=60), +40 (=100). High=150, low=60.
    w.player.gold = 100;
    logGold(w.player, 50, 'a', 1); // oldest
    logGold(w.player, -90, 'b', 1);
    logGold(w.player, 40, 'c', 1); // newest
    const ex = purseSparklineExtremes(w.player)!;
    expect(ex.peak.value).toBe(150);
    expect(ex.low.value).toBe(60);
  });

  it('peak sits at normalised y=1 and low at y=0', () => {
    const w = new World();
    w.player.gold = 100;
    logGold(w.player, 50, 'a', 1);
    logGold(w.player, -90, 'b', 1);
    logGold(w.player, 40, 'c', 1);
    const ex = purseSparklineExtremes(w.player)!;
    expect(ex.peak.y).toBe(1);
    expect(ex.low.y).toBe(0);
  });

  it('marker positions coincide with the matching purseSparkline vertices', () => {
    const w = new World();
    w.player.gold = 210;
    logGold(w.player, 50, 'a', 1);
    logGold(w.player, -20, 'b', 1);
    logGold(w.player, 80, 'c', 1);
    const spark = purseSparkline(w.player)!;
    const ex = purseSparklineExtremes(w.player)!;
    // Each extreme's (x,y) must equal an actual sparkline point.
    const has = (mx: number, my: number) =>
      spark.some((p) => p.x === mx && p.y === my);
    expect(has(ex.peak.x, ex.peak.y)).toBe(true);
    expect(has(ex.low.x, ex.low.y)).toBe(true);
  });

  it('puts the low at the oldest and the peak at the newest on a monotonic climb', () => {
    const w = new World();
    w.player.gold = 130;
    logGold(w.player, 10, 'a', 1);
    logGold(w.player, 10, 'b', 1);
    logGold(w.player, 10, 'c', 1);
    const ex = purseSparklineExtremes(w.player)!;
    // Monotonic climb: low is the oldest (start), peak is the newest.
    expect(ex.low.x).toBe(0);
    expect(ex.peak.x).toBe(1);
    expect(ex.peak.value).toBeGreaterThan(ex.low.value);
  });

  it('breaks ties toward the earlier vertex on a repeated extreme', () => {
    const w = new World();
    // start 100, +50 (=150), -50 (=100), +50 (=150): the 150 high repeats
    // at two vertices; the FIRST (earlier) one must win.
    w.player.gold = 150;
    logGold(w.player, 50, 'a', 1); // oldest -> 150
    logGold(w.player, -50, 'b', 1); // -> 100
    logGold(w.player, 50, 'c', 1); // newest -> 150
    const spark = purseSparkline(w.player)!; // 4 vertices: 100,150,100,150
    const ex = purseSparklineExtremes(w.player)!;
    expect(ex.peak.value).toBe(150);
    // The earlier 150 is vertex index 1 (x = 1/3), not the newest (x = 1).
    expect(ex.peak.x).toBeCloseTo(1 / 3, 5);
    expect(ex.peak.x).not.toBe(spark[spark.length - 1].x);
  });
});
