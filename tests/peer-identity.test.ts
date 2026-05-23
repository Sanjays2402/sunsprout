import { describe, it, expect } from 'vitest';
import {
  resolveLocalIdentity,
  clearPersistedIdentity,
  type IdentityStore,
} from '../src/game/peer-identity';

class MemStore implements IdentityStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

// Deterministic LCG so id/name/palette choices are stable across runs.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('peer-identity', () => {
  it('generates a fresh identity with sane shape when nothing is provided', () => {
    const ident = resolveLocalIdentity({ rand: seeded(1) });
    expect(ident.id).toMatch(/^p_[A-Za-z0-9]+$/);
    expect(ident.id.length).toBeGreaterThanOrEqual(4);
    expect(ident.name.length).toBeGreaterThan(0);
    expect(ident.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(ident.hat).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('persists across calls when a store is provided', () => {
    const store = new MemStore();
    const first = resolveLocalIdentity({ store, rand: seeded(2) });
    const second = resolveLocalIdentity({ store, rand: seeded(999) });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe(first.name);
    expect(second.color).toBe(first.color);
    expect(second.hat).toBe(first.hat);
  });

  it('hash params override persisted values', () => {
    const store = new MemStore();
    resolveLocalIdentity({ store, rand: seeded(3) });
    const overridden = resolveLocalIdentity({
      store,
      hash: '#name=Finn&color=ff8855&hat=3a2a1a',
      rand: seeded(3),
    });
    expect(overridden.name).toBe('Finn');
    expect(overridden.color).toBe('#ff8855');
    expect(overridden.hat).toBe('#3a2a1a');
  });

  it('clearPersistedIdentity wipes the persisted record', () => {
    const store = new MemStore();
    const first = resolveLocalIdentity({ store, rand: seeded(4) });
    clearPersistedIdentity(store);
    const next = resolveLocalIdentity({ store, rand: seeded(5) });
    expect(next.id).not.toBe(first.id);
  });

  it('sanitizes garbage colors and oversized names', () => {
    const ident = resolveLocalIdentity({
      rand: seeded(6),
      override: {
        id: 'has spaces & junk!!',
        name: 'x'.repeat(99),
        color: 'not-a-color',
        hat: '#abcdef',
      },
    });
    expect(ident.id).not.toMatch(/[^A-Za-z0-9_-]/);
    expect(ident.name.length).toBeLessThanOrEqual(32);
    expect(ident.color).toBe('#cccccc');
    expect(ident.hat).toBe('#abcdef');
  });

  it('rejects malformed persisted JSON and regenerates', () => {
    const store = new MemStore();
    store.setItem('sunsprout.peerIdentity.v1', '{not json');
    const ident = resolveLocalIdentity({ store, rand: seeded(7) });
    expect(ident.id).toMatch(/^p_/);
  });
});
