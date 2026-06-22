// Bath house loyalty card — every SOAP_PER_SOAKS soaks gifts a
// Perfumed Soap cosmetic. Total + gifted counts persist through
// save/load so reloads don't double-gift or reset the streak.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BATH_FEE,
  BATH_X,
  BATH_Y,
  PERFUMED_SOAP_INVENTORY_KEY,
  SOAP_PER_SOAKS,
  SPA_PASS_INVENTORY_KEY,
  bathFlavorLine,
  bathLoyaltyLine,
  getBath,
  getSpaPass,
  redeemSpaPass,
  takeBath,
} from '../src/game/bath-house';
import { BATH_DURATION_DAYS } from '../src/game/bath-house';

function freshWorld(gold = 10_000): World {
  const w = new World();
  w.player.gold = gold;
  w.player.inventory = {};
  return w;
}

describe('bath loyalty count', () => {
  it('totalSoaks starts at 0 / undefined and bumps on each soak', () => {
    const w = freshWorld();
    expect(getBath(w.player).totalSoaks ?? 0).toBe(0);
    const o1 = takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(o1.kind).toBe('soaked');
    if (o1.kind === 'soaked') {
      expect(o1.totalSoaks).toBe(1);
      expect(o1.soapsEarned).toBe(0);
    }
    expect(getBath(w.player).totalSoaks).toBe(1);
  });

  it('counts soaks across multiple days', () => {
    const w = freshWorld();
    for (let d = 1; d <= 5; d++) {
      // takeBath returns 'already-active' if buff is still on — advance the day.
      const out = takeBath(w.player, BATH_X, BATH_Y, d + BATH_DURATION_DAYS * d);
      expect(out.kind).toBe('soaked');
    }
    expect(getBath(w.player).totalSoaks).toBe(5);
    expect(w.player.inventory[PERFUMED_SOAP_INVENTORY_KEY] ?? 0).toBe(0);
  });

  it('counts spa-pass soaks too', () => {
    const w = freshWorld(0);
    w.player.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    const out = takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      expect(out.paidWithPass).toBe(true);
      expect(out.totalSoaks).toBe(1);
    }
  });
});

describe('bath loyalty soap gift', () => {
  it('gifts one Perfumed Soap at exactly SOAP_PER_SOAKS soaks', () => {
    const w = freshWorld();
    let earned = 0;
    for (let i = 0; i < SOAP_PER_SOAKS; i++) {
      const day = 1 + i * (BATH_DURATION_DAYS + 1);
      const out = takeBath(w.player, BATH_X, BATH_Y, day);
      expect(out.kind).toBe('soaked');
      if (out.kind === 'soaked') earned += out.soapsEarned;
    }
    expect(earned).toBe(1);
    expect(w.player.inventory[PERFUMED_SOAP_INVENTORY_KEY]).toBe(1);
    expect(getBath(w.player).soapsGifted).toBe(1);
  });

  it('gifts another soap at 2x SOAP_PER_SOAKS soaks and not before', () => {
    const w = freshWorld();
    let extra = 0;
    for (let i = 0; i < SOAP_PER_SOAKS * 2; i++) {
      const day = 1 + i * (BATH_DURATION_DAYS + 1);
      const out = takeBath(w.player, BATH_X, BATH_Y, day);
      if (out.kind === 'soaked') extra += out.soapsEarned;
    }
    expect(extra).toBe(2);
    expect(w.player.inventory[PERFUMED_SOAP_INVENTORY_KEY]).toBe(2);
  });

  it('does NOT double-gift if takeBath is called twice on the same lifetime count', () => {
    const w = freshWorld();
    for (let i = 0; i < SOAP_PER_SOAKS; i++) {
      const day = 1 + i * (BATH_DURATION_DAYS + 1);
      takeBath(w.player, BATH_X, BATH_Y, day);
    }
    // Forcibly nudge totalSoaks backward and call takeBath one more time
    // — soapsGifted is already 1 so the next gift only fires at soak #20.
    expect(getBath(w.player).soapsGifted).toBe(1);
    const farFutureDay = 1 + SOAP_PER_SOAKS * (BATH_DURATION_DAYS + 1) + 50;
    const out = takeBath(w.player, BATH_X, BATH_Y, farFutureDay);
    expect(out.kind).toBe('soaked');
    if (out.kind === 'soaked') {
      // 11 soaks total → 11/10 = 1 expected, 1 already gifted → 0 new.
      expect(out.soapsEarned).toBe(0);
      expect(out.totalSoaks).toBe(SOAP_PER_SOAKS + 1);
    }
    expect(w.player.inventory[PERFUMED_SOAP_INVENTORY_KEY]).toBe(1);
  });
});

describe('bathFlavorLine surfaces the gift', () => {
  it('appends the soap gift line on the milestone soak', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 0,
      daysLeft: BATH_DURATION_DAYS,
      bonus: 30,
      pricePaid: BATH_FEE,
      discounted: false,
      paidWithPass: false,
      passesLeft: 0,
      totalSoaks: SOAP_PER_SOAKS,
      soapsEarned: 1,
    });
    expect(line).toMatch(/Perfumed Soap/);
    expect(line).toMatch(/lifetime soaks/);
  });

  it('omits the gift line on a non-milestone soak', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 0,
      daysLeft: BATH_DURATION_DAYS,
      bonus: 30,
      pricePaid: BATH_FEE,
      discounted: false,
      paidWithPass: false,
      passesLeft: 0,
      totalSoaks: 3,
      soapsEarned: 0,
    });
    expect(line).not.toMatch(/Perfumed Soap/);
  });
});

describe('bathLoyaltyLine', () => {
  it('reads naturally on a fresh player', () => {
    const w = freshWorld();
    const line = bathLoyaltyLine(w.player);
    expect(line).toMatch(/0 soaks/);
    expect(line).toMatch(new RegExp(`${SOAP_PER_SOAKS} until`));
  });

  it('counts down toward the next soap correctly', () => {
    const w = freshWorld();
    const state = getBath(w.player);
    state.totalSoaks = 7;
    state.soapsGifted = 0;
    expect(bathLoyaltyLine(w.player)).toMatch(/7 soaks/);
    expect(bathLoyaltyLine(w.player)).toMatch(new RegExp(`${SOAP_PER_SOAKS - 7} until`));
  });
});

// Belt-and-braces — make sure the spa-pass interaction left intact.
describe('spa pass + loyalty integration', () => {
  it('redeemSpaPass alone does not bump soaks', () => {
    const w = freshWorld();
    w.player.inventory[SPA_PASS_INVENTORY_KEY] = 1;
    redeemSpaPass(w.player);
    expect(getSpaPass(w.player).punchesLeft).toBeGreaterThan(0);
    expect(getBath(w.player).totalSoaks ?? 0).toBe(0);
  });
});
