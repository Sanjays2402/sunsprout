import { describe, it, expect } from 'vitest';
import {
  peerRosterPanelRect,
  drawPeerRosterPanel,
} from '../src/ui/peer-roster-panel';
import { peerBadgeRect } from '../src/ui/peer-badge';
import type { RosterEntry } from '../src/game/peer-roster';

describe('peer-roster-panel', () => {
  it('returns zero-height rect when no rows', () => {
    const r = peerRosterPanelRect(800, 0);
    expect(r.h).toBe(0);
  });

  it('anchors below the peer badge with matching width', () => {
    const badge = peerBadgeRect(800);
    const r = peerRosterPanelRect(800, 3);
    expect(r.x).toBe(badge.x);
    expect(r.w).toBe(badge.w);
    expect(r.y).toBe(badge.y + badge.h + 4);
    expect(r.h).toBeGreaterThan(0);
  });

  it('grows linearly with entry count', () => {
    const r1 = peerRosterPanelRect(800, 1);
    const r3 = peerRosterPanelRect(800, 3);
    expect(r3.h - r1.h).toBe(28); // 2 extra rows * 14px
  });

  it('drawPeerRosterPanel skips work for empty list', () => {
    const calls: string[] = [];
    const fakeCtx = new Proxy(
      {},
      {
        get: (_t, prop) => {
          calls.push(String(prop));
          return () => {};
        },
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    drawPeerRosterPanel(fakeCtx, { entries: [], canvasW: 800 });
    expect(calls).toEqual([]);
  });

  it('drawPeerRosterPanel issues draw calls for non-empty list', () => {
    const calls: string[] = [];
    const ctx = makeFakeCtx(calls);
    const entries: RosterEntry[] = [
      { id: 'a', name: 'Ada', color: '#fff', distance: 2, live: true },
      { id: 'b', name: 'Beatrix-Long', color: '#888', distance: 0, live: false },
    ];
    drawPeerRosterPanel(ctx, { entries, canvasW: 800 });
    expect(calls).toContain('fillRect');
    expect(calls).toContain('fillText');
  });
});

function makeFakeCtx(calls: string[]): CanvasRenderingContext2D {
  const stub: Record<string, unknown> = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    fillRect: () => calls.push('fillRect'),
    strokeRect: () => calls.push('strokeRect'),
    fillText: () => calls.push('fillText'),
    beginPath: () => calls.push('beginPath'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
  };
  return new Proxy(stub, {
    get: (t, p) => (p in t ? (t as Record<string | symbol, unknown>)[p] : undefined),
    set: (t, p, v) => {
      (t as Record<string | symbol, unknown>)[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
