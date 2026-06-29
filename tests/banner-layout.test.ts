// Banner layout — the top-center celebration ribbons (birthday + festival)
// now honour the HUD scale. The key invariant is back-compat: at scale 1.0
// the helper reproduces the historical fixed values exactly (h=18, font=11,
// padX=12, firstY=36, secondY=54) so nothing moves for the default HUD;
// above 1.0 the ribbons grow and tuck under the taller top bar.

import { describe, it, expect } from 'vitest';
import {
  bannerLayout,
  clampBannerScale,
  BANNER_TOP_BAR_BASE_H,
  BANNER_BASE_H,
  BANNER_BASE_FONT_PX,
  BANNER_BASE_PAD_X,
} from '../src/game/banner-layout';

describe('clampBannerScale', () => {
  it('passes the legal scales through unchanged', () => {
    expect(clampBannerScale(1.0)).toBe(1.0);
    expect(clampBannerScale(1.25)).toBe(1.25);
    expect(clampBannerScale(1.5)).toBe(1.5);
  });

  it('clamps below 1 up to 1 and above 2 down to 2', () => {
    expect(clampBannerScale(0)).toBe(1);
    expect(clampBannerScale(-3)).toBe(1);
    expect(clampBannerScale(5)).toBe(2);
  });
});

describe('bannerLayout — back-compat at 1.0x', () => {
  const L = bannerLayout(1.0);

  it('reproduces the historical sizes (h=18, font=11, padX=12)', () => {
    expect(L.height).toBe(BANNER_BASE_H);
    expect(L.fontPx).toBe(BANNER_BASE_FONT_PX);
    expect(L.padX).toBe(BANNER_BASE_PAD_X);
  });

  it('reproduces the historical row positions (firstY=36, secondY=54)', () => {
    // 32px top bar + a 4px gap = 36; second ribbon one height (18) below.
    expect(L.firstY).toBe(36);
    expect(L.secondY).toBe(54);
  });

  it('stacks the second ribbon exactly one height below the first', () => {
    expect(L.secondY - L.firstY).toBe(L.height);
  });
});

describe('bannerLayout — scaling up', () => {
  it('grows the ribbon height + font with the scale', () => {
    const L = bannerLayout(1.5);
    expect(L.height).toBe(Math.round(BANNER_BASE_H * 1.5));
    expect(L.fontPx).toBe(Math.round(BANNER_BASE_FONT_PX * 1.5));
    expect(L.padX).toBe(Math.round(BANNER_BASE_PAD_X * 1.5));
  });

  it('drops the first ribbon below the taller scaled top bar', () => {
    const L = bannerLayout(1.5);
    const topBarH = Math.round(BANNER_TOP_BAR_BASE_H * 1.5);
    // The ribbon must clear the scaled top bar entirely.
    expect(L.firstY).toBeGreaterThanOrEqual(topBarH);
  });

  it('keeps the two rows non-overlapping at every legal scale', () => {
    for (const scale of [1.0, 1.1, 1.25, 1.5, 1.75, 2.0]) {
      const L = bannerLayout(scale);
      // The second row starts exactly where the first ends — no overlap,
      // no gap that would look detached.
      expect(L.secondY).toBe(L.firstY + L.height);
    }
  });

  it('reports the clamped scale it used', () => {
    expect(bannerLayout(1.25).scale).toBe(1.25);
    expect(bannerLayout(9).scale).toBe(2);
  });
});
