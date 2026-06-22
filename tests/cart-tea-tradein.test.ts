// Stamina-tea trade-in at Pip's cart — exchange 3 cheap teas
// (herb-tea + berry-tonic, cheapest-first) for 1 Hot Cocoa. Mirrors
// the breeder-egg trade-in shape: auto-fires on cart-menu open, gated
// by cartOpen + nearCart, refuses cleanly on a low bag balance, and
// credits the minted cocoa directly into `dish-hot-cocoa` so the
// existing drinkBest (Z) path picks it up unchanged.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  CART_X,
  CART_Y,
  TEA_TRADEIN_COST,
  TEA_TRADEIN_KEYS,
  TEA_TRADEIN_REWARD_KEY,
  canTradeStaminaTeas,
  teaTradeInBalance,
  teaTradeInLine,
  tradeStaminaTeas,
} from '../src/game/cart';
import { dishInventoryKey } from '../src/game/cooking';
import { TimeOfDay } from '../src/game/time';

/** Build a fresh world with an empty bag, parked at the cart. */
function freshAtCart(): { w: World; px: number; py: number; time: TimeOfDay } {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  // Pip arrives on day 3 every season; 12:00 puts us inside the
  // 09-18h open window.
  const time = new TimeOfDay();
  time.day = 3;
  time.hour = 12;
  time.minute = 0;
  return { w, px: CART_X, py: CART_Y, time };
}

describe('teaTradeInBalance — counts cheap teas only', () => {
  it('returns 0 on an empty bag', () => {
    const w = new World();
    w.player.inventory = {};
    expect(teaTradeInBalance(w.player)).toBe(0);
  });

  it('sums every eligible tea key', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = 2;
    w.player.inventory[dishInventoryKey('berry-tonic')] = 3;
    expect(teaTradeInBalance(w.player)).toBe(5);
  });

  it('does NOT count expensive teas (mushroom-broth, sunflower-elixir, hot-cocoa)', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('mushroom-broth')] = 10;
    w.player.inventory[dishInventoryKey('sunflower-elixir')] = 10;
    w.player.inventory[dishInventoryKey('hot-cocoa')] = 10;
    expect(teaTradeInBalance(w.player)).toBe(0);
  });
});

describe('canTradeStaminaTeas — gate', () => {
  it('false below the threshold', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = TEA_TRADEIN_COST - 1;
    expect(canTradeStaminaTeas(w.player)).toBe(false);
  });

  it('true at exactly the threshold', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = TEA_TRADEIN_COST;
    expect(canTradeStaminaTeas(w.player)).toBe(true);
  });

  it('true when threshold is reached across multiple keys', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = 2;
    w.player.inventory[dishInventoryKey('berry-tonic')] = 1;
    expect(canTradeStaminaTeas(w.player)).toBe(true);
  });
});

