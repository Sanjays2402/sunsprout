// Animal happiness — coop happiness bumps, fancy-rate boost, pet streak bonus.
import { describe, it, expect } from 'vitest';
import {
  COOP_HAPPINESS_COLLECT,
  COOP_HAPPINESS_DECAY,
  COOP_HAPPINESS_FEED,
  COOP_HAPPINESS_MAX,
  FANCY_HAPPINESS_BONUS,
  bumpCoopHappinessCollect,
  bumpCoopHappinessFeed,
  coopFancyRate,
  coopHappiness,
  coopMoodLabel,
  decayCoopHappiness,
  petTipBonus,
  streakBonus,
} from '../src/game/animal-happiness';
import type { PlacedCoop } from '../src/game/coop';
import { FANCY_EGG_RATE, coopTick, placeCoop } from '../src/game/coop';
import { World } from '../src/world/world';
import { defaultDogState } from '../src/game/farm-dog';
import { defaultCatState } from '../src/game/farm-cat';

function makeCoop(): PlacedCoop {
  return { tx: 0, ty: 0, chickens: 0, eggs: 0 };
}

describe('coop happiness — read + bump', () => {
  it('coopHappiness defaults to 0 for an old save with no field', () => {
    expect(coopHappiness(makeCoop())).toBe(0);
  });

  it('bumpCoopHappinessCollect adds the collect amount', () => {
    const c = makeCoop();
    const v = bumpCoopHappinessCollect(c, 1);
    expect(v).toBe(COOP_HAPPINESS_COLLECT);
    expect(c.happiness).toBe(COOP_HAPPINESS_COLLECT);
    expect(c.lastCareDay).toBe(1);
  });

  it('bumpCoopHappinessFeed adds the smaller feed amount', () => {
    const c = makeCoop();
    bumpCoopHappinessFeed(c, 1);
    expect(c.happiness).toBe(COOP_HAPPINESS_FEED);
  });

  it('a second care on the same day is a no-op', () => {
    const c = makeCoop();
    bumpCoopHappinessCollect(c, 5);
    const before = c.happiness;
    bumpCoopHappinessFeed(c, 5);
    expect(c.happiness).toBe(before);
  });

  it('care on a fresh day stacks again', () => {
    const c = makeCoop();
    bumpCoopHappinessCollect(c, 1);
    bumpCoopHappinessCollect(c, 2);
    expect(c.happiness).toBe(2 * COOP_HAPPINESS_COLLECT);
  });

  it('happiness caps at COOP_HAPPINESS_MAX', () => {
    const c = makeCoop();
    c.happiness = COOP_HAPPINESS_MAX - 1;
    bumpCoopHappinessCollect(c, 1);
    expect(c.happiness).toBe(COOP_HAPPINESS_MAX);
  });
});

describe('decayCoopHappiness', () => {
  it('drops every coop one point and floors at zero', () => {
    const list: PlacedCoop[] = [
      { tx: 0, ty: 0, chickens: 0, eggs: 0, happiness: 10 },
      { tx: 1, ty: 0, chickens: 0, eggs: 0, happiness: 0 },
      { tx: 2, ty: 0, chickens: 0, eggs: 0 },
    ];
    decayCoopHappiness(list);
    expect(list[0].happiness).toBe(10 - COOP_HAPPINESS_DECAY);
    expect(list[1].happiness).toBe(0);
    // Coops with no happiness field start at zero and decay is skipped.
    expect((list[2].happiness ?? 0)).toBe(0);
  });
});

describe('coopFancyRate', () => {
  it('returns the base rate at zero happiness', () => {
    expect(coopFancyRate(makeCoop(), 0.08)).toBe(0.08);
  });

  it('adds up to FANCY_HAPPINESS_BONUS at max happiness', () => {
    const c = makeCoop();
    c.happiness = COOP_HAPPINESS_MAX;
    expect(coopFancyRate(c, 0.08)).toBeCloseTo(0.08 + FANCY_HAPPINESS_BONUS, 6);
  });

  it('a happy coop produces more fancy eggs over many days', () => {
    const w = new World();
    // Make a free 2x2 patch of grass.
    for (let y = 9; y <= 12; y++) {
      for (let x = 9; x <= 14; x++) {
        if (w.inBounds(x, y)) w.tiles[y][x] = { type: 'grass' };
      }
    }
    const grumpy = placeCoop(w, 9, 9)!;
    grumpy.chickens = 4;
    const happy = placeCoop(w, 12, 9)!;
    happy.chickens = 4;
    happy.happiness = COOP_HAPPINESS_MAX;
    for (let d = 0; d < 300; d++) {
      coopTick(w, d);
    }
    expect(happy.fancyEggs ?? 0).toBeGreaterThan(grumpy.fancyEggs ?? 0);
    expect(FANCY_EGG_RATE.basic).toBeGreaterThan(0);
  });
});

describe('streakBonus + petTipBonus', () => {
  it('streakBonus tiers correctly', () => {
    expect(streakBonus(0)).toBe(0);
    expect(streakBonus(7)).toBe(0);
    expect(streakBonus(8)).toBe(1);
    expect(streakBonus(11)).toBe(1);
    expect(streakBonus(12)).toBe(2);
    expect(streakBonus(13)).toBe(2);
    expect(streakBonus(14)).toBe(3);
    expect(streakBonus(99)).toBe(3);
  });

  it('petTipBonus reads petStreak off dog/cat state', () => {
    const dog = defaultDogState();
    dog.petStreak = 12;
    const cat = defaultCatState();
    cat.petStreak = 14;
    expect(petTipBonus(dog)).toBe(2);
    expect(petTipBonus(cat)).toBe(3);
  });
});

describe('coopMoodLabel', () => {
  it('returns a label for every bracket', () => {
    expect(coopMoodLabel(0)).toBe('cold');
    expect(coopMoodLabel(5)).toBe('restless');
    expect(coopMoodLabel(30)).toBe('okay');
    expect(coopMoodLabel(60)).toBe('content');
    expect(coopMoodLabel(95)).toBe('thriving');
  });
});
