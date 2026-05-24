import { describe, it, expect } from 'vitest';
import { MuteToasts } from '../src/ui/mute-toast';

describe('MuteToasts.pushUnmuteAll', () => {
  it('no-ops when cleared is zero or negative', () => {
    const t = new MuteToasts();
    t.pushUnmuteAll(0, 1000);
    t.pushUnmuteAll(-3, 1000);
    expect(t.list(1000)).toEqual([]);
  });

  it('renders singular form for one peer', () => {
    const t = new MuteToasts();
    t.pushUnmuteAll(1, 1000);
    expect(t.list(1000)).toEqual(['unmuted 1 peer']);
  });

  it('renders plural form for many peers and floors fractions', () => {
    const t = new MuteToasts();
    t.pushUnmuteAll(3.7, 1000);
    expect(t.list(1000)).toEqual(['unmuted 3 peers']);
  });

  it('ignores non-finite counts', () => {
    const t = new MuteToasts();
    t.pushUnmuteAll(Number.NaN, 1000);
    t.pushUnmuteAll(Number.POSITIVE_INFINITY, 1000);
    expect(t.list(1000)).toEqual([]);
  });

  it('coexists with regular push() in the same queue', () => {
    const t = new MuteToasts();
    t.push({ id: 'alice', muted: true }, 1000);
    t.pushUnmuteAll(2, 1000);
    expect(t.list(1000)).toEqual(['muted alice', 'unmuted 2 peers']);
  });
});
