// Showcase recording harness — gives Playwright videos a VISIBLE cursor + click
// ripple + step captions (none of which Playwright records by default).
//
// - CURSOR_INIT is injected via addInitScript (re-runs on every navigation) and
//   draws a fake cursor that follows real mouse events + a ripple on mousedown,
//   plus a caption banner element (#__cap).
// - moveClick / moveXY move the mouse in interpolated steps so the cursor
//   visibly travels before clicking.
// - startSession records 1080p webm to docs/showcase/; finishSession finalizes
//   the video, renames it, and transcodes to mp4 via ffmpeg.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';

export const OUT_DIR = 'docs/showcase';

// Injected into every page/frame before its own scripts run.
export const CURSOR_INIT = `
(() => {
  if (window.__cursorInjected) return;
  window.__cursorInjected = true;
  const css = document.createElement('style');
  css.textContent = \`
    .__cur{position:fixed;left:0;top:0;width:24px;height:24px;z-index:2147483647;
      pointer-events:none;transition:transform .04s linear}
    .__cur svg{filter:drop-shadow(0 1px 3px rgba(0,0,0,.7))}
    .__rip{position:fixed;z-index:2147483646;pointer-events:none;border:3px solid #34d399;
      border-radius:50%;transform:translate(-50%,-50%);left:0;top:0}
    @keyframes __rk{from{width:8px;height:8px;opacity:.95}to{width:64px;height:64px;opacity:0}}
    .__cap{position:fixed;left:50%;bottom:30px;transform:translateX(-50%);z-index:2147483647;
      pointer-events:none;background:rgba(10,10,12,.85);color:#fff;
      font:600 19px/1.3 system-ui,-apple-system,Segoe UI,sans-serif;padding:11px 20px;
      border-radius:12px;border:1px solid rgba(255,255,255,.15);
      box-shadow:0 10px 34px rgba(0,0,0,.55);max-width:82vw;opacity:0;transition:opacity .25s}
  \`;
  const mount = () => {
    const root = document.documentElement;
    root.appendChild(css);
    const cur = document.createElement('div');
    cur.className = '__cur';
    cur.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 3l14 7-5.6 1.6L10 18z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    root.appendChild(cur);
    const cap = document.createElement('div');
    cap.className = '__cap';
    cap.id = '__cap';
    root.appendChild(cap);
    try { const saved = sessionStorage.getItem('__cap'); if (saved) { cap.textContent = saved; cap.style.opacity = '1'; } } catch (e) {}
    let x = window.innerWidth / 2, y = window.innerHeight / 2, s = 1;
    const apply = () => { cur.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 2) + 'px) scale(' + s + ')'; };
    apply();
    addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; apply(); }, true);
    addEventListener('mousedown', (e) => {
      s = 0.78; apply();
      const r = document.createElement('div');
      r.className = '__rip';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      r.style.animation = '__rk .5s ease-out forwards';
      root.appendChild(r);
      setTimeout(() => r.remove(), 520);
    }, true);
    addEventListener('mouseup', () => { s = 1; apply(); }, true);
  };
  if (document.documentElement) mount();
  else addEventListener('DOMContentLoaded', mount);
})();
`;

export const sleep = (page, ms) => page.waitForTimeout(ms);

export async function caption(page, text) {
  await page
    .evaluate((t) => {
      try {
        if (t) sessionStorage.setItem('__cap', t);
        else sessionStorage.removeItem('__cap');
      } catch (e) {}
      const cap = document.getElementById('__cap');
      if (cap) {
        cap.textContent = t;
        cap.style.opacity = t ? '1' : '0';
      }
    }, text)
    .catch(() => {});
}

// Move the cursor to an element (visible travel), then click it.
export async function moveClick(page, locator, { steps = 26 } = {}) {
  const el = typeof locator === 'string' ? page.locator(locator) : locator;
  await el.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(page, 250);
  const box = await el.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps,
    });
    await sleep(page, 200);
  }
  await el.click();
  await sleep(page, 500);
}

// Move + click at raw coordinates (for canvas/animation stages).
export async function moveXY(page, x, y, { steps = 26 } = {}) {
  await page.mouse.move(x, y, { steps });
  await sleep(page, 180);
  await page.mouse.click(x, y);
  await sleep(page, 500);
}

export async function startSession({
  viewport = { width: 1920, height: 1080 },
} = {}) {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: OUT_DIR, size: viewport },
  });
  await context.addInitScript(CURSOR_INIT);
  const page = await context.newPage();
  return { browser, context, page };
}

export async function finishSession(session, name) {
  const { browser, context, page } = session;
  const video = page.video();
  await context.close(); // flushes the .webm to disk
  const webm = path.join(OUT_DIR, `${name}.webm`);
  if (video) {
    const tmp = await video.path();
    if (existsSync(tmp)) renameSync(tmp, webm);
  }
  await browser.close();
  // Transcode to mp4 (H.264, web-friendly). ffmpeg required.
  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        webm,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        path.join(OUT_DIR, `${name}.mp4`),
      ],
      { stdio: 'ignore' },
    );
  } catch {
    console.warn(`  (ffmpeg transcode failed for ${name} — .webm kept)`);
  }
  return webm;
}
