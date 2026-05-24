import { describe, it, expect } from 'vitest';
import {
  chatHistoryRect,
  chatHistoryAlpha,
  drawChatHistory,
  VISIBLE_LINES,
  FADE_AFTER_MS,
  FADE_DURATION_MS,
} from '../src/ui/chat-history';
import { ChatLog } from '../src/game/chat-log';

describe('chat-history layout', () => {
  it('sits in the bottom-left corner with a 10px margin', () => {
    const r = chatHistoryRect(800, 600, 3);
    expect(r.x).toBe(10);
    expect(r.y + r.h).toBe(600 - 10);
    expect(r.w).toBeGreaterThan(0);
  });

  it('grows in height with line count up to VISIBLE_LINES', () => {
    const a = chatHistoryRect(800, 600, 1);
    const b = chatHistoryRect(800, 600, VISIBLE_LINES);
    expect(b.h).toBeGreaterThan(a.h);
    const c = chatHistoryRect(800, 600, VISIBLE_LINES + 10);
    expect(c.h).toBe(b.h);
  });
});

describe('chat-history alpha', () => {
  it('is 0 when there are no entries', () => {
    expect(chatHistoryAlpha(undefined, 1000, false)).toBe(0);
  });

  it('is 1 within the visible window', () => {
    const e = { seq: 1, source: 'local', text: 'hi', at: 1000 };
    expect(chatHistoryAlpha(e, 1000 + FADE_AFTER_MS - 1, false)).toBe(1);
  });

  it('linearly fades out and pins at 0 past the fade', () => {
    const e = { seq: 1, source: 'local', text: 'hi', at: 0 };
    const mid = chatHistoryAlpha(e, FADE_AFTER_MS + FADE_DURATION_MS / 2, false);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(chatHistoryAlpha(e, FADE_AFTER_MS + FADE_DURATION_MS + 1, false)).toBe(0);
  });

  it('forceVisible pins alpha to 1 even when stale', () => {
    const e = { seq: 1, source: 'local', text: 'hi', at: 0 };
    expect(chatHistoryAlpha(e, 1_000_000, true)).toBe(1);
  });
});

describe('chat-history draw', () => {
  function fakeCtx() {
    const calls: string[] = [];
    return {
      calls,
      ctx: {
        save() { calls.push('save'); },
        restore() { calls.push('restore'); },
        fillRect() { calls.push('fillRect'); },
        strokeRect() { calls.push('strokeRect'); },
        fillText(txt: string) { calls.push('text:' + txt); },
        measureText() { return { width: 10 }; },
        set fillStyle(_v: string) {},
        set strokeStyle(_v: string) {},
        set font(_v: string) {},
        set textBaseline(_v: string) {},
        set textAlign(_v: string) {},
        set globalAlpha(_v: number) {},
        imageSmoothingEnabled: false,
      } as unknown as CanvasRenderingContext2D,
    };
  }

  it('is a no-op when log is empty', () => {
    const f = fakeCtx();
    drawChatHistory(f.ctx, { canvasW: 800, canvasH: 600, log: new ChatLog(), now: 0 });
    expect(f.calls.length).toBe(0);
  });

  it('renders one row per recent entry with source tag + body', () => {
    const log = new ChatLog();
    log.push('local', 'hello', 1000);
    log.push('peer-abc123', 'hi back', 1100);
    const f = fakeCtx();
    drawChatHistory(f.ctx, { canvasW: 800, canvasH: 600, log, now: 1100 });
    expect(f.calls).toContain('text:you');
    expect(f.calls).toContain('text:hello');
    expect(f.calls).toContain('text:peer-a');
    expect(f.calls).toContain('text:hi back');
  });

  it('skips drawing once entries have fully faded (unless forced)', () => {
    const log = new ChatLog();
    log.push('local', 'old', 0);
    const f = fakeCtx();
    drawChatHistory(f.ctx, {
      canvasW: 800,
      canvasH: 600,
      log,
      now: FADE_AFTER_MS + FADE_DURATION_MS + 10,
    });
    expect(f.calls.length).toBe(0);
  });

  it('forceVisible keeps the panel drawn even when stale', () => {
    const log = new ChatLog();
    log.push('local', 'old', 0);
    const f = fakeCtx();
    drawChatHistory(f.ctx, {
      canvasW: 800,
      canvasH: 600,
      log,
      now: FADE_AFTER_MS + FADE_DURATION_MS + 10,
      forceVisible: true,
    });
    expect(f.calls).toContain('text:old');
  });
});
