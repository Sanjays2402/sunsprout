// HUD layout — right-column stacking geometry for the weather strip,
// sky dial, and almanac chip. The key invariant is back-compat: at
// scale 1.0 the helper must reproduce the historical fixed positions
// exactly (weather y=40, sky-dial y=66, chip y=110) so nothing moves
// for the default HUD; above 1.0 the column cascades under a taller bar.

import { describe, it, expect } from 'vitest';
import {
  rightColumnLayout,
  clampHudScale,
  TOP_BAR_BASE_H,
  WEATHER_STRIP_BASE_H,
  SKY_DIAL_BASE_H,
  SKY_DIAL_BASE_W,
  ALMANAC_CHIP_BASE_H,
} from '../src/game/hud-layout';

describe('clampHudScale', () => {
  it('passes the legal scales through unchanged', () => {
    expect(clampHudScale(1.0)).toBe(1.0);
    expect(clampHudScale(1.25)).toBe(1.25);
    expect(clampHudScale(1.5)).toBe(1.5);
  });

  it('clamps below 1 up to 1 and above 2 down to 2', () => {
    expect(clampHudScale(0)).toBe(1);
    expect(clampHudScale(-5)).toBe(1);
    expect(clampHudScale(3)).toBe(2);
  });
});

describe('rightColumnLayout — back-compat at 1.0x', () => {
  const L = rightColumnLayout(1.0);

  it('reproduces the historical weather strip slot (y=40, h=22)', () => {
    expect(L.weatherStrip.y).toBe(40);
    expect(L.weatherStrip.height).toBe(WEATHER_STRIP_BASE_H);
  });

  it('reproduces the historical sky dial slot (y=66, h=40, w=132)', () => {
    expect(L.skyDial.y).toBe(66);
    expect(L.skyDial.height).toBe(SKY_DIAL_BASE_H);
    expect(L.skyDial.width).toBe(SKY_DIAL_BASE_W);
  });

  it('reproduces the historical almanac chip slot (y=110, h=20)', () => {
    expect(L.almanacChip.y).toBe(110);
    expect(L.almanacChip.height).toBe(ALMANAC_CHIP_BASE_H);
  });

  it('reports the clamped scale it used', () => {
    expect(L.scale).toBe(1.0);
  });
});

describe('rightColumnLayout — scaling up', () => {
  it('grows every widget height with the scale', () => {
    for (const s of [1.25, 1.5]) {
      const L = rightColumnLayout(s);
      expect(L.weatherStrip.height).toBe(Math.round(WEATHER_STRIP_BASE_H * s));
      expect(L.skyDial.height).toBe(Math.round(SKY_DIAL_BASE_H * s));
      expect(L.skyDial.width).toBe(Math.round(SKY_DIAL_BASE_W * s));
      expect(L.almanacChip.height).toBe(Math.round(ALMANAC_CHIP_BASE_H * s));
    }
  });

  it('pushes the first widget below a taller top bar', () => {
    const L = rightColumnLayout(1.5);
    // weatherStrip.y must clear the scaled top bar.
    expect(L.weatherStrip.y).toBeGreaterThan(Math.round(TOP_BAR_BASE_H * 1.5));
  });

  it('keeps the stack in order with no overlap (cascade)', () => {
    for (const s of [1.0, 1.25, 1.5, 2.0]) {
      const L = rightColumnLayout(s);
      const weatherBottom = L.weatherStrip.y + L.weatherStrip.height;
      const skyBottom = L.skyDial.y + L.skyDial.height;
      expect(L.skyDial.y).toBeGreaterThanOrEqual(weatherBottom);
      expect(L.almanacChip.y).toBeGreaterThanOrEqual(skyBottom);
    }
  });

  it('moves the chip strictly farther down as the scale grows', () => {
    const small = rightColumnLayout(1.0).almanacChip.y;
    const mid = rightColumnLayout(1.25).almanacChip.y;
    const big = rightColumnLayout(1.5).almanacChip.y;
    expect(mid).toBeGreaterThan(small);
    expect(big).toBeGreaterThan(mid);
  });

  it('clamps an out-of-range scale instead of exploding the layout', () => {
    const L = rightColumnLayout(99);
    expect(L.scale).toBe(2);
    // Heights are finite + bounded by the 2x cap.
    expect(L.skyDial.height).toBe(Math.round(SKY_DIAL_BASE_H * 2));
  });
});
