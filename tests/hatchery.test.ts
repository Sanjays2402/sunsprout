// Hatchery — placement gating, fancy-egg incubation, hatch outcomes.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  HATCHERY_INVENTORY_KEY,
  FANCY_EGG_INVENTORY_KEY,
  HATCH_DAYS,
  adjacentHatchery,
  canPlaceHatchery,
  claimPendingChicken,
  daysUntilHatch,
  getHatcheries,
  hatcheryAt,
  hatcheryStatusLine,
  hatcheryTick,
  isIncubating,
  loadEgg,
  placeHatchery,
} from '../src/game/hatchery';
import { addChicken, MAX_CHICKENS_PER_COOP, placeCoop } from '../src/game/coop';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

function fakeGame(): Game {
  return { world: freshWorld(), time: new TimeOfDay(6) } as unknown as Game;
}

/** Stable grass spot for a coop in the default map. */
const COOP_TX = 10;
const COOP_TY = 14;

describe('canPlaceHatchery', () => {
  it('refuses when no coop is adjacent', () => {
    const w = freshWorld();
    expect(canPlaceHatchery(w, 10, 14)).toBe(false);
  });

  it('accepts a clear grass tile next to a coop', () => {
    const w = freshWorld();
    placeCoop(w, COOP_TX, COOP_TY);
    // One tile north of the coop's top-left is adjacent grass.
    expect(canPlaceHatchery(w, COOP_TX, COOP_TY - 1)).toBe(true);
  });

  it('refuses overlapping placement', () => {
    const w = freshWorld();
    placeCoop(w, COOP_TX, COOP_TY);
    placeHatchery(w, COOP_TX, COOP_TY - 1);
    expect(canPlaceHatchery(w, COOP_TX, COOP_TY - 1)).toBe(false);
  });

  it('refuses out-of-bounds', () => {
    const w = freshWorld();
    expect(canPlaceHatchery(w, -1, 0)).toBe(false);
  });
});

describe('placeHatchery', () => {
  it('appends a new hatchery to the world list', () => {
    const w = freshWorld();
    placeCoop(w, COOP_TX, COOP_TY);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1);
    expect(h).not.toBeNull();
    expect(getHatcheries(w).length).toBe(1);
    expect(hatcheryAt(w, COOP_TX, COOP_TY - 1)).toBeDefined();
  });

  it('returns null when placement is invalid', () => {
    const w = freshWorld();
    expect(placeHatchery(w, 0, 0)).toBeNull();
  });
});

describe('adjacentHatchery', () => {
  it('finds a hatchery within Chebyshev radius 1', () => {
    const w = freshWorld();
    placeCoop(w, COOP_TX, COOP_TY);
    placeHatchery(w, COOP_TX, COOP_TY - 1);
    // Standing one tile north of the hatchery.
    expect(adjacentHatchery(w, COOP_TX, COOP_TY - 2)).toBeDefined();
    // Standing on the hatchery tile.
    expect(adjacentHatchery(w, COOP_TX, COOP_TY - 1)).toBeDefined();
    // Far away.
    expect(adjacentHatchery(w, 0, 0)).toBeUndefined();
  });
});

describe('loadEgg', () => {
  it('refuses when the bag has no fancy egg', () => {
    const w = freshWorld();
    placeCoop(w, COOP_TX, COOP_TY);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1)!;
    expect(loadEgg(h, w.player, 1).kind).toBe('no-egg');
  });

  it('spends one fancy egg and sets the hatch countdown', () => {
    const w = freshWorld();
    placeCoop(w, COOP_TX, COOP_TY);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1)!;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 2;
    const out = loadEgg(h, w.player, 1);
    expect(out.kind).toBe('loaded');
    expect(w.player.inventory[FANCY_EGG_INVENTORY_KEY]).toBe(1);
    expect(isIncubating(h, 1)).toBe(true);
    expect(daysUntilHatch(h, 1)).toBe(HATCH_DAYS);
  });

  it('refuses while another egg is already incubating', () => {
    const w = freshWorld();
    placeCoop(w, COOP_TX, COOP_TY);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1)!;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 2;
    loadEgg(h, w.player, 1);
    const out = loadEgg(h, w.player, 2);
    expect(out.kind).toBe('busy');
    expect(w.player.inventory[FANCY_EGG_INVENTORY_KEY]).toBe(1);
  });

  it('refuses while a pending chick blocks the basket', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    for (let i = 0; i < MAX_CHICKENS_PER_COOP; i++) addChicken(coop);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1)!;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    loadEgg(h, w.player, 1);
    hatcheryTick(w, 1 + HATCH_DAYS);
    expect(h.pendingChicken).toBe(true);
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    const out = loadEgg(h, w.player, 1 + HATCH_DAYS);
    expect(out.kind).toBe('pending');
  });
});

