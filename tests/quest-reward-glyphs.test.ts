// Quest-log reward-glyph pips — questRewardGlyphs() derives the ordered
// pip kinds (coin / crate / star) for a reward, one per segment formatReward
// emits and in the SAME order, so the panel can scan the reward line like
// the bag instead of reading every "+50g, +3 tomato" string.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  questRewardGlyphs,
  buildQuestLog,
  formatReward,
  type RewardGlyphKind,
} from '../src/game/quest-log';
import { startingQuests, type QuestReward } from '../src/game/quests';

describe('questRewardGlyphs', () => {
  it('gives a single coin pip for a gold-only reward', () => {
    expect(questRewardGlyphs({ gold: 10 })).toEqual<RewardGlyphKind[]>(['gold']);
  });

  it('gives gold then one crate per item, in that order', () => {
    expect(questRewardGlyphs({ gold: 50, items: { tomato: 3 } })).toEqual<RewardGlyphKind[]>([
      'gold',
      'item',
    ]);
    // Two distinct item entries -> two crate pips after the coin.
    expect(
      questRewardGlyphs({ gold: 320, items: { pumpkin: 2, flower: 5 } }),
    ).toEqual<RewardGlyphKind[]>(['gold', 'item', 'item']);
  });

  it('gives a star pip for a cosmetic, after gold', () => {
    expect(questRewardGlyphs({ gold: 100, cosmetic: 'sunhat' })).toEqual<RewardGlyphKind[]>([
      'gold',
      'cosmetic',
    ]);
  });

  it('orders gold, items, then cosmetic for a full reward', () => {
    expect(
      questRewardGlyphs({ gold: 5, items: { wheat: 1, flower: 2 }, cosmetic: 'hat' }),
    ).toEqual<RewardGlyphKind[]>(['gold', 'item', 'item', 'cosmetic']);
  });

  it('yields no pips for an empty reward', () => {
    expect(questRewardGlyphs({})).toEqual([]);
  });

  it('skips a zero gold amount (no coin for +0g)', () => {
    // formatReward treats 0 gold as absent (falsy), so the pip must too.
    expect(questRewardGlyphs({ gold: 0, items: { wheat: 1 } })).toEqual<RewardGlyphKind[]>([
      'item',
    ]);
  });

  it('emits exactly one pip per comma-segment formatReward produces', () => {
    // The pip count must match the number of segments the player reads, so
    // the two never drift. formatReward joins segments with ", " (and uses
    // an em-dash for the empty reward, which is zero segments).
    const rewards: QuestReward[] = [
      { gold: 10 },
      { gold: 50, items: { tomato: 3 } },
      { gold: 100, cosmetic: 'sunhat' },
      { gold: 640, items: { bouquet: 1, pumpkin: 3 } },
      {},
    ];
    for (const r of rewards) {
      const line = formatReward(r);
      const segments = line === '—' ? 0 : line.split(', ').length;
      expect(questRewardGlyphs(r)).toHaveLength(segments);
    }
  });

  it('threads glyph kinds onto every built quest-log row', () => {
    const w = new World();
    w.player.quests = startingQuests();
    const rows = buildQuestLog(w.player);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // Every starting quest pays gold, so each row leads with a coin pip
      // and the pip count matches its own reward shape.
      expect(row.rewardGlyphs[0]).toBe('gold');
      expect(row.rewardGlyphs.every((g) => ['gold', 'item', 'cosmetic'].includes(g))).toBe(true);
    }
  });
});
