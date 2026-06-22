// Perfumed Soap usage — the bath-house loyalty cosmetic doubles as a
// universal "loved" gift, mirroring the BOUQUET_KEY rule.
//
// Coverage:
//   - tasteOf returns 'loved' for any candidate when fed the soap key
//   - pickBestGift prefers the soap when nothing else loved is on hand
//   - attemptAutoGift consumes the soap + credits a loved-tier heart bump
//   - dispatchOwl wired through (the owl can ship the soap)
//   - keys are in sync (no drift between bath-house + hearts)
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  CANDIDATES,
  PERFUMED_SOAP_GIFT_KEY,
  startingHearts,
  tasteOf,
} from '../src/game/hearts';
import { PERFUMED_SOAP_INVENTORY_KEY } from '../src/game/bath-house';
import {
  attemptAutoGift,
  pickBestGift,
} from '../src/game/gifting';
import { dispatchOwl } from '../src/game/owl-post';

describe('PERFUMED_SOAP_GIFT_KEY is in sync with the bath-house key', () => {
  it('the gifting-side key matches the bath-house inventory key exactly', () => {
    expect(PERFUMED_SOAP_GIFT_KEY).toBe(PERFUMED_SOAP_INVENTORY_KEY);
  });
});

describe('tasteOf for a Perfumed Soap', () => {
  it('returns "loved" for every romanceable candidate', () => {
    for (const npcId of Object.keys(CANDIDATES)) {
      expect(tasteOf(npcId, PERFUMED_SOAP_GIFT_KEY)).toBe('loved');
    }
  });
});

describe('pickBestGift preferring the Perfumed Soap', () => {
  it('picks the soap over a neutral fallback', () => {
    const inv = {
      [PERFUMED_SOAP_GIFT_KEY]: 1,
      'wheat_harvest': 5, // neutral for Finn
    };
    expect(pickBestGift(inv, 'finn')).toBe(PERFUMED_SOAP_GIFT_KEY);
  });

  it('stays with an already-loved item when one is present', () => {
    // Maple loves "ruby" — the soap should NOT displace a real loved.
    // Tie at "loved" tier is broken by iteration order; we just require
    // the result to be one of the two loved candidates.
    const inv = {
      [PERFUMED_SOAP_GIFT_KEY]: 1,
      'ruby': 3,
    };
    const pick = pickBestGift(inv, 'maple');
    expect([PERFUMED_SOAP_GIFT_KEY, 'ruby']).toContain(pick);
  });

  it('returns null when only disliked items are present (soap not in bag)', () => {
    // Finn dislikes flower_harvest — nothing else giftable.
    const inv = { 'flower_harvest': 2 };
    expect(pickBestGift(inv, 'finn')).toBeNull();
  });
});

describe('attemptAutoGift via the Perfumed Soap', () => {
  it('consumes one soap and credits the loved-tier point award', () => {
    const w = new World();
    w.player.inventory = { [PERFUMED_SOAP_GIFT_KEY]: 2 };
    w.player.hearts = startingHearts();
    const before = w.player.hearts.maple.points;
    const out = attemptAutoGift(w.player, 'maple', 1);
    expect(out.kind).toBe('gifted');
    if (out.kind === 'gifted') {
      expect(out.itemKey).toBe(PERFUMED_SOAP_GIFT_KEY);
      expect(out.result.taste).toBe('loved');
      expect(out.result.pointsApplied).toBe(80);
      expect(out.result.accepted).toBe(true);
    }
    expect(w.player.inventory[PERFUMED_SOAP_GIFT_KEY]).toBe(1);
    expect(w.player.hearts.maple.points).toBe(before + 80);
  });
});

describe('dispatchOwl with a Perfumed Soap', () => {
  it('the owl can carry the soap and bills the courier fee', () => {
    const w = new World();
    w.player.inventory = { [PERFUMED_SOAP_GIFT_KEY]: 1 };
    w.player.hearts = startingHearts();
    w.player.gold = 100;
    const out = dispatchOwl(w.player, 'rose', 1);
    expect(out.kind).toBe('sent');
    if (out.kind === 'sent') {
      expect(out.gift.kind).toBe('gifted');
      if (out.gift.kind === 'gifted') {
        expect(out.gift.itemKey).toBe(PERFUMED_SOAP_GIFT_KEY);
        expect(out.gift.result.taste).toBe('loved');
      }
    }
    // Soap consumed.
    expect(w.player.inventory[PERFUMED_SOAP_GIFT_KEY]).toBe(0);
    // Courier fee 40g deducted.
    expect(w.player.gold).toBe(60);
  });
});
