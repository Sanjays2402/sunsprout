import { describe, it, expect, vi } from 'vitest';
import {
  bootstrapMultiplayer,
  isMultiplayerRequested,
} from '../src/game/multiplayer-bootstrap';
import type {
  BroadcastChannelFactory,
  BroadcastChannelLike,
} from '../src/game/broadcast-channel-transport';
import type { IdentityStore } from '../src/game/peer-identity';

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

function fakeChannelFactory(): BroadcastChannelFactory {
  const channels: BroadcastChannelLike[] = [];
  const factory: BroadcastChannelFactory = (_name: string) => {
    const ch: BroadcastChannelLike = {
      onmessage: null,
      postMessage: () => {
        /* no peers */
      },
      close: () => {
        /* noop */
      },
    };
    channels.push(ch);
    return ch;
  };
  return factory;
}

describe('isMultiplayerRequested', () => {
  it('returns false when search is empty/missing', () => {
    expect(isMultiplayerRequested()).toBe(false);
    expect(isMultiplayerRequested({ search: '' })).toBe(false);
    expect(isMultiplayerRequested({ search: '?other=1' })).toBe(false);
  });

  it('recognises truthy values', () => {
    expect(isMultiplayerRequested({ search: '?multiplayer=1' })).toBe(true);
    expect(isMultiplayerRequested({ search: '?multiplayer=true' })).toBe(true);
    expect(isMultiplayerRequested({ search: '?multiplayer=on' })).toBe(true);
    expect(isMultiplayerRequested({ search: '?multiplayer' })).toBe(true);
    expect(isMultiplayerRequested({ search: '?foo=a&multiplayer=yes' })).toBe(
      true,
    );
  });

  it('recognises falsy values', () => {
    expect(isMultiplayerRequested({ search: '?multiplayer=0' })).toBe(false);
    expect(isMultiplayerRequested({ search: '?multiplayer=off' })).toBe(false);
  });
});

describe('bootstrapMultiplayer', () => {
  it('returns null when the feature flag is off', () => {
    const result = bootstrapMultiplayer({
      location: { search: '' },
      store: new MemStore(),
      channelFactory: fakeChannelFactory(),
    });
    expect(result).toBeNull();
  });

  it('builds a session + view when enabled with an injected factory', () => {
    const store = new MemStore();
    const result = bootstrapMultiplayer({
      location: { search: '?multiplayer=1', hash: '#name=spud' },
      store,
      channelFactory: fakeChannelFactory(),
    });
    expect(result).not.toBeNull();
    expect(result!.session.identity.name).toBe('spud');
    expect(result!.view.size()).toBe(0);
    expect(result!.session.peers()).toEqual([]);
    // Identity should be persisted for the next boot.
    expect(store.data.size).toBe(1);
    result!.session.close();
    expect(result!.session.closed).toBe(true);
  });

  it('respects force=true even when search has no flag', () => {
    const result = bootstrapMultiplayer({
      force: true,
      store: new MemStore(),
      channelFactory: fakeChannelFactory(),
    });
    expect(result).not.toBeNull();
    result!.session.close();
  });

  it('returns null + warns when enabled but BroadcastChannel is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = globalThis as unknown as { BroadcastChannel?: unknown };
    const saved = g.BroadcastChannel;
    delete g.BroadcastChannel;
    try {
      const result = bootstrapMultiplayer({
        force: true,
        store: new MemStore(),
      });
      expect(result).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      if (saved !== undefined) g.BroadcastChannel = saved;
      warn.mockRestore();
    }
  });
});
