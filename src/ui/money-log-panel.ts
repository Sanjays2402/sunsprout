// Money log panel — `Q` opens a list of the last 20 gold deltas.
//
// Each row shows the day, the reason tag, and the delta in coloured
// green/red. Renders top-left like the crop journal so it doesn't fight
// the right-hand stack.

import type { Player } from '../world/world';
import { getMoneyLog, netChange, totalIn, totalOut, classifyMoneyEntry, type MoneyCategory } from '../game/money-log';
import { PANEL_EMPTY_STATES } from '../game/panel-empty';
import { drawEmptyState } from './empty-state';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const GAIN = '#A3D77A';
const LOSS = '#E07A8A';
const GOLD = '#F0C24A';

/**
 * Per-category rail colour, mirroring the toast colour-rail language:
 * sale = green (income earned), reward = violet (a gift/payout), purchase
 * = amber (money spent). Drawn as a thin left rail so a busy ledger scans
 * by hue, the same way the toast stack does.
 */
const RAIL_COLOR: Record<MoneyCategory, string> = {
  sale: '#7FB069',
  reward: '#C8A0E8',
  purchase: '#E0A24A',
};

const PANEL_W = 340;
const ROW_H = 18;

export class MoneyLogPanel {
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

  draw(ctx: CanvasRenderingContext2D, player: Player, _canvasW: number, _canvasH: number): void {
    if (!this.opened) return;
    const log = getMoneyLog(player);
    const rows = log.slice(0, 20);
    const visible = Math.max(rows.length, 1);
    // Reserve a second line of body space for the empty state's hint.
    const h = 60 + (rows.length === 0 ? 2 : visible) * ROW_H + 22;
    const x = 12;
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
    ctx.fillText('money log  (Q)', x + 12, y + 8);

    ctx.fillStyle = GOLD;
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${player.gold}g on hand`, x + PANEL_W - 12, y + 9);

    // Summary stripe
    const tin = totalIn(player);
    const tout = totalOut(player);
    const net = netChange(player);
    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`in +${tin}g  /  out -${tout}g  /  net ${net >= 0 ? '+' : ''}${net}g`, x + 12, y + 28);

    // Separator
    ctx.fillStyle = 'rgba(74, 59, 110, 0.55)';
    ctx.fillRect(x + 12, y + 46, PANEL_W - 24, 1);

    if (rows.length === 0) {
      drawEmptyState(ctx, PANEL_EMPTY_STATES.moneyLog, x + PANEL_W / 2, y + 58);
    } else {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const ry = y + 54 + i * ROW_H;
        // Category colour rail — a thin left bar tinted sale/reward/purchase
        // so the ledger scans by hue like the toast stack. Drawn first so
        // the day stamp + reason text sit just to its right.
        ctx.fillStyle = RAIL_COLOR[classifyMoneyEntry(r)];
        ctx.fillRect(x + 12, ry, 3, ROW_H - 3);
        // Day stamp
        ctx.fillStyle = DIM;
        ctx.textAlign = 'left';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`d${r.day}`, x + 20, ry + 2);
        // Reason in the middle
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(r.reason, x + 48, ry + 1);
        // Delta in colour on the right
        ctx.fillStyle = r.delta >= 0 ? GAIN : LOSS;
        ctx.font = 'bold 11px ui-monospace, monospace';
        ctx.textAlign = 'right';
        const tag = r.delta >= 0 ? `+${r.delta}g` : `${r.delta}g`;
        ctx.fillText(tag, x + PANEL_W - 12, ry + 1);
      }
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Q or Esc to close', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }
}
