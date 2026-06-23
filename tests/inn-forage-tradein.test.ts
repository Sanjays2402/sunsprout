// Inn forage trade-in — barter 3 surplus forage items (berries +
// herbs) for 1 Sage Tea on the house. Auto-fires on cooking-menu
// open at the inn so the player doesn't learn a new keybind;
// mirrors the cart-side breeder-egg + tea trade-ins.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  INN_FORAGE_TRADEIN_COST,
  INN_FORAGE_TRADEIN_KEYS,
  INN_FORAGE_TRADEIN_REWARD_KEY,
  canTradeForageForTea,
  innForageTradeInBalance,
  innForageTradeInLine,
  innForageTradeToastLine,
  tradeForageForTea,
} from '../src/game/inn-trade';
import { forageInventoryKey } from '../src/game/forage';
import { dishInventoryKey } from '../src/game/cooking';

/** Build a fresh world with an empty bag. */
function fresh(): { w: World } {
  const w = new World();
  w.player.inventory = {};
  return { w };
}

describe('innForageTradeInBalance — counts eligible forage only', () => {
  it('returns 0 on an empty bag', () => {
    const { w } = fresh();
    expect(innForageTradeInBalance(w.player)).toBe(0);
  });

  it('sums berries + herbs', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = 4;
    w.player.inventory[forageInventoryKey('herb')] = 2;
    expect(innForageTradeInBalance(w.player)).toBe(6);
  });

  it('does NOT count mushroom (mushroom is mid-tier forage, not cheap-tea fuel)', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('mushroom')] = 10;
    expect(innForageTradeInBalance(w.player)).toBe(0);
  });
});

describe('canTradeForageForTea — gate', () => {
  it('false below the threshold', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST - 1;
    expect(canTradeForageForTea(w.player)).toBe(false);
  });

  it('true at exactly the threshold', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST;
    expect(canTradeForageForTea(w.player)).toBe(true);
  });

  it('true when threshold is reached across keys', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = 2;
    w.player.inventory[forageInventoryKey('herb')] = 1;
    expect(canTradeForageForTea(w.player)).toBe(true);
  });
});

describe('tradeForageForTea — gates + outcomes', () => {
  it('returns too-far when near=false', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST;
    expect(tradeForageForTea(w.player, false).kind).toBe('too-far');
  });

  it('returns none when the bag has fewer than COST eligible forage', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST - 1;
    const out = tradeForageForTea(w.player, true);
    expect(out.kind).toBe('none');
    if (out.kind === 'none') {
      expect(out.have).toBe(INN_FORAGE_TRADEIN_COST - 1);
      expect(out.need).toBe(INN_FORAGE_TRADEIN_COST);
    }
    // Bag untouched.
    expect(w.player.inventory[forageInventoryKey('berry')]).toBe(INN_FORAGE_TRADEIN_COST - 1);
    expect(w.player.inventory[dishInventoryKey('herb-tea')] ?? 0).toBe(0);
  });

  it('trades 3 berries for 1 Sage Tea, consuming cheapest first', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = 3;
    w.player.inventory[forageInventoryKey('herb')] = 1;
    const out = tradeForageForTea(w.player, true);
    expect(out.kind).toBe('traded');
    if (out.kind === 'traded') {
      expect(out.forageUsed).toBe(INN_FORAGE_TRADEIN_COST);
      expect(out.teasMinted).toBe(1);
      expect(out.remainingTea).toBe(1);
    }
    // Berries drained, herbs untouched (cheapest-first).
    expect(w.player.inventory[forageInventoryKey('berry')]).toBe(0);
    expect(w.player.inventory[forageInventoryKey('herb')]).toBe(1);
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(1);
  });

  it('spills over into herbs when berries run out', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = 1;
    w.player.inventory[forageInventoryKey('herb')] = 5;
    const out = tradeForageForTea(w.player, true);
    expect(out.kind).toBe('traded');
    // 1 berry + 2 herb = 3 forage.
    expect(w.player.inventory[forageInventoryKey('berry')]).toBe(0);
    expect(w.player.inventory[forageInventoryKey('herb')]).toBe(3);
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(1);
  });

  it('multi-trade — chains TWO trades cleanly when called twice', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = 6;
    const out1 = tradeForageForTea(w.player, true);
    expect(out1.kind).toBe('traded');
    const out2 = tradeForageForTea(w.player, true);
    expect(out2.kind).toBe('traded');
    if (out2.kind === 'traded') expect(out2.remainingTea).toBe(2);
    expect(w.player.inventory[forageInventoryKey('berry')]).toBe(0);
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(2);
  });

  it('a 7-forage bag trades once and leaves the leftover behind', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = 7;
    tradeForageForTea(w.player, true);
    expect(w.player.inventory[forageInventoryKey('berry')]).toBe(4);
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(1);
  });

  it('refuses mushroom — mushroom-only bag returns none', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('mushroom')] = 10;
    expect(tradeForageForTea(w.player, true).kind).toBe('none');
  });
});

