import { describe, it, expect } from 'vitest';
import {
  appendChatChar,
  backspaceChatInput,
  cancelChatInput,
  createChatInput,
  openChatInput,
  submitChatInput,
} from '../src/game/chat-input';
import { CHAT_MAX_LEN } from '../src/game/chat-wire';

describe('chat-input composer', () => {
  it('starts closed with an empty buffer', () => {
    const s = createChatInput();
    expect(s.open).toBe(false);
    expect(s.buffer).toBe('');
  });

  it('ignores input while closed and accepts after open', () => {
    const s = createChatInput();
    appendChatChar(s, 'a');
    expect(s.buffer).toBe('');
    openChatInput(s);
    appendChatChar(s, 'h');
    appendChatChar(s, 'i');
    expect(s.buffer).toBe('hi');
  });

  it('rejects control chars and multi-char strings', () => {
    const s = createChatInput();
    openChatInput(s);
    appendChatChar(s, '\u0000');
    appendChatChar(s, '\u0007');
    appendChatChar(s, 'ab');
    expect(s.buffer).toBe('');
  });

  it('caps buffer length at CHAT_MAX_LEN', () => {
    const s = createChatInput();
    openChatInput(s);
    for (let i = 0; i < CHAT_MAX_LEN + 20; i++) appendChatChar(s, 'x');
    expect(s.buffer.length).toBe(CHAT_MAX_LEN);
  });

  it('backspace trims trailing char, no-op when empty', () => {
    const s = createChatInput();
    openChatInput(s);
    appendChatChar(s, 'a');
    appendChatChar(s, 'b');
    backspaceChatInput(s);
    expect(s.buffer).toBe('a');
    backspaceChatInput(s);
    backspaceChatInput(s);
    expect(s.buffer).toBe('');
  });

  it('submit returns sanitized body and closes; whitespace-only stays open', () => {
    const s = createChatInput();
    openChatInput(s);
    appendChatChar(s, ' ');
    appendChatChar(s, ' ');
    expect(submitChatInput(s)).toBeNull();
    expect(s.open).toBe(true);
    appendChatChar(s, 'h');
    appendChatChar(s, 'i');
    const out = submitChatInput(s);
    expect(out).toBe('hi');
    expect(s.open).toBe(false);
    expect(s.buffer).toBe('');
  });

  it('cancel drops buffer and closes', () => {
    const s = createChatInput();
    openChatInput(s);
    appendChatChar(s, 'h');
    cancelChatInput(s);
    expect(s.open).toBe(false);
    expect(s.buffer).toBe('');
  });
});
