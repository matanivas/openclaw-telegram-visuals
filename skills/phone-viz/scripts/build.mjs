#!/usr/bin/env node
// Build one phone-first HTML page from a JSON spec (see SKILL.md, "The spec").
// No dependencies. Usage: node build.mjs spec.json [out.html]
// The page carries light and dark tokens; render.mjs picks one when it makes a PNG.
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
let specDir = process.cwd(); // svg block files resolve against the spec's folder

const WORDS = {
  he: {
    done: 'הושלם', active: 'בעבודה', waiting: 'ממתין', stuck: 'תקוע', todo: 'טרם התחיל',
    table: 'הצגה כטבלה', asOf: 'נכון ל־', source: 'מקור', decisions: 'מחכה להחלטה שלך',
    unlocks: 'פותח:', item: 'פריט', value: 'ערך', total: 'סה״כ', more: 'עוד',
  },
  en: {
    done: 'Done', active: 'In progress', waiting: 'Waiting', stuck: 'Stuck', todo: 'Not started',
    table: 'Show as table', asOf: 'As of ', source: 'Source', decisions: 'Waiting for your decision',
    unlocks: 'Unlocks:', item: 'Item', value: 'Value', total: 'Total', more: 'more',
  },
};
const RTL = new Set(['he', 'ar', 'fa', 'ur', 'yi']);
// State is always glyph + word + tint, never color alone (status rule).
const STATES = { done: '✓', active: '●', waiting: '…', stuck: '!', todo: '○' };
const MAX_SERIES = 8; // categorical token ceiling; past it fold into "Other"

function fail(msg) {
  console.error(`build.mjs: ${msg}`);
  process.exit(1);
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Inline text: escape everything, then `code` (English terms, paths: isolated LTR) and **bold**.
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code dir="ltr">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
}

function main() {
  const [specPath, outArg] = process.argv.slice(2);
  if (!specPath) fail('usage: node build.mjs spec.json [out.html]');
  let spec;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf8'));
  } catch (e) {
    fail(`cannot read spec: ${e.message}`);
  }
  specDir = dirname(resolve(specPath));
  const html = buildPage(spec);
  const out = resolve(outArg || specPath.replace(/\.json$/i, '') + '.html');
  writeFileSync(out, html);
  console.log(out);
}

