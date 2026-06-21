// Storm shelter pairing — two shelters within SHELTER_PAIR_RANGE
// of each other widen each one's coverage from Chebyshev 1 to Chebyshev
// 2 (5x5). Both still get consumed when the storm hits.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  SHELTER_PAIR_RANGE,
  SHELTER_RADIUS,
  SHELTER_RADIUS_PAIRED,
  consumeShelteringShelters,
  effectiveRadius,
  getShelters,
  isPaired,
  isUnderShelter,
  placeShelter,
} from '../src/game/storm-shelter';
import { plant, till, water, advanceDay } from '../src/game/farming';
import type { FarmCrop } from '../src/game/farming';
import { maybeFireStorm, stormScheduledDay } from '../src/game/storm';

function fakeWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 64 };
  w.player.gold = 200;
  return w;
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

describe('pair constants', () => {
  it('paired radius is wider than the single radius', () => {
    expect(SHELTER_RADIUS_PAIRED).toBeGreaterThan(SHELTER_RADIUS);
  });

  it('pair range covers the paired radius', () => {
    // Two shelters at distance SHELTER_PAIR_RANGE should pair.
    expect(SHELTER_PAIR_RANGE).toBeGreaterThanOrEqual(SHELTER_RADIUS_PAIRED);
  });
});

describe('effectiveRadius', () => {
  it('a lone shelter returns SHELTER_RADIUS', () => {
    const w = fakeWorld();
    const s = placeShelter(w, 10, 14)!;
    expect(effectiveRadius(w, s)).toBe(SHELTER_RADIUS);
    expect(isPaired(w, s)).toBe(false);
  });

  it('two shelters at distance <= SHELTER_PAIR_RANGE return SHELTER_RADIUS_PAIRED', () => {
    const w = fakeWorld();
    const a = placeShelter(w, 10, 14)!;
    const b = placeShelter(w, 10 + SHELTER_PAIR_RANGE, 14)!;
    expect(effectiveRadius(w, a)).toBe(SHELTER_RADIUS_PAIRED);
    expect(effectiveRadius(w, b)).toBe(SHELTER_RADIUS_PAIRED);
    expect(isPaired(w, a)).toBe(true);
    expect(isPaired(w, b)).toBe(true);
  });

  it('two shelters just out of range stay single', () => {
    const w = fakeWorld();
    const a = placeShelter(w, 10, 14)!;
    const b = placeShelter(w, 10 + SHELTER_PAIR_RANGE + 1, 14)!;
    expect(effectiveRadius(w, a)).toBe(SHELTER_RADIUS);
    expect(effectiveRadius(w, b)).toBe(SHELTER_RADIUS);
  });

  it('three shelters: the middle one pairs with both', () => {
    const w = fakeWorld();
    const a = placeShelter(w, 8, 14)!;
    const mid = placeShelter(w, 10, 14)!;
    const b = placeShelter(w, 12, 14)!;
    expect(isPaired(w, a)).toBe(true);
    expect(isPaired(w, mid)).toBe(true);
    expect(isPaired(w, b)).toBe(true);
  });
});

describe('isUnderShelter with pairing', () => {
  it('paired shelter covers a tile 2 away that a single would miss', () => {
    const w = fakeWorld();
    const a = placeShelter(w, 10, 14)!;
    // Pre-pair: a tile 2 away is NOT under coverage.
    expect(isUnderShelter(w, 12, 14)).toBe(false);
    void a;
    // Place a partner within SHELTER_PAIR_RANGE — both widen to 5x5.
    placeShelter(w, 12, 14);
    // The tile 2 east of `a` is now under its widened coverage AND is
    // also the partner's own tile, but the assertion that matters is
    // a 2-away-from-EVERY-shelter tile.
    expect(isUnderShelter(w, 10 + SHELTER_RADIUS_PAIRED, 14 - SHELTER_RADIUS_PAIRED)).toBe(true);
  });

  it('single shelter does not cover a tile at distance 2', () => {
    const w = fakeWorld();
    placeShelter(w, 10, 14);
    expect(isUnderShelter(w, 10, 14 + 2)).toBe(false);
  });
});

describe('storm: paired shelters cover more crops', () => {
  it('a single shelter covers a 3x3, a pair covers a 5x5', () => {
    const w = fakeWorld();
    // Plant crops in a 5x5 grid centered on (22, 24) — entirely inside
    // the starter tilled patch at x:[19,26] y:[22,27].
    const crops: FarmCrop[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        crops.push(plantWatered(w, 22 + dx, 24 + dy));
      }
    }
    expect(crops.length).toBe(25);
    // Drop one shelter dead center, plus a partner one tile to the
    // right — total 25 crops in the 5x5; the paired pair should
    // cover all of them.
    placeShelter(w, 22, 24);
    placeShelter(w, 23, 24);
    const day = stormScheduledDay(w.player, 0);
    const out = maybeFireStorm(w, w.player, 0, day);
    expect(out.kind).toBe('fired');
    if (out.kind === 'fired') {
      // Every crop in the 5x5 lived.
      expect(out.cropsHit).toBe(0);
      expect(out.cropsSheltered).toBe(25);
      expect(out.consumedShelters).toBe(2);
    }
    // The shelters are gone after consume.
    expect(getShelters(w).length).toBe(0);
  });

  it('a lone shelter only covers its 3x3 even when crops sit two tiles out', () => {
    const w = fakeWorld();
    // 5x5 grid as before, all inside the tilled patch.
    const crops: FarmCrop[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        crops.push(plantWatered(w, 22 + dx, 24 + dy));
      }
    }
    expect(crops.length).toBe(25);
    placeShelter(w, 22, 24);
    const day = stormScheduledDay(w.player, 0);
    const out = maybeFireStorm(w, w.player, 0, day);
    expect(out.kind).toBe('fired');
    if (out.kind === 'fired') {
      expect(out.cropsSheltered).toBe(9); // 3x3
      expect(out.cropsHit).toBe(16); // 5x5 - 3x3
      expect(out.consumedShelters).toBe(1);
    }
  });
});

describe('consume with paired snapshot', () => {
  it('removing the partner does not retroactively shrink the surviving shelter mid-loop', () => {
    const w = fakeWorld();
    // Two paired shelters. We pass a single covered tile that ONLY the
    // first shelter's paired-radius reaches. Consume must mark only
    // the first shelter as used. The partner must not be removed.
    placeShelter(w, 10, 14);
    placeShelter(w, 12, 14);
    // Tile (10, 14 + 2) is paired-radius of shelter@(10,14) but is
    // distance 2 (Chebyshev) from shelter@(12,14) too — both reach it
    // when paired. So pass a tile only the first reaches:
    // (8, 14) is paired-radius 2 from (10,14) and 4 Chebyshev from (12,14).
    const consumed = consumeShelteringShelters(w, [{ tx: 8, ty: 14 }]);
    expect(consumed).toBe(1);
    const survivors = getShelters(w);
    expect(survivors.length).toBe(1);
    expect(survivors[0].tx).toBe(12);
  });
});
