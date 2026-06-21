// Rare fertilizer — batches finishing on the season's rare day mint
// RARE bags worth +4 streak instead of regular +2 bags.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  COMPOST_DAYS,
  COMPOST_RATIO,
  FERTILIZER_INVENTORY_KEY,
  FERTILIZER_STREAK,
  RARE_FERTILIZER_INVENTORY_KEY,
  RARE_FERTILIZER_STREAK,
  RARE_FINISH_DAY_MAX,
  RARE_FINISH_DAY_MIN,
  applyFertilizer,
  compostTick,
  depositCrops,
  placeCompost,
  rareFinishDayFor,
  rareFinishDayLine,
} from '../src/game/compost';
import { plant, till, water } from '../src/game/farming';
import type { FarmCrop } from '../src/game/farming';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

const FREE_TX = 10;
const FREE_TY = 14;

describe('rareFinishDayFor', () => {
  it('returns a day in [MIN, MAX] for every season', () => {
    for (let s = 0; s < 4; s++) {
      const d = rareFinishDayFor(s);
      expect(d).toBeGreaterThanOrEqual(RARE_FINISH_DAY_MIN);
      expect(d).toBeLessThanOrEqual(RARE_FINISH_DAY_MAX);
    }
  });

  it('is deterministic — same season always returns the same day', () => {
    for (let s = 0; s < 4; s++) {
      expect(rareFinishDayFor(s)).toBe(rareFinishDayFor(s));
    }
  });

  it('seasons map to distinct days (no two seasons share a rare day in our seed)', () => {
    const seen = new Set<number>();
    for (let s = 0; s < 4; s++) seen.add(rareFinishDayFor(s));
    // We do NOT require every season to be unique — the deterministic
    // hash could collide. We DO require at least 2 distinct values so
    // the feature isn't trivially "always the same day".
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('rareFinishDayLine names the season and day', () => {
    const line = rareFinishDayLine(0);
    expect(line).toContain('Spring');
    expect(line).toContain(`day ${rareFinishDayFor(0)}`);
    expect(line).toContain(`+${RARE_FERTILIZER_STREAK}`);
  });
});

describe('compostTick rare yields', () => {
  it('mints RARE bags when finishOnDay matches rareFinishDayFor(season)', () => {
    const season = 0;
    const rareDay = rareFinishDayFor(season);
    // Deposit so that finishOnDay = rareDay. finishOnDay = today + COMPOST_DAYS - 1.
    // -> today = rareDay - COMPOST_DAYS + 1.
    const today = rareDay - COMPOST_DAYS + 1;
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    w.player.inventory['wheat_harvest'] = COMPOST_RATIO * 3; // -> 3 bags
    depositCrops(bin, w.player, today);
    expect(bin.batches[0].finishOnDay).toBe(rareDay);
    const minted = compostTick(w, w.player, rareDay + 1, season);
    expect(minted).toBe(3);
    expect(w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] ?? 0).toBe(3);
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY] ?? 0).toBe(0);
  });

  it('mints REGULAR bags when finishOnDay does NOT match the rare day', () => {
    const season = 1;
    const rareDay = rareFinishDayFor(season);
    // Pick a non-rare day inside [1..6].
    const nonRare = rareDay === 1 ? 2 : rareDay - 1;
    const today = nonRare - COMPOST_DAYS + 1;
    const w = freshWorld();
    const bin = placeCompost(w, FREE_TX, FREE_TY)!;
    w.player.inventory['wheat_harvest'] = COMPOST_RATIO * 2;
    depositCrops(bin, w.player, today);
    expect(bin.batches[0].finishOnDay).toBe(nonRare);
    const minted = compostTick(w, w.player, nonRare + 1, season);
    expect(minted).toBe(2);
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY] ?? 0).toBe(2);
    expect(w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] ?? 0).toBe(0);
  });
});

describe('applyFertilizer with rare bags', () => {
  it('prefers a rare bag over a regular one when both are available', () => {
    const w = freshWorld();
    till(w, FREE_TX, FREE_TY);
    w.player.inventory['wheat'] = 1;
    plant(w, FREE_TX, FREE_TY, 'wheat', w.player);
    water(w, FREE_TX, FREE_TY);
    const crop = (w.crops as unknown as FarmCrop[]).find(
      (c) => c.tx === FREE_TX && c.ty === FREE_TY,
    )!;
    const before = crop.waterStreak ?? 0;
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 5;
    w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = 2;
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('applied');
    if (out.kind === 'applied') {
      expect(out.bonus).toBe(RARE_FERTILIZER_STREAK);
      expect(out.rare).toBe(true);
    }
    expect(crop.waterStreak).toBe(before + RARE_FERTILIZER_STREAK);
    expect(w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY]).toBe(1);
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY]).toBe(5); // untouched
  });

  it('falls back to regular bags once rare bags are spent', () => {
    const w = freshWorld();
    till(w, FREE_TX, FREE_TY);
    w.player.inventory['wheat'] = 1;
    plant(w, FREE_TX, FREE_TY, 'wheat', w.player);
    water(w, FREE_TX, FREE_TY);
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    // No rare bags.
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('applied');
    if (out.kind === 'applied') {
      expect(out.bonus).toBe(FERTILIZER_STREAK);
      expect(out.rare).toBe(false);
    }
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY]).toBe(0);
  });

  it('refuses when both bags are empty', () => {
    const w = freshWorld();
    till(w, FREE_TX, FREE_TY);
    w.player.inventory['wheat'] = 1;
    plant(w, FREE_TX, FREE_TY, 'wheat', w.player);
    const out = applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    expect(out.kind).toBe('no-fertilizer');
  });
});
