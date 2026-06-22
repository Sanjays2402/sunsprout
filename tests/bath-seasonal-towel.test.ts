// Bath house seasonal towel — a 5-soak-per-season streak gifts a
// seasonal towel cosmetic that the bath flavor toast names. Each
// season has its own towel key; one per season per save.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BATH_FEE,
  BATH_WINTER_SEASON,
  BATH_X,
  BATH_Y,
  SEASONAL_TOWEL_SOAKS,
  SEASONAL_TOWEL_INVENTORY_PREFIX,
  bathFlavorLine,
  getBath,
  seasonalTowelKey,
  seasonalTowelLabel,
  takeBath,
} from '../src/game/bath-house';
import type { TimeOfDay } from '../src/game/time';

function freshWorld(gold = 10_000): World {
  const w = new World();
  w.player.gold = gold;
  w.player.inventory = {};
  return w;
}

function fakeTime(season: 0 | 1 | 2 | 3, day = 1, hour = 12, minute = 0): TimeOfDay {
  return { season, day, hour, minute } as unknown as TimeOfDay;
}

describe('seasonal towel inventory keys', () => {
  it('uses a per-season suffix', () => {
    expect(seasonalTowelKey(0)).toBe(`${SEASONAL_TOWEL_INVENTORY_PREFIX}spring`);
    expect(seasonalTowelKey(1)).toBe(`${SEASONAL_TOWEL_INVENTORY_PREFIX}summer`);
    expect(seasonalTowelKey(2)).toBe(`${SEASONAL_TOWEL_INVENTORY_PREFIX}fall`);
    expect(seasonalTowelKey(3)).toBe(`${SEASONAL_TOWEL_INVENTORY_PREFIX}winter`);
  });

  it('has a capitalised pretty label', () => {
    expect(seasonalTowelLabel(0)).toBe('Spring Towel');
    expect(seasonalTowelLabel(2)).toBe('Fall Towel');
  });
});

describe('seasonal soak counter + towel gift', () => {
  it('bumps the counter on each soak with a time arg', () => {
    const w = freshWorld();
    const day = 1;
    // Use winter season so we get the discount price (BATH_FEE * 0.75 = 150g)
    // — irrelevant to the towel, but a useful sanity that the time arg flows.
    const time = fakeTime(BATH_WINTER_SEASON, day);
    let o = takeBath(w.player, BATH_X, BATH_Y, day, time);
    expect(o.kind).toBe('soaked');
    if (o.kind === 'soaked') expect(o.seasonalSoaks).toBe(1);
    // Walk forward in time so the bath buff expires between calls.
    let nextDay = day + 3;
    o = takeBath(w.player, BATH_X, BATH_Y, nextDay, fakeTime(BATH_WINTER_SEASON, nextDay));
    if (o.kind === 'soaked') expect(o.seasonalSoaks).toBe(2);
  });

  it('does NOT bump or gift when time is omitted (backwards compat)', () => {
    const w = freshWorld();
    const out = takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.seasonalSoaks).toBe(0);
      expect(out.towelEarned).toBe(false);
      expect(out.towelKey).toBe('');
    }
    // No towel inventory key minted.
    for (const season of [0, 1, 2, 3] as const) {
      expect(w.player.inventory[seasonalTowelKey(season)] ?? 0).toBe(0);
    }
  });

  it('gifts the seasonal towel on the SEASONAL_TOWEL_SOAKS-th soak', () => {
    const w = freshWorld(50_000);
    let day = 1;
    let lastOut;
    for (let i = 0; i < SEASONAL_TOWEL_SOAKS; i++) {
      lastOut = takeBath(w.player, BATH_X, BATH_Y, day, fakeTime(0, day));
      // Walk past expiry so each soak takes.
      day += 3;
    }
    expect(lastOut?.kind).toBe('soaked');
    if (lastOut?.kind === 'soaked') {
      expect(lastOut.seasonalSoaks).toBe(SEASONAL_TOWEL_SOAKS);
      expect(lastOut.towelEarned).toBe(true);
      expect(lastOut.towelKey).toBe(seasonalTowelKey(0));
      expect(lastOut.towelLabel).toBe('Spring Towel');
    }
    expect(w.player.inventory[seasonalTowelKey(0)]).toBe(1);
  });

  it('does NOT double-gift the same season', () => {
    const w = freshWorld(50_000);
    let day = 1;
    // Cross the milestone.
    for (let i = 0; i < SEASONAL_TOWEL_SOAKS + 3; i++) {
      takeBath(w.player, BATH_X, BATH_Y, day, fakeTime(0, day));
      day += 3;
    }
    expect(w.player.inventory[seasonalTowelKey(0)]).toBe(1);
    // Confirm the bath state has the per-season gifted flag set.
    expect(getBath(w.player).seasonalTowelsGifted?.spring).toBe(true);
  });

  it('gifts a SEPARATE towel for a DIFFERENT season', () => {
    const w = freshWorld(50_000);
    let day = 1;
    // Cross the spring milestone first.
    for (let i = 0; i < SEASONAL_TOWEL_SOAKS; i++) {
      takeBath(w.player, BATH_X, BATH_Y, day, fakeTime(0, day));
      day += 3;
    }
    // Now soak SEASONAL_TOWEL_SOAKS times in summer.
    let lastSummerOut;
    for (let i = 0; i < SEASONAL_TOWEL_SOAKS; i++) {
      lastSummerOut = takeBath(w.player, BATH_X, BATH_Y, day, fakeTime(1, day));
      day += 3;
    }
    if (lastSummerOut?.kind === 'soaked') {
      expect(lastSummerOut.towelEarned).toBe(true);
      expect(lastSummerOut.towelLabel).toBe('Summer Towel');
    }
    expect(w.player.inventory[seasonalTowelKey(0)]).toBe(1);
    expect(w.player.inventory[seasonalTowelKey(1)]).toBe(1);
  });

  it('does NOT gift before the milestone', () => {
    const w = freshWorld(50_000);
    let day = 1;
    for (let i = 0; i < SEASONAL_TOWEL_SOAKS - 1; i++) {
      const out = takeBath(w.player, BATH_X, BATH_Y, day, fakeTime(2, day));
      if (out.kind === 'soaked') expect(out.towelEarned).toBe(false);
      day += 3;
    }
    expect(w.player.inventory[seasonalTowelKey(2)] ?? 0).toBe(0);
  });
});

describe('bathFlavorLine surfaces the towel gift', () => {
  it('mentions the towel by name when earned', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 0,
      daysLeft: 3,
      bonus: 30,
      pricePaid: BATH_FEE,
      discounted: false,
      paidWithPass: false,
      passesLeft: 0,
      totalSoaks: SEASONAL_TOWEL_SOAKS,
      soapsEarned: 0,
      seasonalSoaks: SEASONAL_TOWEL_SOAKS,
      towelEarned: true,
      towelKey: seasonalTowelKey(2),
      towelLabel: 'Fall Towel',
    });
    expect(line).toContain('Fall Towel');
    expect(line).toContain(`${SEASONAL_TOWEL_SOAKS} soaks this season`);
  });

  it('omits the towel tail when not earned', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 500,
      daysLeft: 3,
      bonus: 30,
      pricePaid: BATH_FEE,
      discounted: false,
      paidWithPass: false,
      passesLeft: 0,
      totalSoaks: 1,
      soapsEarned: 0,
      seasonalSoaks: 1,
      towelEarned: false,
      towelKey: '',
      towelLabel: '',
    });
    expect(line).not.toContain('Towel');
    expect(line).not.toContain('this season');
  });
});
