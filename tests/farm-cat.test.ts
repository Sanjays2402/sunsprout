// Farm cat — purchase, adopt, pet streak, daily payout, persistence.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  CAT_PRICE,
  CAT_TICKET_KEY,
  PET_DAILY_BONUS,
  PET_RADIUS,
  PET_STREAK_CAP,
  adoptCat,
  canPetCat,
  catTick,
  defaultCatState,
  getCat,
  petCat,
} from '../src/game/farm-cat';
import { SHOP_ITEMS, buyItem } from '../src/game/economy';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('shop catalog', () => {
  it('lists the kitten ticket at CAT_PRICE', () => {
    const row = SHOP_ITEMS.find((s) => s.key === CAT_TICKET_KEY);
    expect(row).toBeDefined();
    expect(row?.buyPrice).toBe(CAT_PRICE);
    expect(row?.sellPrice).toBeNull();
  });
});

describe('adoptCat', () => {
  it('starts un-adopted with default state', () => {
    const w = new World();
    expect(getCat(w).owned).toBe(false);
    expect(defaultCatState().petLastDay).toBe(-1);
  });

  it('refuses to adopt without a ticket', () => {
    const w = new World();
    expect(adoptCat(w, w.player)).toBe(false);
    expect(getCat(w).owned).toBe(false);
  });

  it('consumes the ticket and perches on the farmhouse roof', () => {
    const w = new World();
    w.player.inventory[CAT_TICKET_KEY] = 1;
    expect(adoptCat(w, w.player)).toBe(true);
    const cat = getCat(w);
    expect(cat.owned).toBe(true);
    expect(w.player.inventory[CAT_TICKET_KEY]).toBe(0);
    const fh = w.buildings.find((b) => b.kind === 'farmhouse')!;
    expect(cat.x).toBe(fh.x + Math.floor(fh.w / 2));
    expect(cat.y).toBe(fh.y);
  });

  it('double-adopt is a no-op', () => {
    const w = new World();
    w.player.inventory[CAT_TICKET_KEY] = 2;
    expect(adoptCat(w, w.player)).toBe(true);
    expect(adoptCat(w, w.player)).toBe(false);
    // Second ticket not consumed.
    expect(w.player.inventory[CAT_TICKET_KEY]).toBe(1);
  });
});

describe('canPetCat + petCat', () => {
  function setup(): World {
    const w = new World();
    w.player.inventory[CAT_TICKET_KEY] = 1;
    adoptCat(w, w.player);
    return w;
  }

  it('not-owned returns not-owned', () => {
    const w = new World();
    const out = petCat(w, w.player, new TimeOfDay(6));
    expect(out.kind).toBe('not-owned');
  });

  it('too-far returns too-far', () => {
    const w = setup();
    // Move the player far away.
    w.player.x = 1;
    w.player.y = 1;
    expect(canPetCat(w, w.player)).toBe(false);
    const out = petCat(w, w.player, new TimeOfDay(6));
    expect(out.kind).toBe('too-far');
  });

  it('first pet returns petted with streak=1', () => {
    const w = setup();
    // Player starts at (19,13); cat sits on the farmhouse roof (15,18).
    // Move close enough.
    w.player.x = 16;
    w.player.y = 19;
    const t = new TimeOfDay(6);
    t.day = 1;
    const out = petCat(w, w.player, t);
    expect(out.kind).toBe('petted');
    if (out.kind === 'petted') {
      expect(out.streak).toBe(1);
      expect(out.bonus).toBe(1 * PET_DAILY_BONUS);
    }
  });

  it('same-day pet returns already-today', () => {
    const w = setup();
    w.player.x = 16;
    w.player.y = 19;
    const t = new TimeOfDay(6);
    t.day = 1;
    petCat(w, w.player, t);
    const out = petCat(w, w.player, t);
    expect(out.kind).toBe('already-today');
  });

  it('consecutive days bump the streak; multi-day gap resets', () => {
    const w = setup();
    w.player.x = 16;
    w.player.y = 19;
    let t = new TimeOfDay(6);
    t.day = 1;
    expect(petCat(w, w.player, t).kind).toBe('petted');
    t = new TimeOfDay(6);
    t.day = 2;
    let r = petCat(w, w.player, t);
    if (r.kind === 'petted') expect(r.streak).toBe(2);
    // Skip a day.
    t = new TimeOfDay(6);
    t.day = 4;
    r = petCat(w, w.player, t);
    if (r.kind === 'petted') expect(r.streak).toBe(1);
  });

  it('streak caps at PET_STREAK_CAP', () => {
    const w = setup();
    w.player.x = 16;
    w.player.y = 19;
    for (let d = 1; d <= PET_STREAK_CAP + 5; d++) {
      const t = new TimeOfDay(6);
      t.day = d;
      petCat(w, w.player, t);
    }
    expect(getCat(w).petStreak).toBe(PET_STREAK_CAP);
  });
});

