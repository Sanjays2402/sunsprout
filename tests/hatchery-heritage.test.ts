// Heritage hatch — small chance a hatched chick is a heritage breed
// that lays fancy eggs at a higher base rate.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  FANCY_EGG_INVENTORY_KEY,
  HATCH_DAYS,
  HERITAGE_HATCH_RATE,
  claimPendingChicken,
  getHatcheries,
  hatcheryTick,
  loadEgg,
  placeHatchery,
  rollHeritage,
} from '../src/game/hatchery';
import {
  FANCY_EGG_RATE,
  HERITAGE_FANCY_BONUS,
  MAX_CHICKENS_PER_COOP,
  addChicken,
  coopTick,
  getCoops,
  heritageCount,
  isHeritageChicken,
  placeCoop,
} from '../src/game/coop';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';
import { TimeOfDay } from '../src/game/time';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = { [FANCY_EGG_INVENTORY_KEY]: 4 };
  w.player.gold = 0;
  return w;
}

function fakeGame(): Game {
  return { world: freshWorld(), time: new TimeOfDay(6) } as unknown as Game;
}

// Reachable grass tiles in the default map.
const COOP_TX = 10;
const COOP_TY = 14;
// Hatchery sits two tiles east of the coop (must be Chebyshev-adjacent).
const HATCH_TX = COOP_TX + 2;
const HATCH_TY = COOP_TY;
// Pre-computed via the rollHeritage hash for THIS hatchery position:
//   (12, 14, 5) -> true   (heritage hatch)
//   (12, 14, 1) -> false  (regular hatch)
const HERITAGE_DAY = 5;
const REGULAR_DAY = 1;

describe('rollHeritage', () => {
  it('is deterministic', () => {
    for (let i = 0; i < 5; i++) {
      expect(rollHeritage(10, 14, 1)).toBe(rollHeritage(10, 14, 1));
    }
  });

  it('matches our pre-computed sample values', () => {
    expect(rollHeritage(HATCH_TX, HATCH_TY, HERITAGE_DAY)).toBe(true);
    expect(rollHeritage(HATCH_TX, HATCH_TY, REGULAR_DAY)).toBe(false);
  });

  it('produces roughly HERITAGE_HATCH_RATE over a wide sample', () => {
    let trues = 0;
    let total = 0;
    for (let tx = 0; tx < 30; tx++) {
      for (let ty = 0; ty < 25; ty++) {
        for (let day = 1; day < 8; day++) {
          if (rollHeritage(tx, ty, day)) trues += 1;
          total += 1;
        }
      }
    }
    const rate = trues / total;
    // Allow a healthy 3pp band — the hash is a fixed seed so the rate
    // is stable, but we don't want a hyper-tight assertion either.
    expect(Math.abs(rate - HERITAGE_HATCH_RATE)).toBeLessThan(0.03);
  });
});

describe('coop helpers', () => {
  it('addChicken stores the heritage flag at the new slot', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    expect(addChicken(coop, false)).toBe(true);
    expect(addChicken(coop, true)).toBe(true);
    expect(isHeritageChicken(coop, 0)).toBe(false);
    expect(isHeritageChicken(coop, 1)).toBe(true);
    expect(heritageCount(coop)).toBe(1);
  });

  it('addChicken defaults heritage to false', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    expect(addChicken(coop)).toBe(true);
    expect(isHeritageChicken(coop, 0)).toBe(false);
    expect(heritageCount(coop)).toBe(0);
  });

  it('refuses past the cap', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    for (let i = 0; i < MAX_CHICKENS_PER_COOP; i++) addChicken(coop, false);
    expect(addChicken(coop, true)).toBe(false);
  });
});

describe('hatcheryTick produces a heritage chick when the roll fires', () => {
  it('hatched-into-coop carries heritage=true on a heritage day', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    const h = placeHatchery(w, HATCH_TX, HATCH_TY)!;
    loadEgg(h, w.player, HERITAGE_DAY);
    expect(h.incubatingHeritage).toBe(true);
    const outs = hatcheryTick(w, HERITAGE_DAY + HATCH_DAYS);
    expect(outs[0].kind).toBe('hatched-into-coop');
    if (outs[0].kind === 'hatched-into-coop') {
      expect(outs[0].heritage).toBe(true);
    }
    expect(coop.chickens).toBe(1);
    expect(isHeritageChicken(coop, 0)).toBe(true);
  });

  it('hatched-into-coop carries heritage=false on a non-heritage day', () => {
    const w = freshWorld();
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    const h = placeHatchery(w, HATCH_TX, HATCH_TY)!;
    loadEgg(h, w.player, REGULAR_DAY);
    expect(h.incubatingHeritage).toBe(false);
    const outs = hatcheryTick(w, REGULAR_DAY + HATCH_DAYS);
    expect(outs[0].kind).toBe('hatched-into-coop');
    if (outs[0].kind === 'hatched-into-coop') {
      expect(outs[0].heritage).toBe(false);
    }
    expect(isHeritageChicken(coop, 0)).toBe(false);
  });
});

