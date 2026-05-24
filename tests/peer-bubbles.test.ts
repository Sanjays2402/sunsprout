import { describe, it, expect } from 'vitest';
import { drawPeerBubbles, type BubbleSource } from '../src/render/peer-bubbles';
import type { PeerRenderable } from '../src/game/peer-view';
import type { ActiveChat } from '../src/game/peer-chats';
import type { ActiveEmote } from '../src/game/peer-emotes';

function makeCtx(): { ctx: CanvasRenderingContext2D; texts: string[] } {
  const texts: string[] = [];
  let fillStyle = '';
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    fillRect() {},
    fillText(t: string) {
      texts.push(t);
    },
    save() {},
    restore() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

function makePeer(id: string, x: number, y: number): PeerRenderable {
  return {
    id,
    name: id,
    color: '#aaaaaa',
    hat: '#bbbbbb',
    x,
    y,
    facing: 'down',
    moving: false,
  } as PeerRenderable;
}

function makeSource(chats: Record<string, string>, emotes: Record<string, ActiveEmote['kind']>): BubbleSource {
  return {
    chatFor(id: string): ActiveChat | undefined {
      if (!chats[id]) return undefined;
      return { peerId: id, text: chats[id], bornAt: 0, diesAt: 1e9 };
    },
    emoteFor(id: string): ActiveEmote | undefined {
      if (!emotes[id]) return undefined;
      return { peerId: id, kind: emotes[id], bornAt: 0, diesAt: 1e9 };
    },
  };
}

const camera = { x: 0, y: 0, viewW: 800, viewH: 600 } as any;

describe('drawPeerBubbles', () => {
  it('draws chat + emote when both active', () => {
    const { ctx, texts } = makeCtx();
    const peers = [makePeer('p1', 5, 5)];
    drawPeerBubbles(ctx, {
      peers,
      source: makeSource({ p1: 'hi' }, { p1: 'wave' }),
      camera,
      now: 100,
    });
    expect(texts).toContain('hi');
    expect(texts).toContain('~'); // wave glyph
  });

  it('skips peers with no bubbles', () => {
    const { ctx, texts } = makeCtx();
    const peers = [makePeer('p1', 5, 5)];
    drawPeerBubbles(ctx, {
      peers,
      source: makeSource({}, {}),
      camera,
      now: 0,
    });
    expect(texts).toHaveLength(0);
  });

  it('culls peers outside viewport', () => {
    const { ctx, texts } = makeCtx();
    const peers = [makePeer('p1', 9999, 9999)];
    drawPeerBubbles(ctx, {
      peers,
      source: makeSource({ p1: 'farfar' }, {}),
      camera,
      now: 0,
    });
    expect(texts).toHaveLength(0);
  });
});
