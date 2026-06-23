// Owl post menu — modal for sending a gift via the village owl.
//
// Opens via `~` near the farmhouse mailbox. Up/Down picks a
// candidate, Enter dispatches the owl with the player's best gift
// for that candidate. Closes with Esc or `~`. The actual gift
// resolution is owned by ../game/owl-post.ts.

import type { Player } from '../world/world';
import { CANDIDATES } from '../game/hearts';
import { pickBestGift } from '../game/gifting';
import {
  OWL_POST_FEE,
  dispatchOwl,
  owlCandidateIds,
  owlPostFeeChip,
  owlPostFeeFor,
  type OwlPostOutcome,
} from '../game/owl-post';
import type { TimeOfDay } from '../game/time';

const PANEL_W = 540;
const PANEL_H = 340;
const BG = 'rgba(26, 20, 38, 0.94)';
const BORDER = '#9EB8DF';
const TITLE_COLOR = '#9EB8DF';
const ROW_BG = 'rgba(40, 30, 60, 0.85)';
const ROW_BG_SELECTED = 'rgba(108, 86, 158, 0.85)';
const ROW_BORDER = '#6b5b8e';
const TEXT = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.45)';
const GOLD = '#F0C24A';
const HINT = 'rgba(245, 233, 212, 0.55)';

export class OwlMenu {
  private opened = false;
  private index = 0;
  private lockoutMs = 0;
  private flash = '';
  private flashFade = 0;

  open(): void {
    this.opened = true;
    this.index = 0;
    this.lockoutMs = 180;
    this.flash = '';
    this.flashFade = 0;
  }

  close(): void {
    this.opened = false;
  }

  isVisible(): boolean {
    return this.opened;
  }

  selectedId(): string {
    return owlCandidateIds()[this.index];
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
    if (this.flashFade > 0) this.flashFade = Math.max(0, this.flashFade - dtMs);
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  selectPrev(): void {
    if (!this.opened) return;
    const n = owlCandidateIds().length;
    this.index = (this.index - 1 + n) % n;
  }

  selectNext(): void {
    if (!this.opened) return;
    const n = owlCandidateIds().length;
    this.index = (this.index + 1) % n;
  }

  confirm(player: Player, day: number, time?: TimeOfDay): OwlPostOutcome {
    // Snapshot the fee BEFORE dispatchOwl so the toast reports the
    // tier-discounted price the player actually paid. dispatchOwl bumps
    // the stamp book AFTER the gift lands, so reading the fee before
    // the call captures the pre-stamp tier (the tier the discount was
    // applied at). Without this snapshot the toast would over-report
    // the cost by occasionally tipping into a freshly-crossed tier.
    const fee = owlPostFeeFor(player, this.selectedId());
    const out = dispatchOwl(player, this.selectedId(), day, time);
    if (out.kind === 'sent') {
      this.setFlash(`Owl sent to ${out.npcName} (-${fee}g).`);
    } else if (out.kind === 'not-enough-gold') {
      this.setFlash(`Need ${out.need}g (have ${out.have}g).`);
    } else if (out.kind === 'already-today') {
      this.setFlash(`Already gifted ${out.npcName} today.`);
    } else if (out.kind === 'no-items') {
      this.setFlash(`Nothing nice to send ${out.npcName}.`);
    }
    return out;
  }

  private setFlash(s: string): void {
    this.flash = s;
    this.flashFade = 1800;
  }

  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - PANEL_H) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(10, 6, 18, 0.45)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = BG;
    ctx.fillRect(x, y, PANEL_W, PANEL_H);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PANEL_W - 2, PANEL_H - 2);
    ctx.fillStyle = BORDER;
    ctx.fillRect(x + 4, y + 4, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + 4, 4, 4);
    ctx.fillRect(x + 4, y + PANEL_H - 8, 4, 4);
    ctx.fillRect(x + PANEL_W - 8, y + PANEL_H - 8, 4, 4);

    ctx.font = 'bold 16px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillStyle = TITLE_COLOR;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Owl Post', x + 18, y + 14);
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.fillText(`Send a gift across the valley for ${OWL_POST_FEE}g.`, x + 18, y + 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`${player.gold}g`, x + PANEL_W - 18, y + 18);

    const rowH = 50;
    const rowsTop = y + 64;
    const ids = owlCandidateIds();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const def = CANDIDATES[id];
      const giftKey = pickBestGift(player.inventory, id);
      const rowX = x + 14;
      const rowY = rowsTop + i * (rowH + 4);
      const rowW = PANEL_W - 28;
      const selected = i === this.index;
      ctx.fillStyle = selected ? ROW_BG_SELECTED : ROW_BG;
      ctx.fillRect(rowX, rowY, rowW, rowH);
      ctx.strokeStyle = selected ? BORDER : ROW_BORDER;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(rowX + 0.5, rowY + 0.5, rowW - 1, rowH - 1);

      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.fillStyle = TEXT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(def.name, rowX + 10, rowY + 8);
      ctx.textAlign = 'right';
      ctx.fillStyle = giftKey ? GOLD : DIM;
      ctx.fillText(giftKey ? `gift: ${giftKey}` : 'no gift on hand', rowX + rowW - 10, rowY + 8);

      // Per-row hearts summary if available.
      const heartsRow = player.hearts?.[id];
      const hearts = heartsRow ? Math.floor(heartsRow.points / 100) : 0;
      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = HINT;
      ctx.textAlign = 'left';
      ctx.fillText(`hearts: ${hearts}`, rowX + 10, rowY + 28);
      // Per-NPC fee chip — surfaces the tier-discounted price so the
      // player can SEE the savings before pressing Enter. Drawn on
      // the row's right edge under the gift label. The chip turns
      // gold when discounted (visual cue that you've earned a perk)
      // and stays dim/text when at full price.
      const chip = owlPostFeeChip(player, id);
      const isDiscounted = owlPostFeeFor(player, id) < OWL_POST_FEE;
      ctx.textAlign = 'right';
      ctx.fillStyle = isDiscounted ? GOLD : HINT;
      ctx.fillText(chip, rowX + rowW - 10, rowY + 28);
      const todayUsed = heartsRow && heartsRow.lastGiftDay >= 0 ? heartsRow.lastGiftDay : -1;
      void todayUsed;
    }

    if (this.flashFade > 0 && this.flash) {
      const alpha = Math.min(1, this.flashFade / 600);
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = `rgba(245, 233, 212, ${alpha.toFixed(2)})`;
      ctx.textAlign = 'center';
      ctx.fillText(this.flash, x + PANEL_W / 2, y + PANEL_H - 44);
    }

    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = HINT;
    ctx.textAlign = 'center';
    ctx.fillText('Up/Down to choose · Enter to send · Esc to leave', x + PANEL_W / 2, y + PANEL_H - 22);

    ctx.restore();
  }
}
