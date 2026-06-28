// Money-log purse extremes caption — purseExtremesCaption() names the
// sparkline's marked peak + low in plain figures so a colour-blind player
// reads the window's best/worst purse moments without resolving the pips.

import { describe, it, expect } from 'vitest';
import {
  logGold,
  purseSparklineExtremes,
  purseExtremesCaption,
} from '../src/game/money-log';
import { World } from '../src/world/world';

describe('purseExtremesCaption', () => {
  it('returns empty string on null (no-span) extremes', () => {
    const w = new World();
    expect(purseExtremesCaption(purseSparklineExtremes(w.player))).toBe('');
    w.player.gold = 50;
    logGold(w.player, 10, 'well: wheat', 1);
    expect(purseExtremesCaption(purseSparklineExtremes(w.player))).toBe('');
  });

  it('names peak + low in plain figures', () => {
    const w = new World();
    // start 100, +50 (=150), -90 (=60), +40 (=100). peak 150, low 60.
    w.player.gold = 100;
    logGold(w.player, 50, 'a', 1);
    logGold(w.player, -90, 'b', 1);
    logGold(w.player, 40, 'c', 1);
    expect(purseExtremesCaption(purseSparklineExtremes(w.player))).toBe('peak 150g / low 60g');
  });

  it('collapses to a single flat figure when peak == low', () => {
    // A perfectly flat window: peak and low coincide. Hand the formatter the
    // extreme shape directly since logGold can't post zero-delta rows.
    expect(
      purseExtremesCaption({
        peak: { x: 1, y: 0.5, value: 80 },
        low: { x: 0, y: 0.5, value: 80 },
      }),
    ).toBe('flat 80g');
  });

  it('agrees with the marked extreme values exactly', () => {
    const w = new World();
    w.player.gold = 200;
    logGold(w.player, 50, 'well: pumpkin', 2);
    logGold(w.player, -120, 'shop: kit', 2);
    logGold(w.player, 30, 'well: flower', 2);
    const ext = purseSparklineExtremes(w.player)!;
    const cap = purseExtremesCaption(ext);
    expect(ext).not.toBeNull();
    expect(cap).toContain(`${ext.peak.value}g`);
    expect(cap).toContain(`${ext.low.value}g`);
  });

  it('never emits emoji', () => {
    const w = new World();
    w.player.gold = 100;
    logGold(w.player, 40, 'well: wheat', 1);
    logGold(w.player, -10, 'shop: seeds', 1);
    expect(purseExtremesCaption(purseSparklineExtremes(w.player))).toMatch(/^[\x00-\x7F]*$/);
  });
});
