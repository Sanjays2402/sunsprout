// Gifting — slice 3 of v0.5.0. Verifies the auto-pick + inventory
// decrement bridge between Player.inventory and HeartsState.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { startingHearts, getHearts } from '../src/game/hearts';
import { attemptAutoGift, pickBestGift, giftReadiness } from '../src/game/gifting';

describe('gifting auto-pick', () => {
  it('prefers loved over liked over neutral, and skips disliked', () => {
    // Rose loves hearty-stew, likes flower_harvest, dislikes copper.
    const inv = { copper: 5, flower_harvest: 2, 'hearty-stew': 1, wheat: 9 };
    expect(pickBestGift(inv, 'rose')).toBe('hearty-stew');
    delete (inv as Record<string, number>)['hearty-stew'];
    expect(pickBestGift(inv, 'rose')).toBe('flower_harvest');
    delete (inv as Record<string, number>).flower_harvest;
    // wheat is neutral for Rose; copper is disliked and must be skipped.
    expect(pickBestGift(inv, 'rose')).toBe('wheat');
    expect(pickBestGift({ copper: 5 }, 'rose')).toBeNull();
  });

  it('never auto-picks the watering-can utility item', () => {
    expect(pickBestGift({ 'watering-can': 1 }, 'maple')).toBeNull();
  });

  it('returns no-items when player has nothing giftable', () => {
    const w = new World();
    const p = w.player!;
    p.hearts = startingHearts();
    p.inventory = { 'watering-can': 1 };
    const out = attemptAutoGift(p, 'maple', 1);
    expect(out.kind).toBe('no-items');
  });

  it('decrements inventory and bumps hearts on a successful gift', () => {
    const w = new World();
    const p = w.player!;
    p.hearts = startingHearts();
    p.inventory = { ruby: 1, wheat: 3 };
    const out = attemptAutoGift(p, 'maple', 5);
    expect(out.kind).toBe('gifted');
    if (out.kind === 'gifted') {
      expect(out.itemKey).toBe('ruby'); // loved by Maple
      expect(out.result.accepted).toBe(true);
      expect(out.result.taste).toBe('loved');
    }
    expect(p.inventory.ruby).toBe(0);
    expect(getHearts(p.hearts, 'maple')).toBeGreaterThanOrEqual(0);
    // Second attempt same day → gated.
    const out2 = attemptAutoGift(p, 'maple', 5);
    expect(out2.kind).toBe('already-today');
    // Wheat still untouched.
    expect(p.inventory.wheat).toBe(3);
  });

  it('reports not-candidate for unknown NPC ids', () => {
    const w = new World();
    const p = w.player!;
    p.hearts = startingHearts();
    expect(attemptAutoGift(p, 'ghost', 1).kind).toBe('not-candidate');
  });
});

describe('giftReadiness', () => {
  function freshPlayer() {
    const w = new World();
    const p = w.player!;
    p.hearts = startingHearts();
    p.inventory = {};
    return p;
  }

  it('is not ready with an empty bag', () => {
    const p = freshPlayer();
    const r = giftReadiness(p, 'maple', 1);
    expect(r.ready).toBe(false);
    expect(r.taste).toBeNull();
    expect(r.itemKey).toBeNull();
  });

  it('reports the best item + its taste when something giftable is held', () => {
    const p = freshPlayer();
    p.inventory = { ruby: 1, wheat: 2 }; // ruby loved by Maple
    const r = giftReadiness(p, 'maple', 1);
    expect(r.ready).toBe(true);
    expect(r.itemKey).toBe('ruby');
    expect(r.taste).toBe('loved');
  });

  it('falls to a neutral item when nothing loved/liked is carried', () => {
    const p = freshPlayer();
    // pumpkin_harvest is neutral for Maple (not in her loved/liked/disliked).
    p.inventory = { pumpkin_harvest: 1 };
    const r = giftReadiness(p, 'maple', 1);
    expect(r.ready).toBe(true);
    expect(r.taste).toBe('neutral');
  });

  it('goes un-ready once the candidate has been gifted today', () => {
    const p = freshPlayer();
    p.inventory = { ruby: 1 };
    expect(giftReadiness(p, 'maple', 5).ready).toBe(true);
    attemptAutoGift(p, 'maple', 5);
    // Same day -> the per-day gate closes readiness even if more is in the bag.
    p.inventory.amethyst = 1; // another Maple-loved item
    expect(giftReadiness(p, 'maple', 5).ready).toBe(false);
    // Next day it re-opens.
    expect(giftReadiness(p, 'maple', 6).ready).toBe(true);
  });

  it('never reports a disliked-only bag as ready', () => {
    const p = freshPlayer();
    p.inventory = { frog: 3 }; // Maple dislikes frog
    expect(giftReadiness(p, 'maple', 1).ready).toBe(false);
  });

  it('returns the empty shape for an unknown NPC', () => {
    const p = freshPlayer();
    p.inventory = { ruby: 1 };
    const r = giftReadiness(p, 'ghost', 1);
    expect(r.ready).toBe(false);
  });
});
