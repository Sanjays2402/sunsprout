import { describe, expect, it } from 'vitest';
import {
  EMOTE_BINDINGS,
  emoteForKey,
  handleEmoteInput,
} from '../src/game/emote-keybinds';
import type { EmoteKind } from '../src/game/peer-emotes';

class FakeInput {
  private keys = new Set<string>();
  press(k: string) {
    this.keys.add(k.toLowerCase());
  }
  isJustPressed(k: string): boolean {
    return this.keys.has(k.toLowerCase());
  }
}

class FakeDriver {
  sent: Array<{ kind: EmoteKind; now: number }> = [];
  sendEmote(kind: EmoteKind, now: number) {
    this.sent.push({ kind, now });
  }
}

describe('emote-keybinds', () => {
  it('covers all five emote kinds with unique number keys', () => {
    const keys = EMOTE_BINDINGS.map(([k]) => k);
    const kinds = EMOTE_BINDINGS.map(([, e]) => e);
    expect(new Set(keys).size).toBe(EMOTE_BINDINGS.length);
    expect(new Set(kinds).size).toBe(EMOTE_BINDINGS.length);
    expect(EMOTE_BINDINGS.length).toBe(5);
  });

  it('emoteForKey maps known keys and ignores others (case-insensitive)', () => {
    expect(emoteForKey('1')).toBe('wave');
    expect(emoteForKey('2')).toBe('heart');
    expect(emoteForKey('5')).toBe('note');
    expect(emoteForKey('q')).toBeUndefined();
    expect(emoteForKey('')).toBeUndefined();
  });

  it('handleEmoteInput fires the matching emote exactly once', () => {
    const input = new FakeInput();
    const driver = new FakeDriver();
    input.press('3');
    const sent = handleEmoteInput(input, driver, 1234);
    expect(sent).toBe('sprout');
    expect(driver.sent).toEqual([{ kind: 'sprout', now: 1234 }]);
  });

  it('no-ops cleanly when no bound key is pressed', () => {
    const input = new FakeInput();
    const driver = new FakeDriver();
    input.press('x');
    expect(handleEmoteInput(input, driver, 0)).toBeUndefined();
    expect(driver.sent).toHaveLength(0);
  });

  it('only emits one emote per call even if multiple bindings are held', () => {
    const input = new FakeInput();
    const driver = new FakeDriver();
    input.press('2');
    input.press('4');
    handleEmoteInput(input, driver, 10);
    expect(driver.sent).toHaveLength(1);
    // Earlier bindings win (table order).
    expect(driver.sent[0].kind).toBe('heart');
  });
});
