// Toast reduce-motion — under calm mode the corner pills hold full
// opacity for their whole life then cut at the very end instead of
// tracking a slow fade out of the corner of the eye.

import { describe, it, expect } from 'vitest';
import {
  toastAlpha,
  toastAlphaFor,
  TOAST_TTL_MS,
  TOAST_FADE_MS,
  TOAST_CUT_MS,
  type ToastEntry,
} from '../src/game/toast-queue';

function entry(ageMs: number, ttlMs: number = TOAST_TTL_MS): ToastEntry {
  return { text: 'Saved.', ageMs, ttlMs, kind: 'info' };
}

describe('toastAlphaFor — motion on (default fade)', () => {
  it('matches toastAlpha exactly when reduceMotion is false', () => {
    for (const age of [0, 500, 1900, TOAST_TTL_MS - TOAST_FADE_MS, TOAST_TTL_MS - 100, TOAST_TTL_MS]) {
      const e = entry(age);
      expect(toastAlphaFor(e, false)).toBe(toastAlpha(e));
    }
  });

  it('still fades over the final TOAST_FADE_MS with motion on', () => {
    // Halfway through the fade tail -> ~0.5 with motion on.
    const e = entry(TOAST_TTL_MS - TOAST_FADE_MS / 2);
    expect(toastAlphaFor(e, false)).toBeCloseTo(0.5, 5);
  });
});

describe('toastAlphaFor — motion off (calm cut)', () => {
  it('holds FULL opacity through the would-be fade tail', () => {
    // Deep inside the motion fade window, but calm mode keeps it solid.
    const e = entry(TOAST_TTL_MS - TOAST_FADE_MS / 2);
    expect(toastAlphaFor(e, true)).toBe(1);
    // With motion on the same instant is mid-fade — proving they differ.
    expect(toastAlphaFor(e, false)).toBeLessThan(1);
  });

  it('is full opacity at birth and through most of its life', () => {
    expect(toastAlphaFor(entry(0), true)).toBe(1);
    expect(toastAlphaFor(entry(TOAST_TTL_MS - TOAST_CUT_MS), true)).toBe(1);
  });

  it('cuts to 0 over only the final TOAST_CUT_MS', () => {
    // Halfway through the cut window -> ~0.5.
    const e = entry(TOAST_TTL_MS - TOAST_CUT_MS / 2);
    expect(toastAlphaFor(e, true)).toBeCloseTo(0.5, 5);
  });

  it('the cut window is far shorter than the motion fade', () => {
    expect(TOAST_CUT_MS).toBeLessThan(TOAST_FADE_MS);
  });

  it('returns 0 at and past expiry', () => {
    expect(toastAlphaFor(entry(TOAST_TTL_MS), true)).toBe(0);
    expect(toastAlphaFor(entry(TOAST_TTL_MS + 1000), true)).toBe(0);
  });

  it('never returns a value outside [0,1]', () => {
    for (let age = 0; age <= TOAST_TTL_MS + 200; age += 25) {
      const a = toastAlphaFor(entry(age), true);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});
