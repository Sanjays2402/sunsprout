// Recipe codex panel — `R` toggles a read-only catalog of every recipe.
//
// The codex shows three discovery states: cooked (the player has made
// this dish at least once), known (the player has the ingredients to
// cook it right now), locked (neither). Locked recipes show only their
// name + slot — flavour text and ingredient list are hidden until the
// player discovers them, so reaching a new recipe still feels like a
// reveal. Cooked rows show their cooked count.
//
// Rendering is a top-right floating panel with the same chrome as the
// hearts panel — it floats above the world without dimming it, and
// closes with a second `R` press or Escape.

import type { Player } from '../world/world';
import { buildCodex, recipesCooked, totalDishesCooked, type RecipeCodexRow } from '../game/cooking-history';
import { RECIPES, RECIPE_KEYS } from '../game/cooking';

const PANEL_BG = 'rgba(26, 20, 38, 0.95)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const KNOWN = '#A3D77A';
const COOKED = '#F0C24A';
const LOCKED = '#7a6a9a';
const GOLD = '#F0C24A';

const PANEL_W = 360;
const ROW_H = 28;

function pretty(key: string): string {
  if (key.endsWith('_harvest')) return key.slice(0, -'_harvest'.length);
  if (key.startsWith('fish-')) return key.slice('fish-'.length);
  if (key.startsWith('forage-')) return key.slice('forage-'.length);
  return key;
}

/** Pure controller for the recipe codex. */
export class RecipeCodex {
  private opened = false;
  private lockoutMs = 0;

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
  }

  close(): void {
    this.opened = false;
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  isVisible(): boolean {
    return this.opened;
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  /** Renders the codex on top of the world. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, _canvasH: number): void {
    if (!this.opened) return;
    const rows = buildCodex(player);
    const h = 56 + rows.length * ROW_H + 22;
    const x = canvasW - PANEL_W - 12;
    const y = 40;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.fillText('recipe codex  (R)', x + 12, y + 8);

    const cooked = recipesCooked(player);
    const total = RECIPE_KEYS.length;
    const totalDishes = totalDishesCooked(player);
    ctx.fillStyle = DIM;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${cooked}/${total} known  -  ${totalDishes} cooked`, x + PANEL_W - 12, y + 9);

    ctx.font = '11px ui-monospace, monospace';
    for (let i = 0; i < rows.length; i++) {
      const row: RecipeCodexRow = rows[i];
      const ry = y + 32 + i * ROW_H;

      // Status pip on the left.
      const color =
        row.discovery === 'cooked' ? COOKED : row.discovery === 'known' ? KNOWN : LOCKED;
      ctx.fillStyle = color;
      ctx.fillRect(x + 12, ry + 4, 4, 4);

      // Name (locked rows show "????" so the reveal moment stays intact).
      ctx.fillStyle = row.discovery === 'locked' ? DIM : TEXT_COLOR;
      ctx.textAlign = 'left';
      const nameLabel =
        row.discovery === 'locked'
          ? row.name.replace(/[A-Za-z]/g, '?')
          : row.name;
      ctx.fillText(nameLabel, x + 22, ry + 1);

      // Sell price right-aligned.
      if (row.discovery !== 'locked') {
        ctx.fillStyle = GOLD;
        ctx.textAlign = 'right';
        ctx.fillText(`${row.sellPrice}g`, x + PANEL_W - 12, ry + 1);
      }

      // Ingredient row (only when known or cooked).
      if (row.discovery !== 'locked') {
        ctx.fillStyle = HINT;
        ctx.textAlign = 'left';
        const parts = row.ingredients
          .map((ing) => `${pretty(ing.key)} ${ing.have}/${ing.count}`)
          .join('  -  ');
        ctx.fillText(parts, x + 22, ry + 14);
      } else {
        ctx.fillStyle = DIM;
        ctx.textAlign = 'left';
        ctx.fillText('cook the right combo to discover', x + 22, ry + 14);
      }
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('R or Esc to close', x + PANEL_W / 2, y + h - 14);

    ctx.restore();
    void RECIPES;
  }
}
