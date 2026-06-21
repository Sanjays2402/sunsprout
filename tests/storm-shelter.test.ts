// Storm shelter — placement, coverage, consume-on-storm semantics.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  SHELTER_RADIUS,
  STORM_SHELTER_INVENTORY_KEY,
  canPlaceShelter,
  consumeShelteringShelters,
  getShelters,
  isUnderShelter,
  placeShelter,
  shelterCount,
} from '../src/game/storm-shelter';
import {
  getStorm,
  maybeFireStorm,
  pickStormDay,
  stormFlavorLine,
  stormScheduledDay,
  takeStormMemo,
} from '../src/game/storm';
import { plant, till, water, advanceDay } from '../src/game/farming';
import type { FarmCrop } from '../src/game/farming';
import { BENCH_RECIPES } from '../src/game/bench';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 8 };
  w.player.gold = 200;
  return w;
}

function fakeGame(): Game {
  return { world: fakeWorld(), time: new TimeOfDay(6) } as unknown as Game;
}

function plantWatered(w: World, tx: number, ty: number): FarmCrop {
  till(w, tx, ty);
  plant(w, tx, ty, 'wheat', w.player);
  water(w, tx, ty);
  for (let i = 0; i < 4; i++) {
    advanceDay(w);
    water(w, tx, ty);
  }
  return (w.crops as unknown as FarmCrop[]).find((c) => c.tx === tx && c.ty === ty)!;
}

/** A grass tile we know is clear in the default map. */
const FREE_TX = 10;
const FREE_TY = 14;

describe('placement', () => {
  it('accepts a grass tile', () => {
    const w = fakeWorld();
    expect(canPlaceShelter(w, FREE_TX, FREE_TY)).toBe(true);
  });

  it('accepts a tilled tile too', () => {
    const w = fakeWorld();
    till(w, FREE_TX, FREE_TY);
    expect(canPlaceShelter(w, FREE_TX, FREE_TY)).toBe(true);
  });

  it('refuses overlap', () => {
    const w = fakeWorld();
    placeShelter(w, FREE_TX, FREE_TY);
    expect(canPlaceShelter(w, FREE_TX, FREE_TY)).toBe(false);
  });

  it('refuses out-of-bounds', () => {
    const w = fakeWorld();
    expect(canPlaceShelter(w, -1, 0)).toBe(false);
  });

  it('refuses water tiles', () => {
    const w = fakeWorld();
    // The world's pond corners are water.
    expect(canPlaceShelter(w, 3, 19)).toBe(false);
  });
});

describe('coverage', () => {
  it('isUnderShelter is true within Chebyshev SHELTER_RADIUS', () => {
    const w = fakeWorld();
    placeShelter(w, FREE_TX, FREE_TY);
    expect(isUnderShelter(w, FREE_TX, FREE_TY)).toBe(true);
    expect(isUnderShelter(w, FREE_TX + SHELTER_RADIUS, FREE_TY + SHELTER_RADIUS)).toBe(true);
    expect(isUnderShelter(w, FREE_TX + SHELTER_RADIUS + 1, FREE_TY)).toBe(false);
  });

  it('shelterCount + getShelters expose the world list', () => {
    const w = fakeWorld();
    placeShelter(w, FREE_TX, FREE_TY);
    placeShelter(w, FREE_TX + 4, FREE_TY);
    expect(shelterCount(w)).toBe(2);
    expect(getShelters(w).length).toBe(2);
  });
});

describe('consumeShelteringShelters', () => {
  it('removes only shelters that cover at least one provided tile', () => {
    const w = fakeWorld();
    placeShelter(w, FREE_TX, FREE_TY);
    // Pick a spot far away that we know is grass — same column, deeper south.
    const farTX = FREE_TX;
    const farTY = FREE_TY + 6;
    expect(canPlaceShelter(w, farTX, farTY)).toBe(true);
    placeShelter(w, farTX, farTY);
    const consumed = consumeShelteringShelters(w, [{ tx: FREE_TX, ty: FREE_TY }]);
    expect(consumed).toBe(1);
    expect(getShelters(w).length).toBe(1);
    expect(getShelters(w)[0].tx).toBe(farTX);
    expect(getShelters(w)[0].ty).toBe(farTY);
  });

  it('returns 0 when no tiles are supplied', () => {
    const w = fakeWorld();
    placeShelter(w, FREE_TX, FREE_TY);
    expect(consumeShelteringShelters(w, [])).toBe(0);
    expect(getShelters(w).length).toBe(1);
  });
});

