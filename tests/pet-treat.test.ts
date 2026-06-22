// Pet treat — gift a stamina tea to the dog or cat AFTER a regular
// pet to bump the streak +1 (clamped at the cap). Consumes the
// lowest-tier tea first so the player keeps the heavy-hitters for
// the stamina pool.

import { describe, it, expect } from 'vitest';
import { World, type Player } from '../src/world/world';
import {
  PET_DAILY_BONUS,
  PET_STREAK_CAP,
  PET_TREAT_KEYS,
  adoptDog,
  getDog,
  petDog,
  treatDog,
} from '../src/game/farm-dog';
import {
  PET_DAILY_BONUS as CAT_DAILY_BONUS,
  CAT_TREAT_KEYS,
  getCat,
  petCat,
  treatCat,
} from '../src/game/farm-cat';
import { DOG_TICKET_KEY } from '../src/game/farm-dog';
import { CAT_TICKET_KEY } from '../src/game/farm-cat';
import { TimeOfDay } from '../src/game/time';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

function timeAt(day: number): TimeOfDay {
  const t = new TimeOfDay();
  t.day = day;
  t.hour = 12;
  t.season = 0;
  return t;
}

function petAdoptedDog(w: World): void {
  w.player.inventory[DOG_TICKET_KEY] = 1;
  expect(adoptDog(w, w.player)).toBe(true);
}

describe('PET_TREAT_KEYS catalog', () => {
  it('lists exactly the stamina-tea dish keys in cheapest-first order', () => {
    // Mirror of stamina.ts STAMINA_RESTORE keys, ordered so the
    // cheapest tea is consumed first.
    expect(PET_TREAT_KEYS[0]).toBe('dish-herb-tea');
    expect(PET_TREAT_KEYS[PET_TREAT_KEYS.length - 1]).toBe('dish-sunflower-elixir');
  });

  it('cat catalog matches dog catalog order', () => {
    expect([...CAT_TREAT_KEYS]).toEqual([...PET_TREAT_KEYS]);
  });
});

describe('treatDog gating', () => {
  it('refuses with not-owned when the dog has never been adopted', () => {
    const w = freshWorld();
    w.player.inventory['dish-herb-tea'] = 1;
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('not-owned');
  });

  it('refuses with too-far when the player is not adjacent', () => {
    const w = freshWorld();
    petAdoptedDog(w);
    w.player.x = 0;
    w.player.y = 0;
    getDog(w).x = 50;
    getDog(w).y = 50;
    w.player.inventory['dish-herb-tea'] = 1;
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('too-far');
  });

  it('refuses with not-petted-yet when the dog has not been petted today', () => {
    const w = freshWorld();
    petAdoptedDog(w);
    w.player.x = getDog(w).x;
    w.player.y = getDog(w).y;
    w.player.inventory['dish-herb-tea'] = 1;
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('not-petted-yet');
    // Tea was NOT consumed.
    expect(w.player.inventory['dish-herb-tea']).toBe(1);
  });

  it('refuses with no-treat when the bag has zero teas', () => {
    const w = freshWorld();
    petAdoptedDog(w);
    w.player.x = getDog(w).x;
    w.player.y = getDog(w).y;
    petDog(w, w.player, timeAt(2));
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('no-treat');
  });
});

describe('treatDog success', () => {
  it('consumes one tea and bumps streak by +1', () => {
    const w = freshWorld();
    petAdoptedDog(w);
    w.player.x = getDog(w).x;
    w.player.y = getDog(w).y;
    petDog(w, w.player, timeAt(2));
    expect(getDog(w).petStreak).toBe(1);
    w.player.inventory['dish-herb-tea'] = 2;
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('treated');
    if (out.kind !== 'treated') return;
    expect(out.streak).toBe(2);
    expect(out.bonus).toBe(2 * PET_DAILY_BONUS);
    expect(out.treatKey).toBe('dish-herb-tea');
    expect(w.player.inventory['dish-herb-tea']).toBe(1);
    expect(getDog(w).petStreak).toBe(2);
  });

  it('prefers cheaper teas first (herb-tea over sunflower-elixir)', () => {
    const w = freshWorld();
    petAdoptedDog(w);
    w.player.x = getDog(w).x;
    w.player.y = getDog(w).y;
    petDog(w, w.player, timeAt(2));
    w.player.inventory['dish-sunflower-elixir'] = 1;
    w.player.inventory['dish-herb-tea'] = 1;
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('treated');
    if (out.kind !== 'treated') return;
    expect(out.treatKey).toBe('dish-herb-tea');
    expect(w.player.inventory['dish-sunflower-elixir']).toBe(1); // untouched
  });

  it('falls through to the next tier when the cheapest is missing', () => {
    const w = freshWorld();
    petAdoptedDog(w);
    w.player.x = getDog(w).x;
    w.player.y = getDog(w).y;
    petDog(w, w.player, timeAt(2));
    w.player.inventory['dish-sunflower-elixir'] = 1;
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('treated');
    if (out.kind !== 'treated') return;
    expect(out.treatKey).toBe('dish-sunflower-elixir');
  });

  it('refuses with at-cap when streak is already PET_STREAK_CAP', () => {
    const w = freshWorld();
    petAdoptedDog(w);
    w.player.x = getDog(w).x;
    w.player.y = getDog(w).y;
    const dog = getDog(w);
    dog.petStreak = PET_STREAK_CAP;
    dog.petLastDay = 2; // already petted today
    w.player.inventory['dish-herb-tea'] = 1;
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('at-cap');
    expect(w.player.inventory['dish-herb-tea']).toBe(1); // untouched
  });

  it('clamps at PET_STREAK_CAP - 1 → CAP via the treat', () => {
    const w = freshWorld();
    petAdoptedDog(w);
    w.player.x = getDog(w).x;
    w.player.y = getDog(w).y;
    const dog = getDog(w);
    dog.petStreak = PET_STREAK_CAP - 1;
    dog.petLastDay = 2;
    w.player.inventory['dish-herb-tea'] = 1;
    const out = treatDog(w, w.player, timeAt(2));
    expect(out.kind).toBe('treated');
    if (out.kind !== 'treated') return;
    expect(out.streak).toBe(PET_STREAK_CAP);
  });
});

describe('treatCat — mirror of treatDog', () => {
  it('consumes a cat treat and bumps the cat streak', () => {
    const w = freshWorld();
    w.player.inventory[CAT_TICKET_KEY] = 1;
    // Adopting the cat reads the farmhouse buildings list — for the
    // test we adopt via the cat's setter to avoid coupling to the
    // farmhouse layout. Just mark owned + set perch coords.
    const cat = getCat(w);
    cat.owned = true;
    cat.x = w.player.x;
    cat.y = w.player.y;
    petCat(w, w.player, timeAt(3));
    expect(getCat(w).petStreak).toBe(1);
    w.player.inventory['dish-herb-tea'] = 1;
    const out = treatCat(w, w.player, timeAt(3));
    expect(out.kind).toBe('treated');
    if (out.kind !== 'treated') return;
    expect(out.streak).toBe(2);
    expect(out.bonus).toBe(2 * CAT_DAILY_BONUS);
  });

  it('refuses cat treat with not-petted-yet when cat is fresh today', () => {
    const w = freshWorld();
    const cat = getCat(w);
    cat.owned = true;
    cat.x = w.player.x;
    cat.y = w.player.y;
    w.player.inventory['dish-herb-tea'] = 1;
    const out = treatCat(w, w.player, timeAt(3));
    expect(out.kind).toBe('not-petted-yet');
  });
});