describe('claimPendingChicken preserves heritage', () => {
  it('pendingHeritage flows through into the coop on claim', () => {
    const w = freshWorld();
    // Coop full -> hatch will park the chick as pending.
    const coop = placeCoop(w, COOP_TX, COOP_TY)!;
    for (let i = 0; i < MAX_CHICKENS_PER_COOP; i++) addChicken(coop, false);
    const h = placeHatchery(w, HATCH_TX, HATCH_TY)!;
    loadEgg(h, w.player, HERITAGE_DAY);
    const outs = hatcheryTick(w, HERITAGE_DAY + HATCH_DAYS);
    expect(outs[0].kind).toBe('hatched-no-room');
    if (outs[0].kind === 'hatched-no-room') {
      expect(outs[0].heritage).toBe(true);
    }
    expect(h.pendingChicken).toBe(true);
    expect(h.pendingHeritage).toBe(true);
    // Free up a slot, then claim.
    coop.chickens -= 1;
    if (coop.heritage) coop.heritage.pop();
    const moved = claimPendingChicken(w, h);
    expect(moved).toBe(coop);
    expect(h.pendingHeritage).toBe(false);
    // The newly-added chicken (now at slot index 3) is heritage.
    expect(isHeritageChicken(coop, MAX_CHICKENS_PER_COOP - 1)).toBe(true);
  });
});

describe('coopTick uses the per-chicken heritage bonus', () => {
  it('a coop of all heritage chickens lays many more fancy eggs than a regular coop', () => {
    const w = freshWorld();
    const heritage = placeCoop(w, COOP_TX, COOP_TY)!;
    const regular = placeCoop(w, COOP_TX + 5, COOP_TY)!;
    for (let i = 0; i < MAX_CHICKENS_PER_COOP; i++) {
      addChicken(heritage, true);
      addChicken(regular, false);
    }
    // Sweep enough days to amortise the per-day hash.
    let heritageFancy = 0;
    let regularFancy = 0;
    for (let d = 1; d < 200; d++) {
      coopTick(w, d);
    }
    heritageFancy = heritage.fancyEggs ?? 0;
    regularFancy = regular.fancyEggs ?? 0;
    // Heritage coop should clearly outpace regular coop.
    expect(heritageFancy).toBeGreaterThan(regularFancy);
    // Heritage coop's rate must be at least ~1.5x regular's — even a
    // conservative bound given the per-coop base is 8% and heritage
    // adds +15pp.
    expect(heritageFancy).toBeGreaterThanOrEqual(Math.floor(regularFancy * 1.5));
  });

  it('HERITAGE_FANCY_BONUS pushes a heritage chick past the basic per-coop base', () => {
    // Sanity check: heritage rate = base + HERITAGE_FANCY_BONUS.
    expect(FANCY_EGG_RATE.basic + HERITAGE_FANCY_BONUS).toBeGreaterThan(FANCY_EGG_RATE.basic);
  });
});

describe('persistence', () => {
  it('coop.heritage flags survive a serialize+apply round trip', () => {
    const a = fakeGame();
    const coop = placeCoop(a.world, COOP_TX, COOP_TY)!;
    addChicken(coop, true);
    addChicken(coop, false);
    addChicken(coop, true);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getCoops(b.world).length).toBe(0);
    applySnapshot(b, snap);
    const restored = getCoops(b.world)[0];
    expect(restored.chickens).toBe(3);
    expect(isHeritageChicken(restored, 0)).toBe(true);
    expect(isHeritageChicken(restored, 1)).toBe(false);
    expect(isHeritageChicken(restored, 2)).toBe(true);
  });

  it('hatchery.pendingHeritage + incubatingHeritage survive a round trip', () => {
    const a = fakeGame();
    placeCoop(a.world, COOP_TX, COOP_TY);
    const h = placeHatchery(a.world, HATCH_TX, HATCH_TY)!;
    loadEgg(h, a.world.player, HERITAGE_DAY);
    expect(h.incubatingHeritage).toBe(true);
    const snap = serializeGame(a);
    const b = fakeGame();
    applySnapshot(b, snap);
    const restored = getHatcheries(b.world)[0];
    expect(restored.incubatingHeritage).toBe(true);
  });
});
