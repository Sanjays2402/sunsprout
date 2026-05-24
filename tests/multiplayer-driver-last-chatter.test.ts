import { describe, expect, it } from 'vitest';
import { LoopbackBus } from '../src/game/multiplayer-transport';
import { MultiplayerSession } from '../src/game/multiplayer-session';
import { PeerView } from '../src/game/peer-view';
import { MultiplayerDriver } from '../src/game/multiplayer-driver';

function makePair() {
  const bus = new LoopbackBus();
  const sessionA = new MultiplayerSession({
    identity: { id: 'a', name: 'A', color: '#ff8855', hat: '#222' },
    transport: bus.connect('a'),
    broadcastIntervalMs: 50,
  });
  const sessionB = new MultiplayerSession({
    identity: { id: 'b', name: 'B', color: '#55b6ff', hat: '#222' },
    transport: bus.connect('b'),
    broadcastIntervalMs: 50,
  });
  return {
    a: new MultiplayerDriver({ session: sessionA, view: new PeerView() }),
    b: new MultiplayerDriver({ session: sessionB, view: new PeerView() }),
  };
}

describe('MultiplayerDriver lastChatterId', () => {
  it('returns null before anyone speaks', () => {
    const { a } = makePair();
    expect(a.lastChatterId(1000)).toBeNull();
  });

  it('reports the latest unmuted speaker', () => {
    const { a, b } = makePair();
    b.sendChat('hello', 1000);
    expect(a.lastChatterId(1500)).toBe('b');
  });

  it('hides muted speakers from lastChatterId', () => {
    const { a, b } = makePair();
    b.sendChat('hi', 1000);
    expect(a.lastChatterId(1500)).toBe('b');
    a.mutes.mute('b');
    expect(a.lastChatterId(1500)).toBeNull();
  });
});
