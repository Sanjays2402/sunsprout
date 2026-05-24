// Tests for MuteToasts.pushRestore — Shift+U restore-mutes bulk toast.

import { describe, expect, it } from 'vitest';
import { MuteToasts } from '../src/ui/mute-toast';

describe('MuteToasts.pushRestore', () => {
  it('enqueues a singular toast for one restored mute', () => {
    const t = new MuteToasts();
    t.pushRestore(1, 1000);
    expect(t.list(1000)).toEqual(['restored 1 mute']);
  });

  it('enqueues a plural toast for many restored mutes', () => {
    const t = new MuteToasts();
    t.pushRestore(4, 1000);
    expect(t.list(1000)).toEqual(['restored 4 mutes']);
  });

  it('stays silent when restored is zero or negative', () => {
    const t = new MuteToasts();
    t.pushRestore(0, 1000);
    t.pushRestore(-2, 1000);
    expect(t.list(1000)).toEqual([]);
  });

  it('stays silent on non-finite restored counts', () => {
    const t = new MuteToasts();
    t.pushRestore(Number.NaN, 1000);
    t.pushRestore(Number.POSITIVE_INFINITY, 1000);
    expect(t.list(1000)).toEqual([]);
  });

  it('floors fractional restored counts', () => {
    const t = new MuteToasts();
    t.pushRestore(3.9, 1000);
    expect(t.list(1000)).toEqual(['restored 3 mutes']);
  });

  it('fades out after TTL', () => {
    const t = new MuteToasts();
    t.pushRestore(2, 0);
    expect(t.list(0)).toEqual(['restored 2 mutes']);
    expect(t.list(5000)).toEqual([]);
  });
});
