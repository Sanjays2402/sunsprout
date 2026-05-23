import { describe, expect, it } from 'vitest';
import { LoopbackBus } from '../src/game/multiplayer-transport';
import { PeerEmotes } from '../src/game/peer-emotes';
import {
  bindTransportToEmotes,
  broadcastEmote,
} from '../src/game/emote-transport';
import { serializeSnapshot } from '../src/game/multiplayer';

describe('emote-transport', () => {
  it('routes emote events from one transport into the other peer\'s emote store', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const emotesB = new PeerEmotes();
    bindTransportToEmotes(b, emotesB, () => 1000);

    broadcastEmote(a, 'a', 'wave');
    expect(emotesB.activeFor('a', 1500)?.kind).toBe('wave');
  });

  it('ignores non-emote messages (snapshots) without polluting the store', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const emotesB = new PeerEmotes();
    bindTransportToEmotes(b, emotesB, () => 1000);

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
    expect(emotesB.size(1500)).toBe(0);
  });

  it('drops malformed emote-shaped payloads silently', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const emotesB = new PeerEmotes();
    bindTransportToEmotes(b, emotesB, () => 1000);

    a.send('{"t":"emote","v":1,"id":"a","k":"flame"}');
    expect(emotesB.size(1500)).toBe(0);
  });

  it('unbind stops further delivery', () => {
    const bus = new LoopbackBus();
    const a = bus.connect('a');
    const b = bus.connect('b');
    const emotesB = new PeerEmotes();
    const unbind = bindTransportToEmotes(b, emotesB, () => 1000);
    unbind();
    broadcastEmote(a, 'a', 'heart');
    expect(emotesB.size(1500)).toBe(0);
  });
});
