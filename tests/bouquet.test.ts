// Bouquet — universal "loved" courtship gift sold at the shop.
import { describe, it, expect } from 'vitest';
import {
  BOUQUET_KEY,
  BOUQUET_PRICE,
  CANDIDATES,
  giveGift,
  startingHearts,
  tasteOf,
} from '../src/game/hearts';
import { SHOP_ITEMS } from '../src/game/economy';

describe('bouquet (courtship token)', () => {
  it('every candidate loves the bouquet regardless of taste lists', () => {
    for (const id of Object.keys(CANDIDATES)) {
      expect(tasteOf(id, BOUQUET_KEY)).toBe('loved');
    }
  });

  it('giveGift with a bouquet awards loved points (+80)', () => {
    const s = startingHearts();
    const r = giveGift(s, 'finn', BOUQUET_KEY, 1);
    expect(r.accepted).toBe(true);
    expect(r.taste).toBe('loved');
    expect(r.pointsApplied).toBe(80);
    expect(s.finn.points).toBe(80);
  });

  it('appears in the shop catalog as a buyable, non-sellable item', () => {
    const row = SHOP_ITEMS.find((i) => i.key === BOUQUET_KEY);
    expect(row, 'bouquet missing from SHOP_ITEMS').toBeDefined();
    expect(row!.buyPrice).toBe(BOUQUET_PRICE);
    expect(row!.sellPrice).toBeNull();
    expect(row!.label).toBe('Bouquet');
  });
});
