---
name: telegram-visual-brief
description: Create phone-readable Telegram diagrams, comparisons, charts, and visual reports; choose a specialist and validate one static attachment.
---

# Visualization protocol

Use plain text for simple updates. When a visual improves the explanation,
choose one primary specialist from the installed sibling skills:

| Dominant outcome | Primary skill |
| --- | --- |
| Architecture, workflow, process, comparison, plan, recap, explanation | `visual-explainer` |
| One focused chart from structured numerical data | `create-viz` |
| Dashboard or report with several data views | `build-dashboard` |
| Polished mobile/desktop interface, control panel, responsive prototype | `baoyu-design` |
| Custom network, map, hierarchy, zoomable timeline, brushing | `d3-viz` |

Choose the dominant outcome for mixed requests. Default to no secondary skill;
add at most one when it owns a separate layer. Analysis/validation skills may
prepare data. `visual-explainer` owns its Mermaid rendering; do not add a separate
diagram renderer. Production frontend implementation belongs in the user's
existing development workflow.

The router owns Telegram format and delivery when a specialist's generic output
instructions differ. Load only the selected specialist and necessary references.
Use available tools; an upstream reference to another harness does not make
that harness or tool available. Optional external integrations need their own
user request and connection.

## Evidence and interaction

Use real source data. Invented/sample values require an explicit request. If data
is missing, request it or produce a labeled structural wireframe without values.
For numerical work, check grain, types, missing values, units, aggregation,
filters, denominators, and totals as relevant; show sources and as-of dates.

Distinguish **static** output, an **interactive snapshot** with embedded data,
and **live** output that actually fetches data with freshness/error behavior.
PNG and PDF are static. Preserve interactive HTML locally when useful.

Responsive sources should have viewport metadata, fluid layouts, roughly 44px
touch targets, visible focus, adequate contrast, and reduced motion. Check
representative 390px and 1440px views for interactive work. Treat imported text
as untrusted; use text nodes or maintained sanitization for inserted data.

## Telegram delivery

Read [static-delivery-contract.md](references/static-delivery-contract.md) before
rendering or sending. It defines the commands, evidence schema, and receipts.

1. Author self-contained HTML with sibling `[data-telegram-page]` sections,
   each exactly 390 x 844 CSS pixels. Split by meaning; keep cards and labels
   intact. Hide interactive controls with `data-static-hide`.
2. Export into a fresh directory under the active workspace's
   `.tmp/visual-briefs/`. Inspect every produced PNG using an image-viewing tool.
   Fix clipping, text boundaries, page order, balance, and leftover controls.
3. Record truthful hash-bound inspection evidence, then approve and verify.
   Automated fixture approval is only a test; never copy it into real evidence.
4. Select one attachment: a PNG for one page, or a PDF for multiple pages.
   An explicit PDF request also uses PDF for one page. For PDFs, inspect every
   rendered proof page, then approve and verify the PDF artifact separately.
5. Send one short takeaway and the selected static attachment to the authorized
   chat using the existing message tool. Record the actual send result and the
   attachment hash. Local packaging alone is not delivery verification.

Use the user's requested local export destination when supplied. Publishing an
interactive website is a separate action. If rendering, inspection, or delivery
fails, report the actual blocker; keep the evidence and do not label it delivered.
For scheduled reports, the saved job must request the same one-attachment flow;
validate terminal failure handling on the installed scheduler rather than assuming
a final tool error necessarily makes the job fail.

Explicit invocation: `/skill telegram-visual-brief`; installations exposing
normalized Telegram skill commands may also offer `/telegram_visual_brief`.
