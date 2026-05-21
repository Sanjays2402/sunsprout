// Entry point. Vite mounts this on the page; we acquire the canvas,
// instantiate the Game, and start the loop. Errors are surfaced to the
// canvas so a misconfigured host doesn't fail silently.

import { Game } from './engine/game';

function fatal(message: string): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) {
    // No canvas at all — write to body as a last resort.
    document.body.textContent = message;
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    document.body.textContent = message;
    return;
  }
  ctx.fillStyle = '#1a1426';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f5e9d4';
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
}

function main(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) {
    fatal('🌱 sunsprout — no #game canvas found');
    return;
  }
  try {
    const game = new Game(canvas);
    game.start();
    // Expose for debugging from the devtools console.
    (window as unknown as { __sunsprout?: Game }).__sunsprout = game;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    fatal(`🌱 sunsprout — boot failed: ${msg}`);
    // Re-throw so Vite/HMR shows the stack in the devtools console too.
    throw err;
  }
}

// Defer to DOMContentLoaded so the canvas element is guaranteed to exist
// when this module is loaded as a deferred ES module.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}

export {};
