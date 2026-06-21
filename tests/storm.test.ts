// Seasonal storm — once-per-season, deterministic day, greenhouse-safe.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import type { FarmCrop } from '../src/game/farming';
import {
  getStorm,
  maybeFireStorm,
  pickStormDay,
  stormDaysUntil,
  stormFlavorLine,
  stormScheduledDay,
  takeStormMemo,
} from '../src/game/storm';
import { placeGreenhouse } from '../src/game/greenhouse';
import { plant, till, water, advanceDay } from '../src/game/farming';
import { getForage } from '../src/game/forage';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function makeWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 8, tomato: 4 };
  w.player.gold = 200;
  return w;
}

function plantWatered(w: World, tx: number, ty: number, crop = 'wheat'): FarmCrop {
  till(w, tx, ty);
  plant(w, tx, ty, crop, w.player);
  water(w, tx, ty);
  // Rack up a meaningful streak.
  for (let i = 0; i < 4; i++) {
    advanceDay(w);
    water(w, tx, ty);
  }
  return (w.crops as unknown as FarmCrop[]).find((c) => c.tx === tx && c.ty === ty)!;
}

function fakeGame(): Game {
  return { world: makeWorld(), time: new TimeOfDay(6) } as unknown as Game;
}

describe('pickStormDay', () => {
  it('always returns a day in [2,6]', () => {
    for (let season = 0; season < 4; season++) {
      const day = pickStormDay(season, {});
      expect(day).toBeGreaterThanOrEqual(2);
      expect(day).toBeLessThanOrEqual(6);
    }
  });

  it('is deterministic for the same season + history', () => {
    expect(pickStormDay(1, {})).toBe(pickStormDay(1, {}));
    expect(pickStormDay(2, { 'y0:s0': 4, 'y0:s1': 5 })).toBe(
      pickStormDay(2, { 'y0:s0': 4, 'y0:s1': 5 }),
    );
  });
});

describe('stormScheduledDay', () => {
  it('matches pickStormDay for an untouched season', () => {
    const w = makeWorld();
    expect(stormScheduledDay(w.player, 1)).toBe(pickStormDay(1, {}));
  });

  it('preserves the recorded day after a storm has hit', () => {
    const w = makeWorld();
    const scheduled = stormScheduledDay(w.player, 0);
    // Trigger the storm at the scheduled day.
    plantWatered(w, 20, 23);
    const out = maybeFireStorm(w, w.player, 0, scheduled);
    expect(out.kind).toBe('fired');
    expect(stormScheduledDay(w.player, 0)).toBe(scheduled);
  });
});

