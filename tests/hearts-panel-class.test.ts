// HeartsPanel as a class panel — the relationships overlay (H) joined the
// shared open-fade family this tick. These cover the open/close/lockout +
// sort-cycle controller surface (the pure relationship-row builders are
// covered in relationship-panel.test.ts).

import { describe, it, expect } from 'vitest';
import { HeartsPanel } from '../src/ui/hearts-panel';

describe('HeartsPanel controller', () => {
  it('opens closed and toggles visibility', () => {
    const p = new HeartsPanel();
    expect(p.isVisible()).toBe(false);
    p.toggle();
    expect(p.isVisible()).toBe(true);
    p.toggle();
    expect(p.isVisible()).toBe(false);
  });

  it('arms an open lockout that canAct gates until it elapses', () => {
    const p = new HeartsPanel();
    p.open();
    // Fresh open: lockout (160ms) still running, so canAct is false.
    expect(p.canAct()).toBe(false);
    p.update(80);
    expect(p.canAct()).toBe(false);
    p.update(100); // total 180 > 160
    expect(p.canAct()).toBe(true);
  });

  it('starts on closeness and cycles the sort while open', () => {
    const p = new HeartsPanel();
    p.open();
    expect(p.currentSort()).toBe('closeness');
    p.cycleSort();
    expect(p.currentSort()).toBe('birthday');
    p.cycleSort();
    expect(p.currentSort()).toBe('closeness');
  });

  it('resets the sort to closeness on each open', () => {
    const p = new HeartsPanel();
    p.open();
    p.cycleSort();
    expect(p.currentSort()).toBe('birthday');
    p.close();
    p.open();
    expect(p.currentSort()).toBe('closeness');
  });

  it('ignores cycleSort while closed', () => {
    const p = new HeartsPanel();
    p.cycleSort();
    expect(p.currentSort()).toBe('closeness');
  });
});
