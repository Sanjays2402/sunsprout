// v0.6.0 slice — verify the roster panel layout reflects what
// buildPeerRoster returns from a PeerRegistry snapshot. This guards the
// game.ts wiring: roster len -> panel height.
import { describe, it, expect } from 'vitest';
import { PeerRegistry } from '../src/game/multiplayer';
import { buildPeerRoster } from '../src/game/peer-roster';
import { peerRosterPanelRect } from '../src/ui/peer-roster-panel';

describe('peer roster wiring (registry -> panel)', () => {
  it('panel height scales with live peers around the local player', () => {
    const reg = new PeerRegistry();
    const now = 1000;
    reg.apply(
      { v: 1, id: 'a', name: 'Ari', color: '#fff', hat: '#000', x: 5, y: 5, facing: 'down' },
      now,
    );
    reg.apply(
      { v: 1, id: 'b', name: 'Bea', color: '#fa0', hat: '#000', x: 8, y: 5, facing: 'down' },
      now,
    );

    const roster = buildPeerRoster(reg.list(), {
      localX: 5,
      localY: 5,
      now,
    });
    expect(roster).toHaveLength(2);
    expect(roster[0].distance).toBe(0); // local-overlap peer first
    expect(roster[0].live).toBe(true);

    const empty = peerRosterPanelRect(800, 0);
    const full = peerRosterPanelRect(800, roster.length);
    expect(empty.h).toBe(0);
    expect(full.h).toBeGreaterThan(0);
    expect(full.w).toBe(empty.w);
  });
});
