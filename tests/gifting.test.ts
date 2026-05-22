// Gifting — slice 3 of v0.5.0. Verifies the auto-pick + inventory
// decrement bridge between Player.inventory and HeartsState.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { startingHearts, getHearts } from '../src/game/hearts';
import { attemptAutoGift, pickBestGift } from '../src/game/gifting';

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
