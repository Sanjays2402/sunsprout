import { describe, it, expect } from 'vitest';
import { PeerPresenceLog } from '../src/game/peer-events';
import { PeerRegistry, buildSnapshot } from '../src/game/multiplayer';

function snap(id: string, name: string, x = 0, y = 0) {
  return buildSnapshot({ id, name, x, y, facing: 'down', color: '#fff', hat: '#000' });
}

describe('PeerPresenceLog', () => {
  it('reports first-seen peers as joins', () => {
    const reg = new PeerRegistry();
    reg.apply(snap('a', 'Alex'), 0);
    reg.apply(snap('b', 'Bea'), 0);
    const log = new PeerPresenceLog();
    const ev = log.diff(reg, 100);
    expect(ev).toHaveLength(2);
    expect(ev.every((e) => e.kind === 'join')).toBe(true);
    expect(ev.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(log.size()).toBe(2);
  });

  it('emits no events when registry is unchanged', () => {
    const reg = new PeerRegistry();
    reg.apply(snap('a', 'Alex'), 0);
    const log = new PeerPresenceLog();
    log.diff(reg, 0);
    expect(log.diff(reg, 1)).toEqual([]);
  });

  it('emits a leave event when a peer disappears, using the last-seen name', () => {
    const reg = new PeerRegistry();
    reg.apply(snap('a', 'Alex'), 0);
    const log = new PeerPresenceLog();
    log.diff(reg, 0);
    // Peer renames before leaving.
    reg.apply(snap('a', 'Alexandra'), 100);
    log.diff(reg, 100);
    reg.remove('a');
    const ev = log.diff(reg, 200);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'leave', id: 'a', name: 'Alexandra', at: 200 });
    expect(log.has('a')).toBe(false);
  });

  it('seed() suppresses joins for peers already present', () => {
    const reg = new PeerRegistry();
    reg.apply(snap('a', 'Alex'), 0);
    const log = new PeerPresenceLog();
    log.seed(reg);
    expect(log.diff(reg, 10)).toEqual([]);
    reg.apply(snap('b', 'Bea'), 10);
    const ev = log.diff(reg, 20);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'join', id: 'b' });
  });

  it('clear() makes every current peer look new on the next diff', () => {
    const reg = new PeerRegistry();
    reg.apply(snap('a', 'Alex'), 0);
    const log = new PeerPresenceLog();
    log.diff(reg, 0);
    log.clear();
    const ev = log.diff(reg, 1);
    expect(ev).toHaveLength(1);
    expect(ev[0].kind).toBe('join');
  });
});
