// Farm dog companion — adoption, petting streak, daily bonus, follow movement.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingHearts } from '../src/game/hearts';
import { startingQuests } from '../src/game/quests';
import {
  DOG_PRICE,
  DOG_TICKET_KEY,
  PET_DAILY_BONUS,
  PET_RADIUS,
  PET_STREAK_CAP,
  adoptDog,
  canPet,
  defaultDogState,
  dogTick,
  getDog,
  petDog,
  updateDog,
} from '../src/game/farm-dog';
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
  const time = new TimeOfDay(8);
  return { world, time } as unknown as Game;
}

describe('farm dog', () => {
  it('defaultDogState is not-owned', () => {
    const s = defaultDogState();
    expect(s.owned).toBe(false);
    expect(s.petLastDay).toBe(-1);
    expect(s.petStreak).toBe(0);
  });

  it('adoptDog requires a dog-ticket in the inventory', () => {
    const w = fakeWorld();
    expect(adoptDog(w, w.player)).toBe(false);
    w.player.inventory[DOG_TICKET_KEY] = 1;
    expect(adoptDog(w, w.player)).toBe(true);
    expect(getDog(w).owned).toBe(true);
    expect(w.player.inventory[DOG_TICKET_KEY]).toBe(0);
  });

  it('adoptDog refuses a second adoption', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 2;
    expect(adoptDog(w, w.player)).toBe(true);
    expect(adoptDog(w, w.player)).toBe(false);
  });

  it('canPet is false until owned and within PET_RADIUS', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    expect(canPet(w, w.player)).toBe(false);
    adoptDog(w, w.player);
    expect(canPet(w, w.player)).toBe(true);
    const dog = getDog(w);
    dog.x = 0;
    dog.y = 0;
    w.player.x = 20;
    w.player.y = 20;
    expect(canPet(w, w.player)).toBe(false);
  });

  it('petDog grows the streak and awards a streak-scaled bonus', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    const time = new TimeOfDay(8);
    time.day = 1;
    const out = petDog(w, w.player, time);
    expect(out.kind).toBe('petted');
    if (out.kind === 'petted') {
      expect(out.streak).toBe(1);
      expect(out.bonus).toBe(PET_DAILY_BONUS);
    }
    time.day = 2;
    const out2 = petDog(w, w.player, time);
    if (out2.kind === 'petted') {
      expect(out2.streak).toBe(2);
      expect(out2.bonus).toBe(2 * PET_DAILY_BONUS);
    }
  });

  it('petDog refuses the same day twice', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    const time = new TimeOfDay(8);
    time.day = 1;
    petDog(w, w.player, time);
    const second = petDog(w, w.player, time);
    expect(second.kind).toBe('already-today');
  });

  it('skipping a day resets the streak', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    const time = new TimeOfDay(8);
    time.day = 1;
    petDog(w, w.player, time);
    time.day = 5;
    const out = petDog(w, w.player, time);
    if (out.kind === 'petted') {
      expect(out.streak).toBe(1);
    }
  });

  it('petDog caps the streak at PET_STREAK_CAP', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    const time = new TimeOfDay(8);
    for (let d = 1; d <= PET_STREAK_CAP + 5; d++) {
      time.day = d;
      petDog(w, w.player, time);
    }
    expect(getDog(w).petStreak).toBe(PET_STREAK_CAP);
  });

  it('petDog refuses when out of range', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    getDog(w).x = 0;
    getDog(w).y = 0;
    w.player.x = 30;
    w.player.y = 25;
    const out = petDog(w, w.player, new TimeOfDay(8));
    expect(out.kind).toBe('too-far');
  });

  it('dogTick pays the streak bonus the morning after petting', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    const time = new TimeOfDay(8);
    time.day = 1;
    petDog(w, w.player, time);
    time.day = 2; // simulate the rollover
    const goldBefore = w.player.gold;
    const paid = dogTick(w, w.player, time);
    expect(paid).toBe(PET_DAILY_BONUS);
    expect(w.player.gold).toBe(goldBefore + PET_DAILY_BONUS);
  });

  it('dogTick pays nothing when no pet happened yesterday', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    const time = new TimeOfDay(8);
    time.day = 5;
    expect(dogTick(w, w.player, time)).toBe(0);
  });

  it('updateDog chases the player when too far', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    const dog = getDog(w);
    dog.x = w.player.x + 5;
    dog.y = w.player.y;
    const startX = dog.x;
    updateDog(w, w.player, 200); // 200ms
    expect(dog.x).toBeLessThan(startX);
  });

  it('updateDog stays still when already within follow radius', () => {
    const w = fakeWorld();
    w.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(w, w.player);
    const dog = getDog(w);
    dog.x = w.player.x;
    dog.y = w.player.y;
    updateDog(w, w.player, 200);
    expect(dog.x).toBe(w.player.x);
    expect(dog.y).toBe(w.player.y);
  });

  it('dog state survives a persistence round-trip', () => {
    const a = fakeGame();
    a.world.player.inventory[DOG_TICKET_KEY] = 1;
    adoptDog(a.world, a.world.player);
    const time = a.time as TimeOfDay;
    time.day = 1;
    petDog(a.world, a.world.player, time);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getDog(b.world).owned).toBe(false);
    applySnapshot(b, snap);
    const restored = getDog(b.world);
    expect(restored.owned).toBe(true);
    expect(restored.petLastDay).toBe(1);
    expect(restored.petStreak).toBeGreaterThan(0);
  });

  it('DOG_PRICE and constants are sane', () => {
    expect(DOG_PRICE).toBeGreaterThan(0);
    expect(PET_RADIUS).toBeGreaterThan(0);
    expect(PET_STREAK_CAP).toBeGreaterThan(1);
  });
});
