// Crop journal panel — `;` toggles a per-crop reference + lifetime tally.
//
// Each row shows:
//   - crop name, seed/sell prices, growth days, best season
//   - lifetime: sown count, harvest tally with silver/gold breakdown
//   - best water streak ever achieved with this crop
//
// Render anchored under the hearts panel (top-right). Both panels share
// the same chrome — they're peer informational HUD overlays the player
// can stack open while moving around the world.

import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import {
  buildJournal,
  nextFestivals,
  totalHarvest,
  type CropJournalEntry,
} from '../game/crop-journal';

const PANEL_BG = 'rgba(26, 20, 38, 0.95)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const GOLD = '#F0C24A';
const SILVER = '#D5D8DC';
const GREEN = '#A3D77A';

const PANEL_W = 360;
const ROW_H = 50;

export class CropJournalPanel {
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

  /** Render the journal panel. No-op when closed. */
  draw(
    ctx: CanvasRenderingContext2D,
    player: Player,
    time: TimeOfDay,
    canvasW: number,
    _canvasH: number,
  ): void {
    if (!this.opened) return;
    void canvasW;
    const entries = buildJournal(player);
    const festivals = nextFestivals(time, 2);
    const h = 44 + entries.length * ROW_H + (festivals.length > 0 ? 38 : 12);
    // Top-left overlay — replaces the quest panel while open (same chrome
    // pattern as the recipe codex overlays the hearts panel on the right).
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
    ctx.fillText('crop journal  (;)', x + 12, y + 8);

    // Header counts on the right
    const totalSown = entries.reduce((s, e) => s + e.sown, 0);
    const totalHarv = entries.reduce(
      (s, e) => s + totalHarvest({ sown: e.sown, normal: e.normal, silver: e.silver, gold: e.gold, bestStreak: e.bestStreak }),
      0,
    );
    ctx.fillStyle = DIM;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${totalSown} sown  -  ${totalHarv} reaped`, x + PANEL_W - 12, y + 9);

    for (let i = 0; i < entries.length; i++) {
      const e: CropJournalEntry = entries[i];
      const ry = y + 30 + i * ROW_H;
      // Row separator line.
      if (i > 0) {
        ctx.fillStyle = 'rgba(74, 59, 110, 0.55)';
        ctx.fillRect(x + 12, ry - 2, PANEL_W - 24, 1);
      }
      // Name + season pill on left, sell/seed prices on right.
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(e.name, x + 12, ry);
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`${e.bestSeason}  -  ${e.growthDays}d to ripe`, x + 12, ry + 14);

      ctx.fillStyle = GOLD;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${e.sellPrice}g`, x + PANEL_W - 12, ry);
      ctx.fillStyle = DIM;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`seed ${e.seedPrice}g`, x + PANEL_W - 12, ry + 14);

      // Lifetime tally on the second sub-line.
      ctx.textAlign = 'left';
      ctx.font = '10px ui-monospace, monospace';
      const sownStr = `sown ${e.sown}`;
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(sownStr, x + 12, ry + 28);
      const sownW = ctx.measureText(sownStr).width;

      let runX = x + 12 + sownW + 10;
      const normal = e.normal;
      const silver = e.silver;
      const gold = e.gold;
      if (normal > 0) {
        ctx.fillStyle = TEXT_COLOR;
        const s = `${normal}n`;
        ctx.fillText(s, runX, ry + 28);
        runX += ctx.measureText(s).width + 8;
      }
      if (silver > 0) {
        ctx.fillStyle = SILVER;
        const s = `${silver}s`;
        ctx.fillText(s, runX, ry + 28);
        runX += ctx.measureText(s).width + 8;
      }
      if (gold > 0) {
        ctx.fillStyle = GOLD;
        const s = `${gold}g`;
        ctx.fillText(s, runX, ry + 28);
        runX += ctx.measureText(s).width + 8;
      }
      if (e.bestStreak > 0) {
        ctx.fillStyle = GREEN;
        const s = `streak ${e.bestStreak}`;
        ctx.textAlign = 'right';
        ctx.fillText(s, x + PANEL_W - 12, ry + 28);
      }
      // Ribbon — heaviest single-day harvest. Sits one line below the
      // sown/streak strip, only when the player has actually set one.
      if (e.ribbonCount > 0) {
        ctx.fillStyle = '#F0A828';
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        const tag = e.ribbonWhen ? ` -  ${e.ribbonWhen}` : '';
        ctx.fillText(`ribbon: ${e.ribbonCount} in a day${tag}`, x + 12, ry + 40 - 7);
      }
    }

    // Festival forecast footer.
    if (festivals.length > 0) {
      const fy = y + 30 + entries.length * ROW_H + 4;
      ctx.fillStyle = 'rgba(74, 59, 110, 0.55)';
      ctx.fillRect(x + 12, fy - 4, PANEL_W - 24, 1);
      ctx.fillStyle = TITLE_COLOR;
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('next festivals', x + 12, fy);
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(festivals.join('  -  '), x + 12, fy + 12);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('; or Esc to close', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }
}
