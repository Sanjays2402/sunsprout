// Cart-side inn nudge — staminaTeaTradeInLine appends a long-pipeline
// pointer when the player is SHORT on cart teas but is carrying enough
// forage at the inn to mint at least one Sage Tea. Suppressed when:
//   - the player can already trade at the cart (no need to point them
//     at the longer pipeline);
//   - the player has no eligible forage to convert (the tail would
//     just be noise).
//
// This closes the loop on the trade-in trio: a player who only walks
// up to the cart and sees \"need more teas\" now also learns about the
// inn route in the same chip.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  TEA_TRADEIN_COST,
  TEA_TRADEIN_KEYS,
  staminaTeaTradeInLine,
} from '../src/game/cart';
import { INN_FORAGE_TRADEIN_COST } from '../src/game/inn-trade';
import { dishInventoryKey } from '../src/game/cooking';
import { forageInventoryKey } from '../src/game/forage';

function fresh(): { w: World } {
  const w = new World();
  w.player.inventory = {};
  return { w };
}

describe('staminaTeaTradeInLine — empty branch with inn nudge', () => {
  it('still empty when player has neither teas nor forage', () => {
    const { w } = fresh();
    expect(staminaTeaTradeInLine(w.player)).toBe('');
  });

  it('still empty when player has forage but not enough to mint a Sage Tea', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST - 1;
    expect(staminaTeaTradeInLine(w.player)).toBe('');
  });

  it('surfaces ONLY the inn hint when teas==0 but forage covers a tea', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('or trade');
    expect(line).toContain(`${INN_FORAGE_TRADEIN_COST} forage at the inn`);
    expect(line).toContain('Sage Tea');
    // No "tea" / "Hot Cocoa" prefix since the player has zero teas.
    expect(line.startsWith('0 teas')).toBe(false);
    expect(line).not.toContain('Hot Cocoa');
  });

  it('quantifies the inn yield when forage is enough for multiple teas', () => {
    const { w } = fresh();
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST * 2;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain(`${INN_FORAGE_TRADEIN_COST * 2} forage`);
    expect(line).toContain('2 Sage Tea');
  });
});

describe('staminaTeaTradeInLine — under-the-threshold branch with inn nudge', () => {
  it('appends the inn hint when player has 1 tea + enough forage', () => {
    const { w } = fresh();
    w.player.inventory[dishInventoryKey(TEA_TRADEIN_KEYS[0])] = 1;
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('1 tea');
    expect(line).toContain(`need ${TEA_TRADEIN_COST - 1} more`);
    expect(line).toContain('or trade');
    expect(line).toContain('Sage Tea');
  });

  it('does NOT append the inn hint when player has 1 tea but no forage', () => {
    const { w } = fresh();
    w.player.inventory[dishInventoryKey(TEA_TRADEIN_KEYS[0])] = 1;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('1 tea');
    expect(line).not.toContain('or trade');
    expect(line).not.toContain('at the inn');
  });

  it('does NOT append the inn hint when forage is below the inn-trade threshold', () => {
    const { w } = fresh();
    w.player.inventory[dishInventoryKey(TEA_TRADEIN_KEYS[0])] = 2;
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST - 1;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('2 teas');
    expect(line).not.toContain('or trade');
  });

  it('counts BERRY + HERB forage toward the inn-tail threshold', () => {
    const { w } = fresh();
    w.player.inventory[dishInventoryKey(TEA_TRADEIN_KEYS[0])] = 1;
    w.player.inventory[forageInventoryKey('berry')] = 2;
    w.player.inventory[forageInventoryKey('herb')] = 1;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('1 tea');
    expect(line).toContain('or trade');
    expect(line).toContain(`${INN_FORAGE_TRADEIN_COST} forage`);
  });
});

describe('staminaTeaTradeInLine — trade-ready branch suppresses inn hint', () => {
  it('says trade-ready and nothing else when player already has enough teas', () => {
    const { w } = fresh();
    w.player.inventory[dishInventoryKey(TEA_TRADEIN_KEYS[0])] = TEA_TRADEIN_COST;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('trade ready');
    expect(line).not.toContain('at the inn');
  });

  it('also suppresses the inn hint even when forage would mint MORE teas', () => {
    const { w } = fresh();
    w.player.inventory[dishInventoryKey(TEA_TRADEIN_KEYS[0])] = TEA_TRADEIN_COST;
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST * 4;
    const line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('trade ready');
    expect(line).not.toContain('at the inn');
  });
});

describe('staminaTeaTradeInLine — branch transition with the inn nudge', () => {
  it('moves cleanly from empty -> inn-only -> partial+inn -> trade-ready as the bags shift', () => {
    const { w } = fresh();
    expect(staminaTeaTradeInLine(w.player)).toBe('');
    // Add enough forage to mint a Sage Tea -> inn-only branch.
    w.player.inventory[forageInventoryKey('berry')] = INN_FORAGE_TRADEIN_COST;
    let line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('or trade');
    expect(line.startsWith(' - or trade')).toBe(true);
    // Add 1 tea -> partial branch + inn tail.
    w.player.inventory[dishInventoryKey(TEA_TRADEIN_KEYS[0])] = 1;
    line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('1 tea');
    expect(line).toContain('or trade');
    // Top up teas -> trade-ready, inn tail dropped.
    w.player.inventory[dishInventoryKey(TEA_TRADEIN_KEYS[0])] = TEA_TRADEIN_COST;
    line = staminaTeaTradeInLine(w.player);
    expect(line).toContain('trade ready');
    expect(line).not.toContain('or trade');
  });
});
