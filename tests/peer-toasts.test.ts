import { describe, it, expect, vi } from 'vitest';
import { PeerToasts } from '../src/ui/peer-toasts';
import type { PeerEvent } from '../src/game/peer-events';

function makeCtx() {
  const calls: string[] = [];
  const ctx = {
    calls,
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) =>
      calls.push(`fillRect:${x},${y},${w},${h}`),
    ),
    fillText: vi.fn((s: string) => calls.push(`text:${s}`)),
    set fillStyle(v: string) {
      calls.push(`fill:${v}`);
    },
    set globalAlpha(v: number) {
      calls.push(`alpha:${v.toFixed(2)}`);
    },
    set font(_v: string) {},
    set textBaseline(_v: string) {},
    set textAlign(_v: string) {},
    set imageSmoothingEnabled(_v: boolean) {},
  } as unknown as CanvasRenderingContext2D & { calls: string[] };
  return ctx as CanvasRenderingContext2D & { calls: string[] };
}

const ev = (kind: 'join' | 'leave', name: string, id = name): PeerEvent => ({
  kind,
  id,
  name,
  at: 0,
});

describe('PeerToasts', () => {
  it('renders one toast per pushed event with the right name', () => {
    const t = new PeerToasts();
    t.push([ev('join', 'Alex'), ev('leave', 'Bea')], 0);
    expect(t.size(0)).toBe(2);
    const ctx = makeCtx();
    t.draw(ctx, 800, 100);
    expect(ctx.calls.some((c) => c === 'text:Alex joined')).toBe(true);
    expect(ctx.calls.some((c) => c === 'text:Bea left')).toBe(true);
  });

  it('expires toasts after their TTL', () => {
    const t = new PeerToasts();
    t.push([ev('join', 'Alex')], 0);
    expect(t.size(0)).toBe(1);
    expect(t.size(10_000)).toBe(0);
  });

  it('caps the visible queue, evicting oldest first', () => {
    const t = new PeerToasts();
    const burst: PeerEvent[] = [];
    for (let i = 0; i < 10; i++) burst.push(ev('join', `P${i}`, `id${i}`));
    t.push(burst, 0);
    expect(t.size(0)).toBe(4);
    const ctx = makeCtx();
    t.draw(ctx, 800, 0);
    // Oldest (P0..P5) evicted; P6..P9 should remain.
    expect(ctx.calls.some((c) => c === 'text:P9 joined')).toBe(true);
    expect(ctx.calls.some((c) => c === 'text:P0 joined')).toBe(false);
  });

  it('clear() drops everything', () => {
    const t = new PeerToasts();
    t.push([ev('join', 'Alex')], 0);
    t.clear();
    expect(t.size(0)).toBe(0);
  });

  it('draw is a no-op when empty', () => {
    const t = new PeerToasts();
    const ctx = makeCtx();
    t.draw(ctx, 800, 0);
    expect(ctx.calls.length).toBe(0);
  });
});
