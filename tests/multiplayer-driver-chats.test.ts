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

describe('MultiplayerDriver chats', () => {
  it('sendChat echoes locally so the sender sees their own bubble', () => {
    const { a } = makePair();
    expect(a.sendChat('hello world', 1000)).toBe(true);
    expect(a.chatFor('a', 1500)?.text).toBe('hello world');
  });

  it('receives remote chats through the transport', () => {
    const { a, b } = makePair();
    b.sendChat('hi from b', 1000);
    expect(a.chatFor('b', 1500)?.text).toBe('hi from b');
    expect(b.chatFor('b', 1500)?.text).toBe('hi from b');
    expect(a.chatFor('a', 1500)).toBeUndefined();
  });

  it('sendChat returns false for empty/whitespace bodies and broadcasts nothing', () => {
    const { a, b } = makePair();
    expect(a.sendChat('   ', 1000)).toBe(false);
    expect(a.chatFor('a', 1500)).toBeUndefined();
    expect(b.chatFor('a', 1500)).toBeUndefined();
  });

  it("forgets a peer's chat when that peer leaves", () => {
    const { a, b } = makePair();
    a.tick({ x: 0, y: 0, facing: 'down' }, 0);
    b.tick({ x: 1, y: 1, facing: 'down' }, 0);
    b.sendChat('bye soon', 0);
    a.tick({ x: 0, y: 0, facing: 'down' }, 50);
    expect(a.chatFor('b', 60)?.text).toBe('bye soon');
    a.tick({ x: 0, y: 0, facing: 'down' }, 10_000);
    expect(a.chatFor('b', 10_001)).toBeUndefined();
  });

  it('sendChat is a no-op after close()', () => {
    const { a } = makePair();
    a.close();
    expect(a.sendChat('post-close', 1000)).toBe(false);
    expect(a.chatFor('a', 1500)).toBeUndefined();
  });
});
