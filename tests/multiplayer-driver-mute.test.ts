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

describe('MultiplayerDriver mute integration', () => {
  it('drops bubble + history when the sender is muted', () => {
    const { a, b } = makePair();
    a.mutes.mute('b');
    b.sendChat('shhh', 1000);
    expect(a.chatFor('b', 1500)).toBeUndefined();
    expect(a.recentChatHistory().some((e) => e.source === 'b')).toBe(false);
    // Sender still sees their own line locally.
    expect(b.chatFor('b', 1500)?.text).toBe('shhh');
  });

  it('still delivers chats from non-muted peers', () => {
    const { a, b } = makePair();
    a.mutes.mute('someone-else');
    b.sendChat('hi a', 1000);
    expect(a.chatFor('b', 1500)?.text).toBe('hi a');
  });

  it('unmute restores delivery on the next message', () => {
    const { a, b } = makePair();
    a.mutes.mute('b');
    b.sendChat('drop1', 1000);
    expect(a.chatFor('b', 1500)).toBeUndefined();
    a.mutes.unmute('b');
    b.sendChat('keep2', 2000);
    expect(a.chatFor('b', 2500)?.text).toBe('keep2');
  });
});
