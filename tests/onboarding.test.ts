// Onboarding — first-run welcome card gating + content.
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_SEEN_KEY,
  ONBOARDING_TIPS,
  ONBOARDING_TITLE,
  hasSeenOnboarding,
  markOnboardingSeen,
  shouldShowOnboarding,
} from '../src/game/onboarding';
import type { StorageLike } from '../src/game/persistence';

function makeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('onboarding content', () => {
  it('has a title and a handful of tips, no emoji', () => {
    expect(ONBOARDING_TITLE).toBeTruthy();
    expect(ONBOARDING_TIPS.length).toBeGreaterThanOrEqual(3);
    for (const tip of ONBOARDING_TIPS) {
      expect(tip.keys).toBeTruthy();
      expect(tip.label).toBeTruthy();
      // ASCII-only (no emoji) in any git/app chrome string.
      expect(/^[\x20-\x7E]*$/.test(tip.keys + tip.label)).toBe(true);
    }
  });

  it('surfaces the wayfinding keys the player would otherwise miss', () => {
    const keys = ONBOARDING_TIPS.map((t) => t.keys);
    expect(keys).toContain('?');
    expect(keys).toContain('9');
    expect(keys).toContain('0');
  });
});

describe('onboarding gating', () => {
  it('shows on a fresh device and hides after being marked seen', () => {
    const s = makeStorage();
    expect(shouldShowOnboarding(s)).toBe(true);
    expect(hasSeenOnboarding(s)).toBe(false);
    markOnboardingSeen(s);
    expect(hasSeenOnboarding(s)).toBe(true);
    expect(shouldShowOnboarding(s)).toBe(false);
    expect(s.getItem(ONBOARDING_SEEN_KEY)).toBe('1');
  });

  it('treats a null storage (no localStorage) as already-seen so it never pops in SSR/tests', () => {
    expect(shouldShowOnboarding(null)).toBe(true);
    expect(hasSeenOnboarding(null)).toBe(false);
    // marking with null storage is a harmless no-op
    expect(() => markOnboardingSeen(null)).not.toThrow();
  });

  it('survives a thrown storage gracefully (private mode / quota)', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    expect(hasSeenOnboarding(throwing)).toBe(false);
    expect(() => markOnboardingSeen(throwing)).not.toThrow();
  });

  it('uses a dedicated key independent of the save snapshot', () => {
    expect(ONBOARDING_SEEN_KEY).toBe('sunsprout.onboarding.v1');
  });
});
