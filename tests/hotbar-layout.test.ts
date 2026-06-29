// Hotbar layout — the bottom action-bar geometry now honours the HUD scale.
// The key invariant is back-compat: at scale 1.0 the helper reproduces the
// historical fixed values exactly (slot 48, gap 6, font 11, bottom margin
// 12 -> y = canvasH - 60, centred strip) so the default HUD is unchanged;
// above 1.0 the slots + sprites + fonts grow together.

import { describe, it, expect } from 'vitest';
import {
  hotbarLayout,
  clampHotbarScale,
  HOTBAR_BASE_SLOT,
  HOTBAR_BASE_GAP,
  HOTBAR_BASE_FONT_PX,
  HOTBAR_SPRITE_BASE_SLOT,
} from '../src/game/hotbar-layout';
import { CROP_KEYS } from '../src/game/crops';

const W = 1280;
const H = 720;
const SLOTS = 5; // 4 crop slots (CROP_KEYS) + the watering can

describe('slot-count assumption', () => {
  it('matches the real hotbar (CROP_KEYS + the watering can)', () => {
    expect(SLOTS).toBe(CROP_KEYS.length + 1);
  });
});

describe('clampHotbarScale', () => {
  it('passes legal scales through, clamps the rest to 1..2', () => {
    expect(clampHotbarScale(1.0)).toBe(1.0);
    expect(clampHotbarScale(1.25)).toBe(1.25);
    expect(clampHotbarScale(0)).toBe(1);
    expect(clampHotbarScale(9)).toBe(2);
  });
});

describe('hotbarLayout — back-compat at 1.0x', () => {
  const L = hotbarLayout(1.0, SLOTS, W, H);

  it('reproduces the historical slot + gap + font (48 / 6 / 11)', () => {
    expect(L.slotSize).toBe(HOTBAR_BASE_SLOT);
    expect(L.gap).toBe(HOTBAR_BASE_GAP);
    expect(L.fontPx).toBe(HOTBAR_BASE_FONT_PX);
  });

  it('reproduces the historical bottom Y (canvasH - slot - 12)', () => {
    expect(L.y).toBe(H - HOTBAR_BASE_SLOT - 12);
  });

  it('centres the strip the same way the old code did', () => {
    const totalW = SLOTS * HOTBAR_BASE_SLOT + (SLOTS - 1) * HOTBAR_BASE_GAP;
    expect(L.totalW).toBe(totalW);
    expect(L.startX).toBe(Math.floor((W - totalW) / 2));
  });

  it('draws sprites at native size (spriteScale == 1)', () => {
    expect(L.spriteScale).toBe(1);
  });
});

describe('hotbarLayout — scaling up', () => {
  it('grows slot, gap, and font with the scale', () => {
    const L = hotbarLayout(1.5, SLOTS, W, H);
    expect(L.slotSize).toBe(Math.round(HOTBAR_BASE_SLOT * 1.5));
    expect(L.gap).toBe(Math.round(HOTBAR_BASE_GAP * 1.5));
    expect(L.fontPx).toBe(Math.round(HOTBAR_BASE_FONT_PX * 1.5));
  });

  it('scales the sprites to fill the bigger slot', () => {
    const L = hotbarLayout(1.5, SLOTS, W, H);
    expect(L.spriteScale).toBeCloseTo(L.slotSize / HOTBAR_SPRITE_BASE_SLOT, 5);
    expect(L.spriteScale).toBeGreaterThan(1);
  });

  it('keeps the strip centred + on-screen at every legal scale', () => {
    for (const scale of [1.0, 1.25, 1.5, 2.0]) {
      const L = hotbarLayout(scale, SLOTS, W, H);
      // Centred: equal margin on both sides (within a pixel of rounding).
      expect(L.startX).toBe(Math.floor((W - L.totalW) / 2));
      // The whole strip stays above the canvas bottom.
      expect(L.y + L.slotSize).toBeLessThanOrEqual(H);
      expect(L.startX).toBeGreaterThanOrEqual(0);
    }
  });

  it('lifts the bar higher off the bottom as the slot grows', () => {
    const base = hotbarLayout(1.0, SLOTS, W, H).y;
    const big = hotbarLayout(2.0, SLOTS, W, H).y;
    expect(big).toBeLessThan(base);
  });

  it('reports the clamped scale it used', () => {
    expect(hotbarLayout(1.25, SLOTS, W, H).scale).toBe(1.25);
    expect(hotbarLayout(9, SLOTS, W, H).scale).toBe(2);
  });
});
