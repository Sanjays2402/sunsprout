// Persistence — serialize / apply / save / load round-trips.
//
// We construct a "Game-shaped" object by hand rather than `new Game(canvas)`
// because the latter pulls in the renderer + DOM canvas. The persistence
// module only touches `game.world`, `game.world.player`, and `game.time` —
// any object exposing those is sufficient.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingQuests } from '../src/game/quests';
import { startingHearts } from '../src/game/hearts';
import {
  SAVE_KEY,
  SAVE_VERSION,
  serializeGame,
  applySnapshot,
  saveToStorage,
  loadFromStorage,
  clearSave,
  type StorageLike,
} from '../src/game/persistence';
import { plant, water, advanceDay } from '../src/game/farming';
import type { Game } from '../src/engine/game';

/** Returns a Game-shaped object: world + clock, enough for persistence to work. */
function fakeGame(): Game {
  const world = new World();
  const time = new TimeOfDay(6);
  // Apply the same player overlays Game's constructor does so the snapshot
  // looks like a "real" save: starting quests + hearts + inventory.
  const p = world.player;
  p.inventory = { wheat: 4, tomato: 1, flower: 1, 'watering-can': 1 };
  p.gold = 50;
  p.quests = startingQuests();
  p.hearts = startingHearts();
  return { world, time } as unknown as Game;
}

function makeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('persistence', () => {
  it('serializeGame captures player + world + clock at SAVE_VERSION', () => {
    const game = fakeGame();
    game.world.player.gold = 1234;
    game.world.player.inventory.wheat = 9;
    game.time.day = 5;
    const snap = serializeGame(game);
    expect(snap.version).toBe(SAVE_VERSION);
    expect(snap.player.gold).toBe(1234);
    expect(snap.player.inventory.wheat).toBe(9);
    expect(snap.time.day).toBe(5);
    expect(snap.world.tiles.length).toBe(game.world.height);
    expect(snap.world.tiles[0].length).toBe(game.world.width);
  });

  it('applySnapshot restores gold + inventory + clock onto a fresh game', () => {
    const a = fakeGame();
    a.world.player.gold = 777;
    a.world.player.inventory.tomato_harvest = 3;
    a.time.day = 6;
    a.time.season = 2;
    const snap = serializeGame(a);

    const b = fakeGame();
    expect(b.world.player.gold).toBe(50);
    expect(applySnapshot(b, snap)).toBe(true);
    expect(b.world.player.gold).toBe(777);
    expect(b.world.player.inventory.tomato_harvest).toBe(3);
    expect(b.time.day).toBe(6);
    expect(b.time.season).toBe(2);
  });

  it('round-trip preserves planted crops and their growth', () => {
    const a = fakeGame();
    a.world.player.inventory.wheat = 5;
    // The starter tilled patch is at (19,22).
    expect(plant(a.world, 19, 22, 'wheat', a.world.player)).toBe(true);
    water(a.world, 19, 22);
    advanceDay(a.world);
    const beforeStage = (a.world.crops[0] as unknown as { stage: number }).stage;
    expect(beforeStage).toBeGreaterThanOrEqual(1);

    const snap = serializeGame(a);
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(b.world.crops.length).toBe(1);
    const cropB = b.world.crops[0] as unknown as { stage: number; x: number; y: number };
    expect(cropB.stage).toBe(beforeStage);
    expect(cropB.x).toBe(19);
    expect(cropB.y).toBe(22);
  });

  it('round-trip preserves engagement + marriage', () => {
    const a = fakeGame();
    a.world.player.engagement = { npcId: 'maple', day: 4 };
    const snap = serializeGame(a);
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(b.world.player.engagement?.npcId).toBe('maple');
    expect(b.world.player.engagement?.day).toBe(4);
  });

  it('saveToStorage + loadFromStorage round-trip via fake storage', () => {
    const game = fakeGame();
    game.world.player.gold = 4242;
    const storage = makeStorage();
    expect(saveToStorage(game, storage)).toBe(true);
    const loaded = loadFromStorage(storage);
    expect(loaded).not.toBeNull();
    expect(loaded?.player.gold).toBe(4242);
  });

  it('loadFromStorage returns null on miss / parse error / version mismatch', () => {
    const storage = makeStorage();
    expect(loadFromStorage(storage)).toBeNull();
    storage.setItem(SAVE_KEY, '{not json');
    expect(loadFromStorage(storage)).toBeNull();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 999 }));
    expect(loadFromStorage(storage)).toBeNull();
  });

  it('clearSave wipes the slot', () => {
    const storage = makeStorage();
    storage.setItem(SAVE_KEY, '{"version":1}');
    clearSave(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('applySnapshot refuses a snapshot for a different-sized world', () => {
    const game = fakeGame();
    const snap = serializeGame(game);
    snap.world.width = 999;
    expect(applySnapshot(game, snap)).toBe(false);
  });
});
