// Bath house tests — fee deduction, buff duration, expiry, idempotency.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BATH_BONUS,
  BATH_DURATION_DAYS,
  BATH_FEE,
  BATH_X,
  BATH_Y,
  bathActive,
  bathDaysLeft,
  bathFlavorLine,
  getBath,
  maybeExpireBath,
  nearBath,
  takeBath,
} from '../src/game/bath-house';
import { MAX_STAMINA, getStamina, setStamina } from '../src/game/stamina';

function freshWorld(): World {
  const w = new World();
  w.player.gold = 1000;
  return w;
}

describe('nearBath', () => {
  it('is true on the bath tile + its neighbours', () => {
    expect(nearBath(BATH_X, BATH_Y)).toBe(true);
    expect(nearBath(BATH_X + 1, BATH_Y)).toBe(true);
    expect(nearBath(BATH_X - 1, BATH_Y + 1)).toBe(true);
  });

  it('is false more than one tile away', () => {
    expect(nearBath(BATH_X + 3, BATH_Y)).toBe(false);
    expect(nearBath(BATH_X, BATH_Y + 4)).toBe(false);
  });
});

describe('takeBath', () => {
  it('refuses when too far from the bath', () => {
    const w = freshWorld();
    const out = takeBath(w.player, 1, 1, 1);
    expect(out.kind).toBe('too-far');
    expect(w.player.gold).toBe(1000);
  });

  it('refuses with not-enough-gold when the player is broke', () => {
    const w = freshWorld();
    w.player.gold = 10;
    const out = takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(out.kind).toBe('not-enough-gold');
    if (out.kind === 'not-enough-gold') {
      expect(out.need).toBe(BATH_FEE);
      expect(out.have).toBe(10);
    }
    expect(w.player.gold).toBe(10); // untouched on failure
  });

  it('spends BATH_FEE gold and arms the buff', () => {
    const w = freshWorld();
    const out = takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(out.kind).toBe('soaked');
    expect(w.player.gold).toBe(1000 - BATH_FEE);
    expect(bathActive(w.player, 1)).toBe(true);
    expect(getStamina(w.player).max).toBe(MAX_STAMINA + BATH_BONUS);
  });

  it('immediately tops the stamina pool by the bonus', () => {
    const w = freshWorld();
    setStamina(w.player, 50);
    takeBath(w.player, BATH_X, BATH_Y, 1);
    // Pool jumped by BATH_BONUS but never above the new cap.
    expect(getStamina(w.player).current).toBe(50 + BATH_BONUS);
  });

  it('caps the pool at the new max (no overflow)', () => {
    const w = freshWorld();
    setStamina(w.player, MAX_STAMINA);
    takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(getStamina(w.player).current).toBe(MAX_STAMINA + BATH_BONUS);
  });

  it('refuses with already-active when the buff is still running', () => {
    const w = freshWorld();
    takeBath(w.player, BATH_X, BATH_Y, 1);
    const out = takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(out.kind).toBe('already-active');
    // Gold only spent once.
    expect(w.player.gold).toBe(1000 - BATH_FEE);
  });
});

describe('buff duration', () => {
  it('lasts BATH_DURATION_DAYS days', () => {
    const w = freshWorld();
    takeBath(w.player, BATH_X, BATH_Y, 1);
    for (let d = 1; d <= BATH_DURATION_DAYS; d++) {
      expect(bathActive(w.player, d)).toBe(true);
    }
    expect(bathActive(w.player, BATH_DURATION_DAYS + 1)).toBe(false);
  });

  it('bathDaysLeft counts down day by day', () => {
    const w = freshWorld();
    takeBath(w.player, BATH_X, BATH_Y, 5);
    expect(bathDaysLeft(w.player, 5)).toBe(BATH_DURATION_DAYS);
    expect(bathDaysLeft(w.player, 5 + BATH_DURATION_DAYS - 1)).toBe(1);
    expect(bathDaysLeft(w.player, 5 + BATH_DURATION_DAYS)).toBe(-1);
  });
});

describe('maybeExpireBath', () => {
  it('returns false when no buff is active', () => {
    const w = freshWorld();
    expect(maybeExpireBath(w.player, 1)).toBe(false);
  });

  it('returns false while the buff is still running', () => {
    const w = freshWorld();
    takeBath(w.player, BATH_X, BATH_Y, 1);
    expect(maybeExpireBath(w.player, 1)).toBe(false);
    expect(getStamina(w.player).max).toBe(MAX_STAMINA + BATH_BONUS);
  });

  it('drops the stamina cap back to MAX_STAMINA when the buff lapses', () => {
    const w = freshWorld();
    takeBath(w.player, BATH_X, BATH_Y, 1);
    const expiredOnDay = 1 + BATH_DURATION_DAYS;
    expect(maybeExpireBath(w.player, expiredOnDay)).toBe(true);
    expect(getStamina(w.player).max).toBe(MAX_STAMINA);
    // Subsequent call is a no-op.
    expect(maybeExpireBath(w.player, expiredOnDay + 1)).toBe(false);
  });

  it('caps the current pool to the new max after expiry', () => {
    const w = freshWorld();
    takeBath(w.player, BATH_X, BATH_Y, 1);
    setStamina(w.player, MAX_STAMINA + BATH_BONUS);
    maybeExpireBath(w.player, 1 + BATH_DURATION_DAYS);
    expect(getStamina(w.player).current).toBeLessThanOrEqual(MAX_STAMINA);
  });
});

describe('bathFlavorLine', () => {
  it('reads naturally with pluralisation', () => {
    const line = bathFlavorLine({
      kind: 'soaked',
      remainingGold: 800,
      daysLeft: BATH_DURATION_DAYS,
      bonus: BATH_BONUS,
      pricePaid: BATH_FEE,
      discounted: false,
      paidWithPass: false,
      passesLeft: 0,
      totalSoaks: 1,
      soapsEarned: 0,
    });
    expect(line).toMatch(/Soaked/);
    expect(line).toMatch(new RegExp(`${BATH_BONUS}`));
    expect(line).toMatch(new RegExp(`${BATH_DURATION_DAYS} days?`));
  });
});

describe('getBath default', () => {
  it('lazy-inits to expiresOnDay -1', () => {
    const w = freshWorld();
    expect(getBath(w.player).expiresOnDay).toBe(-1);
  });
});
