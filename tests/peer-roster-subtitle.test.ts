import { describe, it, expect, vi } from 'vitest';
import {
  drawRosterSubtitle,
  rosterSubtitleRect,
} from '../src/ui/peer-roster-subtitle';
import { peerBadgeRect } from '../src/ui/peer-badge';

function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    imageSmoothingEnabled: false,
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D & {
    fillText: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
  };
}

describe('peer-roster-subtitle', () => {
  it('stacks directly under the peer badge with the same width', () => {
    const badge = peerBadgeRect(800);
    const r = rosterSubtitleRect(800);
    expect(r.x).toBe(badge.x);
    expect(r.w).toBe(badge.w);
    expect(r.y).toBeGreaterThanOrEqual(badge.y + badge.h);
    expect(r.y).toBeLessThan(badge.y + badge.h + 8);
    expect(r.h).toBeGreaterThan(0);
  });

  it('draws the summary text when provided', () => {
    const ctx = fakeCtx();
    drawRosterSubtitle(ctx, { text: '3 nearby · nearest 2t', canvasW: 800 });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    );
    expect(calls.some((s) => String(s).includes('3 nearby'))).toBe(true);
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      0,
    );
  });

  it('tints with the tone palette when a tone is supplied', () => {
    const fills: string[] = [];
    const strokes: string[] = [];
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      imageSmoothingEnabled: false,
      set fillStyle(v: string) {
        fills.push(v);
      },
      get fillStyle() {
        return fills[fills.length - 1] ?? '';
      },
      set strokeStyle(v: string) {
        strokes.push(v);
      },
      get strokeStyle() {
        return strokes[strokes.length - 1] ?? '';
      },
      font: '',
      textAlign: '',
      textBaseline: '',
    } as unknown as CanvasRenderingContext2D;

    drawRosterSubtitle(ctx, { text: 'hi', canvasW: 800, tone: 'busy' });
    // Busy palette text color is the warm amber #f4cb9a.
    expect(fills).toContain('#f4cb9a');
    expect(strokes).toContain('#a87142');
  });

  it('is a no-op when text is empty (solo play)', () => {
    const ctx = fakeCtx();
    drawRosterSubtitle(ctx, { text: '', canvasW: 800 });
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
