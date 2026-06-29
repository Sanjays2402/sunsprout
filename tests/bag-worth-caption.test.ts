// Bag worth-share legend caption — bagWorthCaption() names the top one or
// two categories the bag's money sits in, so a colour-blind player reads the
// share bar's hues as words ("most worth in Gems, then Crops"). It must stay
// in lock-step with bagWorthShares (only worthful categories appear) and only
// mention a runner-up when it carries a real slice.

import { describe, it, expect } from 'vitest';
import { bagWorthCaption, bagTotalValue } from '../src/game/bag';
import type { Player } from '../src/world/world';

function mkPlayer(inventory: Record<string, number>): Player {
  return { inventory, gold: 0 } as unknown as Player;
}

describe('bagWorthCaption', () => {
  it('returns "" for an empty or worthless bag', () => {
    expect(bagWorthCaption(mkPlayer({}))).toBe('');
    // Seeds + supplies carry no sell value.
    expect(bagWorthCaption(mkPlayer({ wheat: 9, hoe: 1 }))).toBe('');
  });

  it('names the single dominant category when one swamps the rest', () => {
    // Ruby is worth 140g; a single wheat harvest is 8g — Gems dominate so the
    // runner-up sliver doesn't earn a mention.
    const cap = bagWorthCaption(mkPlayer({ 'gem-ruby': 4, wheat_harvest: 1 }));
    expect(cap).toBe('most worth in Gems');
  });

  it('names the top two when the runner-up is a real share', () => {
    // Two rubies (280g) + a fat crop stack (~10 * 8g = 80g) keeps Crops well
    // over 15% of the whole, so it earns the "then ..." mention.
    const cap = bagWorthCaption(mkPlayer({ 'gem-ruby': 2, wheat_harvest: 10 }));
    expect(cap).toBe('most worth in Gems, then Crops');
  });

  it('leads with the richest category', () => {
    // Crops dominate; gems are the minor slice — caption leads with Crops.
    const cap = bagWorthCaption(mkPlayer({ wheat_harvest: 40, 'gem-copper': 1 }));
    expect(cap.startsWith('most worth in Crops')).toBe(true);
  });

  it('only ever names worthful categories', () => {
    // Seeds/supplies never sell, so they can never appear in the caption.
    const cap = bagWorthCaption(mkPlayer({ 'gem-ruby': 3, wheat: 99, hoe: 1 }));
    expect(cap).not.toContain('Seeds');
    expect(cap).not.toContain('Supplies');
  });

  it('agrees with bagTotalValue having worth', () => {
    const player = mkPlayer({ 'gem-ruby': 2 });
    expect(bagTotalValue(player)).toBeGreaterThan(0);
    expect(bagWorthCaption(player)).not.toBe('');
  });
});
