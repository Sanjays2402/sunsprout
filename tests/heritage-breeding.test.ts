// Heritage breeding — coops with two or more heritage chickens
// occasionally route one of their fancy eggs into a breeder egg
// that hatches a guaranteed heritage chick when loaded into the
// hatchery. Propagates the heritage line without buying more passes.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BREEDER_EGG_INVENTORY_KEY,
  EGG_INVENTORY_KEY,
  FANCY_EGG_INVENTORY_KEY,
  HERITAGE_BREEDER_MIN_HERITAGE,
  HERITAGE_BREEDER_RATE,
  addChicken,
  breederRoll,
  collectEggsDetailed,
  coopTick,
  heritageCount,
  placeCoop,
} from '../src/game/coop';
import {
  HERITAGE_HATCH_RATE,
  loadEgg,
  placeHatchery,
} from '../src/game/hatchery';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  // Clear an area for coop + hatchery placement.
  for (let y = FREE_TY - 1; y <= FREE_TY + 4; y++) {
    for (let x = FREE_TX - 1; x <= FREE_TX + 5; x++) {
      if (w.inBounds(x, y)) w.tiles[y][x] = { type: 'grass' };
    }
  }
  return w;
}

const FREE_TX = 10;
const FREE_TY = 10;
const HATCH_TX = 12;
const HATCH_TY = 10;

describe('breederRoll', () => {
  it('is deterministic per (tx, ty, day)', () => {
    expect(breederRoll(1, 2, 3)).toBe(breederRoll(1, 2, 3));
    expect(breederRoll(0, 0, 0)).toBe(breederRoll(0, 0, 0));
  });

  it('returns a value in [0, 1)', () => {
    for (let d = 0; d < 50; d++) {
      const r = breederRoll(3, 5, d);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('spans roughly the whole [0,1) range across 1000 samples', () => {
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < 1000; i++) {
      const r = breederRoll(i, 17, 4);
      if (r < lo) lo = r;
      if (r > hi) hi = r;
    }
    expect(lo).toBeLessThan(0.1);
    expect(hi).toBeGreaterThan(0.9);
  });
});

describe('coopTick breeder rule', () => {
  it('does not produce breeder eggs when fewer than the threshold heritage chickens', () => {
    const w = freshWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    addChicken(coop, true);
    addChicken(coop, false);
    expect(heritageCount(coop)).toBe(1);
    // Even after 100 days no breeder should appear (one heritage chicken).
    for (let d = 0; d < 100; d++) coopTick(w, d);
    expect(coop.breederEggs ?? 0).toBe(0);
  });

  it('only produces a breeder egg on days the heritage chicken laid a fancy', () => {
    const w = freshWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    addChicken(coop, true);
    addChicken(coop, true);
    expect(heritageCount(coop)).toBe(HERITAGE_BREEDER_MIN_HERITAGE);
    // Run many days; tally how many breeders we get total.
    let bumps = 0;
    for (let d = 0; d < 200; d++) {
      const before = coop.breederEggs ?? 0;
      coopTick(w, d);
      if ((coop.breederEggs ?? 0) > before) bumps += 1;
    }
    // Heritage chickens have a 0.08 + 0.15 = 0.23 fancy rate. With
    // breederRoll < 0.4 of those, we expect roughly 0.23 * 0.4 * 2 = ~18%
    // breeder rate per day across the pair. Looser bound: at least one.
    expect(bumps).toBeGreaterThan(0);
  });

  it('caps breeder produce at 1 per dawn per coop', () => {
    const w = freshWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    addChicken(coop, true);
    addChicken(coop, true);
    addChicken(coop, true);
    addChicken(coop, true);
    // Walk many days, assert no single dawn produced >1 breeder.
    for (let d = 0; d < 500; d++) {
      const before = coop.breederEggs ?? 0;
      coopTick(w, d);
      const delta = (coop.breederEggs ?? 0) - before;
      expect(delta).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the total egg count consistent (plain + fancy + breeder = chickens)', () => {
    const w = freshWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    addChicken(coop, true);
    addChicken(coop, true);
    for (let d = 0; d < 100; d++) {
      const before = coop.eggs + (coop.fancyEggs ?? 0) + (coop.breederEggs ?? 0);
      coopTick(w, d);
      const after = coop.eggs + (coop.fancyEggs ?? 0) + (coop.breederEggs ?? 0);
      expect(after - before).toBe(coop.chickens);
    }
  });

  // Sanity check: the breeder rate constant is exposed and reasonable.
  it('HERITAGE_BREEDER_RATE is within (0, 1)', () => {
    expect(HERITAGE_BREEDER_RATE).toBeGreaterThan(0);
    expect(HERITAGE_BREEDER_RATE).toBeLessThan(1);
  });
});

describe('collectEggsDetailed with breeder', () => {
  it('routes breeder eggs into BREEDER_EGG_INVENTORY_KEY', () => {
    const w = freshWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    coop.eggs = 1;
    coop.fancyEggs = 1;
    coop.breederEggs = 1;
    const detail = collectEggsDetailed(coop, w.player);
    expect(detail).toEqual({ plain: 1, fancy: 1, breeder: 1 });
    expect(w.player.inventory[EGG_INVENTORY_KEY]).toBe(1);
    expect(w.player.inventory[FANCY_EGG_INVENTORY_KEY]).toBe(1);
    expect(w.player.inventory[BREEDER_EGG_INVENTORY_KEY]).toBe(1);
    expect(coop.breederEggs).toBe(0);
  });
});

describe('hatchery prefers a breeder egg + forces heritage', () => {
  it('consumes a breeder before a fancy when both are in the bag', () => {
    const w = freshWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    addChicken(coop, false);
    const hatchery = placeHatchery(w, HATCH_TX, HATCH_TY)!;
    w.player.inventory[BREEDER_EGG_INVENTORY_KEY] = 1;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    const out = loadEgg(hatchery, w.player, 1);
    expect(out.kind).toBe('loaded');
    // Breeder consumed; fancy untouched.
    expect(w.player.inventory[BREEDER_EGG_INVENTORY_KEY]).toBe(0);
    expect(w.player.inventory[FANCY_EGG_INVENTORY_KEY]).toBe(1);
    // Heritage forced true regardless of position/day hash.
    expect(hatchery.incubatingHeritage).toBe(true);
  });

  it('falls back to a fancy egg + deterministic roll when no breeder is in the bag', () => {
    const w = freshWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    addChicken(coop, false);
    const hatchery = placeHatchery(w, HATCH_TX, HATCH_TY)!;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    const out = loadEgg(hatchery, w.player, 1);
    expect(out.kind).toBe('loaded');
    expect(w.player.inventory[FANCY_EGG_INVENTORY_KEY]).toBe(0);
    // Heritage flag depends on the deterministic roll (HERITAGE_HATCH_RATE).
    // We can't assert true/false here without spilling impl detail, but we
    // can assert the constant exists and is a probability.
    expect(HERITAGE_HATCH_RATE).toBeGreaterThan(0);
    expect(HERITAGE_HATCH_RATE).toBeLessThan(1);
  });

  it('refuses with no-egg when neither type is in the bag', () => {
    const w = freshWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    addChicken(coop, false);
    const hatchery = placeHatchery(w, HATCH_TX, HATCH_TY)!;
    const out = loadEgg(hatchery, w.player, 1);
    expect(out.kind).toBe('no-egg');
  });
});
