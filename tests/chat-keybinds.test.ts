import { describe, expect, it } from 'vitest';
import { handleChatInput, type ChatInputLike } from '../src/game/chat-keybinds';
import { createChatInput } from '../src/game/chat-input';

class FakeInput implements ChatInputLike {
  justPressed: Set<string>;
  constructor(keys: string[] = []) {
    this.justPressed = new Set(keys.map((k) => k.toLowerCase()));
  }
  isJustPressed(key: string): boolean {
    return this.justPressed.has(key.toLowerCase());
  }
}

describe('handleChatInput', () => {
  it('opens composer when t is pressed while closed', () => {
    const s = createChatInput();
    const r = handleChatInput(new FakeInput(['t']), s);
    expect(r.opened).toBe(true);
    expect(s.open).toBe(true);
    expect(s.buffer).toBe('');
  });

  it('opens composer on enter while closed', () => {
    const s = createChatInput();
    const r = handleChatInput(new FakeInput(['enter']), s);
    expect(r.opened).toBe(true);
    expect(s.open).toBe(true);
  });

  it('does not type the opener key into the buffer on the same frame', () => {
    const s = createChatInput();
    handleChatInput(new FakeInput(['t']), s);
    // Now open; a fresh frame with another printable goes through.
    handleChatInput(new FakeInput(['h']), s);
    expect(s.buffer).toBe('h');
  });

  it('appends printable chars and ignores named keys', () => {
    const s = createChatInput();
    handleChatInput(new FakeInput(['t']), s);
    handleChatInput(new FakeInput(['h', 'i', 'shift']), s);
    expect(s.buffer).toBe('hi');
  });

  it('backspace removes trailing char', () => {
    const s = createChatInput();
    handleChatInput(new FakeInput(['t']), s);
    handleChatInput(new FakeInput(['a']), s);
    handleChatInput(new FakeInput(['b']), s);
    handleChatInput(new FakeInput(['backspace']), s);
    expect(s.buffer).toBe('a');
  });

  it('escape cancels and closes', () => {
    const s = createChatInput();
    handleChatInput(new FakeInput(['t']), s);
    handleChatInput(new FakeInput(['x']), s);
    const r = handleChatInput(new FakeInput(['escape']), s);
    expect(r.closed).toBe(true);
    expect(r.submitted).toBe(null);
    expect(s.open).toBe(false);
    expect(s.buffer).toBe('');
  });

  it('enter submits non-empty buffer and closes', () => {
    const s = createChatInput();
    handleChatInput(new FakeInput(['t']), s);
    handleChatInput(new FakeInput(['h', 'i']), s);
    const r = handleChatInput(new FakeInput(['enter']), s);
    expect(r.submitted).toBe('hi');
    expect(r.closed).toBe(true);
    expect(s.open).toBe(false);
  });

  it('enter on empty buffer keeps composer open and returns null', () => {
    const s = createChatInput();
    handleChatInput(new FakeInput(['t']), s);
    const r = handleChatInput(new FakeInput(['enter']), s);
    expect(r.submitted).toBe(null);
    expect(r.closed).toBe(false);
    expect(s.open).toBe(true);
  });

  it('ignores all input when closed except openers', () => {
    const s = createChatInput();
    handleChatInput(new FakeInput(['h', 'backspace', 'escape']), s);
    expect(s.open).toBe(false);
    expect(s.buffer).toBe('');
  });

  it('prefers escape over enter when both pressed', () => {
    const s = createChatInput();
    handleChatInput(new FakeInput(['t']), s);
    handleChatInput(new FakeInput(['h', 'i']), s);
    const r = handleChatInput(new FakeInput(['escape', 'enter']), s);
    expect(r.closed).toBe(true);
    expect(r.submitted).toBe(null);
  });
});
