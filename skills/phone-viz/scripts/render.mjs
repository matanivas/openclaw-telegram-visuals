#!/usr/bin/env node
// Render an HTML page to phone-sized PNG(s) with headless Chrome/Chromium over the DevTools
// protocol. No npm dependencies: Node >= 22 (global WebSocket) and a Chrome binary.
//
//   node render.mjs page.html [--out dir/name] [--theme light|dark] [--width 390]
//                   [--scale 2] [--max-height 1280] [--single]
//
// Telegram re-encodes a photo so its long side is at most 2560 px. At scale 2 that is 1280 CSS
// px, so a taller page is cut into several PNGs at block boundaries (send them as one album).
// --single makes one tall PNG instead. --width 1280 --single renders the computer layout.
// Prints JSON: { "files": [...], "theme", "width", "scale" }. Exits 3 when an SVG label is cut off
// at the drawing's edge or overlaps a dot or another label (the PNGs are still written, to look at).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir, homedir, platform } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const VALUED = new Set(['--out', '--theme', '--width', '--scale', '--max-height']);
const input = args.find((a, i) => !a.startsWith('--') && !VALUED.has(args[i - 1]));
if (!input) die('usage: node render.mjs page.html [--out path] [--theme light|dark] [--single]');
const theme = opt('theme', 'light');
if (!['light', 'dark'].includes(theme)) die('--theme must be light or dark');
const width = Number(opt('width', 390));
const scale = Number(opt('scale', 2));
const maxH = Number(opt('max-height', Math.floor(2560 / scale)));
const single = args.includes('--single');
const outBase = resolve(opt('out', input.replace(/\.html?$/i, '')));

function die(msg) {
  console.error(`render.mjs: ${msg}`);
  process.exit(1);
}

function findChrome() {
  if (process.env.VIZ_CHROME) return process.env.VIZ_CHROME;
  const names = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome', 'msedge'];
  const pathDirs = (process.env.PATH || '').split(platform() === 'win32' ? ';' : ':');
  for (const d of pathDirs) for (const n of names) for (const ext of platform() === 'win32' ? ['.exe'] : ['']) {
    const p = join(d, n + ext);
    if (existsSync(p)) return p;
  }
  const fixed = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    '/opt/pw-browsers/chromium',
  ];
  for (const p of fixed) if (existsSync(p)) return p;
  // Playwright's cache, if the host has one.
  for (const root of [join(homedir(), '.cache/ms-playwright'), join(homedir(), 'Library/Caches/ms-playwright')]) {
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root).filter((x) => x.startsWith('chromium-')).sort().reverse()) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = join(root, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  die('no Chrome/Chromium found. Install one, or set VIZ_CHROME to its binary path.');
}

async function launch(bin) {
  const profile = mkdtempSync(join(tmpdir(), 'phone-viz-'));
  const flags = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--allow-file-access-from-files', 'about:blank',
  ];
  if (process.getuid?.() === 0 || process.env.VIZ_NO_SANDBOX) flags.unshift('--no-sandbox');
  const proc = spawn(bin, flags, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((ok, no) => {
    let buf = '';
    const t = setTimeout(() => no(new Error(`Chrome did not start: ${buf.slice(-400)}`)), 20000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); ok(m[1]); }
    });
    proc.on('exit', (c) => { clearTimeout(t); no(new Error(`Chrome exited (${c}): ${buf.slice(-400)}`)); });
  });
  return { proc, profile, wsUrl };
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { ok, no } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? no(new Error(`${msg.error.message}`)) : ok(msg.result);
    } else if (msg.method) {
      for (const w of [...waiters]) if (w.method === msg.method) { waiters.splice(waiters.indexOf(w), 1); w.ok(msg.params); }
    }
  };
  const ready = new Promise((ok, no) => { ws.onopen = ok; ws.onerror = () => no(new Error('DevTools socket failed')); });
  return {
    ready,
    send: (method, params = {}, sessionId) => new Promise((ok, no) => {
      const m = { id: ++id, method, params };
      if (sessionId) m.sessionId = sessionId;
      pending.set(m.id, { ok, no });
      ws.send(JSON.stringify(m));
    }),
    once: (method, ms = 20000) => new Promise((ok, no) => {
      const t = setTimeout(() => no(new Error(`timeout waiting for ${method}`)), ms);
      t.unref();
      waiters.push({ method, ok: (v) => { clearTimeout(t); ok(v); } });
    }),
    close: () => ws.close(),
  };
}

