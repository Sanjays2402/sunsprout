import { describe, expect, it } from 'vitest';
import { playerToLocalState, tickMultiplayerFrame } from '../src/game/multiplayer-frame';
import { initMultiplayer } from '../src/game/multiplayer-init';
import type { Player } from '../src/world/world';

function fakePlayer(): Player {
  return {
    x: 3.5,
    y: 7,
    facing: 'right',
    inventory: {},
    gold: 0,
  } as unknown as Player;
}

function fakeChannelFactory() {
  return () => ({
    postMessage: () => {},
    close: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

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

describe('multiplayer-frame', () => {
  it('playerToLocalState extracts x/y/facing only', () => {
    const p = fakePlayer();
    expect(playerToLocalState(p)).toEqual({ x: 3.5, y: 7, facing: 'right' });
  });

  it('tickMultiplayerFrame is a no-op with null driver', () => {
    const out = tickMultiplayerFrame(null, fakePlayer(), 0);
    expect(out).toEqual([]);
  });

  it('tickMultiplayerFrame drives the driver and returns peers', () => {
    const driver = initMultiplayer({
      force: true,
      store: new MemStore(),
      channelFactory: fakeChannelFactory() as never,
    });
    expect(driver).not.toBeNull();
    const peers = tickMultiplayerFrame(driver, fakePlayer(), 1000);
    expect(driver!.ticks).toBe(1);
    expect(peers).toEqual([]);
    driver!.close();
    // After close it stays silent.
    const peers2 = tickMultiplayerFrame(driver, fakePlayer(), 2000);
    expect(peers2).toEqual([]);
    expect(driver!.ticks).toBe(1);
  });
});
