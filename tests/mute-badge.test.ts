import { describe, it, expect, vi } from 'vitest';
import { drawMuteBadge, muteBadgeRect } from '../src/ui/mute-badge';
import { peerBadgeRect } from '../src/ui/peer-badge';

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

describe('mute-badge', () => {
  it('stacks directly under the peer badge', () => {
    const peer = peerBadgeRect(800);
    const mute = muteBadgeRect(800);
    expect(mute.x).toBe(peer.x);
    expect(mute.y).toBeGreaterThan(peer.y + peer.h);
    expect(mute.y).toBeLessThan(peer.y + peer.h + 20);
    expect(mute.w).toBe(peer.w);
  });

  it('skips drawing when mutedCount is 0', () => {
    const ctx = fakeCtx();
    drawMuteBadge(ctx, { mutedCount: 0, canvasW: 800 });
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it('renders singular "muted 1" copy', () => {
    const ctx = fakeCtx();
    drawMuteBadge(ctx, { mutedCount: 1, canvasW: 800 });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((s) => String(s).includes('muted 1'))).toBe(true);
  });

  it('renders plural "muted N" copy for >1', () => {
    const ctx = fakeCtx();
    drawMuteBadge(ctx, { mutedCount: 4, canvasW: 800 });
    const calls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.some((s) => String(s).includes('muted 4'))).toBe(true);
  });
});
