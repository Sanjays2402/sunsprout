import { describe, it, expect } from 'vitest';
import {
  BroadcastChannelTransport,
  isBroadcastChannelSupported,
  type BroadcastChannelLike,
} from '../src/game/broadcast-channel-transport';

// Minimal in-memory BroadcastChannel mock that mimics real-tab semantics:
// every channel with the same name receives messages from every other
// channel — but never its own echoes.
class MockChannelRegistry {
  channels = new Map<string, Set<MockChannel>>();
  register(c: MockChannel) {
    let set = this.channels.get(c.name);
    if (!set) {
      set = new Set();
      this.channels.set(c.name, set);
    }
    set.add(c);
  }
  unregister(c: MockChannel) {
    this.channels.get(c.name)?.delete(c);
  }
  dispatch(from: MockChannel, msg: unknown) {
    const set = this.channels.get(from.name);
    if (!set) return;
    for (const c of set) {
      if (c === from) continue;
      c.onmessage?.({ data: msg });
    }
  }
}

class MockChannel implements BroadcastChannelLike {
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  constructor(
    public name: string,
    private registry: MockChannelRegistry,
  ) {
    registry.register(this);
  }
  postMessage(msg: unknown) {
    this.registry.dispatch(this, msg);
  }
  close() {
    this.registry.unregister(this);
    this.onmessage = null;
  }
}

describe('BroadcastChannelTransport', () => {
  it('delivers messages between two transports on the same channel', () => {
    const reg = new MockChannelRegistry();
    const factory = (name: string) => new MockChannel(name, reg);
    const a = new BroadcastChannelTransport({ id: 'a', channelFactory: factory });
    const b = new BroadcastChannelTransport({ id: 'b', channelFactory: factory });
    const got: Array<{ raw: string; from: string }> = [];
    b.onMessage((raw, from) => got.push({ raw, from }));
    a.send('hello');
    expect(got).toEqual([{ raw: 'hello', from: 'a' }]);
  });

  it('does not echo back to the sender', () => {
    const reg = new MockChannelRegistry();
    const factory = (name: string) => new MockChannel(name, reg);
    const a = new BroadcastChannelTransport({ id: 'a', channelFactory: factory });
    const aIn: string[] = [];
    a.onMessage((raw) => aIn.push(raw));
    a.send('echo?');
    expect(aIn).toEqual([]);
  });

  it('stops delivering after close()', () => {
    const reg = new MockChannelRegistry();
    const factory = (name: string) => new MockChannel(name, reg);
    const a = new BroadcastChannelTransport({ id: 'a', channelFactory: factory });
    const b = new BroadcastChannelTransport({ id: 'b', channelFactory: factory });
    const bIn: string[] = [];
    b.onMessage((raw) => bIn.push(raw));
    b.close();
    a.send('after-close');
    expect(bIn).toEqual([]);
    expect(b.closed).toBe(true);
  });

  it('isolates by channel name', () => {
    const reg = new MockChannelRegistry();
    const factory = (name: string) => new MockChannel(name, reg);
    const a = new BroadcastChannelTransport({ id: 'a', channelName: 'room1', channelFactory: factory });
    const b = new BroadcastChannelTransport({ id: 'b', channelName: 'room2', channelFactory: factory });
    const bIn: string[] = [];
    b.onMessage((raw) => bIn.push(raw));
    a.send('only-room1');
    expect(bIn).toEqual([]);
  });

  it('drops malformed envelopes silently', () => {
    const reg = new MockChannelRegistry();
    const factory = (name: string) => new MockChannel(name, reg);
    const a = new BroadcastChannelTransport({ id: 'a', channelFactory: factory });
    const b = new BroadcastChannelTransport({ id: 'b', channelFactory: factory });
    const bIn: string[] = [];
    b.onMessage((raw) => bIn.push(raw));
    // Reach in and post a bogus message directly.
    const aChan = reg.channels.get('sunsprout.multiplayer.v1')!.values().next().value as MockChannel;
    aChan.postMessage({ not: 'an envelope' });
    aChan.postMessage(null);
    aChan.postMessage({ from: 'x', raw: 123 });
    a.send('valid');
    expect(bIn).toEqual(['valid']);
  });

  it('throws if no factory and no global BroadcastChannel', () => {
    const g = globalThis as { BroadcastChannel?: unknown };
    const prev = g.BroadcastChannel;
    delete g.BroadcastChannel;
    try {
      expect(() => new BroadcastChannelTransport({ id: 'x' })).toThrow();
      expect(isBroadcastChannelSupported()).toBe(false);
    } finally {
      if (prev !== undefined) g.BroadcastChannel = prev;
    }
  });
});
