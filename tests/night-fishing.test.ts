// Late-night fishing perk — 22-04h biases the bite pool toward rares.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  NIGHT_FISH_BIAS,
  NIGHT_WINDOW_END,
  NIGHT_WINDOW_START,
  isLateNightFishing,
  isLateNightHour,
  nightAwareFishPick,
  nightFlavorLine,
} from '../src/game/night-fishing';
import { upgradeRod } from '../src/game/rod-upgrades';
import type { FishKey } from '../src/game/fish';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('isLateNightHour', () => {
  it('covers 22:00 through 03:59 inclusive', () => {
    expect(isLateNightHour(22)).toBe(true);
    expect(isLateNightHour(23)).toBe(true);
    expect(isLateNightHour(0)).toBe(true);
    expect(isLateNightHour(3)).toBe(true);
  });

  it('excludes the regular daylight hours', () => {
    expect(isLateNightHour(4)).toBe(false);
    expect(isLateNightHour(12)).toBe(false);
    expect(isLateNightHour(21)).toBe(false);
    expect(isLateNightHour(NIGHT_WINDOW_END)).toBe(false);
    expect(isLateNightHour(NIGHT_WINDOW_START - 1)).toBe(false);
  });

  it('isLateNightFishing reads off TimeOfDay.hour', () => {
    const t = new TimeOfDay(6);
    t.hour = 23;
    expect(isLateNightFishing(t)).toBe(true);
    t.hour = 12;
    expect(isLateNightFishing(t)).toBe(false);
  });
});

describe('NIGHT_FISH_BIAS catalog', () => {
  it('lifts the rare fish and drops the minnow', () => {
    expect(NIGHT_FISH_BIAS.minnow).toBeLessThan(1);
    expect(NIGHT_FISH_BIAS.trout).toBeGreaterThan(1);
    expect(NIGHT_FISH_BIAS.pike).toBeGreaterThan(NIGHT_FISH_BIAS.trout);
  });
});

describe('nightAwareFishPick', () => {
  it('rare catches arrive more often at night than at noon', () => {
    const w = new World();
    // 1000 casts at noon, 1000 at night with the same RNG sequence.
    function tally(hour: number): Record<FishKey, number> {
      const rng = seeded(12345);
      const t = new TimeOfDay(6);
      t.hour = hour;
      const counts: Record<FishKey, number> = {
        minnow: 0, carp: 0, bass: 0, trout: 0, pike: 0,
      };
      for (let i = 0; i < 2000; i++) {
        const fish = nightAwareFishPick(w.player, t, rng);
        counts[fish] += 1;
      }
      return counts;
    }
    const day = tally(12);
    const night = tally(23);
    expect(night.pike).toBeGreaterThan(day.pike);
    expect(night.trout).toBeGreaterThan(day.trout);
    expect(night.minnow).toBeLessThan(day.minnow);
  });

  it('still respects rod tier on top of the night bias', () => {
    const w = new World();
    w.player.gold = 99999;
    // Wood-rod night cast vs gold-rod night cast — gold should lift pike further.
    const t = new TimeOfDay(6);
    t.hour = 1;
    const woodCounts = { minnow: 0, pike: 0 } as Record<string, number>;
    const goldCounts = { minnow: 0, pike: 0 } as Record<string, number>;
    const rng1 = seeded(7777);
    for (let i = 0; i < 2000; i++) {
      const f = nightAwareFishPick(w.player, t, rng1);
      woodCounts[f] = (woodCounts[f] ?? 0) + 1;
    }
    upgradeRod(w.player);
    upgradeRod(w.player);
    upgradeRod(w.player); // now gold
    const rng2 = seeded(7777);
    for (let i = 0; i < 2000; i++) {
      const f = nightAwareFishPick(w.player, t, rng2);
      goldCounts[f] = (goldCounts[f] ?? 0) + 1;
    }
    expect(goldCounts.pike).toBeGreaterThan(woodCounts.pike);
  });

  it('always returns a valid fish key', () => {
    const w = new World();
    const t = new TimeOfDay(6);
    t.hour = 23;
    const allowed = new Set<FishKey>(['minnow', 'carp', 'bass', 'trout', 'pike']);
    for (let i = 0; i < 50; i++) {
      const f = nightAwareFishPick(w.player, t);
      expect(allowed.has(f)).toBe(true);
    }
  });
});

describe('nightFlavorLine', () => {
  it('returns a non-empty toast string', () => {
    expect(nightFlavorLine().length).toBeGreaterThan(0);
  });
});
