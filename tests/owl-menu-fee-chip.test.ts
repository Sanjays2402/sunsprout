// Owl-menu per-NPC fee chip — surfaces the tier-discounted price on
// each row of the owl menu so the player can SEE the discount before
// pressing Enter. Closes a UX gap: until this slice the tier discount
// was invisible until the post-dispatch toast. owlPostFeeChip() is a
// pure helper so the menu UI doesn't have to know about the tier math.

import { describe, it, expect } from 'vitest';
import {
  OWL_FLUENCY_TIERS,
  OWL_POST_FEE,
  OWL_POST_TIER_DISCOUNT_PCT,
  owlPostFeeChip,
  owlPostFeeFor,
  recordOwlStamp,
} from '../src/game/owl-post';

describe('owlPostFeeChip — no-discount baseline', () => {
  it('returns just "Ng" when player has no stamps to this NPC', () => {
    const p = {} as object;
    expect(owlPostFeeChip(p, 'maple')).toBe(`${OWL_POST_FEE}g`);
  });

  it('still returns just "Ng" one stamp under the first tier', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min - 1; i++) {
      recordOwlStamp(p, 'maple');
    }
    expect(owlPostFeeChip(p, 'maple')).toBe(`${OWL_POST_FEE}g`);
  });

  it('has NO discount tag in the base chip', () => {
    const p = {} as object;
    const chip = owlPostFeeChip(p, 'maple');
    expect(chip).not.toContain('-');
    expect(chip).not.toContain('occasional');
    expect(chip).not.toContain('regular');
    expect(chip).not.toContain('favorite');
  });
});

describe('owlPostFeeChip — discounted tiers', () => {
  it('shows discounted price + savings + short tier name at the first tier floor', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) {
      recordOwlStamp(p, 'maple');
    }
    const chip = owlPostFeeChip(p, 'maple');
    const expectedFee = owlPostFeeFor(p, 'maple');
    const expectedSavings = OWL_POST_FEE - expectedFee;
    expect(chip).toContain(`${expectedFee}g`);
    expect(chip).toContain(`-${expectedSavings}g`);
    expect(chip).toContain('occasional');
  });

  it('uses the SHORT tier label (no "pen pal" / "courier" suffix)', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) {
      recordOwlStamp(p, 'maple');
    }
    const chip = owlPostFeeChip(p, 'maple');
    // Full tier label is "occasional pen pal" — chip should NOT include
    // the "pen pal" suffix.
    expect(chip).not.toContain('pen pal');
    expect(chip).not.toContain('courier');
  });

  it('promotes the short label through every tier as stamps climb', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[1].min; i++) {
      recordOwlStamp(p, 'maple');
    }
    expect(owlPostFeeChip(p, 'maple')).toContain('regular');
    for (let i = OWL_FLUENCY_TIERS[1].min; i < OWL_FLUENCY_TIERS[2].min; i++) {
      recordOwlStamp(p, 'maple');
    }
    expect(owlPostFeeChip(p, 'maple')).toContain('favorite');
  });

  it('savings amount matches the fee math for every tier', () => {
    for (const tier of OWL_FLUENCY_TIERS) {
      const p = {} as object;
      for (let i = 0; i < tier.min; i++) recordOwlStamp(p, 'maple');
      const expectedFee = owlPostFeeFor(p, 'maple');
      const expectedSavings = OWL_POST_FEE - expectedFee;
      const chip = owlPostFeeChip(p, 'maple');
      expect(chip).toContain(`${expectedFee}g`);
      expect(chip).toContain(`-${expectedSavings}g`);
    }
  });

  it('per-NPC isolation — pumping stamps to NPC A leaves NPC B at the base chip', () => {
    const p = {} as object;
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min; i++) {
      recordOwlStamp(p, 'maple');
    }
    expect(owlPostFeeChip(p, 'maple')).toContain('favorite');
    expect(owlPostFeeChip(p, 'pip')).toBe(`${OWL_POST_FEE}g`);
  });
});

describe('owlPostFeeChip — tuning sanity', () => {
  it('every discount tier in OWL_POST_TIER_DISCOUNT_PCT produces a discounted chip', () => {
    for (const tier of OWL_FLUENCY_TIERS) {
      const p = {} as object;
      for (let i = 0; i < tier.min; i++) recordOwlStamp(p, 'maple');
      const chip = owlPostFeeChip(p, 'maple');
      // Sanity: tier must actually be in the discount table.
      expect(OWL_POST_TIER_DISCOUNT_PCT[tier.label]).toBeGreaterThan(0);
      // Chip must surface the savings.
      expect(chip).toContain('-');
    }
  });

  it('chip stays compact (under 30 chars) for every tier so the menu row has room', () => {
    for (const tier of OWL_FLUENCY_TIERS) {
      const p = {} as object;
      for (let i = 0; i < tier.min; i++) recordOwlStamp(p, 'maple');
      const chip = owlPostFeeChip(p, 'maple');
      expect(chip.length).toBeLessThan(30);
    }
  });
});
