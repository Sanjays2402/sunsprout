// Settings panel — `\` opens a modal-ish panel listing every settings row.
//
// Each row has a key label and a value the player can cycle with Enter
// or Space. The reset-save row asks for a second Enter to confirm so a
// stray keypress doesn't blow away the player's farm.
//
// Renders centred over the world with a soft dim backdrop so it feels
// like a modal pause screen rather than a stray HUD overlay.

import type { Player } from '../world/world';
import {
  cycleHudScale,
  cycleNightTint,
  getSettings,
  toggleAutoSave,
  toggleReduceMotion,
  type Settings,
} from '../game/settings';
import { clearSave, type StorageLike } from '../game/persistence';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const ROW_BG = 'rgba(40, 30, 60, 0.85)';
const ROW_BG_SELECTED = 'rgba(108, 86, 158, 0.85)';
const ROW_BORDER = '#6b5b8e';
const HINT = 'rgba(245, 233, 212, 0.55)';
const CONFIRM_BG = 'rgba(150, 60, 60, 0.85)';
const CONFIRM_BORDER = '#E07A8A';
const ACCENT = '#F0C24A';

const PANEL_W = 460;

type RowKey = 'autoSave' | 'nightTint' | 'hudScale' | 'reduceMotion' | 'reset' | 'close';

const ROWS: RowKey[] = ['autoSave', 'nightTint', 'hudScale', 'reduceMotion', 'reset', 'close'];

/** Outcome of a confirm in the settings panel. */
export type SettingsAction =
  | { kind: 'cycled'; key: RowKey; value: string }
  | { kind: 'reset-requested' }
  | { kind: 'reset-done' }
  | { kind: 'closed' }
  | { kind: 'noop' };

export class SettingsPanel {
  private opened = false;
  private lockoutMs = 0;
  private index = 0;
  /** True once the player has armed the reset row; second confirm wipes. */
  private resetArmed = false;

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.index = 0;
    this.resetArmed = false;
  }

  close(): void {
    this.opened = false;
    this.resetArmed = false;
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

  selectedRow(): RowKey {
    return ROWS[this.index];
  }

  selectPrev(): void {
    if (!this.opened) return;
    this.index = (this.index - 1 + ROWS.length) % ROWS.length;
    this.resetArmed = false;
  }

  selectNext(): void {
    if (!this.opened) return;
    this.index = (this.index + 1) % ROWS.length;
    this.resetArmed = false;
  }

  /**
   * Confirm the current row. Cycles a value, toggles a bool, or arms /
   * fires the reset. Returns a tagged outcome so the caller can show the
   * matching toast.
   */
  confirm(player: Player, storage: StorageLike | null): SettingsAction {
    if (!this.opened) return { kind: 'noop' };
    const row = this.selectedRow();
    switch (row) {
      case 'autoSave': {
        const v = toggleAutoSave(player);
        return { kind: 'cycled', key: 'autoSave', value: v ? 'on' : 'off' };
      }
      case 'nightTint': {
        const v = cycleNightTint(player);
        return { kind: 'cycled', key: 'nightTint', value: `${Math.round(v * 100)}%` };
      }
      case 'hudScale': {
        const v = cycleHudScale(player);
        return { kind: 'cycled', key: 'hudScale', value: `${v.toFixed(2)}x` };
      }
      case 'reduceMotion': {
        const v = toggleReduceMotion(player);
        return { kind: 'cycled', key: 'reduceMotion', value: v ? 'on' : 'off' };
      }
      case 'reset': {
        if (!this.resetArmed) {
          this.resetArmed = true;
          return { kind: 'reset-requested' };
        }
        if (storage) clearSave(storage);
        this.resetArmed = false;
        return { kind: 'reset-done' };
      }
      case 'close':
        this.close();
        return { kind: 'closed' };
    }
  }

  /** Render the panel. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const settings = getSettings(player);

    const rowH = 36;
    const h = 80 + ROWS.length * (rowH + 4) + 26;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(10, 6, 18, 0.55)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 15px ui-monospace, monospace';
    ctx.fillText('settings  ( \\ )', x + 16, y + 14);

    ctx.fillStyle = HINT;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('arrows or w-s to move - enter to change - esc to close', x + 16, y + 36);

    for (let i = 0; i < ROWS.length; i++) {
      const row = ROWS[i];
      const ry = y + 64 + i * (rowH + 4);
      const isSelected = i === this.index;
      const isReset = row === 'reset';
      const showResetWarn = isReset && this.resetArmed;
      ctx.fillStyle = showResetWarn ? CONFIRM_BG : isSelected ? ROW_BG_SELECTED : ROW_BG;
      ctx.fillRect(x + 14, ry, PANEL_W - 28, rowH);
      ctx.strokeStyle = showResetWarn ? CONFIRM_BORDER : isSelected ? TITLE_COLOR : ROW_BORDER;
      ctx.lineWidth = isSelected || showResetWarn ? 2 : 1;
      ctx.strokeRect(x + 14 + 0.5, ry + 0.5, PANEL_W - 29, rowH - 1);

      ctx.fillStyle = TEXT_COLOR;
      ctx.font = 'bold 13px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(rowLabel(row), x + 26, ry + 6);

      ctx.font = '11px ui-monospace, monospace';
      ctx.fillStyle = HINT;
      ctx.fillText(rowHint(row, settings, this.resetArmed), x + 26, ry + 22);

      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillStyle = ACCENT;
      ctx.textAlign = 'right';
      ctx.fillText(rowValue(row, settings, this.resetArmed), x + PANEL_W - 26, ry + 10);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Reset Save erases your local farm permanently.', x + PANEL_W / 2, y + h - 16);
    ctx.restore();
  }
}

function rowLabel(row: RowKey): string {
  switch (row) {
    case 'autoSave': return 'Auto-save on sleep';
    case 'nightTint': return 'Night tint';
    case 'hudScale': return 'HUD scale';
    case 'reduceMotion': return 'Reduce motion';
    case 'reset': return 'Reset save';
    case 'close': return 'Close menu';
  }
}

function rowHint(row: RowKey, _s: Settings, armed: boolean): string {
  switch (row) {
    case 'autoSave': return 'Write a snapshot at every day rollover.';
    case 'nightTint': return 'Dim the world overlay at dusk + night.';
    case 'hudScale': return 'Top bar + quest panel size.';
    case 'reduceMotion': return 'Hide rain + forage particle effects.';
    case 'reset':
      return armed
        ? 'Press Enter again to ERASE every saved field.'
        : 'Erase the local save file (cannot undo).';
    case 'close': return 'Dismiss this panel.';
  }
}

function rowValue(row: RowKey, s: Settings, armed: boolean): string {
  switch (row) {
    case 'autoSave': return s.autoSave ? 'on' : 'off';
    case 'nightTint': return `${Math.round(s.nightTintScale * 100)}%`;
    case 'hudScale': return `${s.hudScale.toFixed(2)}x`;
    case 'reduceMotion': return s.reduceMotion ? 'on' : 'off';
    case 'reset': return armed ? 'CONFIRM' : 'erase';
    case 'close': return '';
  }
}
