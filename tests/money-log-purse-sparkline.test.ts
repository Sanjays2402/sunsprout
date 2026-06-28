// Money-log purse sparkline — the running-balance trajectory across the
// whole logged window, normalised into a unit box so the header can draw a
// tiny polyline of the window's SHAPE on top of the start -> end trend.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { logGold, purseSparkline, purseTrend } from '../src/game/money-log';

describe('purseSparkline', () => {
  it('returns null for an empty ledger (no span)', () => {
    const w = new World();
    expect(purseSparkline(w.player)).toBeNull();
  });

  it('returns null for a single entry (no span to trace)', () => {
    const w = new World();
    w.player.gold = 120;
    logGold(w.player, 20, 'a', 1);
    expect(purseSparkline(w.player)).toBeNull();
  });

  it('yields N+1 points for N ledger rows (start + each balance)', () => {
    const w = new World();
    w.player.gold = 210;
    logGold(w.player, 50, 'a', 1);
    logGold(w.player, -20, 'b', 1);
    logGold(w.player, 80, 'c', 1);
    const spark = purseSparkline(w.player)!;
    expect(spark).toHaveLength(4); // 3 rows -> 4 vertices
  });

  it('spans x from 0 (oldest) to 1 (newest), evenly spaced', () => {
    const w = new World();
    w.player.gold = 130;
    logGold(w.player, 10, 'a', 1);
    logGold(w.player, 10, 'b', 1);
    logGold(w.player, 10, 'c', 1);
    const spark = purseSparkline(w.player)!;
    expect(spark[0].x).toBe(0);
    expect(spark[spark.length - 1].x).toBe(1);
    // Evenly spaced across the 4 points: 0, 1/3, 2/3, 1.
    expect(spark[1].x).toBeCloseTo(1 / 3, 5);
    expect(spark[2].x).toBeCloseTo(2 / 3, 5);
  });

  it('normalises y so the window low is 0 and the high is 1', () => {
    const w = new World();
    // start 100, +50 (=150), -90 (=60), +40 (=100). Low=60, high=150.
    w.player.gold = 100;
    logGold(w.player, 50, 'a', 1); // oldest
    logGold(w.player, -90, 'b', 1);
    logGold(w.player, 40, 'c', 1); // newest
    const spark = purseSparkline(w.player)!;
    const ys = spark.map((p) => p.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(1);
    // First vertex is the pre-window start (100), normalised between 60..150.
    expect(spark[0].y).toBeCloseTo((100 - 60) / (150 - 60), 5);
  });

  it('traces the same start/end the trend text names', () => {
    const w = new World();
    // 100 -> 150 -> 130 -> 210: monotone-ish, end (210) is the window high,
    // start (100) is the window low, so the polyline ends at the top.
    w.player.gold = 210;
    logGold(w.player, 50, 'a', 1);
    logGold(w.player, -20, 'b', 1);
    logGold(w.player, 80, 'c', 1);
    const trend = purseTrend(w.player)!;
    const spark = purseSparkline(w.player)!;
    expect(trend.start).toBe(100);
    expect(trend.end).toBe(210);
    expect(spark[0].y).toBe(0); // start is the window low here
    expect(spark[spark.length - 1].y).toBe(1); // end is the window high
  });

  it('keeps every y finite and within [0,1] on a varied window', () => {
    const w = new World();
    w.player.gold = 500;
    for (let i = 0; i < 8; i++) {
      logGold(w.player, i % 2 === 0 ? 60 : -25, `e${i}`, 1);
    }
    const spark = purseSparkline(w.player)!;
    for (const p of spark) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
    }
  });
});
