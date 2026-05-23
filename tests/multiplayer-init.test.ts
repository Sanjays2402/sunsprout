import { describe, expect, it, vi } from 'vitest';
import { initMultiplayer } from '../src/game/multiplayer-init';
import { MultiplayerDriver } from '../src/game/multiplayer-driver';

class MemStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function fakeChannelFactory() {
  return () => ({
    postMessage: () => {},
    close: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

describe('initMultiplayer', () => {
  it('returns null when feature flag is off', () => {
    const driver = initMultiplayer({
      location: { search: '' },
      store: new MemStore(),
      channelFactory: fakeChannelFactory() as never,
    });
    expect(driver).toBeNull();
  });

  it('returns a tickable driver when enabled', () => {
    const driver = initMultiplayer({
      force: true,
      store: new MemStore(),
      channelFactory: fakeChannelFactory() as never,
    });
    expect(driver).toBeInstanceOf(MultiplayerDriver);
    expect(driver!.closed).toBe(false);
    expect(driver!.ticks).toBe(0);
    driver!.tick({ x: 1, y: 2, facing: 'down' }, 0);
    expect(driver!.ticks).toBe(1);
    expect(driver!.peers(0)).toEqual([]);
    driver!.close();
    expect(driver!.closed).toBe(true);
  });

  it('returns null + warns when BroadcastChannel is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = globalThis as unknown as { BroadcastChannel?: unknown };
    const saved = g.BroadcastChannel;
    delete g.BroadcastChannel;
    try {
      const driver = initMultiplayer({ force: true, store: new MemStore() });
      expect(driver).toBeNull();
    } finally {
      if (saved !== undefined) g.BroadcastChannel = saved;
      warn.mockRestore();
    }
  });
});
