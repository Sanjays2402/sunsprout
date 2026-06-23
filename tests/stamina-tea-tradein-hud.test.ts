// Stamina-tea trade-in HUD glance — pure formatter that surfaces a
// chip in the cart-menu footer so the player knows at a glance
// whether the auto-trade-on-open path will fire (and how many more
// teas they need if it won't).
//
// The auto-trade itself fires inside the cart E-press path
// (game.ts) right after tradeBreederEggs — that wiring is tested
// elsewhere in cart-tea-tradein.test.ts. This module tests the
// pure formatter alone.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  TEA_TRADEIN_COST,
  staminaTeaTradeInLine,
  teaTradeInBalance,
} from '../src/game/cart';
import { dishInventoryKey } from '../src/game/cooking';

describe('staminaTeaTradeInLine — empty branch', () => {
  it('returns empty string on an empty bag', () => {
    const w = new World();
    w.player.inventory = {};
    expect(staminaTeaTradeInLine(w.player)).toBe('');
  });

  it('returns empty string when only non-eligible (expensive) teas are present', () => {
    const w = new World();
    w.player.inventory = {};
    // Mushroom-broth, sunflower-elixir, hot-cocoa are intentionally
    // NOT eligible for the trade-in (high-restore teas would be a
    // stamina arbitrage). Should read as 0 in the line formatter.
    w.player.inventory[dishInventoryKey('mushroom-broth')] = 10;
    w.player.inventory[dishInventoryKey('sunflower-elixir')] = 10;
    w.player.inventory[dishInventoryKey('hot-cocoa')] = 10;
    expect(staminaTeaTradeInLine(w.player)).toBe('');
  });
});

describe('staminaTeaTradeInLine — under-the-threshold branch', () => {
  it('says "need N more" with the correct count + pluralization', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = 1;
    expect(teaTradeInBalance(w.player)).toBe(1);
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('1 tea ');  // singular "1 tea" (no trailing 's')
    expect(line).toContain(`need ${TEA_TRADEIN_COST - 1} more`);
    expect(line).toContain('Hot Cocoa');
  });

  it('handles plural "teas" at 2 with need 1', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = 2;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('2 teas');
    expect(line).toContain('need 1 more');
  });

  it('sums across multiple eligible keys before deciding the branch', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = 1;
    w.player.inventory[dishInventoryKey('berry-tonic')] = 1;
    expect(teaTradeInBalance(w.player)).toBe(2);
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('2 teas');
    expect(line).toContain('need 1 more');
  });
});

describe('staminaTeaTradeInLine — trade-ready branch', () => {
  it('returns the "trade ready" chip at exactly TEA_TRADEIN_COST teas', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = TEA_TRADEIN_COST;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('trade ready');
    expect(line).toContain(`${TEA_TRADEIN_COST} teas`);
    expect(line).toContain('Hot Cocoa');
  });

  it('returns the "trade ready" chip when balance is well over the threshold', () => {
    const w = new World();
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = 10;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('trade ready');
    // The chip should only quote the COST, not the full bag balance,
    // so the player sees "what one trade costs" rather than "what
    // the bag holds total" (a misleading multi-trade tease).
    expect(line).toContain(`${TEA_TRADEIN_COST} teas`);
  });

  it('reads the trade-ready branch consistently regardless of which key carries the balance', () => {
    const w = new World();
    w.player.inventory = {};
    // Trade-ready via berry-tonic alone.
    w.player.inventory[dishInventoryKey('berry-tonic')] = TEA_TRADEIN_COST;
    expect(staminaTeaTradeInLine(w.player)).toContain('trade ready');
    // Reset, trade-ready via mixed bag.
    w.player.inventory = {};
    w.player.inventory[dishInventoryKey('herb-tea')] = 2;
    w.player.inventory[dishInventoryKey('berry-tonic')] = 1;
    expect(staminaTeaTradeInLine(w.player)).toContain('trade ready');
  });
});

describe('staminaTeaTradeInLine — branch transition smoke', () => {
  it('moves cleanly from empty -> partial -> trade-ready as the bag fills', () => {
    const w = new World();
    w.player.inventory = {};
    expect(staminaTeaTradeInLine(w.player)).toBe('');
    w.player.inventory[dishInventoryKey('herb-tea')] = 1;
    expect(staminaTeaTradeInLine(w.player)).toContain('need');
    w.player.inventory[dishInventoryKey('herb-tea')] = TEA_TRADEIN_COST;
    expect(staminaTeaTradeInLine(w.player)).toContain('trade ready');
  });
});
