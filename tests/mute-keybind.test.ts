import { describe, expect, it } from 'vitest';
import { handleMuteKeybind } from '../src/game/mute-keybind';

function makeInput(pressed: string[] = []) {
  const set = new Set(pressed);
  return {
    isJustPressed: (k: string) => set.has(k),
  };
}

function makeDriver(lastId: string | null) {
  const toggled: string[] = [];
  let mutedState = false;
  return {
    toggled,
    lastChatterId: (_now: number) => lastId,
    mutes: {
      toggle: (id: string) => {
        toggled.push(id);
        mutedState = !mutedState;
        return mutedState;
      },
    },
  };
}

describe('handleMuteKeybind', () => {
  it('no-ops when m not pressed', () => {
    const drv = makeDriver('alice');
    const r = handleMuteKeybind(makeInput([]), drv, 100);
    expect(r).toEqual({ id: null, muted: false });
    expect(drv.toggled).toEqual([]);
  });

  it('no-ops when no last chatter', () => {
    const drv = makeDriver(null);
    const r = handleMuteKeybind(makeInput(['m']), drv, 100);
    expect(r.id).toBeNull();
    expect(drv.toggled).toEqual([]);
  });

  it('toggles mute on last chatter and reports result', () => {
    const drv = makeDriver('alice');
    const r = handleMuteKeybind(makeInput(['m']), drv, 100);
    expect(r).toEqual({ id: 'alice', muted: true });
    expect(drv.toggled).toEqual(['alice']);
  });

  it('no-ops when chat composer is open', () => {
    const drv = makeDriver('alice');
    const r = handleMuteKeybind(makeInput(['m']), drv, 100, true);
    expect(r.id).toBeNull();
    expect(drv.toggled).toEqual([]);
  });

  it('second press flips back to unmuted', () => {
    const drv = makeDriver('bob');
    const a = handleMuteKeybind(makeInput(['m']), drv, 100);
    const b = handleMuteKeybind(makeInput(['m']), drv, 200);
    expect(a.muted).toBe(true);
    expect(b.muted).toBe(false);
    expect(drv.toggled).toEqual(['bob', 'bob']);
  });
});
