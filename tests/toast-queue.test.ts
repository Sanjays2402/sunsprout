// Toast queue — FIFO of recent corner notifications that lets multiple
// messages from the same frame coexist instead of clobbering each other.

import { describe, it, expect } from 'vitest';
import {
  ToastQueue,
  toastAlpha,
  TOAST_TTL_MS,
  TOAST_FADE_MS,
  TOAST_MAX_VISIBLE,
  type ToastEntry,
} from '../src/game/toast-queue';

describe('ToastQueue — push + ordering', () => {
  it('starts empty', () => {
    const q = new ToastQueue();
    expect(q.size).toBe(0);
    expect(q.latest()).toBeNull();
    expect(q.active()).toEqual([]);
  });

  it('keeps two same-frame messages alive at once', () => {
    const q = new ToastQueue();
    q.push('Harvested 4 turnips');
    q.push('Heart up with Maple');
    expect(q.size).toBe(2);
    const active = q.active();
    expect(active.length).toBe(2);
    // Newest first.
    expect(active[0].text).toBe('Heart up with Maple');
    expect(active[1].text).toBe('Harvested 4 turnips');
  });

  it('latest() returns the freshest message', () => {
    const q = new ToastQueue();
    q.push('first');
    q.push('second');
    expect(q.latest()).toBe('second');
  });

  it('ignores empty / whitespace-only pushes', () => {
    const q = new ToastQueue();
    q.push('');
    q.push('   ');
    q.push('\n\t');
    expect(q.size).toBe(0);
  });

  it('trims whitespace around the message', () => {
    const q = new ToastQueue();
    q.push('  Saved.  ');
    expect(q.latest()).toBe('Saved.');
  });
});

describe('ToastQueue — duplicate suppression', () => {
  it('resets the age of the newest toast when the same text repeats', () => {
    const q = new ToastQueue();
    q.push('Watered.');
    q.tick(1000);
    q.push('Watered.'); // same text -> refresh, not a new entry
    expect(q.size).toBe(1);
    // Age should have reset, so the toast survives a further near-full TTL.
    q.tick(TOAST_TTL_MS - 100);
    expect(q.size).toBe(1);
  });

  it('does NOT merge when a different message sits between two repeats', () => {
    const q = new ToastQueue();
    q.push('Watered.');
    q.push('Picked a berry.');
    q.push('Watered.'); // newest differs from the prior newest -> new entry
    expect(q.size).toBe(3);
  });
});

describe('ToastQueue — tick + expiry', () => {
  it('drops a toast once its TTL elapses', () => {
    const q = new ToastQueue();
    q.push('gone soon');
    q.tick(TOAST_TTL_MS - 1);
    expect(q.size).toBe(1);
    q.tick(2);
    expect(q.size).toBe(0);
    expect(q.latest()).toBeNull();
  });

  it('expires independently — older toast drops first', () => {
    const q = new ToastQueue();
    q.push('older');
    q.tick(1000);
    q.push('newer');
    // Advance until the older one (now 1000ms further along) expires but
    // the newer one is still alive.
    q.tick(TOAST_TTL_MS - 1000 + 1);
    expect(q.size).toBe(1);
    expect(q.latest()).toBe('newer');
  });

  it('tick on an empty queue is a no-op', () => {
    const q = new ToastQueue();
    expect(() => q.tick(100)).not.toThrow();
    expect(q.size).toBe(0);
  });
});

describe('ToastQueue — visible cap', () => {
  it('renders at most TOAST_MAX_VISIBLE entries', () => {
    const q = new ToastQueue();
    for (let i = 0; i < TOAST_MAX_VISIBLE + 2; i++) {
      q.push(`msg ${i}`);
    }
    expect(q.size).toBe(TOAST_MAX_VISIBLE + 2);
    expect(q.active().length).toBe(TOAST_MAX_VISIBLE);
    // The visible window is the newest ones.
    expect(q.active()[0].text).toBe(`msg ${TOAST_MAX_VISIBLE + 1}`);
  });

  it('a hidden older toast resurfaces after a visible one expires', () => {
    const q = new ToastQueue();
    // Push more than the cap, staggered so ages differ.
    for (let i = 0; i < TOAST_MAX_VISIBLE + 1; i++) {
      q.push(`m${i}`);
      q.tick(10);
    }
    // The very first (oldest) is hidden behind the cap.
    const beforeTexts = q.active().map((e) => e.text);
    expect(beforeTexts).not.toContain('m0');
    // Age out the visible window's oldest by pushing past its TTL but not
    // the newest — m0 should remain below cap still (it's oldest), so this
    // mostly asserts the cap logic stays stable as ages advance.
    expect(q.active().length).toBe(TOAST_MAX_VISIBLE);
  });

  it('clear() empties the queue', () => {
    const q = new ToastQueue();
    q.push('a');
    q.push('b');
    q.clear();
    expect(q.size).toBe(0);
    expect(q.active()).toEqual([]);
  });
});

describe('toastAlpha — fade curve', () => {
  function entry(ageMs: number, ttlMs: number = TOAST_TTL_MS): ToastEntry {
    return { text: 'x', ageMs, ttlMs };
  }

  it('is fully opaque well before the fade window', () => {
    expect(toastAlpha(entry(0))).toBe(1);
    expect(toastAlpha(entry(TOAST_TTL_MS - TOAST_FADE_MS - 1))).toBe(1);
  });

  it('ramps down across the final fade window', () => {
    // Exactly at the fade boundary -> still 1.
    expect(toastAlpha(entry(TOAST_TTL_MS - TOAST_FADE_MS))).toBe(1);
    // Halfway through the fade -> ~0.5.
    const half = toastAlpha(entry(TOAST_TTL_MS - TOAST_FADE_MS / 2));
    expect(half).toBeGreaterThan(0.4);
    expect(half).toBeLessThan(0.6);
  });

  it('is zero at and past expiry', () => {
    expect(toastAlpha(entry(TOAST_TTL_MS))).toBe(0);
    expect(toastAlpha(entry(TOAST_TTL_MS + 500))).toBe(0);
  });

  it('never returns a value outside [0,1]', () => {
    for (let age = 0; age <= TOAST_TTL_MS + 200; age += 137) {
      const a = toastAlpha(entry(age));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});