describe('catTick', () => {
  it('no-op when not owned', () => {
    const w = new World();
    expect(catTick(w, w.player, new TimeOfDay(6))).toBe(0);
  });

  it('pays the streak bonus the day after a pet', () => {
    const w = new World();
    w.player.inventory[CAT_TICKET_KEY] = 1;
    adoptCat(w, w.player);
    w.player.x = 16;
    w.player.y = 19;
    let t = new TimeOfDay(6);
    t.day = 5;
    const pet = petCat(w, w.player, t);
    expect(pet.kind).toBe('petted');
    // Day rolls over.
    t = new TimeOfDay(6);
    t.day = 6;
    const before = w.player.gold;
    const paid = catTick(w, w.player, t);
    expect(paid).toBe(1 * PET_DAILY_BONUS);
    expect(w.player.gold).toBe(before + paid);
  });

  it('does not pay twice across multi-day gaps', () => {
    const w = new World();
    w.player.inventory[CAT_TICKET_KEY] = 1;
    adoptCat(w, w.player);
    w.player.x = 16;
    w.player.y = 19;
    let t = new TimeOfDay(6);
    t.day = 1;
    petCat(w, w.player, t);
    t = new TimeOfDay(6);
    t.day = 5; // multi-day gap
    expect(catTick(w, w.player, t)).toBe(0);
  });
});

describe('buyItem integration', () => {
  it('buying the ticket costs CAT_PRICE and grants one', () => {
    const w = new World();
    w.player.gold = CAT_PRICE + 10;
    expect(buyItem(w.player, CAT_TICKET_KEY, CAT_PRICE)).toBe(true);
    expect(w.player.gold).toBe(10);
    expect(w.player.inventory[CAT_TICKET_KEY]).toBe(1);
  });
});

describe('persistence — cat round-trip', () => {
  it('survives a snapshot round-trip', () => {
    const a = fakeGame();
    a.world.player.inventory[CAT_TICKET_KEY] = 1;
    adoptCat(a.world, a.world.player);
    a.world.player.x = 16;
    a.world.player.y = 19;
    const t = new TimeOfDay(6);
    t.day = 1;
    petCat(a.world, a.world.player, t);
    const snap = serializeGame(a);
    expect(snap.world.cat?.owned).toBe(true);
    expect(snap.world.cat?.petStreak).toBe(1);
    const b = fakeGame();
    applySnapshot(b, snap);
    const cat = getCat(b.world);
    expect(cat.owned).toBe(true);
    expect(cat.petStreak).toBe(1);
    expect(cat.petLastDay).toBe(1);
  });

  it('older saves without a cat entry default to un-owned', () => {
    const a = fakeGame();
    const snap = serializeGame(a);
    delete (snap.world as { cat?: unknown }).cat;
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(getCat(b.world).owned).toBe(false);
  });
});

// PET_RADIUS export sanity — it's used by the engine layer.
describe('PET_RADIUS', () => {
  it('is positive', () => {
    expect(PET_RADIUS).toBeGreaterThan(0);
  });
});
