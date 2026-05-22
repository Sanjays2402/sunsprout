import { describe, expect, it } from 'vitest';
import { GEMS, GEM_KEYS, gemInventoryKey, gemRarity, pickGem } from '../src/game/gems';

describe('gem catalog', () => {
  it('every key has a definition with positive sell price + weight', () => {
    for (const k of GEM_KEYS) {
      expect(GEMS[k].sellPrice).toBeGreaterThan(0);
      expect(GEMS[k].weight).toBeGreaterThan(0);
      expect(GEMS[k].name.length).toBeGreaterThan(0);
    }
  });

  it('inventory keys are gem-prefixed and disjoint from other namespaces', () => {
    for (const k of GEM_KEYS) {
      expect(gemInventoryKey(k)).toBe(`gem-${k}`);
    }
  });

  it('pickGem honours the weight table — common gems dominate over many rolls', () => {
    let cnt = { copper: 0, iron: 0, silver: 0, gold: 0, ruby: 0 };
    // Deterministic rng so the assertion is stable.
    let s = 1;
    const rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 5000; i++) cnt[pickGem(rng)]++;
    expect(cnt.copper).toBeGreaterThan(cnt.ruby * 5);
    expect(cnt.iron).toBeGreaterThan(cnt.gold);
  });

  it('rarity buckets line up with catalog tiers', () => {
    expect(gemRarity('copper')).toBe('common');
    expect(gemRarity('iron')).toBe('uncommon');
    expect(gemRarity('silver')).toBe('rare');
    expect(gemRarity('gold')).toBe('epic');
    expect(gemRarity('ruby')).toBe('legendary');
  });
});
