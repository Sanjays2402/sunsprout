// Chimney smoke — a responsive hearth wisp over the farmhouse roof.

import { describe, it, expect } from 'vitest';
import {
  hearthLit,
  chimneySmoke,
  SMOKE_PUFF_COUNT,
  SMOKE_RISE_HEIGHT,
  SMOKE_PERIOD_MS,
  HEARTH_MORNING_HOUR,
  HEARTH_EVENING_HOUR,
} from '../src/game/chimney-smoke';
import { weatherToday, WEATHER } from '../src/game/weather';
import type { TimeOfDay } from '../src/game/time';

function t(season: 0 | 1 | 2 | 3, day: number, hour: number): TimeOfDay {
  return { season, day, hour, minute: 0 } as unknown as TimeOfDay;
}

/** Find a Summer day whose midday weather does NOT water crops. */
function findDryMiddaySummerDay(): TimeOfDay {
  for (let day = 1; day <= 7; day++) {
    const time = t(1, day, 12);
    if (!WEATHER[weatherToday(time)].watersCrops) return time;
  }
  throw new Error('expected at least one dry Summer day');
}

/** Find any day whose weather waters crops (rain / storm). */
function findWateringMiddayDay(): TimeOfDay {
  for (let season = 0 as 0 | 1 | 2 | 3; season <= 3; season++) {
    for (let day = 1; day <= 7; day++) {
      const time = t(season, day, 12);
      if (season !== 3 && WEATHER[weatherToday(time)].watersCrops) return time;
    }
  }
  throw new Error('expected at least one watering day');
}

describe('hearthLit', () => {
  it('is always lit in Winter, even at sunny midday', () => {
    expect(hearthLit(t(3, 3, 12))).toBe(true);
  });

  it('is lit in the cold dark hours (before morning / after evening)', () => {
    expect(hearthLit(t(1, 2, HEARTH_MORNING_HOUR - 1))).toBe(true);
    expect(hearthLit(t(1, 2, HEARTH_EVENING_HOUR))).toBe(true);
    expect(hearthLit(t(1, 2, 23))).toBe(true);
  });

  it('is unlit at a dry Summer midday', () => {
    const dry = findDryMiddaySummerDay();
    expect(hearthLit(dry)).toBe(false);
  });

  it('is lit whenever the weather waters crops (rain / storm)', () => {
    const wet = findWateringMiddayDay();
    // Same instant, but the rain lights the hearth even at midday.
    expect(WEATHER[weatherToday(wet)].watersCrops).toBe(true);
    expect(hearthLit(wet)).toBe(true);
  });
});

describe('chimneySmoke — animated column', () => {
  it('returns SMOKE_PUFF_COUNT puffs with motion on', () => {
    expect(chimneySmoke(1000, 100, 80, false).length).toBe(SMOKE_PUFF_COUNT);
  });

  it('is deterministic for a given (nowMs, origin)', () => {
    const a = chimneySmoke(1234, 50, 60, false);
    const b = chimneySmoke(1234, 50, 60, false);
    expect(a).toEqual(b);
  });

  it('keeps every puff within the rise envelope above the chimney lip', () => {
    for (let ms = 0; ms <= SMOKE_PERIOD_MS; ms += 100) {
      for (const p of chimneySmoke(ms, 200, 150, false)) {
        // Rises (y decreases) but never past the full rise height, never below the lip.
        expect(p.y).toBeLessThanOrEqual(150 + 1e-6);
        expect(p.y).toBeGreaterThanOrEqual(150 - SMOKE_RISE_HEIGHT - 1e-6);
        expect(p.alpha).toBeGreaterThanOrEqual(0);
        expect(p.alpha).toBeLessThanOrEqual(1);
      }
    }
  });

  it('drifts wider near the top than at the lip (the wisp curls out)', () => {
    // Sample the spread of x across a full period at the base vs the crown
    // by comparing the lowest and highest puffs' drift envelopes.
    let maxLow = 0;
    let maxHigh = 0;
    const ox = 100;
    for (let ms = 0; ms <= SMOKE_PERIOD_MS; ms += 50) {
      for (const p of chimneySmoke(ms, ox, 200, false)) {
        const rise = (200 - p.y) / SMOKE_RISE_HEIGHT; // 0 at lip .. 1 at crown
        const drift = Math.abs(p.x - ox);
        if (rise < 0.25) maxLow = Math.max(maxLow, drift);
        if (rise > 0.6) maxHigh = Math.max(maxHigh, drift);
      }
    }
    expect(maxHigh).toBeGreaterThan(maxLow);
  });

  it('loops seamlessly over SMOKE_PERIOD_MS', () => {
    const start = chimneySmoke(0, 10, 10, false);
    const oneLoop = chimneySmoke(SMOKE_PERIOD_MS, 10, 10, false);
    for (let i = 0; i < start.length; i++) {
      expect(oneLoop[i].x).toBeCloseTo(start[i].x, 4);
      expect(oneLoop[i].y).toBeCloseTo(start[i].y, 4);
    }
  });
});

describe('chimneySmoke — reduce-motion', () => {
  it('returns a frozen wisp that ignores the clock', () => {
    const a = chimneySmoke(0, 100, 80, true);
    const b = chimneySmoke(99999, 100, 80, true);
    expect(a).toEqual(b);
  });

  it('still shows a visible thread (lit hearth reads as lit)', () => {
    const calm = chimneySmoke(0, 100, 80, true);
    expect(calm.length).toBeGreaterThan(0);
    expect(calm.some((p) => p.alpha > 0)).toBe(true);
  });

  it('the frozen wisp rises (puffs at distinct heights)', () => {
    const calm = chimneySmoke(0, 100, 80, true);
    const ys = new Set(calm.map((p) => Math.round(p.y)));
    expect(ys.size).toBeGreaterThan(1);
  });
});

describe('SMOKE_PUFF_COUNT', () => {
  it('is a modest thread, not a plume', () => {
    expect(SMOKE_PUFF_COUNT).toBeGreaterThan(0);
    expect(SMOKE_PUFF_COUNT).toBeLessThanOrEqual(8);
  });
});