const PREPARE = `(async () => {
  document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
  document.documentElement.classList.add('export');
  for (const d of document.querySelectorAll('details:not(.twin)')) d.open = true;
  await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 4000))]);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const wrap = document.querySelector('.wrap') || document.body;
  const kids = [...wrap.children].filter(e => e.getBoundingClientRect().height > 0);
  const blocks = kids.map(e => { const r = e.getBoundingClientRect(); return [Math.floor(r.top + scrollY), Math.ceil(r.bottom + scrollY)]; });
  const overflow = innerWidth > ${width} + 1 || document.documentElement.scrollWidth > innerWidth + 1;
  // SVG label check. A label placed by hand can run past the drawing's edge (an SVG clips it) or
  // under a dot or another label. The usual cause is text-anchor read in the wrong direction: an
  // SVG inside a right-to-left page inherits direction rtl, where "start" is the right edge.
  const labels = [];
  const box = (e) => e.getBoundingClientRect();
  const hit = (a, b, pad) => a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad;
  const holds = (outer, r) => { const x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2; return x > outer.left && x < outer.right && y > outer.top && y < outer.bottom; };
  for (const svg of document.querySelectorAll('svg')) {
    const sb = box(svg);
    if (!sb.width || !sb.height) continue;
    const texts = [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim() && box(t).width);
    const dots = [...svg.querySelectorAll('circle, ellipse')].map(box).filter((r) => r.width);
    const name = (t) => JSON.stringify(t.textContent.trim().slice(0, 40));
    texts.forEach((t, i) => {
      const r = box(t);
      if (r.left < sb.left - 1 || r.right > sb.right + 1 || r.top < sb.top - 1 || r.bottom > sb.bottom + 1) labels.push('cut off at the edge of the drawing: ' + name(t));
      for (const d of dots) if (!holds(d, r) && hit(r, d, 2)) { labels.push('covered by or covering a dot: ' + name(t)); break; }
      for (const u of texts.slice(i + 1)) if (hit(r, box(u), 1)) labels.push('overlaps another label: ' + name(t) + ' and ' + name(u));
    });
  }
  return JSON.stringify({ height: Math.ceil(document.documentElement.scrollHeight), blocks, overflow, labels: [...new Set(labels)] });
})()`;

// Greedy pages: keep whole blocks together; a block taller than a page is sliced.
function paginate(blocks, total) {
  const PAD = 16;
  if (single || total <= maxH) return [[0, total]];
  const pages = [];
  let start = 0;
  let end = 0;
  for (const [top, bottom] of blocks) {
    if (bottom - start + PAD <= maxH) { end = bottom; continue; }
    if (end > start) { pages.push([start, end + PAD]); start = top - PAD; }
    while (bottom - start + PAD > maxH) { pages.push([start, start + maxH]); start += maxH; }
    end = bottom;
  }
  pages.push([start, Math.min(total, end + PAD + 12)]);
  return pages.map(([a, b]) => [Math.max(0, a), Math.min(total, b)]).filter(([a, b]) => b - a > 8);
}

async function main() {
  const file = resolve(input);
  if (!existsSync(file)) die(`not found: ${file}`);
  const { proc, profile, wsUrl } = await launch(findChrome());
  const c = cdp(wsUrl);
  try {
    await c.ready;
    const { targetId } = await c.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: s } = await c.send('Target.attachToTarget', { targetId, flatten: true });
    await c.send('Page.enable', {}, s);
    await c.send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: scale, mobile: width < 700 }, s);
    await c.send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: theme }] }, s);
    const loaded = c.once('Page.loadEventFired').catch(() => {});
    await c.send('Page.navigate', { url: pathToFileURL(file).href }, s);
    // Remote assets must not hold the render hostage: give up waiting for "load" after 8 s.
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 8000).unref())]);
    const ev = await c.send('Runtime.evaluate', { expression: PREPARE, awaitPromise: true, returnByValue: true }, s);
    if (ev.exceptionDetails) throw new Error(`page script failed: ${ev.exceptionDetails.text}`);
    const info = JSON.parse(ev.result.value);
    await c.send('Emulation.setDeviceMetricsOverride', { width, height: Math.min(info.height, 16000), deviceScaleFactor: scale, mobile: width < 700 }, s);
    const pages = paginate(info.blocks, info.height);
    const files = [];
    for (let i = 0; i < pages.length; i++) {
      const [y0, y1] = pages[i];
      const shot = await c.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true, clip: { x: 0, y: y0, width, height: y1 - y0, scale: 1 },
      }, s);
      const out = pages.length === 1 ? `${outBase}-${theme}.png` : `${outBase}-${theme}-${i + 1}.png`;
      writeFileSync(out, Buffer.from(shot.data, 'base64'));
      files.push(out);
    }
    if (files.length > 10) console.error('render.mjs: more than 10 images; Telegram albums hold 10. Split the spec or use --single.');
    if (info.overflow) console.error('render.mjs: WARNING the page is wider than the phone viewport; something overflows horizontally.');
    if (info.labels.length) {
      console.error(`render.mjs: ${info.labels.length} SVG label problem(s); fix them before sending (text-anchor in a right-to-left SVG: "start" is the right edge):`);
      for (const l of info.labels) console.error(`  - ${l}`);
      process.exitCode = 3;
    }
    console.log(JSON.stringify({ files, theme, width, scale, cssHeight: info.height }, null, 1));
  } finally {
    try { await c.send('Browser.close'); } catch {}
    c.close();
    proc.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => die(e.message));
