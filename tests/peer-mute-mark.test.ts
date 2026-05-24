import { describe, expect, it } from 'vitest';
import { ChatMuteSet } from '../src/game/chat-mute';
import {
  PEER_MUTE_MARK_WIDTH,
  drawPeerMuteMark,
} from '../src/render/peer-mute-mark';

interface FillCall {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

function makeStubCtx(): { ctx: CanvasRenderingContext2D; fills: FillCall[] } {
  const fills: FillCall[] = [];
  let color = '';
  const ctx = {
    set fillStyle(c: string) {
      color = c;
    },
    get fillStyle() {
      return color;
    },
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ x, y, w, h, color });
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, fills };
}

describe('drawPeerMuteMark', () => {
  it('no-ops when peer is not muted', () => {
    const mutes = new ChatMuteSet();
    const { ctx, fills } = makeStubCtx();
    const drew = drawPeerMuteMark(
      ctx,
      { id: 'peer-a', name: 'Alice' },
      mutes,
      100,
      100,
    );
    expect(drew).toBe(false);
    expect(fills).toEqual([]);
  });

  it('draws the badge when peer is muted', () => {
    const mutes = new ChatMuteSet();
    mutes.mute('peer-a');
    const { ctx, fills } = makeStubCtx();
    const drew = drawPeerMuteMark(
      ctx,
      { id: 'peer-a', name: 'Alice' },
      mutes,
      100,
      100,
    );
    expect(drew).toBe(true);
    // background + inner fill + 7 slash pixels = 9 fillRect calls
    expect(fills).toHaveLength(9);
    // First call is the dark background pill.
    expect(fills[0].w).toBe(PEER_MUTE_MARK_WIDTH);
    expect(fills[0].h).toBe(9);
    expect(fills[0].color).toBe('#2C2A38');
    // Slash pixels are red.
    for (let i = 2; i < 9; i++) {
      expect(fills[i].color).toBe('#FF6B6B');
      expect(fills[i].w).toBe(1);
      expect(fills[i].h).toBe(1);
    }
    // Badge sits at nameplate top (sy - 28 = 72).
    expect(fills[0].y).toBe(72);
  });

  it('truncates long names for width calc but still draws', () => {
    const mutes = new ChatMuteSet();
    mutes.mute('peer-z');
    const { ctx, fills } = makeStubCtx();
    drawPeerMuteMark(
      ctx,
      { id: 'peer-z', name: 'AReallyLongNameHere' },
      mutes,
      200,
      200,
    );
    expect(fills.length).toBeGreaterThan(0);
    // Width math caps at 12 chars (74px wide nameplate); badge x should be
    // to the right of that.
    expect(fills[0].x).toBeGreaterThan(200);
  });

  it('local id is never marked even if asked', () => {
    const mutes = new ChatMuteSet();
    // ChatMuteSet rejects 'local' on mute(); confirm helper is consistent.
    mutes.mute('local');
    const { ctx, fills } = makeStubCtx();
    const drew = drawPeerMuteMark(
      ctx,
      { id: 'local', name: 'Me' },
      mutes,
      0,
      0,
    );
    expect(drew).toBe(false);
    expect(fills).toEqual([]);
  });
});
