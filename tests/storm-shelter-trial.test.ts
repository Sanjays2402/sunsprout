// Storm shelter free trial — the first storm a save faces gets a
// free, deterministically-placed shelter on one outdoor crop tile so
// the player learns the system exists. Skipped on subsequent storms
// (storm.hit has entries) or when the player has already crafted a
// shelter.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  getShelters,
  isUnderShelter,
  placeShelter,
  seedTrialShelter,
} from '../src/game/storm-shelter';
import { getStorm, maybeFireStorm, pickStormDay } from '../src/game/storm';
import { plant, till, water, advanceDay } from '../src/game/farming';
import type { FarmCrop } from '../src/game/farming';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = { wheat: 8 };
  w.player.gold = 200;
  return w;
}

function plantAt(w: World, tx: number, ty: number): FarmCrop {
  till(w, tx, ty);
  plant(w, tx, ty, 'wheat', w.player);
  water(w, tx, ty);
  // Push a few growth days so the crop is real.
  for (let i = 0; i < 2; i++) {
    advanceDay(w);
    water(w, tx, ty);
  }
  return (w.crops as unknown as FarmCrop[]).find((c) => c.tx === tx && c.ty === ty)!;
}

const CROP_TX = 10;
const CROP_TY = 14;

describe('seedTrialShelter — gating', () => {
  it('returns null when the field has no crops', () => {
    const w = freshWorld();
    expect(seedTrialShelter(w, w.player)).toBeNull();
    expect(getShelters(w).length).toBe(0);
  });

  it('returns null when the player already owns a shelter', () => {
    const w = freshWorld();
    plantAt(w, CROP_TX, CROP_TY);
    placeShelter(w, CROP_TX + 4, CROP_TY); // player-crafted
    expect(getShelters(w).length).toBe(1);
    expect(seedTrialShelter(w, w.player)).toBeNull();
    // Only the player's shelter — no freebie added.
    expect(getShelters(w).length).toBe(1);
  });

  it('returns null when the player has already lived through a storm', () => {
    const w = freshWorld();
    plantAt(w, CROP_TX, CROP_TY);
    // Simulate the storm record landing — hit map is non-empty.
    getStorm(w.player).hit['y0:s0'] = 4;
    expect(seedTrialShelter(w, w.player)).toBeNull();
    expect(getShelters(w).length).toBe(0);
  });

  it('returns null when the only outdoor crop tile is somehow unplaceable', () => {
    const w = freshWorld();
    plantAt(w, CROP_TX, CROP_TY);
    // Sandbox: drop a second shelter onto the only crop tile so the
    // trial can't claim it — this also blocks the trial since the
    // shelters-already-placed gate trips first.
    placeShelter(w, CROP_TX, CROP_TY);
    expect(seedTrialShelter(w, w.player)).toBeNull();
  });
});

describe('seedTrialShelter — happy path', () => {
  it('drops a shelter on the lowest-(ty,tx) outdoor crop tile', () => {
    const w = freshWorld();
    plantAt(w, CROP_TX, CROP_TY);
    plantAt(w, CROP_TX + 2, CROP_TY); // same row, higher tx
    plantAt(w, CROP_TX, CROP_TY + 1); // lower row
    const out = seedTrialShelter(w, w.player);
    expect(out).not.toBeNull();
    if (!out) return;
    // Lowest ty first, then lowest tx -> (CROP_TX, CROP_TY) wins.
    expect(out).toEqual({ tx: CROP_TX, ty: CROP_TY });
    expect(getShelters(w).length).toBe(1);
    // The shelter covers Chebyshev radius 1 — so the crop tile is
    // under shelter by virtue of being AT the shelter tile.
    expect(isUnderShelter(w, CROP_TX, CROP_TY)).toBe(true);
  });

  it('is deterministic — placing twice in a row (no storm in between) is idempotent until the gate trips', () => {
    const w = freshWorld();
    plantAt(w, CROP_TX, CROP_TY);
    const first = seedTrialShelter(w, w.player);
    expect(first).not.toBeNull();
    // Calling again — the gate "already owns a shelter" trips.
    const second = seedTrialShelter(w, w.player);
    expect(second).toBeNull();
    expect(getShelters(w).length).toBe(1);
  });
});

describe('seedTrialShelter — integration with maybeFireStorm', () => {
  it('the trial shelter actually shields the crop on impact', () => {
    const w = freshWorld();
    const crop = plantAt(w, CROP_TX, CROP_TY);
    crop.waterStreak = 5;
    const out = seedTrialShelter(w, w.player);
    expect(out).not.toBeNull();
    // Fire the storm on its scheduled day.
    const storm = pickStormDay(0, {});
    const result = maybeFireStorm(w, w.player, 0, storm);
    expect(result.kind).toBe('fired');
    if (result.kind !== 'fired') return;
    expect(result.cropsSheltered).toBe(1);
    expect(result.cropsHit).toBe(0);
    expect(result.consumedShelters).toBe(1);
    // Crop kept its streak.
    expect(crop.waterStreak).toBe(5);
    // Shelter consumed.
    expect(getShelters(w).length).toBe(0);
  });

  it('after the first storm the trial does not fire again next season', () => {
    const w = freshWorld();
    plantAt(w, CROP_TX, CROP_TY);
    seedTrialShelter(w, w.player);
    const storm = pickStormDay(0, {});
    maybeFireStorm(w, w.player, 0, storm); // consume the shelter
    expect(getShelters(w).length).toBe(0);
    // Try again on a future storm day in a different season — gate
    // trips on the hit map being non-empty.
    const second = seedTrialShelter(w, w.player);
    expect(second).toBeNull();
    expect(getShelters(w).length).toBe(0);
  });
});
