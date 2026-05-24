import { describe, it, expect } from 'vitest';
import { emoteLegendRect, drawEmoteLegend } from '../src/ui/emote-legend';
import { EMOTE_BINDINGS } from '../src/game/emote-keybinds';

describe('emote legend', () => {
  it('anchors to bottom-right with width scaling per binding count', () => {
    const r = emoteLegendRect(800, 600);
    expect(r.x + r.w).toBe(800 - 8);
    expect(r.y + r.h).toBe(600 - 8);
    expect(r.w).toBe(6 * 2 + 28 * EMOTE_BINDINGS.length);
    expect(r.h).toBe(22);
  });

  it('draws without throwing on a stub ctx', () => {
    const calls: string[] = [];
    const ctx = {
      save() { calls.push('save'); },
      restore() { calls.push('restore'); },
      fillRect() {},
      strokeRect() {},
      fillText() { calls.push('text'); },
      beginPath() {},
      arc() {},
      fill() {},
      stroke() {},
      set imageSmoothingEnabled(_v: boolean) {},
      set fillStyle(_v: string) {},
      set strokeStyle(_v: string) {},
      set font(_v: string) {},
      set textBaseline(_v: string) {},
      set textAlign(_v: string) {},
    } as unknown as CanvasRenderingContext2D;
    drawEmoteLegend(ctx, { canvasW: 800, canvasH: 600 });
    expect(calls[0]).toBe('save');
    expect(calls[calls.length - 1]).toBe('restore');
    // 2 fillText calls per binding (key + glyph)
    const textCount = calls.filter((c) => c === 'text').length;
    expect(textCount).toBe(EMOTE_BINDINGS.length * 2);
  });
});
