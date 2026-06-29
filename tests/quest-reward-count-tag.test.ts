// Quest-log reward-pip count tag — rewardGlyphCountTag() emits a small "xN"
// for a busy reward cluster (3+ stacked pips) so a player reads how many
// payouts a quest gives without tallying pips, staying quiet for the common
// 1-2 pip rewards. Must agree with questRewardGlyphs' length.

import { describe, it, expect } from 'vitest';
import { rewardGlyphCountTag, questRewardGlyphs } from '../src/game/quest-log';

describe('rewardGlyphCountTag', () => {
  it('is empty for 0-2 pips (trivially countable)', () => {
    expect(rewardGlyphCountTag([])).toBe('');
    expect(rewardGlyphCountTag(['gold'])).toBe('');
    expect(rewardGlyphCountTag(['gold', 'item'])).toBe('');
  });

  it('tags a busy 3+ pip cluster with its count', () => {
    expect(rewardGlyphCountTag(['gold', 'item', 'cosmetic'])).toBe('x3');
    expect(rewardGlyphCountTag(['gold', 'item', 'item', 'cosmetic'])).toBe('x4');
  });

  it('matches questRewardGlyphs length for a multi-item reward', () => {
    // gold + two item types + a cosmetic = 4 pips -> x4.
    const glyphs = questRewardGlyphs({ gold: 50, items: { tomato: 3, flower: 2 }, cosmetic: 'hat' });
    expect(glyphs.length).toBe(4);
    expect(rewardGlyphCountTag(glyphs)).toBe('x4');
  });

  it('stays quiet for a plain single-gold reward', () => {
    const glyphs = questRewardGlyphs({ gold: 10 });
    expect(rewardGlyphCountTag(glyphs)).toBe('');
  });
});
