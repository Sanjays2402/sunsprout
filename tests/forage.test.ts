// Forage spawns — daily regeneration, pickup, dusk-vanish, persistence.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingHearts } from '../src/game/hearts';
import { startingQuests } from '../src/game/quests';
import {
  FORAGE,
  FORAGE_KEYS,
  forageInventoryKey,
  getForage,
  regenerateForage,
  forageAt,
  clearForage,
  pickupForage,
  isDusk,
  sellAllForage,
} from '../src/game/forage';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 4 };
  w.player.gold = 50;
  w.player.quests = startingQuests();
  w.player.hearts = startingHearts();
  return w;
}

function fakeGame(): Game {
  const world = fakeWorld();
  const time = new TimeOfDay(6);
  return { world, time } as unknown as Game;
}

describe('forage', () => {
  it('every catalog entry has a sane definition', () => {
    for (const k of FORAGE_KEYS) {
      const def = FORAGE[k];
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.sellPrice).toBeGreaterThan(0);
      expect(def.weight).toBeGreaterThan(0);
    }
  });

  it('forageInventoryKey is stable and prefixed', () => {
    expect(forageInventoryKey('berry')).toBe('forage-berry');
    expect(forageInventoryKey('mushroom')).toBe('forage-mushroom');
    expect(forageInventoryKey('herb')).toBe('forage-herb');
  });

  it('regenerateForage is deterministic per (season, day)', () => {
    const a = fakeWorld();
    const b = fakeWorld();
    regenerateForage(a, 0, 3);
    regenerateForage(b, 0, 3);
    const la = getForage(a);
    const lb = getForage(b);
    expect(la.length).toBe(lb.length);
    expect(la.length).toBeGreaterThan(0);
    for (let i = 0; i < la.length; i++) {
      expect(la[i].tx).toBe(lb[i].tx);
      expect(la[i].ty).toBe(lb[i].ty);
      expect(la[i].kind).toBe(lb[i].kind);
    }
  });

  it('regenerateForage spawns only on grass tiles', () => {
    const w = fakeWorld();
    regenerateForage(w, 1, 2);
    for (const f of getForage(w)) {
      const tile = w.tiles[f.ty][f.tx];
      expect(tile.type).toBe('grass');
    }
  });

  it('regenerateForage clears yesterday before spawning today', () => {
    const w = fakeWorld();
    regenerateForage(w, 0, 1);
    const day1 = [...getForage(w)];
    regenerateForage(w, 0, 2);
    const day2 = getForage(w);
    // Different days → different layout (with high probability).
    const same = day1.every((f, i) => day2[i] && day2[i].tx === f.tx && day2[i].ty === f.ty && day2[i].kind === f.kind);
    expect(same).toBe(false);
  });

  it('pickupForage removes from world and adds to inventory', () => {
    const w = fakeWorld();
    regenerateForage(w, 2, 4);
    const first = getForage(w)[0];
    const result = pickupForage(w, w.player, first.tx, first.ty);
    expect(result).toBe(first.kind);
    expect(forageAt(w, first.tx, first.ty)).toBeUndefined();
    expect(w.player.inventory[forageInventoryKey(first.kind)]).toBe(1);
  });

  it('pickupForage returns null when nothing is there', () => {
    const w = fakeWorld();
    const result = pickupForage(w, w.player, 0, 0);
    expect(result).toBeNull();
  });

  it('clearForage empties the list', () => {
    const w = fakeWorld();
    regenerateForage(w, 0, 1);
    expect(getForage(w).length).toBeGreaterThan(0);
    const cleared = clearForage(w);
    expect(cleared).toBeGreaterThan(0);
    expect(getForage(w).length).toBe(0);
  });

  it('isDusk flips at 19:00', () => {
    expect(isDusk(18)).toBe(false);
    expect(isDusk(19)).toBe(true);
    expect(isDusk(22)).toBe(true);
  });

  it('sellAllForage zeroes inventory and adds gold', () => {
    const w = fakeWorld();
    w.player.inventory['forage-berry'] = 3;
    w.player.inventory['forage-mushroom'] = 2;
    const earned = sellAllForage(w.player);
    expect(earned).toBe(3 * FORAGE.berry.sellPrice + 2 * FORAGE.mushroom.sellPrice);
    expect(w.player.inventory['forage-berry']).toBe(0);
    expect(w.player.inventory['forage-mushroom']).toBe(0);
  });

  it('sellAllForage returns 0 when nothing to sell', () => {
    const w = fakeWorld();
    expect(sellAllForage(w.player)).toBe(0);
  });

  it('forage survives a persistence round-trip', () => {
    const a = fakeGame();
    regenerateForage(a.world, 0, 5);
    const before = getForage(a.world).length;
    expect(before).toBeGreaterThan(0);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getForage(b.world).length).toBe(0);
    applySnapshot(b, snap);
    const after = getForage(b.world);
    expect(after.length).toBe(before);
    expect(after[0].kind).toBe(getForage(a.world)[0].kind);
  });

  it('regenerate does not pile up over many days', () => {
    const w = fakeWorld();
    for (let d = 1; d <= 7; d++) {
      regenerateForage(w, 1, d);
    }
    // Final list is just one day's worth.
    expect(getForage(w).length).toBeLessThanOrEqual(12);
  });
});
