import { describe, it, expect, vi } from 'vitest';
import { drawPeerBadge, peerBadgeRect } from '../src/ui/peer-badge';

function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    imageSmoothingEnabled: false,
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D & { fillText: ReturnType<typeof vi.fn> };
}

describe('peer-badge', () => {
  it('anchors to the top-right of the canvas under the status bar', () => {
    const r = peerBadgeRect(800);
    expect(r.x + r.w).toBeLessThanOrEqual(800);
    expect(r.x).toBeGreaterThan(800 / 2);
    expect(r.y).toBeGreaterThanOrEqual(32);
    expect(r.w).toBeGreaterThan(40);
    expect(r.h).toBeGreaterThan(0);
  });

  it('renders singular "1 friend" copy when one peer is connected', () => {
    const ctx = fakeCtx();
    drawPeerBadge(ctx, { peerCount: 1, canvasW: 800 });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((s) => String(s).includes('1 friend'))).toBe(true);
  });

  it('renders plural "N friends" copy when multiple peers are connected', () => {
    const ctx = fakeCtx();
    drawPeerBadge(ctx, { peerCount: 3, canvasW: 800 });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((s) => String(s).includes('3 friends'))).toBe(true);
  });

  it('still draws the badge when no peers are connected (dim state)', () => {
    const ctx = fakeCtx();
    drawPeerBadge(ctx, { peerCount: 0, canvasW: 800 });
    // Background panel rect drawn means badge is present.
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((s) => String(s).includes('0 friends'))).toBe(true);
  });
});
