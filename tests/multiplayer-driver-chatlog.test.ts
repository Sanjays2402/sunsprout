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

describe('MultiplayerDriver chat log', () => {
  it('records local sends as source="local" in chatLog', () => {
    const { a } = makePair();
    a.sendChat('hello world', 1000);
    const tail = a.recentChatHistory(5);
    expect(tail).toHaveLength(1);
    expect(tail[0].source).toBe('local');
    expect(tail[0].text).toBe('hello world');
  });

  it('records inbound peer chats under their peer id', () => {
    const { a, b } = makePair();
    b.sendChat('hi from b', 1000);
    const aTail = a.recentChatHistory(5);
    expect(aTail).toHaveLength(1);
    expect(aTail[0].source).toBe('b');
    expect(aTail[0].text).toBe('hi from b');
    // b's own log records its send locally too
    expect(b.recentChatHistory(5)[0].source).toBe('local');
  });

  it('preserves chronological order across local + peer chatter', () => {
    const { a, b } = makePair();
    a.sendChat('first', 1000);
    b.sendChat('second', 1100);
    a.sendChat('third', 1200);
    const sources = a.recentChatHistory(5).map((e) => `${e.source}:${e.text}`);
    expect(sources).toEqual(['local:first', 'b:second', 'local:third']);
  });

  it('close() clears the chat log', () => {
    const { a } = makePair();
    a.sendChat('one', 1000);
    expect(a.recentChatHistory(5)).toHaveLength(1);
    a.close();
    expect(a.recentChatHistory(5)).toHaveLength(0);
  });
});
