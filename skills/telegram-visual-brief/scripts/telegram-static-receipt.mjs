#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyManifest } from "./telegram-static-export.mjs";

const __filename = fileURLToPath(import.meta.url);

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`, 2);
    const key = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`missing value for --${key}`, 2);
    args[key] = value;
    index += 1;
  }
  return args;
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(tempPath, filePath);
}

function artifactHash(manifest) {
  const hash = crypto.createHash("sha256");
  for (const page of manifest.pages) hash.update(`${page.index}:${page.sha256}\n`);
  return hash.digest("hex");
}

export function recordReceipt(args) {
  if (!args.manifest) fail("--manifest is required", 2);
  if (!args["message-id"]) fail("--message-id is required", 2);
  if (!/^[A-Za-z0-9:_-]+$/.test(args["message-id"])) fail("message ID has an invalid shape", 2);
  if (!args.target) fail("--target is required", 2);
  const { manifest, manifestPath, baseDir } = verifyManifest(args.manifest, true);
  if (manifest.pages.length !== 1) fail("PNG delivery requires exactly one page; use the PDF receipt command for multiple pages");
  const receiptPath = path.join(baseDir, "delivery-receipt.json");
  if (fs.existsSync(receiptPath)) fail(`delivery receipt already exists: ${receiptPath}`, 40);
  const receipt = {
    schemaVersion: 1,
    status: "send_result_recorded",
    deliveredAt: new Date().toISOString(),
    channel: "telegram",
    target: args.target,
    messageId: args["message-id"],
    manifest: path.basename(manifestPath),
    artifact: {
      sha256: manifest.pages[0].sha256,
      format: "png",
      pages: manifest.pages.length,
      files: manifest.pages.map((entry) => entry.file),
    },
  };
  writeJsonAtomic(receiptPath, receipt);
  process.stdout.write(
    `${JSON.stringify({
      status: receipt.status,
      messageId: receipt.messageId,
      receipt: receiptPath,
      pages: manifest.pages.length,
    })}\n`,
  );
}

if (path.resolve(process.argv[1] ?? "") === __filename) {
  try {
    recordReceipt(parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`TELEGRAM_STATIC_RECEIPT_FAILED: ${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  }
}
