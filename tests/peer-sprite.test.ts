import { describe, it, expect } from 'vitest';
import {
  drawPeerSprite,
  drawPeerNameplate,
  peerScreenPos,
} from '../src/render/peer-sprite';
import { TILE_SIZE } from '../src/engine/grid';
import type { PeerRenderable } from '../src/game/peer-view';

interface FillCall {
  op: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}
interface TextCall {
  op: 'text';
  text: string;
  x: number;
  y: number;
  color: string;
}

function makeCtx(): { ctx: CanvasRenderingContext2D; calls: (FillCall | TextCall)[] } {
  const calls: (FillCall | TextCall)[] = [];
  let fillStyle = '';
  let font = '';
  const ctx = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
    },
    get font() {
      return font;
    },
    set font(v: string) {
      font = v;
    },
    textBaseline: 'top' as CanvasTextBaseline,
    textAlign: 'left' as CanvasTextAlign,
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push({ op: 'rect', x, y, w, h, color: fillStyle });
    },
    fillText(text: string, x: number, y: number) {
      calls.push({ op: 'text', text, x, y, color: fillStyle });
    },
    save() {},
    restore() {},
    beginPath() {},
    ellipse() {},
    fill() {},
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const peer: PeerRenderable = {
  id: 'p1',
  name: 'Robin',
  x: 5,
  y: 7,
  facing: 'down',
  color: '#AA3344',
  hat: '#22AA66',
};

describe('peerScreenPos', () => {
  it('converts tile coords to screen center using camera offset', () => {
    const { sx, sy } = peerScreenPos(peer, 10, 20);
    expect(sx).toBe(Math.floor(5 * TILE_SIZE + TILE_SIZE / 2 - 10));
    expect(sy).toBe(Math.floor(7 * TILE_SIZE + TILE_SIZE / 2 - 20));
  });
});

describe('drawPeerSprite', () => {
  it('uses the peer tint colors for tunic and hat', () => {
    const { ctx, calls } = makeCtx();
    drawPeerSprite(ctx, peer, 100, 100);
    const colors = calls.filter((c) => c.op === 'rect').map((c) => c.color);
    expect(colors).toContain('#AA3344');
    expect(colors).toContain('#22AA66');
  });

  it('draws the name plate above the head', () => {
    const { ctx, calls } = makeCtx();
    drawPeerSprite(ctx, peer, 100, 100);
    const text = calls.find((c): c is TextCall => c.op === 'text');
    expect(text).toBeDefined();
    expect(text!.text).toBe('Robin');
    expect(text!.y).toBeLessThan(100);
  });

  it('renders different art for each facing direction', () => {
    const seen = new Set<number>();
    for (const facing of ['up', 'down', 'left', 'right'] as const) {
      const { ctx, calls } = makeCtx();
      drawPeerSprite(ctx, { ...peer, facing }, 100, 100);
      seen.add(calls.length);
    }
    // Different facings produce different numbers of rects (eyes/arms differ).
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('drawPeerNameplate', () => {
  it('truncates long names with an ellipsis', () => {
    const { ctx, calls } = makeCtx();
    drawPeerNameplate(ctx, 'AbcdefghijklmnopQR', 50, 50);
    const text = calls.find((c): c is TextCall => c.op === 'text');
    expect(text!.text.endsWith('…')).toBe(true);
    expect(text!.text.length).toBeLessThanOrEqual(12);
  });
});
