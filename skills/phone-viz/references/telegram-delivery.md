# Sending the visual in Telegram

Checked against OpenClaw 2026.10.9 (`message` tool schema, Telegram outbound media, rich output protocol). If the `message` tool in your turn has a different schema, follow the schema.

## What to send

1. **The PNG pages as photos.** Telegram shows photos inline in the chat; that is what the reader sees first. Several pages go in one call so they form one album (Telegram groups up to 10).
2. **The HTML page as a file**, when it adds something: the reader can zoom, open the table view, and see dark mode follow their phone. Skip it for a one-image status.
3. **Never an SVG file.** Telegram shows no preview for SVG; it is only an intermediate.

## Why photos are cut at 1280 CSS px

Telegram re-encodes a photo so its long side is at most 2560 px (and width plus height at most 10000, ratio at most 20). `render.mjs` renders at scale 2, so it keeps each image within 1280 CSS px of height and cuts between blocks. A cut through one tall block happens only when that block alone is taller than an image; then shorten the block.

If one tall image is wanted (for example to save or forward a single file), render with `--single` and send it with `forceDocument: true`, which skips Telegram's compression. It arrives as a file with a small thumbnail, not inline.

## The call

Write all files inside the agent workspace (for example `./viz/<slug>/`): local media must be inside the allowed media roots, and the workspace is.

Photos, one album, caption on the first image:

```json5
{
  action: "send",
  message: "ההזמנה מהספק מחכה לאישור שלך; כל השאר בזמן.",
  attachments: [
    { type: "image", media: "./viz/weekly/page-light-1.png" },
    { type: "image", media: "./viz/weekly/page-light-2.png" },
  ],
}
```

The HTML page, as its own send:

```json5
{
  action: "send",
  media: "./viz/weekly/page.html",
  filename: "weekly-status.html",
  caption: "Open for zoom, table view and dark mode",
}
```

Leave out `channel` and `to` to answer in the current conversation, when the tool allows it; otherwise give `channel: "telegram"` and the chat id. A self-contained HTML file starting with `<!doctype html>` passes OpenClaw's HTML check for an explicit send; the builder produces exactly that.

### Fallback without the message tool

In a final reply in automatic mode, a standalone line `MEDIA:./viz/weekly/page-light-1.png` attaches a PNG. The line must stand alone: not inside code, bold or a sentence. Do not use `MEDIA:` for the HTML page; automatic replies restrict HTML attachments. Send the HTML with the `message` tool.

## Caption

- One sentence with the conclusion or the question, in the reader's language. The picture carries the rest.
- Captions over 1024 characters are moved after the album as a separate message; keep it short.
- Do not list the picture's contents in the caption.

## Theme

The PNG is one theme. Light is the default because it reads on both light and dark chat backgrounds. Use `--theme dark` when the reader asked for it or is known to use a dark client. The HTML page follows the phone's setting on its own.

## Before sending, look

Open each PNG with your image tool. Fix and re-render when: text is cut at an edge, labels collide, a number reads reversed in right-to-left text, the render printed an overflow warning, or the page has more than 10 images.
