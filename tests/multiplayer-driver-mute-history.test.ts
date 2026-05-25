import { describe, expect, it } from 'vitest';
import { LoopbackBus } from '../src/game/multiplayer-transport';
import { MultiplayerSession } from '../src/game/multiplayer-session';
import { PeerView } from '../src/game/peer-view';
import { MultiplayerDriver } from '../src/game/multiplayer-driver';
import { MuteHistory } from '../src/game/mute-history';
import { handleUnmuteAllKeybind } from '../src/game/unmute-all-keybind';
import { handleRestoreMutesKeybind } from '../src/game/restore-mutes-keybind';

function makeDriver() {
  const bus = new LoopbackBus();
  const session = new MultiplayerSession({
    identity: { id: 'a', name: 'A', color: '#ff8855', hat: '#222' },
    transport: bus.connect('a'),
    broadcastIntervalMs: 50,
  });
  return new MultiplayerDriver({ session, view: new PeerView() });
}

class FakeInput {
  private just = new Set<string>();
  private held = new Set<string>();
  press(k: string, held = false) {
    this.just.add(k);
    if (held) this.held.add(k);
  }
  release() {
    this.just.clear();
  }
  isJustPressed(k: string) {
    return this.just.has(k);
  }
  isPressed(k: string) {
    return this.held.has(k);
  }
}

describe('MultiplayerDriver muteHistory', () => {
  it('exposes a default MuteHistory instance', () => {
    const d = makeDriver();
    expect(d.muteHistory).toBeInstanceOf(MuteHistory);
    expect(d.muteHistory.size()).toBe(0);
  });

  it('accepts an injected MuteHistory', () => {
    const bus = new LoopbackBus();
    const session = new MultiplayerSession({
      identity: { id: 'a', name: 'A', color: '#fff', hat: '#222' },
      transport: bus.connect('a'),
      broadcastIntervalMs: 50,
    });
    const hist = new MuteHistory(4);
    const d = new MultiplayerDriver({ session, view: new PeerView(), muteHistory: hist });
    expect(d.muteHistory).toBe(hist);
    expect(d.muteHistory.depth).toBe(4);
  });

  it('round-trips through unmute-all → restore via the wired history', () => {
    const d = makeDriver();
    d.mutes.mute('alice');
    d.mutes.mute('bob');

    // unmute-all now auto-snapshots the prior set into muteHistory.
    const input = new FakeInput();
    input.press('u');
    const cleared = handleUnmuteAllKeybind(input, d);
    expect(cleared.cleared).toBe(2);
    expect(cleared.snapshotted).toBe(true);
    expect(d.muteHistory.size()).toBe(1);
    expect(d.mutes.size()).toBe(0);

    input.release();
    input.press('u', false);
    // arm shift
    const shiftInput = new FakeInput();
    shiftInput.press('u');
    (shiftInput as unknown as { held: Set<string> }).held = new Set(['shift']);
    const restored = handleRestoreMutesKeybind(shiftInput, d);
    expect(restored.restored).toBe(2);
    expect(d.mutes.isMuted('alice')).toBe(true);
    expect(d.mutes.isMuted('bob')).toBe(true);
    expect(d.muteHistory.size()).toBe(0);
  });

  it('prunes departed peer ids from muteHistory snapshots on leave', () => {
    const d = makeDriver();
    // Make a peer "exist" then evict it via a stale tick.
    d.session.registry.apply(
      { v: 1, id: 'bob', name: 'Bob', x: 0, y: 0, facing: 'down', color: '#fff', hat: '#000' },
      1000,
    );
    // Stash a snapshot mentioning bob (and someone still around).
    d.muteHistory.push(['bob', 'carol']);
    expect(d.muteHistory.peek()).toEqual(['bob', 'carol']);

    // First tick at t=1000 records bob as joined in the presence log.
    d.tick({ x: 0, y: 0, facing: 'down' }, 1000);
    // Second tick well past peerTimeoutMs (5s) so bob is evicted → leave event.
    d.tick({ x: 0, y: 0, facing: 'down' }, 1000 + 10_000);

    // bob pruned, carol survives.
    expect(d.muteHistory.peek()).toEqual(['carol']);
  });
});
