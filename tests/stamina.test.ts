// Stamina — pool default, spend / restore / refill, drink-best from
// inventory, persistence round-trip.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  MAX_STAMINA,
  STAMINA_COST,
  STAMINA_RESTORE,
  defaultStaminaState,
  drinkBest,
  getStamina,
  hasStamina,
  refillStamina,
  restoreStamina,
  setStamina,
  spendStamina,
  staminaLabel,
} from '../src/game/stamina';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('default stamina state', () => {
  it('starts at MAX', () => {
    const s = defaultStaminaState();
    expect(s.current).toBe(MAX_STAMINA);
    expect(s.max).toBe(MAX_STAMINA);
  });

  it('lazy-inits on the player', () => {
    const w = new World();
    expect(getStamina(w.player).current).toBe(MAX_STAMINA);
  });
});

describe('spendStamina', () => {
  it('decrements the pool on success', () => {
    const w = new World();
    expect(spendStamina(w.player, STAMINA_COST.till)).toBe(true);
    expect(getStamina(w.player).current).toBe(MAX_STAMINA - STAMINA_COST.till);
  });

  it('returns false when the cost exceeds the pool', () => {
    const w = new World();
    setStamina(w.player, 3);
    expect(spendStamina(w.player, STAMINA_COST.mine)).toBe(false);
    expect(getStamina(w.player).current).toBe(3);
  });

  it('zero-cost always succeeds without changing the pool', () => {
    const w = new World();
    setStamina(w.player, 12);
    expect(spendStamina(w.player, 0)).toBe(true);
    expect(getStamina(w.player).current).toBe(12);
  });

  it('many spends drain the pool to zero predictably', () => {
    const w = new World();
    let spent = 0;
    while (spendStamina(w.player, STAMINA_COST.water)) {
      spent += STAMINA_COST.water;
      if (spent > 1000) break;
    }
    expect(getStamina(w.player).current).toBeLessThan(STAMINA_COST.water);
  });
});

describe('restoreStamina', () => {
  it('refills up to but not past max', () => {
    const w = new World();
    setStamina(w.player, 10);
    expect(restoreStamina(w.player, 30)).toBe(30);
    expect(getStamina(w.player).current).toBe(40);
    // Cap should kick in.
    expect(restoreStamina(w.player, MAX_STAMINA)).toBe(MAX_STAMINA - 40);
    expect(getStamina(w.player).current).toBe(MAX_STAMINA);
  });

  it('non-positive amounts are no-ops', () => {
    const w = new World();
    setStamina(w.player, 50);
    expect(restoreStamina(w.player, 0)).toBe(0);
    expect(restoreStamina(w.player, -5)).toBe(0);
    expect(getStamina(w.player).current).toBe(50);
  });
});

describe('refillStamina', () => {
  it('tops the pool back up at a new day', () => {
    const w = new World();
    setStamina(w.player, 20);
    getStamina(w.player).lastRefillDay = 1;
    const added = refillStamina(w.player, 2);
    expect(added).toBe(MAX_STAMINA - 20);
    expect(getStamina(w.player).current).toBe(MAX_STAMINA);
    expect(getStamina(w.player).lastRefillDay).toBe(2);
  });

  it('does not double-refill on the same day', () => {
    const w = new World();
    setStamina(w.player, 20);
    getStamina(w.player).lastRefillDay = 5;
    expect(refillStamina(w.player, 5)).toBe(0);
    expect(getStamina(w.player).current).toBe(20);
  });
});

describe('drinkBest', () => {
  it('returns no-drink when the bag is empty', () => {
    const w = new World();
    setStamina(w.player, 20);
    const out = drinkBest(w.player);
    expect(out.kind).toBe('no-drink');
  });

  it('returns already-full when the pool is at max', () => {
    const w = new World();
    w.player.inventory['dish-hot-cocoa'] = 1;
    const out = drinkBest(w.player);
    expect(out.kind).toBe('already-full');
    // Inventory untouched.
    expect(w.player.inventory['dish-hot-cocoa']).toBe(1);
  });

  it('consumes the biggest-restore drink available first', () => {
    const w = new World();
    setStamina(w.player, 20);
    w.player.inventory['dish-herb-tea'] = 1;
    w.player.inventory['dish-hot-cocoa'] = 1;
    const out = drinkBest(w.player);
    expect(out.kind).toBe('drank');
    if (out.kind === 'drank') {
      expect(out.key).toBe('dish-hot-cocoa');
      expect(out.restored).toBe(STAMINA_RESTORE['dish-hot-cocoa']);
    }
    expect(w.player.inventory['dish-hot-cocoa']).toBe(0);
    expect(w.player.inventory['dish-herb-tea']).toBe(1);
    expect(getStamina(w.player).current).toBe(20 + STAMINA_RESTORE['dish-hot-cocoa']);
  });

  it('falls through to a smaller drink when the big one is gone', () => {
    const w = new World();
    setStamina(w.player, 20);
    w.player.inventory['dish-herb-tea'] = 2;
    const out = drinkBest(w.player);
    expect(out.kind).toBe('drank');
    if (out.kind === 'drank') {
      expect(out.key).toBe('dish-herb-tea');
      expect(out.restored).toBe(STAMINA_RESTORE['dish-herb-tea']);
    }
    expect(w.player.inventory['dish-herb-tea']).toBe(1);
  });
});

describe('hasStamina', () => {
  it('zero-cost is always true', () => {
    const w = new World();
    setStamina(w.player, 0);
    expect(hasStamina(w.player, 0)).toBe(true);
  });

  it('reflects the pool', () => {
    const w = new World();
    setStamina(w.player, 4);
    expect(hasStamina(w.player, 3)).toBe(true);
    expect(hasStamina(w.player, 5)).toBe(false);
  });
});

describe('staminaLabel', () => {
  it('formats as current/max', () => {
    expect(staminaLabel({ current: 27, max: 100, lastRefillDay: 1 })).toBe('27/100');
  });
});

describe('persistence — stamina survives a snapshot round-trip', () => {
  it('default round-trips', () => {
    const a = fakeGame();
    getStamina(a.world.player); // lazy-init
    setStamina(a.world.player, 42);
    const snap = serializeGame(a);
    expect(snap.player.stamina?.current).toBe(42);
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(getStamina(b.world.player).current).toBe(42);
  });

  it('older saves without a stamina entry default to full', () => {
    const a = fakeGame();
    const snap = serializeGame(a);
    delete (snap.player as { stamina?: unknown }).stamina;
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(getStamina(b.world.player).current).toBe(MAX_STAMINA);
  });
});
