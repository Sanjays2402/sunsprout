import { describe, it, expect } from 'vitest';
import {
  CHAT_MAX_LEN,
  CHAT_WIRE_TAG,
  CHAT_WIRE_VERSION,
  deserializeChat,
  looksLikeChatWire,
  makeChatMessage,
  sanitizeChatText,
  serializeChat,
} from '../src/game/chat-wire';
import { serializeSnapshot, buildSnapshot } from '../src/game/multiplayer';
import { makeEmoteMessage, serializeEmote } from '../src/game/emote-wire';

describe('chat-wire', () => {
  it('sanitizes control chars, collapses whitespace, trims, caps length', () => {
    expect(sanitizeChatText('  hello\t\nworld  ')).toBe('hello world');
    expect(sanitizeChatText('a\u0000b\u0007c')).toBe('a b c');
    const long = 'x'.repeat(CHAT_MAX_LEN + 50);
    expect(sanitizeChatText(long).length).toBe(CHAT_MAX_LEN);
    expect(sanitizeChatText('   ')).toBe('');
    expect(sanitizeChatText(null as unknown as string)).toBe('');
  });

  it('makeChatMessage rejects empty body and bad ids', () => {
    expect(makeChatMessage('p_1', '   ')).toBeNull();
    expect(makeChatMessage('', 'hi')).toBeNull();
    expect(makeChatMessage('x'.repeat(65), 'hi')).toBeNull();
    const msg = makeChatMessage('p_1', '  hey there  ');
    expect(msg).toEqual({ t: CHAT_WIRE_TAG, v: CHAT_WIRE_VERSION, id: 'p_1', m: 'hey there' });
  });

  it('round-trips via serialize/deserialize', () => {
    const msg = makeChatMessage('p_42', 'gm farmers')!;
    const raw = serializeChat(msg);
    expect(looksLikeChatWire(raw)).toBe(true);
    expect(deserializeChat(raw)).toEqual(msg);
  });

  it('rejects malformed payloads', () => {
    expect(deserializeChat('not json')).toBeNull();
    expect(deserializeChat('null')).toBeNull();
    expect(deserializeChat(JSON.stringify({ t: 'emote', v: 1, id: 'a', k: 'wave' }))).toBeNull();
    expect(deserializeChat(JSON.stringify({ t: 'chat', v: 999, id: 'a', m: 'hi' }))).toBeNull();
    expect(deserializeChat(JSON.stringify({ t: 'chat', v: 1, id: '', m: 'hi' }))).toBeNull();
    expect(deserializeChat(JSON.stringify({ t: 'chat', v: 1, id: 'a', m: '   ' }))).toBeNull();
    expect(deserializeChat(JSON.stringify({ t: 'chat', v: 1, id: 'a', m: 42 }))).toBeNull();
  });

  it('demuxes safely from snapshot and emote wire strings', () => {
    const snap = serializeSnapshot(
      buildSnapshot({ id: 'p1', name: 'finn', x: 1, y: 2, facing: 'down', color: '#fff', hat: '#000' }),
    );
    const emote = serializeEmote(makeEmoteMessage('p1', 'wave'));
    expect(looksLikeChatWire(snap)).toBe(false);
    expect(looksLikeChatWire(emote)).toBe(false);
    expect(deserializeChat(snap)).toBeNull();
    expect(deserializeChat(emote)).toBeNull();
  });
});
