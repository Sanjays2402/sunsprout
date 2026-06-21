// OwlMenu — controller behaviour for the owl post UI.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { OwlMenu } from '../src/ui/owl-menu';
import { startingHearts } from '../src/game/hearts';
import { owlCandidateIds } from '../src/game/owl-post';

function tickPastLockout(menu: OwlMenu): void {
  menu.update(500);
}

function makePlayer() {
  const w = new World();
  w.player.hearts = startingHearts();
  w.player.gold = 1000;
  w.player.inventory = { ruby: 5 };
  return w;
}

describe('OwlMenu controller', () => {
  it('opens visible and starts with a valid selection', () => {
    const menu = new OwlMenu();
    menu.open();
    expect(menu.isVisible()).toBe(true);
    expect(owlCandidateIds()).toContain(menu.selectedId());
  });

  it('honors a brief open lockout before canAct()', () => {
    const menu = new OwlMenu();
    menu.open();
    expect(menu.canAct()).toBe(false);
    menu.update(80);
    expect(menu.canAct()).toBe(false);
    menu.update(120);
    expect(menu.canAct()).toBe(true);
  });

  it('selectNext wraps around the candidate list', () => {
    const menu = new OwlMenu();
    menu.open();
    tickPastLockout(menu);
    const start = menu.selectedId();
    const ids = owlCandidateIds();
    for (let i = 0; i < ids.length; i++) menu.selectNext();
    expect(menu.selectedId()).toBe(start);
  });

  it('confirm sends and reports the sent outcome', () => {
    const w = makePlayer();
    const menu = new OwlMenu();
    menu.open();
    tickPastLockout(menu);
    // Jump to Maple — she loves rubies.
    while (menu.selectedId() !== 'maple') menu.selectNext();
    const out = menu.confirm(w.player, 1);
    expect(out.kind).toBe('sent');
  });

  it('close() hides the menu', () => {
    const menu = new OwlMenu();
    menu.open();
    menu.close();
    expect(menu.isVisible()).toBe(false);
  });
});
