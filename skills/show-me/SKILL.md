---
name: show-me
description: Visual-first answers. Use when a message starts or ends with "תראי לי" or "תראי" ("show me"), when the reader says "אני בטלפון" ("I'm on my phone"), when asked for a chart, diagram, board, timeline, dashboard or visual summary, and whenever presenting a plan, design document, status, report or review findings (for example a review of pull requests). Builds a responsive HTML page (phone and computer, light and dark, right-to-left Hebrew with the Heebo font) from a JSON spec using diagram-design forms and fixed color rules, publishes it as an Artifact where that tool exists, and renders PNG images for phone reading.
---

# Show me: visual-first answers

The reader wants to see the answer, not read it. The picture is the message; text only supports it. Every visual is one self-contained HTML page built from a JSON spec: phone-first, widening into two columns on a computer, with light and dark tokens that follow the device, right-to-left when the language is, fonts inline so it works offline.

`<skill>` below means the folder that holds this `SKILL.md` (Claude Code shows it as the base directory; in Codex it is the path the skill list gives). The scripts need Node 22 or newer and Chrome, Chromium or Edge for PNGs (found in the usual places, or set `VIZ_CHROME`). No npm packages.

## Triggers and what each asks for

| The reader writes | Deliver |
|---|---|
| "תראי לי" / "תראי" at the start or end of a message | the answer as a page: published Artifact link, a one-line conclusion in chat |
| "אני בטלפון" | the page, plus PNG images of it (phone width, light) attached in chat |
| a plan, design document, status or report is due | the page first, the Markdown or text next to it and linked to it |
| a single number or a short list | a sentence. Not every answer is a picture. |

When writing Hebrew in chat or in files, wrap every English word, name, term or path in inline code so the mixed direction stays readable. In a spec, the same goes in backticks. Do not put PR numbers or commit hashes in anything for a non-developer reader; describe changes in words.

## Workflow

1. **Decide whether to draw.** Draw when the reader would learn more from a picture than from a paragraph: the state of many items, an ordered chain, a comparison of amounts, events in time, a hierarchy, a choice between options. Decisions the reader must take go first.
2. **Pick the form from the job the information does.** Read `<skill>/references/choosing-a-form.md`: it maps each job to a block (hierarchy as a map, state as a board, flow as a pipeline, time as a timeline, balance as paired bars, priorities as a quadrant) and to a diagram type when no block fits.
3. **Write the spec** (`<skill>/references/spec.md`) at `./viz/<slug>/spec.json` in the working directory, or in the scratchpad or project files folder when the session names one. Short labels in the reader's language. Mark two neighboring blocks `half: true` to set them side by side on a computer.
4. **Build.**
   ```sh
   node <skill>/scripts/build.mjs ./viz/<slug>/spec.json ./viz/<slug>/page.html
   ```
   `build.mjs` refuses specs that break the rules (too many nodes, unknown state, more than 8 series) and says why: fix the spec rather than working around it.
5. **Look at it at both sizes before delivering.**
   ```sh
   node <skill>/scripts/render.mjs ./viz/<slug>/page.html --theme light                      # phone, split into PNGs
   node <skill>/scripts/render.mjs ./viz/<slug>/page.html --theme dark --width 1280 --single --out ./viz/<slug>/desktop-dark
   ```
   Read every PNG with the image tool. Check: nothing cut or overlapping, labels fit, numbers and English read in the right order inside Hebrew, the dark version has enough contrast. A `WARNING ... overflows` line is a fault to fix, and so is exit code 3 with a list of SVG labels cut off at the drawing's edge or lying over a dot or another label. Run `render.mjs` on every page that holds an SVG before delivering it, hand-written pages included: it opens any HTML file.
6. **Deliver where the reader is.**
   - **The Artifact tool exists** (claude.ai, Claude Code on the web, Claude app projects): publish `page.html` as an Artifact, following that tool's own rules (it may ask to load a design skill first; the page already meets the usual contract: a title, light and dark tokens, no external scripts). Give the link plus a one-line conclusion. A raw `.html` file shared in a Claude app opens as source code, so never send the file as the page. Republish the same file path to update the same link.
   - **No Artifact tool** (a local terminal): give the full path of `page.html` and open it in the browser (`start "" page.html` on Windows, `open` on macOS, `xdg-open` on Linux).
   - **Phone mode** ("אני בטלפון"): also give the phone PNGs from step 5. In a Claude app thread attach them as files; locally, give their paths.
   - **A document was asked for:** save the `.md` next to `page.html`, link the page from the Markdown, and present the page first.

## Rules that always hold

- **One idea per picture.** At most about 9 nodes, steps or bars; density around 4 out of 10. Past that, split into an overview and a detail.
- **State is a glyph plus a word plus a tint**, never color alone: ✓ done, ● in progress, … waiting, ! stuck, ○ not started.
- **Color does one job at a time**: identity (people, series) uses the categorical slots in fixed order; state uses the status colors; one highlighted item against gray is emphasis. Never color by rank, never a rainbow, never two y-axes. Palette and reasons: `<skill>/references/color-and-marks.md`.
- **Text keeps text colors**; a colored swatch or stripe beside it carries identity.
- **Right-to-left pages** (`lang` he, ar, fa): numbers, dates, code and English stay left-to-right inside them. The builder isolates them; in hand-written SVG or HTML, isolate them yourself (`<bdi>`, `dir="ltr"`) and look at the render. **Anchors flip in right-to-left SVG**: an SVG inside a right-to-left page inherits `direction: rtl` even with no attribute, and then `text-anchor="start"` puts `x` at the text's right edge and `end` at its left edge. Write `direction="rtl"` on the `<svg>` so the reading is explicit, choose each anchor by the side the text grows toward, and let `render.mjs` confirm nothing is cut or covered.
- **Data from people or tools is text, not markup.** The builder escapes it. In hand-written SVG, escape `<`, `>` and `&` in labels.
- **Dots on a plane carry numbers, not names.** In a quadrant or scatter, a name beside each dot collides with its neighbours and the edge on a phone; the `quadrant` block puts a number in each dot and the names in a ranked list under it. Use the block rather than drawing the plane by hand.
- **Light by default for PNGs**; render dark when asked. The HTML follows the device by itself.

## When no block fits

Draw the diagram by hand as SVG following the vendored diagram-design guide (`<skill>/references/diagram-design/GUIDE.md`, MIT licence): pick the type there, keep its connector rules and complexity budget, but use this skill's colors and font (`<skill>/references/color-and-marks.md`, "Hand-drawn SVG") and a portrait viewBox no wider than 400 so it reads on a phone. Save it as a file and put it in the page with an `svg` block, so it gets the same frame, legend and themes. `<skill>/examples/` has worked examples.

If the request is for something interactive (filters, tabs, a tool the reader types into), the spec builder is the wrong tool: hand-write the page, reuse the tokens in `<skill>/templates/page.css` (and the `@font-face` rules from the head of any page `build.mjs` made) and the rules above, and still check it at 390 and 1280 px in both themes with `render.mjs` (add `--single`), fixing every label it reports.

## Changing the palette

The colors live in `<skill>/templates/page.css`. When you change the categorical slots, keep neighbouring slots distinguishable for color-blind readers (check them with a color-blindness simulator), keep text contrast at WCAG AA, and look at the PNGs in both themes.
