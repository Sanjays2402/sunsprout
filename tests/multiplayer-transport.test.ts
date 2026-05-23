import { describe, it, expect } from 'vitest';
import { LoopbackBus, bindTransportToRegistry, broadcastSnapshot } from '../src/game/multiplayer-transport';
import { PeerRegistry, buildSnapshot } from '../src/game/multiplayer';

function mkSnap(id: string, x = 5, y = 5) {
  return buildSnapshot({
    id,
    name: id,
    x,
    y,
    facing: 'down',
    color: '#abcdef',
    hat: '#123456',
  });
}

describe('multiplayer LoopbackBus', () => {
  it('fan-outs messages to every other endpoint but not the sender', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const c = bus.connect('c');

    const aIn: string[] = [];
    const bIn: string[] = [];
    const cIn: string[] = [];
    a.onMessage((raw) => aIn.push(raw));
    b.onMessage((raw) => bIn.push(raw));
    c.onMessage((raw) => cIn.push(raw));

    a.send('hello');
    expect(aIn).toEqual([]);
    expect(bIn).toEqual(['hello']);
    expect(cIn).toEqual(['hello']);
  });

  it('rejects duplicate endpoint ids', () => {
    const bus = new LoopbackBus();
    bus.connect('dup');
    expect(() => bus.connect('dup')).toThrow();
  });

  it('close() detaches an endpoint from the bus', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const bIn: string[] = [];
    b.onMessage((raw) => bIn.push(raw));

    a.close();
    expect(a.closed).toBe(true);
    expect(bus.size()).toBe(1);
    a.send('after-close'); // silent no-op
    expect(bIn).toEqual([]);
  });

  it('bindTransportToRegistry applies snapshots into the registry', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const reg = new PeerRegistry();
    bindTransportToRegistry(b, reg, () => 1000);

    broadcastSnapshot(a, mkSnap('peer-a', 7, 9));
    expect(reg.size()).toBe(1);
    expect(reg.get('peer-a')?.x).toBe(7);
    expect(reg.get('peer-a')?.y).toBe(9);

    broadcastSnapshot(a, mkSnap('peer-a', 8, 9));
    expect(reg.get('peer-a')?.x).toBe(8);
  });

  it('ignores malformed wire payloads silently', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const reg = new PeerRegistry();
    bindTransportToRegistry(b, reg);

    a.send('not-json');
    a.send(JSON.stringify({ garbage: true }));
    expect(reg.size()).toBe(0);
  });
});
