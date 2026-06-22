// Spa-pass refill — once the player has redeemed (and burned through)
// a spa pass, Pip sells a discounted refill at the cart that credits
// punches directly without going through the bag. The refill row is
// filtered out of cart-rumor headlines so a fresh-game player never
// gets teased by a row they can't buy yet.
import { describe, it, expect } from 'vitest';
import { World, type Player } from '../src/world/world';
import {
  CART_CATALOG,
  CART_X,
  CART_Y,
  SPA_PASS_REFILL_KEY,
  buyFromCart,
  canRefillSpaPass,
} from '../src/game/cart';
import {
  SPA_PASS_INVENTORY_KEY,
  SPA_PASS_PUNCHES,
  SPA_PASS_REFILL_PRICE,
  bathFlavorLine,
  getBath,
  getSpaPass,
  redeemSpaPass,
  takeBath,
} from '../src/game/bath-house';
import { rumorItemForSeason } from '../src/game/cart-rumor';
import { TimeOfDay } from '../src/game/time';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

function freshPlayer(gold = 1000): Player {
  const w = freshWorld();
  w.player.gold = gold;
  return w.player;
}

function openTime(): TimeOfDay {
  const t = new TimeOfDay();
  t.day = 3;
  t.hour = 10;
  t.minute = 0;
  t.season = 0; // Spring — bath-house full price
  return t;
}

// Helper: set the player up as "has used a spa pass before, now empty".
function exhaustedPass(gold = 1000): Player {
  const w = freshWorld();
  w.player.gold = gold;
  // Drop a pass in the bag and burn through all four soaks.
  w.player.inventory[SPA_PASS_INVENTORY_KEY] = 1;
  redeemSpaPass(w.player);
  for (let i = 0; i < SPA_PASS_PUNCHES; i++) {
    const day = i * 7; // give the buff plenty of room to expire
    const out = takeBath(w.player, 30, 7, day, openTime());
    expect(out.kind).toBe('soaked');
  }
  // Sanity — pool drained, totalSoaks counted, no bag pass.
  expect(getSpaPass(w.player).punchesLeft).toBe(0);
  expect(getBath(w.player).totalSoaks).toBe(SPA_PASS_PUNCHES);
  expect(w.player.inventory[SPA_PASS_INVENTORY_KEY] ?? 0).toBe(0);
  return w.player;
}

describe('SPA_PASS_REFILL catalog row', () => {
  it('exists with the refill price + key', () => {
    const row = CART_CATALOG.find((r) => r.key === SPA_PASS_REFILL_KEY);
    expect(row).toBeDefined();
    expect(row!.buyPrice).toBe(SPA_PASS_REFILL_PRICE);
    expect(SPA_PASS_REFILL_PRICE).toBeLessThan(700); // strictly cheaper than full pass
    expect(row!.label.toLowerCase()).toContain('refill');
  });
});

describe('canRefillSpaPass gating', () => {
  it('false on a fresh player (never soaked)', () => {
    expect(canRefillSpaPass(freshPlayer())).toBe(false);
  });

  it('false when the player still has an unredeemed pass in the bag', () => {
    const p = freshPlayer();
    p.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    expect(canRefillSpaPass(p)).toBe(false);
  });

  it('false when the punches pool still has soaks left', () => {
    const p = freshPlayer();
    p.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    redeemSpaPass(p);
    expect(canRefillSpaPass(p)).toBe(false);
  });

  it('true once a player has soaked through a pass and is bare', () => {
    expect(canRefillSpaPass(exhaustedPass())).toBe(true);
  });
});

