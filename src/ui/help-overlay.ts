// Help overlay — `?` toggles a full-screen controls cheat sheet.
//
// The game grew to ~40 keybinds with no in-game reference; this overlay
// renders CONTROL_GROUPS as a clean two-column card so a player never has
// to leave the game to remember a key. Same dark-violet panel chrome as
// the achievements / settings panels, monospace glyphs, integer-snapped.

import {
  CONTROL_GROUPS,
  splitControlColumns,
  totalBindingCount,
  type ControlGroup,
} from '../game/controls';

const PANEL_BG = 'rgba(26, 20, 38, 0.97)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const GROUP_COLOR = '#C8B6E8';
const KEY_BG = 'rgba(64, 48, 96, 0.92)';
const KEY_BORDER = '#6b5b8e';
const KEY_TEXT = '#F5E9D4';
const LABEL_COLOR = 'rgba(245, 233, 212, 0.82)';
const HINT = 'rgba(245, 233, 212, 0.55)';

const PANEL_W = 560;
const COL_GAP = 24;
const ROW_H = 18;
const GROUP_GAP = 10;
const PAD = 18;

export class HelpOverlay {
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

  /** Height in rows of a single column (title rows + binding rows + gaps). */
  private columnRows(groups: ControlGroup[]): number {
    let rows = 0;
    for (const g of groups) rows += 1 + g.bindings.length;
    return rows;
  }

  draw(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const [left, right] = splitControlColumns(CONTROL_GROUPS);
    const maxRows = Math.max(this.columnRows(left), this.columnRows(right));
    const groupGaps = Math.max(left.length, right.length) * GROUP_GAP;
    const bodyH = maxRows * ROW_H + groupGaps;
    const h = 46 + bodyH + 24;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Dim the world behind so the sheet reads cleanly.
    ctx.fillStyle = 'rgba(10, 6, 18, 0.42)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('controls  (?)', x + PAD, y + 14);

    ctx.fillStyle = HINT;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${totalBindingCount()} keys`, x + PANEL_W - PAD, y + 16);

    const colW = (PANEL_W - PAD * 2 - COL_GAP) / 2;
    const bodyY = y + 44;
    this.drawColumn(ctx, left, x + PAD, bodyY, colW);
    this.drawColumn(ctx, right, x + PAD + colW + COL_GAP, bodyY, colW);

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('? or Esc to close', x + PANEL_W / 2, y + h - 16);
    ctx.restore();
  }

  private drawColumn(
    ctx: CanvasRenderingContext2D,
    groups: ControlGroup[],
    x: number,
    y: number,
    colW: number,
  ): void {
    let cy = y;
    for (const g of groups) {
      ctx.fillStyle = GROUP_COLOR;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(g.title.toUpperCase(), x, cy);
      cy += ROW_H;
      for (const b of g.bindings) {
        this.drawKeyCap(ctx, b.keys, x, cy);
        ctx.fillStyle = LABEL_COLOR;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label, x + 96, cy + 7);
        ctx.textBaseline = 'top';
        cy += ROW_H;
      }
      cy += GROUP_GAP;
    }
    void colW;
  }

  /** Draws a small rounded key-cap with the glyph centred. */
  private drawKeyCap(
    ctx: CanvasRenderingContext2D,
    keys: string,
    x: number,
    y: number,
  ): void {
    ctx.font = 'bold 10px ui-monospace, monospace';
    const capH = 14;
    const padX = 6;
    const textW = ctx.measureText(keys).width;
    const capW = Math.min(86, textW + padX * 2);
    ctx.fillStyle = KEY_BG;
    ctx.fillRect(x, y, capW, capH);
    ctx.strokeStyle = KEY_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, capW - 1, capH - 1);
    ctx.fillStyle = KEY_TEXT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // Clip glyph if it somehow overflows the max cap width.
    ctx.fillText(keys, x + padX, y + capH / 2, capW - padX * 2);
    ctx.textBaseline = 'top';
  }
}
