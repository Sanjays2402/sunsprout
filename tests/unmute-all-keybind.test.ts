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
    expect(handleUnmuteAllKeybind(makeInput([]), drv)).toEqual({ cleared: 0 });
    expect(drv.calls.clear).toBe(0);
  });

  it('no-ops when chat is open', () => {
    const drv = makeDriver(3);
    expect(handleUnmuteAllKeybind(makeInput(['u']), drv, true)).toEqual({
      cleared: 0,
    });
    expect(drv.calls.clear).toBe(0);
  });

  it('no-ops when nobody is muted', () => {
    const drv = makeDriver(0);
    expect(handleUnmuteAllKeybind(makeInput(['u']), drv)).toEqual({
      cleared: 0,
    });
    expect(drv.calls.clear).toBe(0);
  });

  it('clears all mutes and reports prior count', () => {
    const drv = makeDriver(3);
    const r = handleUnmuteAllKeybind(makeInput(['u']), drv);
    expect(r).toEqual({ cleared: 3 });
    expect(drv.calls.clear).toBe(1);
    expect(drv.sizeRef()).toBe(0);
  });

  it('second press after clear is a no-op', () => {
    const drv = makeDriver(2);
    handleUnmuteAllKeybind(makeInput(['u']), drv);
    const r2 = handleUnmuteAllKeybind(makeInput(['u']), drv);
    expect(r2).toEqual({ cleared: 0 });
    expect(drv.calls.clear).toBe(1);
  });
});
