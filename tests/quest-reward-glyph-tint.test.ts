// Quest reward-glyph kind tints — rewardGlyphColor() tints each pip by its
// KIND (coin gold / crate green / star violet, the toast-rail palette) while
// the quest is active, so the reward TYPE scans by hue; a completed quest
// drops every pip to one dim tint so the earned reward recedes.

import { describe, it, expect } from 'vitest';
import {
  rewardGlyphColor,
  REWARD_GLYPH_COLOR,
  REWARD_GLYPH_DONE_COLOR,
  questRewardGlyphs,
  type RewardGlyphKind,
} from '../src/game/quest-log';

describe('rewardGlyphColor', () => {
  it('tints an active pip by its kind hue', () => {
    expect(rewardGlyphColor('gold', false)).toBe(REWARD_GLYPH_COLOR.gold);
    expect(rewardGlyphColor('item', false)).toBe(REWARD_GLYPH_COLOR.item);
    expect(rewardGlyphColor('cosmetic', false)).toBe(REWARD_GLYPH_COLOR.cosmetic);
  });

  it('drops every kind to one dim tint once the quest is done', () => {
    const kinds: RewardGlyphKind[] = ['gold', 'item', 'cosmetic'];
    for (const k of kinds) {
      expect(rewardGlyphColor(k, true)).toBe(REWARD_GLYPH_DONE_COLOR);
    }
  });

  it('uses three DISTINCT kind hues so the reward type is readable', () => {
    const hues = new Set([
      REWARD_GLYPH_COLOR.gold,
      REWARD_GLYPH_COLOR.item,
      REWARD_GLYPH_COLOR.cosmetic,
    ]);
    expect(hues.size).toBe(3);
  });

  it('the done tint differs from every active kind hue', () => {
    // A completed reward must read as muted, not as any live kind colour.
    expect(REWARD_GLYPH_DONE_COLOR).not.toBe(REWARD_GLYPH_COLOR.gold);
    expect(REWARD_GLYPH_DONE_COLOR).not.toBe(REWARD_GLYPH_COLOR.item);
    expect(REWARD_GLYPH_DONE_COLOR).not.toBe(REWARD_GLYPH_COLOR.cosmetic);
  });

  it('covers exactly the kinds questRewardGlyphs can emit', () => {
    // Every kind the resolver yields must have a palette entry, so a pip can
    // never fall through to an undefined colour.
    const emitted = new Set(
      questRewardGlyphs({ gold: 5, items: { wheat: 1, flower: 2 }, cosmetic: 'hat' }),
    );
    for (const kind of emitted) {
      expect(REWARD_GLYPH_COLOR[kind]).toBeDefined();
      expect(typeof rewardGlyphColor(kind, false)).toBe('string');
    }
  });
});
