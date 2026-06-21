// Stamina-tea cookbook — three new restore-tier recipes that join the
// stamina drink loop. Berry Tonic / Mushroom Broth / Sunflower Elixir
// extend RECIPES with forage-driven drinks and slot into STAMINA_RESTORE
// so drinkBest() can pick them.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  RECIPES,
  RECIPE_KEYS,
  canCook,
  cook,
  dishInventoryKey,
  ingredientsValue,
} from '../src/game/cooking';
import {
  STAMINA_RESTORE,
  drinkBest,
  getStamina,
  setStamina,
  spendStamina,
} from '../src/game/stamina';

describe('stamina tea catalog', () => {
  it('three new drinks join the cookbook', () => {
    expect(RECIPES['berry-tonic']).toBeDefined();
    expect(RECIPES['mushroom-broth']).toBeDefined();
    expect(RECIPES['sunflower-elixir']).toBeDefined();
    expect(RECIPE_KEYS).toContain('berry-tonic');
    expect(RECIPE_KEYS).toContain('mushroom-broth');
    expect(RECIPE_KEYS).toContain('sunflower-elixir');
  });

  it('every new recipe sells for more than its raw ingredients', () => {
    for (const key of ['berry-tonic', 'mushroom-broth', 'sunflower-elixir'] as const) {
      const r = RECIPES[key];
      expect(r.sellPrice).toBeGreaterThan(ingredientsValue(r));
    }
  });

  it('every new recipe has a stamina restore entry', () => {
    expect(STAMINA_RESTORE['dish-berry-tonic']).toBeGreaterThan(0);
    expect(STAMINA_RESTORE['dish-mushroom-broth']).toBeGreaterThan(0);
    expect(STAMINA_RESTORE['dish-sunflower-elixir']).toBeGreaterThan(0);
  });

  it('the elixir restores more than the broth which restores more than the tonic', () => {
    expect(STAMINA_RESTORE['dish-sunflower-elixir']).toBeGreaterThan(
      STAMINA_RESTORE['dish-mushroom-broth'],
    );
    expect(STAMINA_RESTORE['dish-mushroom-broth']).toBeGreaterThan(
      STAMINA_RESTORE['dish-berry-tonic'],
    );
  });
});

describe('cooking the new drinks', () => {
  it('berry-tonic consumes 3 berries + 1 herb', () => {
    const w = new World();
    w.player.inventory['forage-berry'] = 3;
    w.player.inventory['forage-herb'] = 1;
    expect(canCook(w.player, 'berry-tonic')).toBe(true);
    expect(cook(w.player, 'berry-tonic')).toBe(true);
    expect(w.player.inventory['forage-berry']).toBe(0);
    expect(w.player.inventory['forage-herb']).toBe(0);
    expect(w.player.inventory[dishInventoryKey('berry-tonic')]).toBe(1);
  });

  it('mushroom-broth consumes 3 mushrooms + 1 tomato', () => {
    const w = new World();
    w.player.inventory['forage-mushroom'] = 3;
    w.player.inventory.tomato_harvest = 1;
    expect(cook(w.player, 'mushroom-broth')).toBe(true);
    expect(w.player.inventory[dishInventoryKey('mushroom-broth')]).toBe(1);
  });

  it('sunflower-elixir consumes 2 flower + 1 pumpkin + 1 egg', () => {
    const w = new World();
    w.player.inventory.flower_harvest = 2;
    w.player.inventory.pumpkin_harvest = 1;
    w.player.inventory.egg = 1;
    expect(cook(w.player, 'sunflower-elixir')).toBe(true);
    expect(w.player.inventory[dishInventoryKey('sunflower-elixir')]).toBe(1);
  });

  it('missing an ingredient blocks the cook', () => {
    const w = new World();
    w.player.inventory['forage-berry'] = 3;
    // No herb.
    expect(canCook(w.player, 'berry-tonic')).toBe(false);
    expect(cook(w.player, 'berry-tonic')).toBe(false);
  });
});

describe('drinkBest pulls the strongest available drink', () => {
  it('picks the elixir over the broth over the tonic over the tea', () => {
    const w = new World();
    w.player.inventory[dishInventoryKey('berry-tonic')] = 1;
    w.player.inventory[dishInventoryKey('mushroom-broth')] = 1;
    w.player.inventory[dishInventoryKey('sunflower-elixir')] = 1;
    setStamina(w.player, 10);
    const out = drinkBest(w.player);
    expect(out.kind).toBe('drank');
    if (out.kind === 'drank') {
      expect(out.key).toBe('dish-sunflower-elixir');
      expect(out.restored).toBe(STAMINA_RESTORE['dish-sunflower-elixir']);
    }
    // Elixir consumed, broth still in bag.
    expect(w.player.inventory[dishInventoryKey('sunflower-elixir')]).toBe(0);
    expect(w.player.inventory[dishInventoryKey('mushroom-broth')]).toBe(1);
  });

  it('the broth is the fallback when the elixir is gone', () => {
    const w = new World();
    w.player.inventory[dishInventoryKey('mushroom-broth')] = 1;
    setStamina(w.player, 5);
    const out = drinkBest(w.player);
    if (out.kind === 'drank') {
      expect(out.key).toBe('dish-mushroom-broth');
    }
  });

  it('full stamina still skips the drink', () => {
    const w = new World();
    w.player.inventory[dishInventoryKey('berry-tonic')] = 1;
    // Stamina is already at max.
    const out = drinkBest(w.player);
    expect(out.kind).toBe('already-full');
  });

  it('cooking a drink then drinking it actually refunds spent stamina', () => {
    const w = new World();
    w.player.inventory['forage-berry'] = 3;
    w.player.inventory['forage-herb'] = 1;
    cook(w.player, 'berry-tonic');
    spendStamina(w.player, 50);
    const before = getStamina(w.player).current;
    drinkBest(w.player);
    expect(getStamina(w.player).current).toBeGreaterThan(before);
  });
});
