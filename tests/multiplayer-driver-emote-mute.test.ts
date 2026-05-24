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

describe('MultiplayerDriver emote mute integration', () => {
  it('drops inbound emote bubbles from muted peers', () => {
    const { a, b } = makePair();
    a.mutes.mute('b');
    b.sendEmote('heart', 1000);
    expect(a.emoteFor('b', 1100)).toBeUndefined();
    // Sender still sees their own emote locally.
    expect(b.emoteFor('b', 1100)?.kind).toBe('heart');
  });

  it('still delivers emotes from non-muted peers', () => {
    const { a, b } = makePair();
    a.mutes.mute('someone-else');
    b.sendEmote('wave', 1000);
    expect(a.emoteFor('b', 1100)?.kind).toBe('wave');
  });

  it('unmute restores emote delivery on the next emote', () => {
    const { a, b } = makePair();
    a.mutes.mute('b');
    b.sendEmote('heart', 1000);
    expect(a.emoteFor('b', 1100)).toBeUndefined();
    a.mutes.unmute('b');
    b.sendEmote('wave', 2000);
    expect(a.emoteFor('b', 2100)?.kind).toBe('wave');
  });
});
