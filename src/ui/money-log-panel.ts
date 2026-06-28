// Money log panel — `Q` opens a list of the last 20 gold deltas.
//
// Each row shows the day, the reason tag, and the delta in coloured
// green/red. Renders top-left like the crop journal so it doesn't fight
// the right-hand stack.

import type { Player } from '../world/world';
import { getMoneyLog, netChange, totalIn, totalOut, classifyMoneyEntry, moneyCategoryTotals, groupMoneyEntriesByDay, applyMoneyFilter, cycleMoneyFilter, moneyFilterLabel, runningBalanceMap, type MoneyCategory, type MoneyFilter } from '../game/money-log';
import { PANEL_EMPTY_STATES, nextFilterHint } from '../game/panel-empty';
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
const FILTER_CHIP = 'rgba(200, 182, 232, 0.7)';
/** Faint running-balance figure — dim so it trails the delta, not competes. */
const BALANCE_COLOR = 'rgba(245, 233, 212, 0.36)';

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
/** Day-divider band height — a small "Day N" header above each day's run. */
const DAY_DIVIDER_H = 14;

export class MoneyLogPanel {
  private opened = false;
  private lockoutMs = 0;
  private filter: MoneyFilter = 'all';

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.filter = 'all';
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

  /** Active ledger filter — exposed for tests. */
  currentFilter(): MoneyFilter {
    return this.filter;
  }

