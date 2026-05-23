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

describe('MultiplayerDriver emotes', () => {
  it('sendEmote echoes locally so the sender sees their own bubble', () => {
    const { a } = makePair();
    a.sendEmote('wave', 1000);
    expect(a.emoteFor('a', 1500)?.kind).toBe('wave');
  });

  it('receives remote emotes through the transport', () => {
    const { a, b } = makePair();
    b.sendEmote('heart', 1000);
    expect(a.emoteFor('b', 1500)?.kind).toBe('heart');
    // Sender's own store also has it.
    expect(b.emoteFor('b', 1500)?.kind).toBe('heart');
    // A did not "send" anything so A's store has no emote for itself.
    expect(a.emoteFor('a', 1500)).toBeUndefined();
  });

  it('forgets a peer\'s emote when that peer leaves', () => {
    const { a, b } = makePair();
    a.tick({ x: 0, y: 0, facing: 'down' }, 0);
    b.tick({ x: 1, y: 1, facing: 'down' }, 0);
    b.sendEmote('sparkle', 0);
    a.tick({ x: 0, y: 0, facing: 'down' }, 50);
    expect(a.emoteFor('b', 60)?.kind).toBe('sparkle');
    // Now b goes silent → eviction + leave event → emote dropped.
    a.tick({ x: 0, y: 0, facing: 'down' }, 10_000);
    expect(a.emoteFor('b', 10_001)).toBeUndefined();
  });

  it('sendEmote is a no-op after close()', () => {
    const { a } = makePair();
    a.close();
    a.sendEmote('note', 1000);
    expect(a.emoteFor('a', 1500)).toBeUndefined();
  });
});