describe('hatcheryTick', () => {
  it('does nothing while the egg is still incubating', () => {
    const w = freshWorld();
    placeCoop(w, COOP_TX, COOP_TY);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1)!;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    loadEgg(h, w.player, 1);
    for (let d = 2; d < 1 + HATCH_DAYS; d++) {
      const [out] = hatcheryTick(w, d);
      expect(out.kind).toBe('none');
    }
  });

  it('hatches a chicken into the nearest coop with room', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    expect(coop.chickens).toBe(0);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1)!;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    loadEgg(h, w.player, 1);
    // Day after the countdown lapses fires the hatch.
    const [out] = hatcheryTick(w, 1 + HATCH_DAYS);
    expect(out.kind).toBe('hatched-into-coop');
    expect(coop.chickens).toBe(1);
    expect(h.hatchOnDay).toBe(-1);
  });

  it('flags pendingChicken when every coop is full', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    for (let i = 0; i < MAX_CHICKENS_PER_COOP; i++) addChicken(coop);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1)!;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    loadEgg(h, w.player, 1);
    const [out] = hatcheryTick(w, 1 + HATCH_DAYS);
    expect(out.kind).toBe('hatched-no-room');
    expect(h.pendingChicken).toBe(true);
    expect(coop.chickens).toBe(MAX_CHICKENS_PER_COOP);
  });

  it('claimPendingChicken moves the chick once a slot frees up', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    for (let i = 0; i < MAX_CHICKENS_PER_COOP; i++) addChicken(coop);
    const h = placeHatchery(w, COOP_TX, COOP_TY - 1)!;
    w.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    loadEgg(h, w.player, 1);
    hatcheryTick(w, 1 + HATCH_DAYS);
    expect(claimPendingChicken(w, h)).toBeNull();
    coop.chickens = MAX_CHICKENS_PER_COOP - 1;
    const moved = claimPendingChicken(w, h);
    expect(moved).toBe(coop);
    expect(coop.chickens).toBe(MAX_CHICKENS_PER_COOP);
    expect(h.pendingChicken).toBe(false);
  });
});

describe('hatcheryStatusLine', () => {
  it('reports the empty state by default', () => {
    expect(hatcheryStatusLine({ tx: 0, ty: 0, hatchOnDay: -1 }, 1)).toMatch(/empty/);
  });

  it('counts down while incubating', () => {
    expect(hatcheryStatusLine({ tx: 0, ty: 0, hatchOnDay: 5 }, 3)).toMatch(/3 days/);
  });

  it('flags the pending chick when a coop is full', () => {
    expect(
      hatcheryStatusLine({ tx: 0, ty: 0, hatchOnDay: -1, pendingChicken: true }, 1),
    ).toMatch(/waiting/);
  });
});

describe('persistence', () => {
  it('hatchery state round-trips through serialize + apply', () => {
    const a = fakeGame();
    placeCoop(a.world, COOP_TX, COOP_TY);
    const h = placeHatchery(a.world, COOP_TX, COOP_TY - 1)!;
    a.world.player.inventory[FANCY_EGG_INVENTORY_KEY] = 1;
    loadEgg(h, a.world.player, 1);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getHatcheries(b.world).length).toBe(0);
    applySnapshot(b, snap);
    const restored = getHatcheries(b.world);
    expect(restored.length).toBe(1);
    expect(restored[0].hatchOnDay).toBe(h.hatchOnDay);
  });
});

describe('bench wiring', () => {
  it('exports the bench inventory key the recipe writes to', () => {
    expect(HATCHERY_INVENTORY_KEY).toBe('craft-hatchery');
  });
});
