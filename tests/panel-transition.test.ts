// Panel open micro-transition — eased fade-in alpha off the shared open
// lockout, reduce-motion-gated, that the whole panel family applies via
// ctx.globalAlpha on open.

import { describe, it, expect } from 'vitest';
import {
  panelOpenAlpha,
  OPEN_LOCKOUT_MS,
  PANEL_OPEN_MIN_ALPHA,
} from '../src/game/panel-transition';

describe('panelOpenAlpha', () => {
  it('starts faint at the first opening frame (full lockout remaining)', () => {
    // At the very first frame the whole lockout is still pending; the alpha
    // floors at PANEL_OPEN_MIN_ALPHA (a faint ghost, never fully invisible).
    expect(panelOpenAlpha(OPEN_LOCKOUT_MS)).toBeCloseTo(PANEL_OPEN_MIN_ALPHA, 5);
  });

  it('reaches solid (1.0) once the lockout has elapsed', () => {
    expect(panelOpenAlpha(0)).toBe(1);
    expect(panelOpenAlpha(-20)).toBe(1);
  });

  it('eases monotonically up as the lockout ticks down', () => {
    // Sample the window from full lockout -> 0; alpha should never decrease.
    let prev = -Infinity;
    for (let lock = OPEN_LOCKOUT_MS; lock >= 0; lock -= 10) {
      const a = panelOpenAlpha(lock);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it('stays within [PANEL_OPEN_MIN_ALPHA, 1] across the whole window', () => {
    for (let lock = OPEN_LOCKOUT_MS; lock >= 0; lock -= 5) {
      const a = panelOpenAlpha(lock);
      expect(a).toBeGreaterThanOrEqual(PANEL_OPEN_MIN_ALPHA - 1e-9);
      expect(a).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('snaps straight to solid under reduce-motion (no fade)', () => {
    // Even mid-window, calm mode returns 1.0 so the panel never animates.
    expect(panelOpenAlpha(OPEN_LOCKOUT_MS, true)).toBe(1);
    expect(panelOpenAlpha(OPEN_LOCKOUT_MS / 2, true)).toBe(1);
    expect(panelOpenAlpha(0, true)).toBe(1);
  });

  it('is around the midpoint partway through the window', () => {
    // Halfway through, smoothstep(0.5) = 0.5, so alpha sits at the midpoint
    // of [MIN, 1].
    const mid = panelOpenAlpha(OPEN_LOCKOUT_MS / 2);
    const expected = PANEL_OPEN_MIN_ALPHA + (1 - PANEL_OPEN_MIN_ALPHA) * 0.5;
    expect(mid).toBeCloseTo(expected, 5);
  });

  it('clamps a lockout larger than the duration to the floor (no overshoot)', () => {
    // A lockout above the nominal duration would give negative progress;
    // it must clamp to the start floor, not exceed it or dip below.
    expect(panelOpenAlpha(OPEN_LOCKOUT_MS * 2)).toBeCloseTo(PANEL_OPEN_MIN_ALPHA, 5);
  });

  it('treats a zero duration as already-solid', () => {
    expect(panelOpenAlpha(100, false, 0)).toBe(1);
  });

  it('honours a custom duration', () => {
    // With a 200ms window and 100ms remaining we're halfway -> midpoint.
    const a = panelOpenAlpha(100, false, 200);
    const expected = PANEL_OPEN_MIN_ALPHA + (1 - PANEL_OPEN_MIN_ALPHA) * 0.5;
    expect(a).toBeCloseTo(expected, 5);
  });
});