describe('tradeStaminaTeas — gates + outcomes', () => {
  it('returns closed when Pip isn\'t in town', () => {
    const { w, px, py } = freshAtCart();
    const time = new TimeOfDay();
    time.day = 4; // Pip already left
    time.hour = 10;
    w.player.inventory[dishInventoryKey('herb-tea')] = TEA_TRADEIN_COST;
    expect(tradeStaminaTeas(w.player, px, py, time).kind).toBe('closed');
  });

  it('returns too-far when the player is across the village', () => {
    const { w, time } = freshAtCart();
    w.player.inventory[dishInventoryKey('herb-tea')] = TEA_TRADEIN_COST;
    expect(tradeStaminaTeas(w.player, CART_X + 5, CART_Y, time).kind).toBe('too-far');
  });

  it('returns none when the bag has fewer than TEA_TRADEIN_COST teas', () => {
    const { w, px, py, time } = freshAtCart();
    w.player.inventory[dishInventoryKey('herb-tea')] = TEA_TRADEIN_COST - 1;
    const out = tradeStaminaTeas(w.player, px, py, time);
    expect(out.kind).toBe('none');
    if (out.kind === 'none') {
      expect(out.have).toBe(TEA_TRADEIN_COST - 1);
      expect(out.need).toBe(TEA_TRADEIN_COST);
    }
    // Bag untouched.
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(TEA_TRADEIN_COST - 1);
    expect(w.player.inventory[dishInventoryKey('hot-cocoa')] ?? 0).toBe(0);
  });

  it('trades 3 herb-teas for 1 hot-cocoa, consuming cheapest first', () => {
    const { w, px, py, time } = freshAtCart();
    w.player.inventory[dishInventoryKey('herb-tea')] = 3;
    w.player.inventory[dishInventoryKey('berry-tonic')] = 1;
    const out = tradeStaminaTeas(w.player, px, py, time);
    expect(out.kind).toBe('traded');
    if (out.kind === 'traded') {
      expect(out.teasUsed).toBe(TEA_TRADEIN_COST);
      expect(out.cocoasMinted).toBe(1);
      expect(out.remainingCocoa).toBe(1);
    }
    // Herb-tea drained, berry-tonic untouched (cheapest-first).
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(0);
    expect(w.player.inventory[dishInventoryKey('berry-tonic')]).toBe(1);
    expect(w.player.inventory[dishInventoryKey('hot-cocoa')]).toBe(1);
  });

  it('spills over into berry-tonic when herb-tea runs out', () => {
    const { w, px, py, time } = freshAtCart();
    w.player.inventory[dishInventoryKey('herb-tea')] = 1;
    w.player.inventory[dishInventoryKey('berry-tonic')] = 5;
    const out = tradeStaminaTeas(w.player, px, py, time);
    expect(out.kind).toBe('traded');
    // 1 herb-tea + 2 berry-tonic = 3 teas.
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(0);
    expect(w.player.inventory[dishInventoryKey('berry-tonic')]).toBe(3);
    expect(w.player.inventory[dishInventoryKey('hot-cocoa')]).toBe(1);
  });

  it('multi-trade — chains TWO trades cleanly when called twice', () => {
    const { w, px, py, time } = freshAtCart();
    w.player.inventory[dishInventoryKey('herb-tea')] = 6;
    const out1 = tradeStaminaTeas(w.player, px, py, time);
    expect(out1.kind).toBe('traded');
    const out2 = tradeStaminaTeas(w.player, px, py, time);
    expect(out2.kind).toBe('traded');
    if (out2.kind === 'traded') expect(out2.remainingCocoa).toBe(2);
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(0);
    expect(w.player.inventory[dishInventoryKey('hot-cocoa')]).toBe(2);
  });

  it('a 7-tea bag trades once and leaves the leftover tea behind', () => {
    const { w, px, py, time } = freshAtCart();
    w.player.inventory[dishInventoryKey('herb-tea')] = 7;
    tradeStaminaTeas(w.player, px, py, time);
    expect(w.player.inventory[dishInventoryKey('herb-tea')]).toBe(4);
    expect(w.player.inventory[dishInventoryKey('hot-cocoa')]).toBe(1);
  });

  it('refuses high-restore teas — mushroom-broth doesn\'t count', () => {
    const { w, px, py, time } = freshAtCart();
    w.player.inventory[dishInventoryKey('mushroom-broth')] = 10;
    expect(tradeStaminaTeas(w.player, px, py, time).kind).toBe('none');
  });
});

describe('teaTradeInLine — pretty toast', () => {
  it('mentions the count + remaining cocoa', () => {
    const line = teaTradeInLine({
      kind: 'traded',
      teasUsed: 3,
      cocoasMinted: 1,
      remainingCocoa: 4,
    });
    expect(line).toContain('3 stamina teas');
    expect(line).toContain('1 Hot Cocoa');
    expect(line).toContain('4 on hand');
  });
});

describe('TEA_TRADEIN_* constants — sanity', () => {
  it('TEA_TRADEIN_KEYS is exactly two entries in cheapest-first order', () => {
    expect(TEA_TRADEIN_KEYS.length).toBe(2);
    expect(TEA_TRADEIN_KEYS[0]).toBe('herb-tea');
    expect(TEA_TRADEIN_KEYS[1]).toBe('berry-tonic');
  });

  it('TEA_TRADEIN_REWARD_KEY is hot-cocoa', () => {
    expect(TEA_TRADEIN_REWARD_KEY).toBe('hot-cocoa');
  });
});
