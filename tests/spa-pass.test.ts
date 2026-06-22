// Spa pass — 700g punch card from Pip's cart that grants 4 free soaks
// at the bath house.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BATH_BONUS,
  BATH_DURATION_DAYS,
  BATH_FEE,
  BATH_X,
  BATH_Y,
  SPA_PASS_INVENTORY_KEY,
  SPA_PASS_PRICE,
  SPA_PASS_PUNCHES,
  bathFlavorLine,
  bathActive,
  getSpaPass,
  hasSpaPass,
  maybeExpireBath,
  redeemSpaPass,
  takeBath,
} from '../src/game/bath-house';
import { CART_CATALOG } from '../src/game/cart';
import { TimeOfDay } from '../src/game/time';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 0;
  return w;
}

function fakeGame(): Game {
  return { world: freshWorld(), time: new TimeOfDay(6) } as unknown as Game;
}

const BATH_PX = BATH_X + 1;
const BATH_PY = BATH_Y;

describe('cart catalog', () => {
  it('Spa Pass appears in CART_CATALOG at the right key + price', () => {
    const row = CART_CATALOG.find((r) => r.key === SPA_PASS_INVENTORY_KEY);
    expect(row).toBeDefined();
    expect(row!.buyPrice).toBe(SPA_PASS_PRICE);
    expect(row!.label.toLowerCase()).toContain('spa');
  });
});

describe('redeemSpaPass', () => {
  it('returns 0 when there is no pass in the bag', () => {
    const w = freshWorld();
    expect(redeemSpaPass(w.player)).toBe(0);
  });

  it('consumes one bag pass and credits SPA_PASS_PUNCHES punches', () => {
    const w = freshWorld();
    w.player.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    const left = redeemSpaPass(w.player);
    expect(left).toBe(SPA_PASS_PUNCHES);
    expect(w.player.inventory[SPA_PASS_INVENTORY_KEY]).toBe(0);
    expect(getSpaPass(w.player).punchesLeft).toBe(SPA_PASS_PUNCHES);
    expect(hasSpaPass(w.player)).toBe(true);
  });

  it('stacks when redeeming two passes', () => {
    const w = freshWorld();
    w.player.inventory[SPA_PASS_INVENTORY_KEY] = 2;
    redeemSpaPass(w.player);
    redeemSpaPass(w.player);
    expect(getSpaPass(w.player).punchesLeft).toBe(SPA_PASS_PUNCHES * 2);
    expect(w.player.inventory[SPA_PASS_INVENTORY_KEY]).toBe(0);
  });
});

describe('takeBath prefers a punch over gold', () => {
  it('auto-redeems a pass and spends one punch instead of gold', () => {
    const w = freshWorld();
    w.player.gold = 1000;
    w.player.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    const out = takeBath(w.player, BATH_PX, BATH_PY, 1);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.paidWithPass).toBe(true);
      expect(out.pricePaid).toBe(0);
      expect(out.passesLeft).toBe(SPA_PASS_PUNCHES - 1);
    }
    // Gold untouched.
    expect(w.player.gold).toBe(1000);
    // Bag's spa-pass count drained (auto-redeemed).
    expect(w.player.inventory[SPA_PASS_INVENTORY_KEY]).toBe(0);
    // Stamina-cap lift fired and buff is active.
    expect(bathActive(w.player, 1)).toBe(true);
  });

  it('does not auto-redeem a pass when punches are already available', () => {
    const w = freshWorld();
    w.player.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    getSpaPass(w.player).punchesLeft = 2;
    const out = takeBath(w.player, BATH_PX, BATH_PY, 1);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.paidWithPass).toBe(true);
      expect(out.passesLeft).toBe(1);
    }
    // The bag's untapped pass is still sitting there for later.
    expect(w.player.inventory[SPA_PASS_INVENTORY_KEY]).toBe(1);
  });

  it('falls back to gold when no punches are available', () => {
    const w = freshWorld();
    w.player.gold = BATH_FEE + 10;
    const out = takeBath(w.player, BATH_PX, BATH_PY, 1);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.paidWithPass).toBe(false);
      expect(out.pricePaid).toBe(BATH_FEE);
    }
    expect(w.player.gold).toBe(10);
  });

  it('a 4-punch pass covers exactly four soaks across the year', () => {
    const w = freshWorld();
    w.player.gold = 0; // <-- intentionally broke, the pass is doing the heavy lifting
    redeemSpaPass(Object.assign(w.player, { inventory: { [SPA_PASS_INVENTORY_KEY]: 1 } }));
    for (let i = 0; i < SPA_PASS_PUNCHES; i++) {
      // Wait for prior buff to expire so each soak counts.
      maybeExpireBath(w.player, i * BATH_DURATION_DAYS + 1);
      const out = takeBath(w.player, BATH_PX, BATH_PY, i * BATH_DURATION_DAYS + 1);
      expect(out.kind).toBe('soaked');
      if (out.kind === 'soaked') expect(out.paidWithPass).toBe(true);
    }
    // 5th attempt with no gold + no punches must refuse.
    maybeExpireBath(w.player, 100);
    const fifth = takeBath(w.player, BATH_PX, BATH_PY, 100);
    expect(fifth.kind).toBe('not-enough-gold');
  });
});

describe('bathFlavorLine names the punch path', () => {
  it('mentions the remaining punches when paidWithPass=true', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 0,
      daysLeft: BATH_DURATION_DAYS,
      bonus: BATH_BONUS,
      pricePaid: 0,
      discounted: false,
      paidWithPass: true,
      passesLeft: 2,
      totalSoaks: 1,
      soapsEarned: 0,
    });
    expect(line).toContain('spa pass');
    expect(line).toContain('2 punches');
  });

  it('keeps the regular wording when paidWithPass=false', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 500,
      daysLeft: BATH_DURATION_DAYS,
      bonus: BATH_BONUS,
      pricePaid: BATH_FEE,
      discounted: false,
      paidWithPass: false,
      passesLeft: 0,
      totalSoaks: 1,
      soapsEarned: 0,
    });
    expect(line).not.toContain('spa pass');
  });
});

describe('persistence', () => {
  it('punchesLeft survives a serialize+apply round trip', () => {
    const a = fakeGame();
    a.world.player.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    redeemSpaPass(a.world.player);
    // Spend one to verify a non-trivial state.
    getSpaPass(a.world.player).punchesLeft -= 1;
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getSpaPass(b.world.player).punchesLeft).toBe(0);
    applySnapshot(b, snap);
    expect(getSpaPass(b.world.player).punchesLeft).toBe(SPA_PASS_PUNCHES - 1);
  });
});
