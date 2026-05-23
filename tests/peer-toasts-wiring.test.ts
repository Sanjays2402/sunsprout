// Verifies the per-frame contract used by Game: events from PeerPresenceLog
// flow into a PeerToasts queue for both join and leave edges.
import { describe, it, expect } from 'vitest';
import { PeerToasts } from '../src/ui/peer-toasts';
import { PeerPresenceLog } from '../src/game/peer-events';
import { PeerRegistry } from '../src/game/multiplayer';

const snap = (id: string, name: string) => ({
  v: 1,
  id,
  name,
  x: 1,
  y: 2,
  facing: 'down' as const,
  color: '#fff',
  hat: 'none',
});

describe('PeerToasts ← presence diff wiring', () => {
  it('join then leave produce two toasts in order', () => {
    const reg = new PeerRegistry();
    const log = new PeerPresenceLog();
    const toasts = new PeerToasts();

    log.seed(reg);
    expect(toasts.size(0)).toBe(0);

    reg.apply(snap('p1', 'Alex'), 100);
    toasts.push(log.diff(reg, 100), 100);
    expect(toasts.size(100)).toBe(1);

    // Peer goes silent past timeout → eviction → leave on next diff.
    reg.evictStale(10_000, 1_000);
    const events = log.diff(reg, 10_000);
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe('leave');
    toasts.push(events, 10_000);
    // First toast (join @ 100) has TTL'd by now; only the fresh leave remains.
    expect(toasts.size(10_000)).toBe(1);
  });
});
