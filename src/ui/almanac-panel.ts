// Almanac panel — `0` toggles a two-week agenda of upcoming village
// events: festivals, NPC birthdays, Pip's cart visits and the seasonal
// friendship tournament, all in one place so the player can plan ahead
// (save a loved gift for a birthday, stock crops before the harvest
// festival, walk to the well for the contest). Same panel chrome as the
// other overlays. Data comes from the pure almanac.ts aggregator.

import type { TimeOfDay } from '../game/time';
import {
  buildAlmanac,
  whenLabel,
  dateLabel,
  type AlmanacEntry,
  type AlmanacKind,
} from '../game/almanac';

const PANEL_BG = 'rgba(26, 20, 38, 0.97)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const TODAY = '#A3D77A';

/** Per-kind accent colour + one-letter tag for the left rail. */
const KIND_STYLE: Record<AlmanacKind, { color: string; tag: string }> = {
  festival: { color: '#9ECDB5', tag: 'F' },
  birthday: { color: '#F5C9A0', tag: 'B' },
  cart: { color: '#C8923A', tag: 'P' },
  tournament: { color: '#C8A0E8', tag: 'T' },
};

const PANEL_W = 400;
const ROW_H = 34;
const HEADER_H = 44;

export class AlmanacPanel {
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

  draw(ctx: CanvasRenderingContext2D, time: TimeOfDay, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const entries = buildAlmanac(time);
    const bodyRows = Math.max(entries.length, 1);
    const h = HEADER_H + bodyRows * ROW_H + 24;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
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
    ctx.fillText('almanac  (0)', x + 16, y + 12);

    ctx.fillStyle = DIM;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('next 2 weeks', x + PANEL_W - 16, y + 15);

    if (entries.length === 0) {
      ctx.fillStyle = DIM;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('A quiet stretch ahead — nothing on the calendar.', x + PANEL_W / 2, y + HEADER_H + 8);
    } else {
      for (let i = 0; i < entries.length; i++) {
        this.drawRow(ctx, entries[i], x, y + HEADER_H + i * ROW_H, i > 0);
      }
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('0 or Esc to close', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  private drawRow(
    ctx: CanvasRenderingContext2D,
    e: AlmanacEntry,
    x: number,
    ry: number,
    separator: boolean,
  ): void {
    const style = KIND_STYLE[e.kind];
    if (separator) {
      ctx.fillStyle = 'rgba(74, 59, 110, 0.5)';
      ctx.fillRect(x + 14, ry, PANEL_W - 28, 1);
    }
    // Left rail accent bar + kind tag.
    ctx.fillStyle = style.color;
    ctx.fillRect(x + 14, ry + 8, 3, ROW_H - 14);
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style.color;
    ctx.fillText(style.tag, x + 22, ry + 13);

    // Title + detail.
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(e.title, x + 38, ry + 11);
    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(e.detail, x + 38, ry + 23);

    // Right: when + date stamp.
    const today = e.daysUntil <= 0;
    ctx.textAlign = 'right';
    ctx.fillStyle = today ? TODAY : '#C8B6E8';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(whenLabel(e.daysUntil), x + PANEL_W - 16, ry + 11);
    ctx.fillStyle = DIM;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(dateLabel(e.season, e.day), x + PANEL_W - 16, ry + 23);

    ctx.textBaseline = 'top';
  }
}
