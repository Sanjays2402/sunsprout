
// Headless screenshot helper. Spawns a local Vite dev server, opens the
// game in a Chromium browser, lets it settle for a moment, then writes
// a couple of PNGs to /tmp/. Run with `node scripts/snap.mjs`.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const ROOT = process.cwd();
const PORT = 5181 + Math.floor(Math.random() * 50);
const server = await createServer({ root: ROOT, server: { port: PORT, host: '127.0.0.1' } });
await server.listen();
const url = `http://127.0.0.1:${PORT}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 620 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => console.error('[browser]', m.type(), m.text()));
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.screenshot({ path: '/tmp/sunsprout_v010_initial.png', clip: { x: 12, y: 30, width: 980, height: 580 } });

// Walk south so the player ends up near tilled patch / NPCs, then snap.
const press = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); await page.waitForTimeout(120); };
await press('s', 900);
await press('d', 500);
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/sunsprout_v010_walking.png', clip: { x: 12, y: 30, width: 980, height: 580 } });

// Try planting on the tilled patch: select wheat (1), press 1 (plant), then water.
await press('1', 60);
await page.waitForTimeout(300);
// Talk to an NPC by walking up + right to plaza area.
await press('w', 1200);
await press('d', 300);
await page.waitForTimeout(400);
await page.keyboard.press('e');
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/sunsprout_v010_dialogue.png', clip: { x: 12, y: 30, width: 980, height: 580 } });

await browser.close();
await server.close();
console.log('OK');
