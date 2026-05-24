import { describe, expect, it } from 'vitest';
import { LoopbackBus } from '../src/game/multiplayer-transport';
import { PeerChats } from '../src/game/peer-chats';
import {
  bindTransportToChats,
  broadcastChat,
} from '../src/game/chat-transport';
import { serializeSnapshot } from '../src/game/multiplayer';
import { broadcastEmote } from '../src/game/emote-transport';

describe('chat-transport', () => {
  it('routes chat lines from one transport into the other peer\'s chat store', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const chatsB = new PeerChats();
    bindTransportToChats(b, chatsB, () => 1000);

    expect(broadcastChat(a, 'a', 'howdy neighbor')).toBe(true);
    expect(chatsB.activeFor('a', 1500)?.text).toBe('howdy neighbor');
  });

  it('ignores snapshots and emotes without polluting the store', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const chatsB = new PeerChats();
    bindTransportToChats(b, chatsB, () => 1000);

    a.send(
      serializeSnapshot({
        v: 1,
        id: 'a',
        name: 'Aaa',
        x: 1,
        y: 2,
        facing: 'down',
        color: '#fff',
        hat: '#000',
      }),
    );
    broadcastEmote(a, 'a', 'wave');
    expect(chatsB.size(1500)).toBe(0);
  });

  it('broadcastChat returns false and sends nothing for empty bodies', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const chatsB = new PeerChats();
    bindTransportToChats(b, chatsB, () => 1000);

    expect(broadcastChat(a, 'a', '   ')).toBe(false);
    expect(chatsB.size(1500)).toBe(0);
  });

  it('unbind stops further delivery', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const chatsB = new PeerChats();
    const unbind = bindTransportToChats(b, chatsB, () => 1000);
    unbind();
    broadcastChat(a, 'a', 'hello?');
    expect(chatsB.size(1500)).toBe(0);
  });
});
