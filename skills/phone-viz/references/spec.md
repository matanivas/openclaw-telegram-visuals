# The spec (input of build.mjs)

One JSON object. Text fields accept `` `code` `` (English terms, paths, names: kept left-to-right and set in mono) and `**bold**`; everything else is escaped. A full example: `examples/weekly-status.he.json`.

```json5
{
  "lang": "he",                 // he, ar, fa → right-to-left page; anything else left-to-right
  "title": "…",                 // required, one line
  "eyebrow": "…",               // optional, small line above the title (context: business, period)
  "subtitle": "…",              // optional, the conclusion in one sentence
  "people": ["Dana", "Yossi"],  // optional: identities, colored by categorical slot in this order (max 8)
  "asOf": "08.11.2026 12:00",   // optional footer: when the data was true
  "source": "…",                // optional footer: where it came from
  "theme": "light",             // optional: pin the HTML to light or dark; omit to follow the phone
  "blocks": [ … ]               // required, drawn in order
}
```

Every block takes optional `title` (a heading) and `caption` (one supporting line under it). `half: true` lets two consecutive blocks sit side by side on a computer screen (1024 px and wider); on a phone every block is full width. Mark both blocks of a pair, and use it for blocks of similar height (two `bars`, a `pipeline` next to a `timeline`). `who` anywhere means a name from `people` (or its index); it draws a colored stripe and the page shows the legend.

States: `done`, `active`, `waiting`, `stuck`, `todo`. Each renders as glyph + word + tint.

## Blocks

**decisions** (max 3)
`{ "type": "decisions", "items": [{ "q": "question", "why": "…", "unlocks": "what answering opens", "recommend": "…", "hot": true }] }`
`hot` marks the most urgent card. Put this block first.

**stats** (max 4)
`{ "type": "stats", "items": [{ "label": "…", "value": 7, "unit": "₪", "delta": "+2 since yesterday", "good": false }] }`
`value` may be a string ("5 of 6"). `good` colors the delta: true = good news, false = bad news, absent = neutral. A leading signed figure in `delta` is kept left-to-right.

**bars** (max 12)
One series: `{ "type": "bars", "unit": "₪", "items": [{ "label": "…", "value": 6200, "note": "…" }], "highlight": "label to emphasise", "sort": true }`
Paired: `{ "type": "bars", "series": ["Effort", "Need"], "items": [{ "label": "…", "values": [3, 5] }] }` (2 or 3 series, kept in the given order).
Values are zero or more. Sorted largest first unless `sort: false` or paired.

**pipeline** (max 9 steps)
`{ "type": "pipeline", "steps": [{ "label": "…", "sub": "…", "state": "done", "who": "Dana" }] }`

**board** (max 5 columns)
`{ "type": "board", "maxPerColumn": 6, "columns": [{ "name": "…", "state": "stuck", "cards": [{ "title": "…", "sub": "…", "who": "Yossi" }] }] }`
Cards past `maxPerColumn` collapse into "+N more".

**timeline** (max 12 events)
`{ "type": "timeline", "events": [{ "when": "Tue 04.11", "label": "…", "sub": "…", "state": "stuck", "who": "Dana", "now": false }] }`
The dot takes the person's color when `who` is set, else the state's.

**map** (max 6 groups, 24 items)
`{ "type": "map", "groups": [{ "name": "…", "sub": "…", "focus": false, "items": [{ "label": "…", "state": "active", "who": "Dana", "weight": 2 }] }], "key": true }`
A state key is added when two or more states appear (`key: false` to omit).

**text**
`{ "type": "text", "body": ["paragraph", "paragraph"], "fold": true, "summary": "why the price rose" }`
`fold` puts the paragraphs behind the summary line in the HTML; the PNG shows them open.

**svg**
`{ "type": "svg", "file": "diagram.svg" }` (path relative to the spec file)
A hand-drawn diagram (see `color-and-marks.md`, "Hand-drawn SVG"). The file must start with `<svg`; scripts and event handlers are refused.
