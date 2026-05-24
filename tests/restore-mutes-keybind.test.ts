import { describe, expect, it } from 'vitest';
import { handleRestoreMutesKeybind } from '../src/game/restore-mutes-keybind';
import { ChatMuteSet } from '../src/game/chat-mute';
import { MuteHistory } from '../src/game/mute-history';

function makeInput(pressed: string[] = [], held: string[] = []) {
  const jp = new Set(pressed);
  const hp = new Set(held);
  return {
    isJustPressed: (k: string) => jp.has(k),
    isPressed: (k: string) => hp.has(k),
  };
}

function makeDriver() {
  return { mutes: new ChatMuteSet(), muteHistory: new MuteHistory() };
}

describe('handleRestoreMutesKeybind', () => {
  it('no-ops when shift not held', () => {
    const drv = makeDriver();
    drv.muteHistory.push(['alice', 'bob']);
    expect(handleRestoreMutesKeybind(makeInput(['u'], []), drv)).toEqual({
      restored: 0,
    });
    expect(drv.muteHistory.size()).toBe(1);
    expect(drv.mutes.size()).toBe(0);
  });

  it('no-ops when u not just-pressed', () => {
    const drv = makeDriver();
    drv.muteHistory.push(['alice']);
    expect(
      handleRestoreMutesKeybind(makeInput([], ['shift']), drv),
    ).toEqual({ restored: 0 });
    expect(drv.muteHistory.size()).toBe(1);
  });

  it('no-ops when chat is open', () => {
    const drv = makeDriver();
    drv.muteHistory.push(['alice']);
    expect(
      handleRestoreMutesKeybind(makeInput(['u'], ['shift']), drv, true),
    ).toEqual({ restored: 0 });
    expect(drv.muteHistory.size()).toBe(1);
  });

  it('no-ops when history is empty', () => {
    const drv = makeDriver();
    expect(
      handleRestoreMutesKeybind(makeInput(['u'], ['shift']), drv),
    ).toEqual({ restored: 0 });
  });

  it('pops history and re-mutes ids on Shift+U', () => {
    const drv = makeDriver();
    drv.muteHistory.push(['alice', 'bob', 'cleo']);
    const r = handleRestoreMutesKeybind(makeInput(['u'], ['shift']), drv);
    expect(r).toEqual({ restored: 3 });
    expect(drv.mutes.list()).toEqual(['alice', 'bob', 'cleo']);
    expect(drv.muteHistory.size()).toBe(0);
  });

  it('only counts newly-added mutes (already-muted ids dont double-count)', () => {
    const drv = makeDriver();
    drv.mutes.mute('alice');
    drv.muteHistory.push(['alice', 'bob']);
    const r = handleRestoreMutesKeybind(makeInput(['u'], ['shift']), drv);
    expect(r).toEqual({ restored: 1 });
    expect(drv.mutes.list()).toEqual(['alice', 'bob']);
  });

  it('second Shift+U restores the previous snapshot too', () => {
    const drv = makeDriver();
    drv.muteHistory.push(['alice']);
    drv.muteHistory.push(['bob', 'cleo']);
    handleRestoreMutesKeybind(makeInput(['u'], ['shift']), drv);
    expect(drv.mutes.list()).toEqual(['bob', 'cleo']);
    drv.mutes.clear();
    const r2 = handleRestoreMutesKeybind(makeInput(['u'], ['shift']), drv);
    expect(r2).toEqual({ restored: 1 });
    expect(drv.mutes.list()).toEqual(['alice']);
  });
});
