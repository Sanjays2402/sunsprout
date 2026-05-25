import { describe, expect, it } from 'vitest';
import { handleUnmuteAllKeybind } from '../src/game/unmute-all-keybind';

function makeInput(pressed: string[] = []) {
  const set = new Set(pressed);
  return { isJustPressed: (k: string) => set.has(k) };
}

function makeDriver(initialSize: number) {
  let size = initialSize;
  const calls = { clear: 0 };
  return {
    calls,
    sizeRef: () => size,
    mutes: {
      size: () => size,
      clear: () => {
        calls.clear++;
        size = 0;
      },
    },
  };
}

describe('handleUnmuteAllKeybind', () => {
  it('no-ops when u not pressed', () => {
    const drv = makeDriver(3);
    expect(handleUnmuteAllKeybind(makeInput([]), drv)).toEqual({
      cleared: 0,
      snapshotted: false,
    });
    expect(drv.calls.clear).toBe(0);
  });

  it('no-ops when chat is open', () => {
    const drv = makeDriver(3);
    expect(handleUnmuteAllKeybind(makeInput(['u']), drv, true)).toEqual({
      cleared: 0,
      snapshotted: false,
    });
    expect(drv.calls.clear).toBe(0);
  });

  it('no-ops when nobody is muted', () => {
    const drv = makeDriver(0);
    expect(handleUnmuteAllKeybind(makeInput(['u']), drv)).toEqual({
      cleared: 0,
      snapshotted: false,
    });
    expect(drv.calls.clear).toBe(0);
  });

  it('clears all mutes and reports prior count', () => {
    const drv = makeDriver(3);
    const r = handleUnmuteAllKeybind(makeInput(['u']), drv);
    expect(r).toEqual({ cleared: 3, snapshotted: false });
    expect(drv.calls.clear).toBe(1);
    expect(drv.sizeRef()).toBe(0);
  });

  it('second press after clear is a no-op', () => {
    const drv = makeDriver(2);
    handleUnmuteAllKeybind(makeInput(['u']), drv);
    const r2 = handleUnmuteAllKeybind(makeInput(['u']), drv);
    expect(r2).toEqual({ cleared: 0, snapshotted: false });
    expect(drv.calls.clear).toBe(1);
  });

  it('snapshots mute list into driver.muteHistory before clearing', () => {
    const drv = makeDriver(2);
    const pushed: string[][] = [];
    (drv.mutes as unknown as { list: () => string[] }).list = () => [
      'alice',
      'bob',
    ];
    (drv as unknown as { muteHistory: { push: (ids: readonly string[]) => boolean } }).muteHistory = {
      push: (ids) => {
        pushed.push([...ids]);
        return true;
      },
    };
    const r = handleUnmuteAllKeybind(makeInput(['u']), drv);
    expect(r).toEqual({ cleared: 2, snapshotted: true });
    expect(pushed).toEqual([['alice', 'bob']]);
    expect(drv.calls.clear).toBe(1);
  });

  it('clears even when muteHistory.push rejects the snapshot', () => {
    const drv = makeDriver(1);
    (drv.mutes as unknown as { list: () => string[] }).list = () => ['x'];
    (drv as unknown as { muteHistory: { push: () => boolean } }).muteHistory = {
      push: () => false,
    };
    const r = handleUnmuteAllKeybind(makeInput(['u']), drv);
    expect(r).toEqual({ cleared: 1, snapshotted: false });
    expect(drv.calls.clear).toBe(1);
  });
});