describe('innForageTradeToastLine — pretty toast', () => {
  it('mentions the forage count + remaining tea', () => {
    const line = innForageTradeToastLine({
      kind: 'traded',
      forageUsed: 3,
      teasMinted: 1,
      remainingTea: 4,
    });
    expect(line).toContain('3 forage');
    expect(line).toContain('1 Sage Tea');
    expect(line).toContain('4 on hand');
  });
});

describe('innForageTradeInLine — HUD chip', () => {
  it('returns empty string on an empty bag', () => {
    const { w } = fresh();
    expect(innForageTradeInLine(w.player)).toBe('');
  });

  it('returns empty string when only mushrooms are present', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('mushroom')] = 10;
    expect(innForageTradeInLine(w.player)).toBe('');
  });

  it('says "need N more" with singular/plural correctness', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = 1;
    const line = innForageTradeInLine(w.player);
    expect(line).toContain('1 forage');
    expect(line).toContain(`need ${INN_FORAGE_TRADEIN_COST - 1} more`);
    expect(line).toContain('Sage Tea');
  });

  it('reads trade-ready at exactly the threshold', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST;
    const line = innForageTradeInLine(w.player);
    expect(line).toContain('trade ready');
    expect(line).toContain(`${INN_FORAGE_TRADEIN_COST} forage`);
  });

  it('reads trade-ready when balance is well over the threshold', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = 10;
    const line = innForageTradeInLine(w.player);
    expect(line).toContain('trade ready');
    // Only quotes the COST, not the full bag balance.
    expect(line).toContain(`${INN_FORAGE_TRADEIN_COST} forage`);
  });

  it('moves cleanly from empty -> partial -> trade-ready as the bag fills', () => {
    const { w } = fresh();
    expect(innForageTradeInLine(w.player)).toBe('');
    w.player.inventory[forageInventoryKey('berry')] = 1;
    expect(innForageTradeInLine(w.player)).toContain('need');
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST;
    expect(innForageTradeInLine(w.player)).toContain('trade ready');
  });
});

describe('INN_FORAGE_TRADEIN_* constants — sanity', () => {
  it('INN_FORAGE_TRADEIN_KEYS is exactly two entries in cheapest-first order (berry, herb)', () => {
    expect(INN_FORAGE_TRADEIN_KEYS.length).toBe(2);
    expect(INN_FORAGE_TRADEIN_KEYS[0]).toBe('berry');
    expect(INN_FORAGE_TRADEIN_KEYS[1]).toBe('herb');
  });

  it('INN_FORAGE_TRADEIN_REWARD_KEY is herb-tea (Sage Tea)', () => {
    expect(INN_FORAGE_TRADEIN_REWARD_KEY).toBe('herb-tea');
  });

  it('INN_FORAGE_TRADEIN_COST mirrors the cart-tea trade-in shape (3-for-1)', () => {
    expect(INN_FORAGE_TRADEIN_COST).toBe(3);
  });
});
