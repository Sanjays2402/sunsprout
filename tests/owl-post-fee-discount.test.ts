// Owl-post tier discount — the per-NPC fluency tier from
// owl-fluency-tiers feeds a real fee discount inside dispatchOwl.
// A favorite-courier path costs 28g instead of the base 40g
// (-30%), regulars pay 32g (-20%), occasionals pay 36g (-10%).
// Tier 0 / no stamps pay the full 40g. Failed dispatches (wrong
// id, no items, already-today) NEVER charge — the gold check
// uses the same tier-aware fee so an under-fee player gets an
// honest `need` on the outcome.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  OWL_FLUENCY_TIERS,
  OWL_POST_FEE,
  OWL_POST_TIER_DISCOUNT_PCT,
  dispatchOwl,
  owlPostFeeFor,
  recordOwlStamp,
} from '../src/game/owl-post';
import { CANDIDATES } from '../src/game/hearts';

function pickCandidate(): string {
  return Object.keys(CANDIDATES)[0];
}

function ownerWithGiftAndGold(): { player: World['player']; npcId: string } {
  const w = new World();
  const p = w.player;
  p.inventory = {};
  p.gold = OWL_POST_FEE * 50;
  const npcId = pickCandidate();
  const def = CANDIDATES[npcId];
  for (const key of def.loved) p.inventory[key] = 50;
  p.hearts = { [npcId]: { points: 0, lastGiftDay: -1, lastTalkDay: -1 } };
  return { player: p, npcId };
}

describe('OWL_POST_TIER_DISCOUNT_PCT — table sanity', () => {
  it('has an entry for every fluency tier label', () => {
    for (const tier of OWL_FLUENCY_TIERS) {
      expect(OWL_POST_TIER_DISCOUNT_PCT[tier.label]).toBeGreaterThan(0);
    }
  });

  it('discounts increase as tiers climb', () => {
    const occasional = OWL_POST_TIER_DISCOUNT_PCT['occasional pen pal'];
    const regular = OWL_POST_TIER_DISCOUNT_PCT['regular pen pal'];
    const favorite = OWL_POST_TIER_DISCOUNT_PCT['favorite courier'];
    expect(regular).toBeGreaterThan(occasional);
    expect(favorite).toBeGreaterThan(regular);
  });

  it('top discount is modest (favorite still pays >= 70% of base)', () => {
    const favorite = OWL_POST_TIER_DISCOUNT_PCT['favorite courier'];
    expect(favorite).toBeLessThanOrEqual(30);
  });
});

describe('owlPostFeeFor — per-NPC discount math', () => {
  it('returns the base fee when player has no stamps to this npc', () => {
    const p = {} as object;
    expect(owlPostFeeFor(p, 'maple')).toBe(OWL_POST_FEE);
  });

  it('full fee just below the first tier', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min - 1; i++) recordOwlStamp(p, 'maple');
    expect(owlPostFeeFor(p, 'maple')).toBe(OWL_POST_FEE);
  });

  it('applies the occasional discount once the first tier is crossed', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) recordOwlStamp(p, 'maple');
    const expected = Math.max(1, Math.ceil(OWL_POST_FEE * (1 - OWL_POST_TIER_DISCOUNT_PCT['occasional pen pal'] / 100)));
    expect(owlPostFeeFor(p, 'maple')).toBe(expected);
  });

  it('applies the regular discount at the middle tier floor', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[1].min; i++) recordOwlStamp(p, 'maple');
    const expected = Math.max(1, Math.ceil(OWL_POST_FEE * (1 - OWL_POST_TIER_DISCOUNT_PCT['regular pen pal'] / 100)));
    expect(owlPostFeeFor(p, 'maple')).toBe(expected);
  });

  it('applies the favorite-courier discount at the top tier floor', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min; i++) recordOwlStamp(p, 'maple');
    const expected = Math.max(1, Math.ceil(OWL_POST_FEE * (1 - OWL_POST_TIER_DISCOUNT_PCT['favorite courier'] / 100)));
    expect(owlPostFeeFor(p, 'maple')).toBe(expected);
  });

  it('per-NPC isolation — bumping NPC A does not discount NPC B', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min; i++) recordOwlStamp(p, 'maple');
    expect(owlPostFeeFor(p, 'maple')).toBeLessThan(OWL_POST_FEE);
    expect(owlPostFeeFor(p, 'pip')).toBe(OWL_POST_FEE);
  });
});

describe('dispatchOwl uses the tier-discounted fee', () => {
  it('charges the discounted price on a fluent successful send', () => {
    const { player, npcId } = ownerWithGiftAndGold();
    // Pump per-NPC stamps to the favorite tier first.
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min; i++) recordOwlStamp(player, npcId);
    const beforeGold = player.gold;
    const out = dispatchOwl(player, npcId, 5);
    expect(out.kind).toBe('sent');
    const expectedFee = Math.max(1, Math.ceil(OWL_POST_FEE * (1 - OWL_POST_TIER_DISCOUNT_PCT['favorite courier'] / 100)));
    expect(beforeGold - player.gold).toBe(expectedFee);
  });

  it('charges the full price on a brand-new npc', () => {
    const { player, npcId } = ownerWithGiftAndGold();
    const beforeGold = player.gold;
    const out = dispatchOwl(player, npcId, 5);
    expect(out.kind).toBe('sent');
    expect(beforeGold - player.gold).toBe(OWL_POST_FEE);
  });

  it('not-enough-gold path uses the tier-discounted fee in `need`', () => {
    const { player, npcId } = ownerWithGiftAndGold();
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min; i++) recordOwlStamp(player, npcId);
    const expectedFee = Math.max(1, Math.ceil(OWL_POST_FEE * (1 - OWL_POST_TIER_DISCOUNT_PCT['favorite courier'] / 100)));
    player.gold = expectedFee - 1;
    const out = dispatchOwl(player, npcId, 5);
    expect(out.kind).toBe('not-enough-gold');
    if (out.kind === 'not-enough-gold') {
      expect(out.need).toBe(expectedFee);
      expect(out.have).toBe(expectedFee - 1);
    }
  });

  it('crossing into a new tier on the next send applies the tier rate', () => {
    const { player, npcId } = ownerWithGiftAndGold();
    // Pump to one stamp below the first tier so the next successful
    // send promotes the player INTO the occasional tier.
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min - 1; i++) recordOwlStamp(player, npcId);
    const before = player.gold;
    const out = dispatchOwl(player, npcId + '__irrelevant_chain_marker_unused', 5);
    // The send was on a bogus id — gold untouched, confirms isolation.
    expect(out.kind).toBe('not-candidate');
    expect(player.gold).toBe(before);
    // Now run the actual send: still pre-tier (we haven't bumped),
    // so the player pays the full base fee on THIS send.
    const out2 = dispatchOwl(player, npcId, 6);
    expect(out2.kind).toBe('sent');
    expect(before - player.gold).toBe(OWL_POST_FEE);
    // The stamp lands AFTER the deduction — so the NEXT send is the
    // one that pays the discounted rate.
    const before3 = player.gold;
    const out3 = dispatchOwl(player, npcId, 7);
    expect(out3.kind).toBe('sent');
    const expected = Math.max(1, Math.ceil(OWL_POST_FEE * (1 - OWL_POST_TIER_DISCOUNT_PCT['occasional pen pal'] / 100)));
    expect(before3 - player.gold).toBe(expected);
  });
});