export function buildPage(spec) {
  if (!spec || typeof spec !== 'object') fail('spec must be an object');
  if (!spec.title) fail('spec.title is required');
  if (!Array.isArray(spec.blocks) || !spec.blocks.length) fail('spec.blocks must be a non-empty array');
  const lang = spec.lang || 'he';
  const W = WORDS[lang] || WORDS[RTL.has(lang) ? 'he' : 'en'];
  const dir = RTL.has(lang) ? 'rtl' : 'ltr';
  const locale = spec.locale || (lang === 'he' ? 'he-IL' : lang);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const people = (spec.people || []).map((p) => (typeof p === 'string' ? { name: p } : p));
  if (people.length > MAX_SERIES) fail(`at most ${MAX_SERIES} people/series; fold the rest into one "other" entry`);
  const slotOf = (who) => {
    if (who === undefined || who === null) return 0;
    const i = typeof who === 'number' ? who : people.findIndex((p) => p.name === who);
    if (i < 0 || i >= people.length) fail(`unknown "who": ${JSON.stringify(who)} (list it in spec.people)`);
    return i + 1;
  };
  const ctx = { W, nf, slotOf, people, dir };
  const blocks = spec.blocks.map((b, i) => {
    const fn = BLOCKS[b.type];
    if (!fn) fail(`block ${i}: unknown type "${b.type}" (known: ${Object.keys(BLOCKS).join(', ')})`);
    return `<section class="blk blk-${b.type}${b.half ? ' half' : ''}" data-blk="${i}">${b.title ? `<h2>${inline(b.title)}</h2>` : ''}${fn(b, ctx, i)}${b.caption ? `<p class="cap">${inline(b.caption)}</p>` : ''}</section>`;
  });
  const usesPeople = people.length > 0;
  const legend = usesPeople
    ? `<div class="legend" aria-label="legend">${people.map((p, i) => `<span class="key"><i class="sw s${i + 1}"></i>${inline(p.name)}</span>`).join('')}</div>`
    : '';
  const meta = [spec.asOf ? `${W.asOf}<bdi>${esc(spec.asOf)}</bdi>` : '', spec.source ? `${W.source}: ${inline(spec.source)}` : '']
    .filter(Boolean)
    .join(' · ');
  const css = fontFaces() + readFileSync(resolve(here, '../templates/page.css'), 'utf8');
  const theme = ['light', 'dark'].includes(spec.theme) ? ` data-theme="${spec.theme}"` : '';
  return `<!doctype html>
<html lang="${esc(lang)}" dir="${dir}"${theme}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${esc(String(spec.title).replace(/`|\*\*/g, ""))}</title>
<style>
${css}
</style>
</head>
<body>
<main class="wrap">
<header class="blk blk-head" data-blk="head">
${spec.eyebrow ? `<div class="eyebrow">${inline(spec.eyebrow)}</div>` : ''}<h1>${inline(spec.title)}</h1>
${spec.subtitle ? `<p class="sub">${inline(spec.subtitle)}</p>` : ''}${legend}
</header>
${blocks.join('\n')}
${meta ? `<footer class="blk meta" data-blk="foot">${meta}</footer>` : ''}
</main>
</body>
</html>
`;
}

// A leading signed figure ("+2", "-8%") stays left-to-right inside right-to-left text.
const signed = (s) => {
  const m = String(s).match(/^\s*([+\-−]?[\d.,]+%?)(.*)$/s);
  return m ? `<bdi dir="ltr" class="num">${esc(m[1])}</bdi>${inline(m[2])}` : inline(s);
};
const chip = (state, W) => {
  if (!state) return '';
  if (!STATES[state]) fail(`unknown state "${state}" (use ${Object.keys(STATES).join(', ')})`);
  return `<span class="st st-${state}"><b aria-hidden="true">${STATES[state]}</b>${W[state]}</span>`;
};
const whoBar = (who, ctx) => (who === undefined ? '' : ` s${ctx.slotOf(who)} has-who`);
const num = (v, ctx, unit) => `<bdi class="num">${ctx.nf.format(v)}${unit ? `${unit.length > 2 ? ' ' : ''}${esc(unit)}` : ''}</bdi>`;

const BLOCKS = {
  // Questions for the reader, on top: each is a question plus what answering it unlocks.
  decisions(b, ctx) {
    const items = req(b, 'items');
    if (items.length > 3) fail('decisions: at most 3 cards; the rest belong in a text block');
    return `<div class="cards">${items
      .map(
        (c) => `<div class="card${c.hot ? ' hot' : ''}"><div class="q">${inline(c.q)}</div>${c.why ? `<div class="why">${inline(c.why)}</div>` : ''}${c.unlocks ? `<div class="un"><span>${ctx.W.unlocks}</span> ${inline(c.unlocks)}</div>` : ''}${c.recommend ? `<div class="rec">${inline(c.recommend)}</div>` : ''}</div>`,
      )
      .join('')}</div>`;
  },

  // A few headline numbers: stat tiles, not a chart. delta.good says whether the change is good news.
  stats(b, ctx) {
    const items = req(b, 'items');
    if (items.length > 4) fail('stats: at most 4 tiles on a phone');
    return `<div class="stats">${items
      .map((t) => {
        const d = t.delta
          ? `<div class="delta ${t.good === true ? 'up' : t.good === false ? 'down' : ''}">${signed(t.delta)}</div>`
          : '';
        const v = typeof t.value === 'number' ? num(t.value, ctx, t.unit) : `<bdi>${inline(t.value)}</bdi>`;
        // A word value ("on hold", a name) is set smaller than a figure, so a phrase never towers over the tile.
        const words = typeof t.value === 'string' && String(t.value).replace(/[\d\s.,/%]/g, '').length > 4;
        return `<div class="tile"><div class="lbl">${inline(t.label)}</div><div class="val${words ? ' words' : ''}">${v}</div>${d}</div>`;
      })
      .join('')}</div>`;
  },

  // Magnitude across categories: horizontal bars on one baseline (labels stay readable on a phone).
  // One series: slot 1 for every bar, or emphasis (highlight one, gray the rest).
  // Several series (paired bars, e.g. effort vs need): values[] per item, names in b.series, legend shown.
  bars(b, ctx) {
    const items = req(b, 'items');
    const series = b.series || null;
    if (series && series.length > 3) fail('bars: at most 3 series side by side on a phone; facet instead');
    const vals = (it) => (series ? it.values : [it.value]);
    for (const it of items) {
      const v = vals(it);
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'number' || x < 0))
        fail(`bars: item "${it.label}" needs ${series ? 'values: [numbers ≥ 0]' : 'value: number ≥ 0'} (signed data → use two blocks or a diverging chart in an svg block)`);
    }
    if (items.length > 12) fail('bars: at most 12 bars; fold the tail into one "other" item');
    const list = b.sort === false || series ? items : [...items].sort((a, c) => c.value - a.value);
    const max = Math.max(...list.flatMap(vals), 0) || 1;
    const legend = series
      ? `<div class="legend">${series.map((s, i) => `<span class="key"><i class="sw s${i + 1}"></i>${inline(s)}</span>`).join('')}</div>`
      : '';
    const rows = list
      .map((it) => {
        const v = vals(it);
        const emph = b.highlight !== undefined && !series;
        const bars = v
          .map((x, k) => {
            const cls = series ? `s${k + 1}` : emph ? (it.label === b.highlight ? 's1' : 'deemph') : 's1';
            const w = Math.max((x / max) * 100, x > 0 ? 1.5 : 0);
            return `<div class="track"><div class="lane"><div class="bar ${cls}" style="width:${w.toFixed(2)}%"></div></div>${num(x, ctx, b.unit)}</div>`;
          })
          .join('');
        return `<div class="brow" title="${esc(it.label)}"><div class="blbl">${inline(it.label)}${it.note ? `<small>${inline(it.note)}</small>` : ''}</div><div class="bcol">${bars}</div></div>`;
      })
      .join('');
    const head = `<tr><th>${ctx.W.item}</th>${(series || [ctx.W.value]).map((s) => `<th>${inline(s)}</th>`).join('')}</tr>`;
    const body = list.map((it) => `<tr><td>${inline(it.label)}</td>${vals(it).map((x) => `<td>${num(x, ctx, b.unit)}</td>`).join('')}</tr>`).join('');
    return `${legend}<div class="bars">${rows}</div>${tableTwin(head, body, ctx)}`;
  },

  // An ordered chain where each step depends on the one before. Vertical on a phone.
  pipeline(b, ctx) {
    const steps = req(b, 'steps');
    if (steps.length > 9) fail('pipeline: at most 9 steps; split into overview + detail');
    return `<ol class="pipe">${steps
      .map(
        (s, i) => `<li class="pstep st-${s.state || 'todo'}${whoBar(s.who, ctx)}"><span class="pn">${i + 1}</span><div class="pbody"><div class="ptop"><b>${inline(s.label)}</b>${chip(s.state, ctx.W)}</div>${s.sub ? `<small>${inline(s.sub)}</small>` : ''}</div></li>`,
      )
      .join('')}</ol>`;
  },

  // State of many items: a board, one column per state. Columns stack on a phone.
  board(b, ctx) {
    const cols = req(b, 'columns');
    if (cols.length > 5) fail('board: at most 5 columns');
    return `<div class="board">${cols
      .map((c) => {
        const cards = c.cards || [];
        const shown = cards.slice(0, b.maxPerColumn || 6);
        const extra = cards.length - shown.length;
        return `<div class="col st-${c.state || 'todo'}"><div class="colh">${c.state ? chip(c.state, ctx.W) : ''}<b>${inline(c.name || '')}</b><bdi class="cnt">${cards.length}</bdi></div>${shown
          .map((k) => `<div class="kcard${whoBar(k.who, ctx)}"><div>${inline(k.title)}</div>${k.sub ? `<small>${inline(k.sub)}</small>` : ''}</div>`)
          .join('')}${extra > 0 ? `<div class="more">+${extra} ${ctx.W.more}</div>` : ''}</div>`;
      })
      .join('')}</div>`;
  },

  // Events in time: a vertical axis, dates on the start side.
  timeline(b, ctx) {
    const ev = req(b, 'events');
    if (ev.length > 12) fail('timeline: at most 12 events; group by week instead');
    return `<ol class="tl">${ev
      .map(
        (e) => `<li class="tev st-${e.state || 'none'}${e.who !== undefined ? ` s${ctx.slotOf(e.who)} has-who` : ''}${e.now ? ' now' : ''}"><bdi class="when">${esc(e.when)}</bdi><i class="dot" aria-hidden="true"></i><div class="tbody"><div>${inline(e.label)} ${chip(e.state, ctx.W)}</div>${e.sub ? `<small>${inline(e.sub)}</small>` : ''}</div></li>`,
      )
      .join('')}</ol>`;
  },

  // Hierarchy plus state: groups (capabilities, areas) containing chips (initiatives, items).
  // weight (optional) widens a chip, treemap-like, when relative size is part of the story.
  map(b, ctx) {
    const groups = req(b, 'groups');
    const n = groups.reduce((a, g) => a + (g.items || []).length, 0);
    if (groups.length > 6 || n > 24) fail('map: at most 6 groups and 24 items; split into overview + detail');
    return `<div class="map">${groups
      .map(
        (g) => `<div class="grp${g.focus ? ' focus' : ''}"><div class="gh"><b>${inline(g.name)}</b>${g.sub ? `<small>${inline(g.sub)}</small>` : ''}</div><div class="chips">${(g.items || [])
          .map(
            (it) => `<span class="mchip st-${it.state || 'todo'}${whoBar(it.who, ctx)}" style="flex-grow:${Number(it.weight) || 1}"><b aria-hidden="true">${STATES[it.state || 'todo']}</b>${inline(it.label)}</span>`,
          )
          .join('')}</div></div>`,
      )
      .join('')}</div>${mapKey(b, groups, ctx)}`;
  },

  // Priorities on two axes (value against effort, gain against risk): a 2x2 matrix with numbered
  // dots, and the same numbers as a ranked list under it, because labels never fit beside dots on a phone.
  // x and y run 0..1; x grows from the start side (right in right-to-left pages). pick: true marks
  // the recommended items (filled in ink); the rest are gray outlines. Ink, not a series hue, so the
  // emphasis never reads as a person's identity color.
  quadrant(b, ctx) {
    const items = req(b, 'items');
    if (items.length > 9) fail('quadrant: at most 9 items; split into overview + detail');
    const ax = b.x || {}, ay = b.y || {};
    for (const it of items) {
      if (![it.x, it.y].every((v) => typeof v === 'number' && v >= 0 && v <= 1))
        fail(`quadrant: item "${it.label}" needs x and y between 0 and 1`);
    }
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++)
        if (Math.abs(items[i].x - items[j].x) < 0.09 && Math.abs(items[i].y - items[j].y) < 0.09)
          fail(`quadrant: dots "${items[i].label}" and "${items[j].label}" overlap; move one by 0.1`);
    const pos = (v) => (6 + v * 88).toFixed(1);
    const names = b.quadrants || [];
    if (names.length && names.length !== 4) fail('quadrant: "quadrants" names the 4 cells: top-start, top-end, bottom-start, bottom-end');
    const cells = [0, 1, 2, 3]
      .map((k) => `<div class="qc${b.best === k ? ' best' : ''}">${names[k] ? `<span>${inline(names[k])}</span>` : ''}</div>`)
      .join('');
    const dots = items
      .map(
        (it, i) => `<span class="qdot${it.pick ? ' pick' : ''}" style="inset-inline-start:${pos(it.x)}%;bottom:${pos(it.y)}%" aria-label="${esc(it.label)}"><bdi>${i + 1}</bdi></span>`,
      )
      .join('');
    const arrow = ctx.dir === 'rtl' ? '←' : '→';
    const yAxis = ay.label ? `<div class="qy">↑ ${inline(ay.label)}${ay.low || ay.high ? ` <small>(${inline(ay.low || '')} ${'↑'} ${inline(ay.high || '')})</small>` : ''}</div>` : '';
    const xAxis = ax.label
      ? `<div class="qx"><span>${inline(ax.low || '')}</span><b>${inline(ax.label)} ${arrow}</b><span>${inline(ax.high || '')}</span></div>`
      : '';
    const list = items
      .map(
        (it, i) => `<li class="qitem${it.pick ? ' pick' : ''}${whoBar(it.who, ctx)}"><span class="qn"><bdi>${i + 1}</bdi></span><div class="qbody"><div class="ptop"><b>${inline(it.label)}</b>${chip(it.state, ctx.W)}</div>${it.sub ? `<small>${inline(it.sub)}</small>` : ''}</div></li>`,
      )
      .join('');
    return `<div class="quad">${yAxis}<div class="qplot">${cells}${dots}</div>${xAxis}</div><ol class="qlist">${list}</ol>`;
  },

  // Support text. fold: true puts it behind a summary line.
  text(b, ctx) {
    const paras = (Array.isArray(b.body) ? b.body : [req(b, 'body')]).map((p) => `<p>${inline(p)}</p>`).join('');
    return b.fold ? `<details><summary>${inline(b.summary || '…')}</summary>${paras}</details>` : `<div class="txt">${paras}</div>`;
  },

  // A diagram drawn by hand per references/diagram-design (architecture, sequence, state machine, ...).
  // Read from a file so the SVG never passes through JSON escaping. Width: the viewBox, scrolled locally.
  svg(b) {
    if (!b.file) fail('svg: give "file", a path to an .svg file');
    const svg = readFileSync(resolve(specDir, b.file), 'utf8');
    if (!/^\s*<svg[\s>]/.test(svg)) fail(`svg: ${b.file} must start with <svg`);
    if (/<script|on\w+\s*=|href\s*=\s*["']?\s*javascript:/i.test(svg)) fail('svg: scripts and event handlers are not allowed');
    return `<div class="svgwrap">${svg}</div>`;
  },
};

// Heebo (SIL OFL, assets/fonts/OFL.txt), embedded so the page and its PNG look the same
// offline and inside Telegram's viewer. Variable weight 400-800; Hebrew and Latin subsets.
function fontFaces() {
  const face = (file, range) =>
    `@font-face{font-family:"Heebo";font-style:normal;font-weight:400 800;font-display:swap;src:url(data:font/woff2;base64,${readFileSync(resolve(here, '../assets/fonts', file)).toString('base64')}) format("woff2");unicode-range:${range}}\n`;
  return (
    face('heebo-hebrew.woff2', 'U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F') +
    face('heebo-latin.woff2', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')
  );
}

function mapKey(b, groups, ctx) {
  const used = new Set(groups.flatMap((g) => (g.items || []).map((i) => i.state || 'todo')));
  if (b.key === false || used.size < 2) return '';
  return `<div class="skey">${Object.keys(STATES).filter((s) => used.has(s)).map((s) => chip(s, ctx.W)).join('')}</div>`;
}

function tableTwin(head, body, ctx) {
  return `<details class="twin"><summary>${ctx.W.table}</summary><table><thead>${head}</thead><tbody>${body}</tbody></table></details>`;
}

function req(b, key) {
  const v = b[key];
  if (v === undefined || (Array.isArray(v) && !v.length)) fail(`${b.type}: "${key}" is required`);
  return v;
}

// Compare real paths: when the skill sits behind a symlink (a mounted or linked skills folder),
// the path Node was given and import.meta.url differ, and the script would exit silently.
const real = (p) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) main();
