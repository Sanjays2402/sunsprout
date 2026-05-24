import { describe, it, expect } from 'vitest';
import { chatBarRect, drawChatBar } from '../src/ui/chat-bar';
import { createChatInput, openChatInput, appendChatChar } from '../src/game/chat-input';

describe('chat-bar layout', () => {
  it('centers horizontally and sits above the bottom margin', () => {
    const r = chatBarRect(800, 600);
    expect(r.x + r.w / 2).toBeCloseTo(400, 0);
    expect(r.y + r.h).toBeLessThan(600);
    expect(r.w).toBeGreaterThanOrEqual(220);
    expect(r.w).toBeLessThanOrEqual(360);
  });

  it('clamps width on tiny canvases to the floor', () => {
    const r = chatBarRect(320, 240);
    expect(r.w).toBe(220);
    expect(r.x).toBeGreaterThanOrEqual(0);
  });

  it('clamps width on huge canvases to the ceiling', () => {
    const r = chatBarRect(2000, 1200);
    expect(r.w).toBe(360);
  });
});

describe('chat-bar draw', () => {
  function fakeCtx() {
    const calls: string[] = [];
    return {
      calls,
      ctx: {
        save() { calls.push('save'); },
        restore() { calls.push('restore'); },
        fillRect() { calls.push('fillRect'); },
        strokeRect() { calls.push('strokeRect'); },
        fillText(txt: string) { calls.push('text:' + txt); },
        measureText() { return { width: 10 }; },
        set fillStyle(_v: string) {},
        set strokeStyle(_v: string) {},
        set font(_v: string) {},
        set textBaseline(_v: string) {},
        set textAlign(_v: string) {},
        imageSmoothingEnabled: false,
      } as unknown as CanvasRenderingContext2D,
    };
  }

  it('is a no-op when composer is closed', () => {
    const f = fakeCtx();
    const s = createChatInput();
    drawChatBar(f.ctx, { canvasW: 800, canvasH: 600, state: s, tick: 0 });
    expect(f.calls.length).toBe(0);
  });

  it('renders prompt + buffer when open', () => {
    const f = fakeCtx();
    const s = createChatInput();
    openChatInput(s);
    appendChatChar(s, 'h');
    appendChatChar(s, 'i');
    drawChatBar(f.ctx, { canvasW: 800, canvasH: 600, state: s, tick: 0 });
    expect(f.calls).toContain('text:say>');
    expect(f.calls).toContain('text:hi');
  });
});
