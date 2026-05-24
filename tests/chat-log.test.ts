import { describe, expect, it } from 'vitest';
import { ChatLog, CHAT_LOG_MAX } from '../src/game/chat-log';

describe('ChatLog', () => {
  it('appends sanitised entries with rising seq numbers', () => {
    const log = new ChatLog();
    const a = log.push('local', '  hello  ', 1000);
    const b = log.push('peer-1', 'hi there', 1100);
    expect(a?.seq).toBe(1);
    expect(a?.text).toBe('hello');
    expect(b?.seq).toBe(2);
    expect(b?.source).toBe('peer-1');
    expect(log.size()).toBe(2);
    expect(log.lastSeq()).toBe(2);
  });

  it('drops empty / whitespace bodies and missing sources', () => {
    const log = new ChatLog();
    expect(log.push('local', '   ', 0)).toBeUndefined();
    expect(log.push('', 'hi', 0)).toBeUndefined();
    expect(log.size()).toBe(0);
    expect(log.lastSeq()).toBe(0);
  });

  it('evicts oldest entries past capacity but keeps climbing seqs', () => {
    const log = new ChatLog(3);
    log.push('local', 'one', 1);
    log.push('local', 'two', 2);
    log.push('local', 'three', 3);
    log.push('local', 'four', 4);
    const all = log.list();
    expect(all.map((e) => e.text)).toEqual(['two', 'three', 'four']);
    expect(all.map((e) => e.seq)).toEqual([2, 3, 4]);
    expect(log.size()).toBe(3);
  });

  it('tail returns the last N entries oldest→newest', () => {
    const log = new ChatLog();
    for (let i = 0; i < 5; i++) log.push('local', `m${i}`, i);
    expect(log.tail(2).map((e) => e.text)).toEqual(['m3', 'm4']);
    expect(log.tail(0)).toEqual([]);
    expect(log.tail(99).length).toBe(5);
  });

  it('default capacity matches CHAT_LOG_MAX export', () => {
    const log = new ChatLog();
    expect(log.capacity).toBe(CHAT_LOG_MAX);
  });
});
