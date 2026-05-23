import { describe, expect, it } from 'vitest';
import {
  EMOTE_WIRE_TAG,
  EMOTE_WIRE_VERSION,
  deserializeEmote,
  looksLikeEmoteWire,
  makeEmoteMessage,
  serializeEmote,
} from '../src/game/emote-wire';

describe('emote-wire', () => {
  it('round-trips a valid emote message', () => {
    const msg = makeEmoteMessage('peer-1', 'wave');
    const raw = serializeEmote(msg);
    const parsed = deserializeEmote(raw);
    expect(parsed).toEqual({ t: EMOTE_WIRE_TAG, v: EMOTE_WIRE_VERSION, id: 'peer-1', k: 'wave' });
  });

  it('rejects messages missing the emote tag', () => {
    expect(deserializeEmote('{"v":1,"id":"p","k":"wave"}')).toBeNull();
    expect(deserializeEmote('{"t":"snap","v":1,"id":"p","k":"wave"}')).toBeNull();
  });

  it('rejects unknown emote kinds and bad ids', () => {
    expect(deserializeEmote('{"t":"emote","v":1,"id":"p","k":"flame"}')).toBeNull();
    expect(deserializeEmote('{"t":"emote","v":1,"id":"","k":"wave"}')).toBeNull();
    const longId = 'x'.repeat(65);
    expect(deserializeEmote(`{"t":"emote","v":1,"id":"${longId}","k":"wave"}`)).toBeNull();
  });

  it('rejects mismatched wire versions', () => {
    expect(deserializeEmote('{"t":"emote","v":99,"id":"p","k":"wave"}')).toBeNull();
  });

  it('rejects malformed JSON gracefully', () => {
    expect(deserializeEmote('not-json')).toBeNull();
    expect(deserializeEmote('null')).toBeNull();
    expect(deserializeEmote('42')).toBeNull();
  });

  it('looksLikeEmoteWire sniffs without parsing', () => {
    expect(looksLikeEmoteWire(serializeEmote(makeEmoteMessage('p', 'heart')))).toBe(true);
    expect(looksLikeEmoteWire('{"v":1,"id":"p","x":0,"y":0}')).toBe(false);
  });
});
