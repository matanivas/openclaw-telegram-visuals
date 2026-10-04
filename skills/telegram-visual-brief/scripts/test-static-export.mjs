#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveArtifact,
  exportArtifact,
  verifyArtifact,
} from "./telegram-static-export.mjs";
import { recordReceipt } from "./telegram-static-receipt.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const good = path.join(root, "..", "assets", "canary-success.html");
const bad = path.join(root, "..", "assets", "canary-forced-failure.html");
const localGood = path.join(root, "canary-success.html");
const localBad = path.join(root, "canary-forced-failure.html");
const goodFixture = fs.existsSync(good) ? good : localGood;
const badFixture = fs.existsSync(bad) ? bad : localBad;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "telegram-static-export-test-"));

async function expectFailure(action, expectedText, expectedCode) {
  let caught;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  if (!caught) throw new Error(`expected failure containing: ${expectedText}`);
  if (!caught.message.includes(expectedText)) {
    throw new Error(`unexpected failure: ${caught.message}`);
  }
  if (expectedCode !== undefined && caught.exitCode !== expectedCode) {
    throw new Error(`unexpected exit code ${caught.exitCode}; expected ${expectedCode}`);
  }
}

try {
  const goodOut = path.join(temp, "good");
  await exportArtifact({
    input: goodFixture,
    out: goodOut,
    title: "Positive canary",
  });
  const manifestPath = path.join(goodOut, "artifact-manifest.json");
  const pending = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (pending.status !== "awaiting_visual_inspection" || pending.pages.length !== 2) {
    throw new Error("positive export did not produce the expected pending manifest");
  }
  await expectFailure(
    () => Promise.resolve(approveArtifact({ manifest: manifestPath })),
    "--inspection-evidence is required",
    2,
  );
  const evidencePath = path.join(goodOut, "inspection-evidence.json");
  fs.writeFileSync(
    evidencePath,
    `${JSON.stringify({
      schemaVersion: 1,
      method: "openclaw_image_tool_original",
      pages: pending.pages.map((page) => ({
        index: page.index,
        file: page.file,
        sha256: page.sha256,
        checks: {
          clipping: "pass",
          textBoundaries: "pass",
          pageOrder: "pass",
          visualBalance: "pass",
          controlsRemoved: "pass",
        },
        note: `SYNTHETIC TEST ONLY: page ${page.index}; not actual visual inspection or delivery evidence.`,
      })),
    }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  approveArtifact({ manifest: manifestPath, "inspection-evidence": evidencePath });
  verifyArtifact({ manifest: manifestPath });
  await expectFailure(
    () => Promise.resolve(recordReceipt({ manifest: manifestPath, target: "telegram:synthetic-test", "message-id": "test-only" })),
    "PNG delivery requires exactly one page",
  );

  const badOut = path.join(temp, "bad");
  await expectFailure(
    () => exportArtifact({ input: badFixture, out: badOut }),
    "overflows",
    35,
  );
  if (fs.existsSync(path.join(badOut, "artifact-manifest.json"))) {
    throw new Error("overflow fixture left a delivery manifest");
  }

  const injectedOut = path.join(temp, "injected");
  await expectFailure(
    () => exportArtifact({ input: goodFixture, out: injectedOut, forceFailure: true }),
    "forced exporter failure",
    70,
  );

  process.stdout.write(
    "telegram-static-export tests passed: positive, multi-page PNG receipt rejection, missing-evidence failure, overflow failure, injected failure\n",
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
