// Sprinklers — placement + watering ticks + persistence round-trip.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingHearts } from '../src/game/hearts';
import { startingQuests } from '../src/game/quests';
import { plant, water, advanceDay, cropAt } from '../src/game/farming';
import {
  SPRINKLERS,
  SPRINKLER_KEYS,
  placeSprinkler,
  removeSprinkler,
  sprinklerAt,
  sprinklerTick,
  sprinklerInventoryKey,
  getSprinklers,
} from '../src/game/sprinklers';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 8, tomato: 4, 'watering-can': 1 };
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

describe('sprinklers', () => {
  it('every catalog entry has a sane definition', () => {
    for (const k of SPRINKLER_KEYS) {
      const def = SPRINKLERS[k];
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.buyPrice).toBeGreaterThan(0);
      expect(def.radius).toBeGreaterThanOrEqual(1);
    }
  });

  it('sprinklerInventoryKey is stable and prefixed', () => {
    expect(sprinklerInventoryKey('basic')).toBe('sprinkler-basic');
  });

  it('placeSprinkler requires a tilled tile', () => {
    const w = fakeWorld();
    // (0,0) is grass.
    expect(placeSprinkler(w, 0, 0, 'basic')).toBe(false);
    // (19,22) is tilled.
    expect(placeSprinkler(w, 19, 22, 'basic')).toBe(true);
  });

  it('placeSprinkler refuses on top of a crop', () => {
    const w = fakeWorld();
    expect(plant(w, 19, 22, 'wheat', w.player)).toBe(true);
    expect(placeSprinkler(w, 19, 22, 'basic')).toBe(false);
  });

  it('placeSprinkler refuses to double-stack on the same tile', () => {
    const w = fakeWorld();
    expect(placeSprinkler(w, 19, 22, 'basic')).toBe(true);
    expect(placeSprinkler(w, 19, 22, 'basic')).toBe(false);
  });

  it('sprinklerAt + removeSprinkler are symmetric', () => {
    const w = fakeWorld();
    placeSprinkler(w, 20, 22, 'basic');
    expect(sprinklerAt(w, 20, 22)).toBeDefined();
    expect(removeSprinkler(w, 20, 22)).toBe(true);
    expect(sprinklerAt(w, 20, 22)).toBeUndefined();
    expect(removeSprinkler(w, 20, 22)).toBe(false);
  });

  it('sprinklerTick waters orthogonal neighbours', () => {
    const w = fakeWorld();
    // Tilled patch is 8x6 at (19,22). Plant crops around a sprinkler at (20,23).
    expect(plant(w, 19, 23, 'wheat', w.player)).toBe(true); // left
    expect(plant(w, 21, 23, 'wheat', w.player)).toBe(true); // right
    expect(plant(w, 20, 22, 'wheat', w.player)).toBe(true); // up
    expect(plant(w, 20, 24, 'wheat', w.player)).toBe(true); // down
    // Sprinkler in the centre — must NOT crush a crop, so pick a different tile.
    expect(placeSprinkler(w, 20, 23, 'basic')).toBe(true);
    const watered = sprinklerTick(w);
    expect(watered).toBe(4);
    for (const [x, y] of [[19,23],[21,23],[20,22],[20,24]] as const) {
      const c = cropAt(w, x, y) as unknown as { watered: boolean };
      expect(c.watered).toBe(true);
    }
  });

  it('sprinklerTick ignores diagonals (cross shape only)', () => {
    const w = fakeWorld();
    expect(placeSprinkler(w, 20, 23, 'basic')).toBe(true);
    expect(plant(w, 19, 22, 'wheat', w.player)).toBe(true); // diagonal NW
    sprinklerTick(w);
    const c = cropAt(w, 19, 22) as unknown as { watered: boolean };
    expect(c.watered).toBe(false);
  });

  it('sprinklerTick chains into advanceDay so watered crops grow', () => {
    const w = fakeWorld();
    expect(plant(w, 19, 23, 'wheat', w.player)).toBe(true);
    expect(placeSprinkler(w, 20, 23, 'basic')).toBe(true);
    const before = (cropAt(w, 19, 23) as unknown as { stage: number }).stage;
    sprinklerTick(w);
    advanceDay(w);
    const after = (cropAt(w, 19, 23) as unknown as { stage: number }).stage;
    expect(after).toBe(before + 1);
  });

  it('sprinklerTick returns 0 with no sprinklers placed', () => {
    const w = fakeWorld();
    expect(sprinklerTick(w)).toBe(0);
  });

  it('sprinklers survive a persistence round-trip', () => {
    const a = fakeGame();
    placeSprinkler(a.world, 19, 22, 'basic');
    placeSprinkler(a.world, 21, 22, 'basic');
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getSprinklers(b.world).length).toBe(0);
    applySnapshot(b, snap);
    const restored = getSprinklers(b.world);
    expect(restored.length).toBe(2);
    expect(restored.find((s) => s.tx === 19 && s.ty === 22)).toBeDefined();
    expect(restored.find((s) => s.tx === 21 && s.ty === 22)).toBeDefined();
  });

  it('a sprinkler does not skip already-watered crops (idempotent water flag)', () => {
    const w = fakeWorld();
    expect(plant(w, 19, 23, 'wheat', w.player)).toBe(true);
    water(w, 19, 23);
    expect(placeSprinkler(w, 20, 23, 'basic')).toBe(true);
    // The crop is already watered → sprinklerTick should report 0 new
    // waterings (we don't double-count).
    expect(sprinklerTick(w)).toBe(0);
  });
});
