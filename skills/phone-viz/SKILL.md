---
name: phone-viz
description: Turn a status, plan, comparison or report into a phone-friendly visual (PNG images plus an HTML page) and send it as files in Telegram. Use when a picture would explain more than text in a chat, or when asked for a chart, diagram, board, timeline or visual summary.
metadata: { "openclaw": { "emoji": "📱", "requires": { "bins": ["node"] } } }
---

# Phone visualizations over Telegram

A chat reader holds a phone. They see an image in the chat first and may open a file. So every visual is built once as a narrow HTML page (360 to 480 px wide, light and dark, right-to-left when the language is) and rendered to PNG for the chat. The diagram is the message; text only supports it.

Scripts need Node 22 or newer and a Chrome, Chromium or Edge binary (found on `PATH`, in the usual install places, or set `VIZ_CHROME`). No npm packages.

## Workflow

1. **Decide whether to draw.** Draw when the reader would learn more from a picture than from a paragraph: a state of many items, an ordered chain, a comparison of amounts, events in time, a hierarchy. A single number, or a short list, is a sentence; send text.
2. **Pick the form from the job the information does.** Read `{baseDir}/references/choosing-a-form.md`. It maps each job to a block of the page builder, and to a diagram type when no block fits.
3. **Write the spec** as JSON (`{baseDir}/references/spec.md`) in the workspace, for example `./viz/<slug>/spec.json`. Short labels, the reader's language, English terms in backticks. Decisions the reader must take go first.
4. **Build and render.**
   ```sh
   node {baseDir}/scripts/build.mjs ./viz/<slug>/spec.json ./viz/<slug>/page.html
   node {baseDir}/scripts/render.mjs ./viz/<slug>/page.html --theme light
   ```
   `build.mjs` refuses specs that break the rules (too many nodes, unknown state, more than 8 series) and says why: fix the spec rather than working around it. `render.mjs` prints the PNG paths as JSON. A page taller than one phone image is split at block boundaries into several PNGs.
5. **Look at every PNG** with your image tool before sending. Check: nothing cut at the edges, labels fit their boxes, numbers read in the right order in right-to-left text, nothing overlaps. A `WARNING ... overflows` line from `render.mjs` is a fault to fix, and so is exit code 3 with a list of SVG labels cut off at the drawing's edge or lying over a dot or another label. `render.mjs` opens any HTML file, so run it on hand-written pages too.
6. **Send** to where the reader is:
   - **Telegram (OpenClaw):** per `{baseDir}/references/telegram-delivery.md`: the PNGs as photos (one album), then `page.html` as a file when the reader may want to zoom, read the table view or see dark mode. One short caption with the conclusion; do not repeat the picture in words.
   - **A Claude app chat or project (claude.ai, phone or desktop):** a shared `.html` file opens there as source code, not as a page. Publish `page.html` as an Artifact (it is self-contained: fonts and styles are inline) and give the reader the Artifact link; attach the PNGs as images. Never link the raw HTML file as the page. Republish the same file path to update the same link.

## Rules that always hold

- **One idea per image.** At most about 9 nodes, steps or bars; density around 4 out of 10. Past that, split into an overview and a detail.
- **State is a glyph plus a word plus a tint**, never color alone: ✓ done, ● in progress, … waiting, ! stuck, ○ not started.
- **Color does one job at a time**: identity (people, series) uses the categorical slots in fixed order; state uses the status colors; one highlighted item against gray is emphasis. Never color by rank, never a rainbow, never two y-axes. The palette and its reasons: `{baseDir}/references/color-and-marks.md`.
- **Text keeps text colors**; a colored swatch or stripe beside it carries identity.
- **Right-to-left pages** (`lang` he, ar, fa): numbers, dates, code and English stay left-to-right inside them. The builder isolates them; in hand-written SVG, isolate them yourself and look at the render. **Anchors flip in right-to-left SVG**: an SVG inside a right-to-left page inherits `direction: rtl` even with no attribute, and then `text-anchor="start"` puts `x` at the text's right edge and `end` at its left edge. Write `direction="rtl"` on the `<svg>` so the reading is explicit, choose each anchor by the side the text grows toward, and let `render.mjs` confirm nothing is cut or covered.
- **Light by default for the PNG**; render `--theme dark` when the reader asked for dark or their client is known to be dark. The HTML follows the phone's setting by itself.
- **Data from people or tools is text, not markup.** The builder escapes it. In hand-written SVG, escape `<`, `>` and `&` in labels.
- **Dots on a plane carry numbers, not names.** In a quadrant or scatter, a name beside each dot collides with its neighbours and the edge on a phone; the `quadrant` block puts a number in each dot and the names in a ranked list under it. Use the block rather than drawing the plane by hand.

## When no block fits

Draw the diagram by hand as SVG following the vendored diagram-design guide (`{baseDir}/references/diagram-design/GUIDE.md`, MIT licence): pick the type there, read its `references/type-*.md`, keep its connector rules and complexity budget, but use this skill's colors and font (`{baseDir}/references/color-and-marks.md`, "Hand-drawn SVG") and a portrait viewBox no wider than 400. Save it as a file and put it in the page with an `svg` block, so it gets the same frame, legend and rendering. `{baseDir}/examples/` has a worked example of each.

## Changing the palette

The colors live in `{baseDir}/templates/page.css`. When you change the categorical slots, keep neighbouring slots distinguishable for color-blind readers (check them with a color-blindness simulator), keep text contrast at WCAG AA, and look at the PNGs in both themes.
