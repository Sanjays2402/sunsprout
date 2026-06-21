// Animal coop + chickens — placement, daily eggs, collection, persistence.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingHearts } from '../src/game/hearts';
import { startingQuests } from '../src/game/quests';
import {
  COOP_W,
  COOP_H,
  MAX_CHICKENS_PER_COOP,
  EGG_INVENTORY_KEY,
  EGG_SELL_PRICE,
  canPlaceCoop,
  placeCoop,
  coopAt,
  isAdjacentToCoop,
  adjacentCoop,
  addChicken,
  coopTick,
  collectEggs,
  totalEggsWaiting,
  sellAllEggs,
  getCoops,
} from '../src/game/coop';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 4 };
  w.player.gold = 500;
  w.player.quests = startingQuests();
  w.player.hearts = startingHearts();
  return w;
}

function fakeGame(): Game {
  const world = fakeWorld();
  const time = new TimeOfDay(6);
  return { world, time } as unknown as Game;
}

/** A patch of grass we know is open. (10,10) is grass in the default map. */
const FREE_TX = 10;
const FREE_TY = 14;

describe('coop', () => {
  it('canPlaceCoop only accepts a clear grass footprint', () => {
    const w = fakeWorld();
    expect(canPlaceCoop(w, FREE_TX, FREE_TY)).toBe(true);
    // Plaza is path tiles, never grass.
    expect(canPlaceCoop(w, 14, 6)).toBe(false);
  });

  it('canPlaceCoop refuses out-of-bounds footprints', () => {
    const w = fakeWorld();
    expect(canPlaceCoop(w, 39, 29)).toBe(false);
    expect(canPlaceCoop(w, -1, 0)).toBe(false);
  });

  it('placeCoop pushes a fresh coop into the world list', () => {
    const w = fakeWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY);
    expect(coop).not.toBeNull();
    expect(getCoops(w).length).toBe(1);
    expect(getCoops(w)[0].tx).toBe(FREE_TX);
  });

  it('placeCoop refuses overlapping footprints', () => {
    const w = fakeWorld();
    expect(placeCoop(w, FREE_TX, FREE_TY)).not.toBeNull();
    expect(placeCoop(w, FREE_TX, FREE_TY)).toBeNull();
    expect(placeCoop(w, FREE_TX + 1, FREE_TY + 1)).toBeNull();
  });

  it('coopAt and adjacentCoop find the right coop', () => {
    const w = fakeWorld();
    placeCoop(w, FREE_TX, FREE_TY);
    expect(coopAt(w, FREE_TX, FREE_TY)).toBeDefined();
    expect(coopAt(w, FREE_TX + COOP_W, FREE_TY)).toBeUndefined();
    // One tile north of the coop is adjacent (not inside).
    expect(isAdjacentToCoop(w, FREE_TX, FREE_TY - 1)).toBe(true);
    expect(adjacentCoop(w, FREE_TX, FREE_TY - 1)).toBeDefined();
    // Inside the footprint does NOT count as adjacent.
    expect(isAdjacentToCoop(w, FREE_TX, FREE_TY)).toBe(false);
    // Far away.
    expect(isAdjacentToCoop(w, 0, 0)).toBe(false);
  });

  it('addChicken respects the MAX_CHICKENS_PER_COOP cap', () => {
    const coop = { tx: 0, ty: 0, chickens: 0, eggs: 0 };
    for (let i = 0; i < MAX_CHICKENS_PER_COOP; i++) {
      expect(addChicken(coop)).toBe(true);
    }
    expect(addChicken(coop)).toBe(false);
    expect(coop.chickens).toBe(MAX_CHICKENS_PER_COOP);
  });

  it('coopTick lays one egg per chicken per call', () => {
    const w = fakeWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    coop.chickens = 3;
    const produced = coopTick(w);
    expect(produced).toBe(3);
    expect(coop.eggs).toBe(3);
    coopTick(w);
    expect(coop.eggs).toBe(6);
  });

  it('coopTick produces nothing for empty coops', () => {
    const w = fakeWorld();
    placeCoop(w, FREE_TX, FREE_TY);
    expect(coopTick(w)).toBe(0);
  });

  it('collectEggs moves eggs from coop to player inventory', () => {
    const w = fakeWorld();
    const coop = placeCoop(w, FREE_TX, FREE_TY)!;
    coop.eggs = 5;
    const n = collectEggs(coop, w.player);
    expect(n).toBe(5);
    expect(coop.eggs).toBe(0);
    expect(w.player.inventory[EGG_INVENTORY_KEY]).toBe(5);
  });

  it('collectEggs returns 0 from an empty coop', () => {
    const coop = { tx: 0, ty: 0, chickens: 0, eggs: 0 };
    const player = { inventory: {} };
    expect(collectEggs(coop, player)).toBe(0);
  });

  it('totalEggsWaiting sums across every coop', () => {
    const w = fakeWorld();
    placeCoop(w, FREE_TX, FREE_TY)!.eggs = 2;
    placeCoop(w, FREE_TX + 5, FREE_TY)!.eggs = 3;
    expect(totalEggsWaiting(w)).toBe(5);
  });

  it('sellAllEggs converts inventory eggs into gold', () => {
    const w = fakeWorld();
    w.player.inventory[EGG_INVENTORY_KEY] = 4;
    const earned = sellAllEggs(w.player);
    expect(earned).toBe(4 * EGG_SELL_PRICE);
    expect(w.player.inventory[EGG_INVENTORY_KEY]).toBe(0);
  });

  it('coops + chickens + eggs survive a persistence round-trip', () => {
    const a = fakeGame();
    const coop = placeCoop(a.world, FREE_TX, FREE_TY)!;
    addChicken(coop);
    addChicken(coop);
    coop.eggs = 4;
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getCoops(b.world).length).toBe(0);
    applySnapshot(b, snap);
    const restored = getCoops(b.world);
    expect(restored.length).toBe(1);
    expect(restored[0].chickens).toBe(2);
    expect(restored[0].eggs).toBe(4);
    expect(restored[0].tx).toBe(FREE_TX);
  });
});