  /** Cycle the category filter (all -> sales -> rewards -> spending). */
  cycleFilter(): void {
    if (!this.opened) return;
    this.filter = cycleMoneyFilter(this.filter);
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  draw(ctx: CanvasRenderingContext2D, player: Player, _canvasW: number, _canvasH: number): void {
    if (!this.opened) return;
    const log = getMoneyLog(player);
    // The ledger has rows iff the underlying log is non-empty; the active
    // filter then narrows WHICH rows show. We distinguish "you have no
    // ledger at all" (the shared empty state) from "nothing matches this
    // filter" (a filter-specific note) so a filtered-empty view isn't a
    // dead end.
    const hasAnyRows = log.length > 0;
    const filtered = applyMoneyFilter(log.slice(0, 20), this.filter);
    const rows = filtered;
    const visible = Math.max(rows.length, 1);
    // Day-group dividers add a small "Day N" band above each day's run, so
    // the panel grows by one band per distinct day in the FILTERED window.
    const dayGroups = groupMoneyEntriesByDay(filtered);
    const dividersH = rows.length === 0 ? 0 : dayGroups.length * DAY_DIVIDER_H;
    // Reserve a second line of body space for the empty state's hint.
    // When there's a ledger, reserve a footer band for the per-category
    // totals line (sales / rewards / spent) above the close hint.
    const footerH = !hasAnyRows ? 0 : 16;
    const h = 60 + (rows.length === 0 ? 2 : visible) * ROW_H + dividersH + footerH + 22;
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

    // Filter chip — dim pill right of the title showing the active filter
    // when it's narrowing the view, so the `f` cycle is discoverable and
    // the current scope is legible. Quiet on 'all' (no narrowing).
    if (this.filter !== 'all') {
      ctx.font = 'bold 13px ui-monospace, monospace';
      const titleW = ctx.measureText('money log  (Q)').width;
      ctx.fillStyle = FILTER_CHIP;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`- ${moneyFilterLabel(this.filter)}`, x + 12 + titleW + 8, y + 11);
    }

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
      // Distinguish a truly empty ledger from a filter that hides every
      // row: the latter gets a plain "nothing here under this filter" note
      // pointing at the `f` cycle, so the player isn't left at a dead end.
      if (!hasAnyRows) {
        drawEmptyState(ctx, PANEL_EMPTY_STATES.moneyLog, x + PANEL_W / 2, y + 58);
      } else {
        ctx.fillStyle = HINT;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`no ${moneyFilterLabel(this.filter)} this window`, x + PANEL_W / 2, y + 60);
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(nextFilterHint(this.filter, cycleMoneyFilter, moneyFilterLabel), x + PANEL_W / 2, y + 76);
      }
    } else {
      // Walk the day groups, drawing a small "Day N  +/-net" divider above
      // each day's run so the ledger reads as dated buckets. A running ry
      // advances by a divider band then each row in the group.
      // Running-balance lookup is computed over the WHOLE log (anchored on
      // current gold) so each shown row's "= Ng" trailing figure is the
      // true purse after it posted, even when a filter hides rows between.
      const balances = runningBalanceMap(player);
      // Reserve a fixed right region for the delta + balance columns so the
      // reason text clips before it can collide with either (a 5-digit
      // balance like "= 20000g" is the widest the column gets).
      const RIGHT_RESERVE = 120;
      let ry = y + 54;
      for (const group of dayGroups) {
        this.drawDayDivider(ctx, group.day, group.net, x, ry);
        ry += DAY_DIVIDER_H;
        for (const r of group.entries) {
          // Category colour rail — a thin left bar tinted sale/reward/purchase
          // so the ledger scans by hue like the toast stack. Drawn first so
          // the reason text sits just to its right (the day stamp is now the
          // divider's job, so the row leads with the reason).
          ctx.fillStyle = RAIL_COLOR[classifyMoneyEntry(r)];
          ctx.fillRect(x + 12, ry, 3, ROW_H - 3);
          // Reason on the left, indented past the rail. Clipped to leave the
          // right reserve free for the balance + delta columns.
          ctx.fillStyle = TEXT_COLOR;
          ctx.textAlign = 'left';
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText(r.reason, x + 22, ry + 1, PANEL_W - 22 - RIGHT_RESERVE);
          // Delta in colour on the right
          ctx.fillStyle = r.delta >= 0 ? GAIN : LOSS;
          ctx.font = 'bold 11px ui-monospace, monospace';
          ctx.textAlign = 'right';
          const tag = r.delta >= 0 ? `+${r.delta}g` : `${r.delta}g`;
          ctx.fillText(tag, x + PANEL_W - 12, ry + 1);
          // Running balance — a faint "= Ng" just left of the delta so the
          // player can trace how the purse reached its current value. Right-
          // aligned at a fixed offset so the column stays tidy down the list.
          const bal = balances.get(r);
          if (bal !== undefined) {
            ctx.fillStyle = BALANCE_COLOR;
            ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(`= ${bal}g`, x + PANEL_W - 12 - 52, ry + 2);
          }
          ry += ROW_H;
        }
      }
    }

    // Per-category totals footer — a one-line breakdown of the WHOLE
    // logged window (not the filtered slice) tinted to the rail colours
    // (sales green / rewards violet / spent amber) so the player can read
    // the shape of their economy at a glance. Shown whenever there's a
    // ledger, so it stays put even when a filter hides every row; sits
    // just above the close hint.
    if (hasAnyRows) {
      const totals = moneyCategoryTotals(player);
      const fy = y + h - 30;
      ctx.textBaseline = 'top';
      ctx.font = 'bold 10px ui-monospace, monospace';
      // Draw the three segments left-to-right, each prefixed by a small
      // swatch of its rail colour so the line reads as the same dialect
      // as the per-row rails above it.
      const segs: Array<{ color: string; text: string }> = [
        { color: RAIL_COLOR.sale, text: `sales +${totals.sales}g` },
        { color: RAIL_COLOR.reward, text: `rewards +${totals.rewards}g` },
        { color: RAIL_COLOR.purchase, text: `spent -${totals.spent}g` },
      ];
      let sx = x + 12;
      for (const seg of segs) {
        // Swatch
        ctx.fillStyle = seg.color;
        ctx.fillRect(sx, fy + 1, 3, 9);
        ctx.textAlign = 'left';
        ctx.fillText(seg.text, sx + 7, fy);
        sx += 7 + ctx.measureText(seg.text).width + 12;
      }
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Q or Esc to close - f filter', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  /**
   * Small "Day N" divider above a day's run of rows, with a faint signed
   * net subtotal on the right so the player can read each day's bottom line
   * at a glance. Mirrors the section-divider language of the codex /
   * almanac panels (dim bold label + a trailing rule).
   */
  private drawDayDivider(
    ctx: CanvasRenderingContext2D,
    day: number,
    net: number,
    x: number,
    ry: number,
  ): void {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM;
    ctx.font = 'bold 9px ui-monospace, monospace';
    const label = `DAY ${day}`;
    ctx.fillText(label, x + 12, ry + 3);
    const labelW = ctx.measureText(label).width;
    // Signed net subtotal, right-aligned and tinted like a delta but dim so
    // it reads as a summary, not a row.
    const netTag = `${net >= 0 ? '+' : ''}${net}g`;
    ctx.textAlign = 'right';
    ctx.fillStyle = net >= 0 ? 'rgba(163, 215, 122, 0.6)' : 'rgba(224, 122, 138, 0.6)';
    ctx.fillText(netTag, x + PANEL_W - 12, ry + 3);
    const netW = ctx.measureText(netTag).width;
    // A thin rule between the label and the net tag.
    ctx.fillStyle = 'rgba(74, 59, 110, 0.5)';
    ctx.fillRect(x + 12 + labelW + 8, ry + 7, PANEL_W - 24 - labelW - netW - 16, 1);
  }
}
