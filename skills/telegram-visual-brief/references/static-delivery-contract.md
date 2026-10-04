# Static delivery commands and evidence

Resolve the installed skill directory from the active workspace. The examples
use Bash variables; on Windows use equivalent PowerShell variables and
`runtime/.venv/Scripts/python.exe` for `pdf_python`.

```bash
skill_dir="/absolute/path/to/workspace/skills/telegram-visual-brief"
pdf_python="$skill_dir/runtime/.venv/bin/python"
output="/absolute/path/to/workspace/.tmp/visual-briefs/report-unique"
```

Every output directory must be fresh and its parent must already exist. Use a
new run directory after a failed export. Install the rendering runtime as
described in the repository INSTALL.md before using these commands.

## Export and inspect PNG pages

The HTML must embed its fonts/images/scripts/styles; external requests and
additional local-file requests are blocked. Each intentional page is one sibling
`<section data-telegram-page>` at 390 x 844 CSS pixels. Mark controls for removal
with `data-static-hide`; the exporter also hides `.zoom-controls` and rejects
remaining visible buttons/inputs. It checks overflow and encoded 780 x 1688 PNGs.

```bash
node "$skill_dir/scripts/telegram-static-export.mjs" export --input /absolute/path/report.html --out "$output" --title "Report title"
```

Open every `page-NN.png` with the available image-viewing tool at original detail.
After actual inspection, write `inspection-evidence.json` with one entry per
page. Use the manifest's exact filenames, indices, and SHA-256 hashes. The method
string below is a portable schema label, not the name of a required tool.

```json
{
  "schemaVersion": 1,
  "method": "openclaw_image_tool_original",
  "pages": [{
    "index": 1,
    "file": "page-01.png",
    "sha256": "COPY_CURRENT_PAGE_HASH",
    "checks": {
      "clipping": "pass",
      "textBoundaries": "pass",
      "pageOrder": "pass",
      "visualBalance": "pass",
      "controlsRemoved": "pass"
    },
    "note": "Write a specific observation about this rendered page."
  }]
}
```

Fix any failed check and export again. Once every page passes:

```bash
node "$skill_dir/scripts/telegram-static-export.mjs" approve --manifest "$output/artifact-manifest.json" --inspection-evidence "$output/inspection-evidence.json"
node "$skill_dir/scripts/telegram-static-export.mjs" verify --manifest "$output/artifact-manifest.json"
```

## Package and inspect PDF

For multiple pages or an explicit PDF request, including a single-page PDF:

```bash
"$pdf_python" "$skill_dir/scripts/telegram-static-pdf.py" pack --manifest "$output/artifact-manifest.json" --out "$output/pdf" --filename report.pdf
```

The packer renders proof PNGs, checks page geometry, and compares pixels to the
approved source PNGs. Open every `pdf/pdf-proof/page-NN.png`. Write
`pdf/pdf-inspection-evidence.json` using the same schema above plus the top-level
`pdfSha256` from `pdf-artifact.json`. Use each **proof** entry's filename and hash,
not the source PNG filename/hash. Then:

```bash
"$pdf_python" "$skill_dir/scripts/telegram-static-pdf.py" approve --artifact "$output/pdf/pdf-artifact.json" --inspection-evidence "$output/pdf/pdf-inspection-evidence.json"
"$pdf_python" "$skill_dir/scripts/telegram-static-pdf.py" verify --artifact "$output/pdf/pdf-artifact.json"
```

## Send and record the real result

Use the installed OpenClaw message tool's actual schema to send exactly the
verified attachment returned by verification, with a short takeaway identifying
it as static. Resolve the authorized chat/thread from context. Never send HTML
as the Telegram visual, and never send the individual PNG pages alongside a PDF.

Only after a successful send, record the returned real message ID and destination:

```bash
# For one PNG:
node "$skill_dir/scripts/telegram-static-receipt.mjs" --manifest "$output/artifact-manifest.json" --target "ACTUAL_DESTINATION" --message-id "ACTUAL_MESSAGE_ID"

# For a PDF (instead of the PNG receipt command):
"$pdf_python" "$skill_dir/scripts/telegram-static-pdf.py" receipt --artifact "$output/pdf/pdf-artifact.json" --target "ACTUAL_DESTINATION" --message-id "ACTUAL_MESSAGE_ID"
```

Receipts use `status: send_result_recorded` because these offline scripts record
the IDs you supply; they do not contact Telegram or independently confirm a send.
Delivery requires both the actual successful message-tool result and a matching
receipt with the attachment filename/hash. Keep these records local.

## Runtime troubleshooting

The exporter first uses the router's private Playwright installation and its
downloaded browser. Existing workspace Playwright installs are fallback candidates.
Optional environment overrides: `OPENCLAW_TELEGRAM_EXPORT_PLAYWRIGHT_CORE`
(absolute module entrypoint), `OPENCLAW_TELEGRAM_EXPORT_CHROMIUM` (executable),
and `OPENCLAW_TELEGRAM_EXPORT_LIBRARY_PATH` (Linux runtime libraries).

If the agent cannot execute commands, inspect images, or use the message tool,
report that missing capability precisely. Do not loosen host permissions or
claim successful delivery to complete the workflow.
