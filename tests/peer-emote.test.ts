import { describe, it, expect } from 'vitest';
import { drawPeerEmote, emoteGlyph } from '../src/render/peer-emote';

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
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('emoteGlyph', () => {
  it('returns a non-empty glyph for every known kind', () => {
    for (const k of ['wave', 'heart', 'sprout', 'sparkle', 'note'] as const) {
      expect(emoteGlyph(k).length).toBeGreaterThan(0);
    }
  });
});

describe('drawPeerEmote', () => {
  it('renders the glyph text inside the bubble', () => {
    const { ctx, calls } = makeCtx();
    drawPeerEmote(ctx, 'heart', 100, 100);
    const text = calls.find((c): c is TextCall => c.op === 'text');
    expect(text).toBeDefined();
    expect(text!.text).toBe(emoteGlyph('heart'));
  });

  it('draws the bubble above the nameplate area', () => {
    const { ctx, calls } = makeCtx();
    drawPeerEmote(ctx, 'wave', 200, 200);
    const rects = calls.filter((c): c is FillCall => c.op === 'rect');
    // Bubble body should sit above y = sy - 28 (the nameplate row).
    const top = Math.min(...rects.map((r) => r.y));
    expect(top).toBeLessThan(200 - 28);
  });

  it('is centred horizontally around the anchor sx', () => {
    const { ctx, calls } = makeCtx();
    drawPeerEmote(ctx, 'sparkle', 150, 100);
    const body = calls.find(
      (c): c is FillCall => c.op === 'rect' && c.color === '#FFF6E1' && c.h === 11,
    );
    expect(body).toBeDefined();
    const center = body!.x + body!.w / 2;
    expect(Math.abs(center - 150)).toBeLessThanOrEqual(1);
  });
});