describe('buyFromCart — refill path', () => {
  it('credits SPA_PASS_PUNCHES into the pool and deducts the price', () => {
    const p = exhaustedPass(SPA_PASS_REFILL_PRICE + 100);
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), SPA_PASS_REFILL_KEY);
    expect(out.kind).toBe('refilled');
    if (out.kind !== 'refilled') return;
    expect(out.punches).toBe(SPA_PASS_PUNCHES);
    expect(out.remainingGold).toBe(100);
    expect(p.gold).toBe(100);
    expect(getSpaPass(p).punchesLeft).toBe(SPA_PASS_PUNCHES);
    // Refill should NOT add a bag item.
    expect(p.inventory[SPA_PASS_REFILL_KEY] ?? 0).toBe(0);
    expect(p.inventory[SPA_PASS_INVENTORY_KEY] ?? 0).toBe(0);
  });

  it('refuses with refill-not-eligible/no-pass on a fresh player', () => {
    const p = freshPlayer(SPA_PASS_REFILL_PRICE + 100);
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), SPA_PASS_REFILL_KEY);
    expect(out.kind).toBe('refill-not-eligible');
    if (out.kind !== 'refill-not-eligible') return;
    expect(out.reason).toBe('no-pass');
    expect(p.gold).toBe(SPA_PASS_REFILL_PRICE + 100); // untouched
  });

  it('refuses with refill-not-eligible/still-has-punches when punches > 0', () => {
    const p = freshPlayer(SPA_PASS_REFILL_PRICE + 100);
    p.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    redeemSpaPass(p);
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), SPA_PASS_REFILL_KEY);
    expect(out.kind).toBe('refill-not-eligible');
    if (out.kind !== 'refill-not-eligible') return;
    expect(out.reason).toBe('still-has-punches');
    expect(p.gold).toBe(SPA_PASS_REFILL_PRICE + 100); // untouched
    expect(getSpaPass(p).punchesLeft).toBe(SPA_PASS_PUNCHES); // unchanged
  });

  it('refuses with not-enough-gold when the eligible player is broke', () => {
    const p = exhaustedPass(50);
    const out = buyFromCart(p, CART_X, CART_Y, openTime(), SPA_PASS_REFILL_KEY);
    expect(out.kind).toBe('not-enough-gold');
    if (out.kind !== 'not-enough-gold') return;
    expect(out.need).toBe(SPA_PASS_REFILL_PRICE);
    expect(out.have).toBe(50);
  });

  it('refill-after-refill works: a second cycle requires another exhaustion', () => {
    const p = exhaustedPass(SPA_PASS_REFILL_PRICE * 2 + 1000);
    buyFromCart(p, CART_X, CART_Y, openTime(), SPA_PASS_REFILL_KEY);
    // Pool is now SPA_PASS_PUNCHES — a second refill is blocked until
    // the player burns through.
    const blocked = buyFromCart(p, CART_X, CART_Y, openTime(), SPA_PASS_REFILL_KEY);
    expect(blocked.kind).toBe('refill-not-eligible');
    // Burn through and try again.
    for (let i = 0; i < SPA_PASS_PUNCHES; i++) {
      takeBath(p, 30, 7, 100 + i * 7, openTime());
    }
    const refill2 = buyFromCart(p, CART_X, CART_Y, openTime(), SPA_PASS_REFILL_KEY);
    expect(refill2.kind).toBe('refilled');
    if (refill2.kind !== 'refilled') return;
    expect(refill2.punches).toBe(SPA_PASS_PUNCHES);
  });

  it('refilled punches make the next bath read as paid-with-pass', () => {
    const p = exhaustedPass(SPA_PASS_REFILL_PRICE + 1000);
    buyFromCart(p, CART_X, CART_Y, openTime(), SPA_PASS_REFILL_KEY);
    // Take a soak — the refill punch should cover the cost.
    const out = takeBath(p, 30, 7, 200, openTime());
    expect(out.kind).toBe('soaked');
    if (out.kind !== 'soaked') return;
    expect(out.paidWithPass).toBe(true);
    expect(out.pricePaid).toBe(0);
    expect(out.passesLeft).toBe(SPA_PASS_PUNCHES - 1);
    // Bath flavour reads as the spa-pass path.
    expect(bathFlavorLine(out)).toContain('spa pass');
  });
});

describe('cart-rumor headliner pool excludes the refill row', () => {
  it('rumorItemForSeason never picks the refill row', () => {
    for (let s = 0; s < 4; s++) {
      const row = rumorItemForSeason(s);
      expect(row).not.toBeNull();
      expect(row!.key).not.toBe(SPA_PASS_REFILL_KEY);
    }
  });
});