describe('storm interaction', () => {
  it('a sheltered crop keeps its streak', () => {
    const w = fakeWorld();
    const crop = plantWatered(w, 20, 23);
    const before = crop.waterStreak ?? 0;
    placeShelter(w, 20, 23);
    const day = stormScheduledDay(w.player, 0);
    const out = maybeFireStorm(w, w.player, 0, day);
    expect(out.kind).toBe('fired');
    if (out.kind === 'fired') {
      expect(out.cropsSheltered).toBe(1);
      expect(out.cropsHit).toBe(0);
      expect(out.consumedShelters).toBe(1);
    }
    expect(crop.waterStreak).toBe(before);
    expect(getShelters(w).length).toBe(0);
  });

  it('an unsheltered crop still loses a streak point', () => {
    const w = fakeWorld();
    till(w, 20, 23);
    plant(w, 20, 23, 'wheat', w.player);
    water(w, 20, 23);
    till(w, 25, 23);
    plant(w, 25, 23, 'wheat', w.player);
    water(w, 25, 23);
    // Water both each iteration so they grow in lockstep.
    for (let i = 0; i < 4; i++) {
      advanceDay(w);
      water(w, 20, 23);
      water(w, 25, 23);
    }
    const inside = (w.crops as unknown as FarmCrop[]).find((c) => c.tx === 20 && c.ty === 23)!;
    const outside = (w.crops as unknown as FarmCrop[]).find((c) => c.tx === 25 && c.ty === 23)!;
    expect(inside.waterStreak).toBe(4);
    expect(outside.waterStreak).toBe(4);
    placeShelter(w, 20, 23);
    const day = stormScheduledDay(w.player, 0);
    maybeFireStorm(w, w.player, 0, day);
    expect(inside.waterStreak).toBe(4);
    expect(outside.waterStreak).toBe(3);
  });

  it('a shelter on a row with no crops survives the storm', () => {
    const w = fakeWorld();
    placeShelter(w, 26, 23);
    plantWatered(w, 20, 23);
    const day = stormScheduledDay(w.player, 0);
    maybeFireStorm(w, w.player, 0, day);
    expect(getShelters(w).length).toBe(1);
  });
});

describe('storm flavor line', () => {
  it('mentions sheltered crops when any were saved', () => {
    const line = stormFlavorLine({
      season: 0,
      day: 4,
      cropsHit: 1,
      forageHit: 0,
      cropsSheltered: 2,
      consumedShelters: 1,
    });
    expect(line).toContain('Spring');
    expect(line).toContain('2 crops kept dry');
  });
});

describe('persistence', () => {
  it('shelters survive a serialize+apply round trip', () => {
    const a = fakeGame();
    placeShelter(a.world, FREE_TX, FREE_TY);
    placeShelter(a.world, FREE_TX + 4, FREE_TY);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getShelters(b.world).length).toBe(0);
    applySnapshot(b, snap);
    expect(getShelters(b.world).length).toBe(2);
  });
});

describe('bench wiring', () => {
  it('exports the right inventory key', () => {
    expect(STORM_SHELTER_INVENTORY_KEY).toBe('craft-shelter');
  });

  it('Storm Shelter shows up in the bench catalog', () => {
    const keys = BENCH_RECIPES.map((r) => r.key);
    expect(keys).toContain('craft-shelter');
  });
});

describe('sanity', () => {
  it('pickStormDay still returns 2..6', () => {
    for (let s = 0; s < 4; s++) {
      const d = pickStormDay(s, {});
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(6);
    }
  });

  it('takeStormMemo clears once the line is consumed', () => {
    const w = fakeWorld();
    plantWatered(w, 20, 23);
    const day = stormScheduledDay(w.player, 0);
    maybeFireStorm(w, w.player, 0, day);
    expect(takeStormMemo(w.player)).toBeDefined();
    expect(takeStormMemo(w.player)).toBeUndefined();
    expect(getStorm(w.player).hit[`y0:s0`]).toBe(day);
  });
});
