# Color and marks

The page builder applies these rules by itself. They matter when you write a spec, draw an SVG by hand, or change the palette.

## One job per color

A color on the page answers one question, and the reader should never have to guess which:

| Question the color answers | How it is built |
|---|---|
| Who or which series is this? | a categorical hue, taken from a fixed list in order |
| Which step in an ordered sequence? | one hue, lighter to darker |
| How much? | one hue, light to dark |
| Above or below a reference? | two opposed hues meeting at a neutral gray |
| What state is it in? | a small fixed status scale, always with a glyph and a word |

If reordering the categories would change their meaning (stages, sizes, age bands), treat them as one hue in lightness steps. Teams, products and places have no order: one series is one color, whatever the number of bars.

## Rules

- Hues go out in list order and are never reused. Past eight series, merge the smallest into "other" or split the chart.
- One value axis per chart. Two measures on different scales are two charts.
- A color belongs to the thing it marks. Sorting or filtering never repaints what remains.
- Magnitude is one hue from light to dark; a split around a reference is two hues and gray. No rainbow scales.
- Keep marks thin. Show a legend from two series on; label a few key values, not every point.
- Words stay in text colors. A swatch, stripe or dot next to a label carries its identity. Text placed on a colored fill is white, or near-black on yellow.
- Status colors mean state only, and never appear without the glyph and the word. Series colors never mean good or bad.
- Bars get a table view in the HTML, so no value depends on color or hover alone.

## Palette

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | blue | `#2a78d6` | `#3987e5` |
| 2 | orange | `#eb6834` | `#d95926` |
| 3 | aqua | `#1baf7a` | `#199e70` |
| 4 | yellow | `#eda100` | `#c98500` |
| 5 | magenta | `#e87ba4` | `#d55181` |
| 6 | green | `#008300` | `#008300` |
| 7 | violet | `#6250d6` | `#9085e9` |
| 8 | red | `#e34948` | `#e66767` |

Neighbouring slots were chosen to stay apart for the common kinds of color blindness, which is why the order is fixed. When marks of any two series can touch (scatter, map, small multiples), stay within the first three slots. From four series on, label the marks directly as well. Aqua, yellow and magenta are faint on the light page, so marks in them always need a visible label or the table view.

Status (same in both modes): good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b`. The builder maps states to them: done = good, waiting = warning, stuck = critical, in progress = slot 1 blue, not started = muted gray.

Sequential blue, light to dark: `#cde2fb` `#b7d3f6` `#9ec5f4` `#86b6ef` `#6da7ec` `#5598e7` `#3987e5` `#2a78d6` `#256abf` `#1c5cab` `#184f95` `#104281` `#0d366b`. For discrete ordered marks on light start no lighter than `#86b6ef`; on dark go no darker than `#184f95`.

Diverging: blue against red, gray midpoint (light `#f0efec`, dark `#383835`), equal steps per side.

Chrome and ink:

| Role | Light | Dark |
|---|---|---|
| Page | `#f9f9f7` | `#0d0d0d` |
| Chart surface | `#fcfcfb` | `#1a1a19` |
| Tile | `#ffffff` | `#232321` |
| Primary ink | `#0b0b0b` | `#f0efec` |
| Secondary ink | `#52514e` | `#c3c2b7` |
| Muted (axis, labels) | `#898781` | `#898781` |
| Gridline | `#e1e0d9` | `#2c2c2a` |
| Baseline, axis | `#c3c2b7` | `#383835` |
| De-emphasis gray | `#c3c2b7` | `#4a4a46` |
| Good-news text | `#006300` | `#0ca30c` |
| Hairline border | `rgba(11,11,11,.10)` | `rgba(255,255,255,.10)` |

Dark is its own selected steps, not an automatic inversion.

Font: Heebo (embedded by the builder, SIL OFL), falling back to the system sans. One sans everywhere, including big numbers; no serif or display face. Monospace only for code, paths and identifiers.

## Marks

| Mark | Spec |
|---|---|
| Bar | at most 24px thick (12px on a phone); rounded 4px at the value end, square at the baseline; the value written at the tip |
| Line | 2px with round joins and caps |
| Dot | at least 8px; a 2px ring in the surface color where it crosses other marks |
| Area | the series hue at about 10% opacity |
| Grid and axis | 1px solid hairlines, just off the surface color; not dashed |
| Touching fills | separated by 2px of surface color, not by an outline |

A label that does not fit inside its mark goes past the end of the bar, or into the legend and table. It is never cut off.

## Hand-drawn SVG

When drawing a diagram by hand (see `diagram-design/GUIDE.md`), map its roles to these tokens instead of its default paper and coral skin:

| diagram-design role | Use |
|---|---|
| `paper` | chart surface |
| `paper-2` | tile |
| `ink` | primary ink |
| `muted`, `soft` | secondary ink, muted |
| `rule`, `rule-solid` | gridline, baseline |
| `accent` (1 to 2 focal elements) | slot 1 blue |
| `link` | slot 7 violet |
| fonts (Instrument Serif, Geist, Geist Mono) | Heebo for all text, monospace only for technical sublabels |

Inside the page, write colors as CSS variables in a `<style>` element in the SVG, so the diagram follows light and dark: `.n{fill:var(--tile);stroke:var(--axis)} .t{fill:var(--ink)} .a{stroke:var(--s1)}`. Presentation attributes such as `fill="..."` cannot take `var()`. The variables available: `--page --surface --tile --ink --ink-2 --muted --grid --axis --s1` to `--s8`, `--good --warning --serious --critical`.

Right-to-left labels in SVG: set `direction="rtl"` on the `<svg>` (or on each `<text>`). An SVG placed inside a right-to-left page inherits rtl even without the attribute, so anchors written with left-to-right habits break silently: a label meant to end at a dot grows across it, and a corner label runs out of the viewBox and is clipped, leaving only its last letters. With rtl, `text-anchor="start"` puts `x` at the text's right edge (the start of a right-to-left line), and `end` at its left edge; `middle` centres. Mixing these up pushes the text out of its box; `render.mjs` lists every label that is cut off or overlaps (exit code 3). Put numbers and English in `<tspan direction="ltr" unicode-bidi="isolate">`.