describe('maybeFireStorm — outdoor crops', () => {
  it('not-today returns when the day does not match', () => {
    const w = makeWorld();
    const scheduled = stormScheduledDay(w.player, 0);
    const off = scheduled === 6 ? 2 : scheduled + 1;
    expect(maybeFireStorm(w, w.player, 0, off).kind).toBe('not-today');
  });

  it('a silver-streak crop loses a streak day when the storm fires', () => {
    const w = makeWorld();
    const crop = plantWatered(w, 20, 23);
    const beforeStreak = crop.waterStreak ?? 0;
    expect(beforeStreak).toBeGreaterThan(0);
    const day = stormScheduledDay(w.player, 0);
    const out = maybeFireStorm(w, w.player, 0, day);
    expect(out.kind).toBe('fired');
    if (out.kind === 'fired') {
      expect(out.cropsHit).toBe(1);
      expect(crop.waterStreak).toBe(beforeStreak - 1);
      expect(crop.daysSinceWater).toBeGreaterThanOrEqual(1);
    }
  });

  it('greenhouse-protected crops keep their streak', () => {
    const w = makeWorld();
    // Clear a 3x3 grass patch for the greenhouse.
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        w.tiles[10 + dy][10 + dx] = { type: 'grass' };
      }
    }
    placeGreenhouse(w, 10, 10);
    // Plant inside the greenhouse footprint.
    plant(w, 11, 11, 'wheat', w.player);
    water(w, 11, 11);
    // Plant outside.
    till(w, 20, 23);
    plant(w, 20, 23, 'wheat', w.player);
    water(w, 20, 23);
    // Grow both in lockstep — water both before each advanceDay.
    for (let i = 0; i < 4; i++) {
      advanceDay(w);
      water(w, 11, 11);
      water(w, 20, 23);
    }
    const inside = (w.crops as unknown as FarmCrop[]).find(
      (c) => c.tx === 11 && c.ty === 11,
    )!;
    const outside = (w.crops as unknown as FarmCrop[]).find(
      (c) => c.tx === 20 && c.ty === 23,
    )!;
    expect(inside.waterStreak).toBe(4);
    expect(outside.waterStreak).toBe(4);
    const day = stormScheduledDay(w.player, 0);
    const out = maybeFireStorm(w, w.player, 0, day);
    expect(out.kind).toBe('fired');
    if (out.kind === 'fired') {
      // Only the outdoor crop was hit.
      expect(out.cropsHit).toBe(1);
    }
    expect(inside.waterStreak).toBe(4);
    expect(outside.waterStreak).toBe(3);
  });

  it('a second call within the same season is a no-op', () => {
    const w = makeWorld();
    plantWatered(w, 20, 23);
    const day = stormScheduledDay(w.player, 0);
    expect(maybeFireStorm(w, w.player, 0, day).kind).toBe('fired');
    expect(maybeFireStorm(w, w.player, 0, day).kind).toBe('already');
  });
});

describe('maybeFireStorm — forage clears', () => {
  it('wipes the forage list on impact', () => {
    const w = makeWorld();
    const forage = getForage(w);
    forage.push({ tx: 5, ty: 5, kind: 'berry', spawnedDay: 1 });
    forage.push({ tx: 6, ty: 6, kind: 'mushroom', spawnedDay: 1 });
    const day = stormScheduledDay(w.player, 0);
    const out = maybeFireStorm(w, w.player, 0, day);
    if (out.kind === 'fired') {
      expect(out.forageHit).toBe(2);
      expect(forage.length).toBe(0);
    }
  });
});

describe('stormDaysUntil + takeStormMemo + stormFlavorLine', () => {
  it('counts down to the storm and reports -1 after it hits', () => {
    const w = makeWorld();
    const day = stormScheduledDay(w.player, 0);
    expect(stormDaysUntil(w.player, 0, 1)).toBe(day - 1);
    maybeFireStorm(w, w.player, 0, day);
    expect(stormDaysUntil(w.player, 0, day)).toBe(-1);
  });

  it('takeStormMemo returns then clears', () => {
    const w = makeWorld();
    plantWatered(w, 20, 23);
    const day = stormScheduledDay(w.player, 0);
    maybeFireStorm(w, w.player, 0, day);
    const memo = takeStormMemo(w.player);
    expect(memo).toBeDefined();
    expect(takeStormMemo(w.player)).toBeUndefined();
  });

  it('stormFlavorLine includes season name + impact counts', () => {
    const line = stormFlavorLine({ season: 2, day: 4, cropsHit: 3, forageHit: 5 });
    expect(line).toContain('Fall');
    expect(line).toContain('3');
    expect(line).toContain('5');
  });
});

describe('storm persistence', () => {
  it('the per-season hit log round-trips', () => {
    const a = fakeGame();
    plantWatered(a.world, 20, 23);
    const day = stormScheduledDay(a.world.player, 0);
    maybeFireStorm(a.world, a.world.player, 0, day);
    const snap = serializeGame(a);
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(Object.keys(getStorm(b.world.player).hit).length).toBe(1);
    // Re-fire is a no-op.
    expect(maybeFireStorm(b.world, b.world.player, 0, day).kind).toBe('already');
  });
});
