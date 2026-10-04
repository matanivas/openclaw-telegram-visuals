#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_VERSION = "1.0.0";
const PAGE_WIDTH = 390;
const PAGE_HEIGHT = 844;
const DEVICE_SCALE_FACTOR = 2;
const PAGE_SELECTOR = "[data-telegram-page]";
const STATIC_HIDE_CSS = `
  [data-static-hide], .zoom-controls { display: none !important; }
  @media print {
    [data-static-hide], .zoom-controls { display: none !important; }
  }
`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findWorkspaceRoot(startPath) {
  let candidate = path.resolve(startPath);
  for (let depth = 0; depth < 8; depth += 1) {
    if (
      fs.existsSync(path.join(candidate, "AGENTS.md")) &&
      fs.existsSync(path.join(candidate, "skills"))
    ) {
      return candidate;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  fail(`could not resolve OpenClaw workspace root from ${startPath}`);
}

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command === "--help" || command === "-h") {
    return { command: undefined, help: true };
  }
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`, 2);
    const key = token.slice(2);
    if (key === "force-failure") {
      args.forceFailure = true;
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) {
      fail(`missing value for --${key}`, 2);
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function printUsage(stream = process.stderr) {
  stream.write(
    [
      "Usage:",
      "  telegram-static-export.mjs export --input <html> --out <directory> [--title <text>] [--force-failure]",
      "  telegram-static-export.mjs approve --manifest <artifact-manifest.json> --inspection-evidence <inspection-evidence.json>",
      "  telegram-static-export.mjs verify --manifest <artifact-manifest.json>",
      "",
    ].join("\n"),
  );
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(tempPath, filePath);
}

function parsePngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (
    buffer.length < 24 ||
    buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    fail(`invalid PNG: ${filePath}`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function ensureNewOutputDirectory(outputDir) {
  if (!path.isAbsolute(outputDir)) fail("--out must resolve to an absolute path");
  if (fs.existsSync(outputDir)) {
    const stat = fs.statSync(outputDir);
    if (!stat.isDirectory()) fail(`output path is not a directory: ${outputDir}`);
    if (fs.readdirSync(outputDir).length > 0) {
      fail(`refusing non-empty output directory: ${outputDir}`);
    }
    fs.rmdirSync(outputDir);
  }
}

function listPlaywrightCandidates(workspaceRoot) {
  const candidates = [];
  if (process.env.OPENCLAW_TELEGRAM_EXPORT_PLAYWRIGHT_CORE) {
    candidates.push(process.env.OPENCLAW_TELEGRAM_EXPORT_PLAYWRIGHT_CORE);
  }
  candidates.push(
    path.join(__dirname, "..", "runtime", "node_modules", "playwright", "index.mjs"),
    path.join(workspaceRoot, "node_modules", "playwright-core", "index.js"),
    path.join(workspaceRoot, "node_modules", "playwright", "index.js"),
  );
  const pluginsRoot = path.join(workspaceRoot, "tools", "openclaw-plugins");
  if (fs.existsSync(pluginsRoot)) {
    for (const name of fs.readdirSync(pluginsRoot).sort()) {
      candidates.push(
        path.join(
          pluginsRoot,
          name,
          "node_modules",
          "openclaw",
          "node_modules",
          "playwright-core",
          "index.js",
        ),
      );
    }
  }
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))].filter(
    (candidate) => fs.existsSync(candidate),
  );
}

async function loadPlaywright(workspaceRoot) {
  const privateBrowsers = path.join(__dirname, "..", "runtime", ".browsers");
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(privateBrowsers)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = privateBrowsers;
  }
  const failures = [];
  for (const candidate of listPlaywrightCandidates(workspaceRoot)) {
    try {
      const imported = await import(pathToFileURL(candidate).href);
      const playwright = imported.chromium ? imported : imported.default;
      if (playwright?.chromium?.launch) {
        return { playwright, modulePath: candidate };
      }
      failures.push(`${candidate}: chromium launcher missing`);
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }
  fail(
    `playwright-core unavailable; checked maintained runtime paths${
      failures.length ? ` (${failures.join("; ")})` : ""
    }`,
    20,
  );
}

function browserVersionFromPath(candidate) {
  const match = candidate.match(/-(\d+)\//);
  return match ? Number(match[1]) : 0;
}

function walkExecutableCandidates(root, depth = 0) {
  if (!fs.existsSync(root) || depth > 4) return [];
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...walkExecutableCandidates(fullPath, depth + 1));
    } else if (
      entry.isFile() &&
      ["chrome", "chrome-headless-shell", "headless_shell"].includes(entry.name)
    ) {
      found.push(fullPath);
    }
  }
  return found;
}

function listBrowserCandidates() {
  const candidates = [];
  if (process.env.OPENCLAW_TELEGRAM_EXPORT_CHROMIUM) {
    candidates.push(process.env.OPENCLAW_TELEGRAM_EXPORT_CHROMIUM);
  }
  candidates.push(...walkExecutableCandidates(path.join(os.homedir(), ".cache", "ms-playwright")));
  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))]
    .filter((candidate) => fs.existsSync(candidate))
    .sort((left, right) => {
      const versionDelta = browserVersionFromPath(right) - browserVersionFromPath(left);
      if (versionDelta !== 0) return versionDelta;
      const leftHeadless = left.includes("headless");
      const rightHeadless = right.includes("headless");
      return Number(rightHeadless) - Number(leftHeadless);
    });
}

function browserEnvironment(workspaceRoot) {
  const libraryCandidates = [
    process.env.OPENCLAW_TELEGRAM_EXPORT_LIBRARY_PATH,
    path.join(workspaceRoot, "tmp", "playwright-libs", "root", "usr", "lib", "x86_64-linux-gnu"),
  ].filter((candidate) => candidate && fs.existsSync(candidate));
  const current = process.env.LD_LIBRARY_PATH;
  const value = [...libraryCandidates, current].filter(Boolean).join(path.delimiter);
  return value ? { ...process.env, LD_LIBRARY_PATH: value } : { ...process.env };
}

async function launchBrowser(playwright, workspaceRoot) {
  const failures = [];
  for (const executablePath of [...new Set([playwright.chromium.executablePath(), ...listBrowserCandidates()])]) {
    try {
      const browser = await playwright.chromium.launch({
        executablePath,
        headless: true,
        args: ["--disable-dev-shm-usage"],
        env: browserEnvironment(workspaceRoot),
      });
      return { browser, executablePath };
    } catch (error) {
      failures.push(`${executablePath}: ${error.message.slice(0, 2500)}`);
    }
  }
  fail(
    `no compatible cached Chromium could launch${
      failures.length ? ` (${failures.join("; ")})` : ""
    }`,
    21,
  );
}

function validateManifestShape(manifest, manifestPath, requireApproval) {
  if (manifest.schemaVersion !== 1) fail(`unsupported manifest schema: ${manifest.schemaVersion}`);
  if (manifest.staticOnly !== true || manifest.htmlDeliveryAllowed !== false) {
    fail("manifest does not enforce static-only Telegram delivery");
  }
  if (!Array.isArray(manifest.pages) || manifest.pages.length < 1) {
    fail("manifest has no pages");
  }
  if (requireApproval && manifest.status !== "ready") {
    fail(`artifact is not delivery-ready; status=${manifest.status}`);
  }
  const baseDir = path.dirname(manifestPath);
  for (const page of manifest.pages) {
    const pagePath = path.resolve(baseDir, page.file);
    if (!pagePath.startsWith(`${baseDir}${path.sep}`)) fail(`page escapes artifact directory: ${page.file}`);
    if (!fs.existsSync(pagePath)) fail(`missing page: ${page.file}`);
    const dimensions = parsePngDimensions(pagePath);
    if (
      dimensions.width !== PAGE_WIDTH * DEVICE_SCALE_FACTOR ||
      dimensions.height !== PAGE_HEIGHT * DEVICE_SCALE_FACTOR
    ) {
      fail(`encoded page dimensions are invalid: ${page.file} is ${dimensions.width}x${dimensions.height}`);
    }
    if (sha256File(pagePath) !== page.sha256) fail(`page hash mismatch: ${page.file}`);
  }
  if (requireApproval) {
    const inspected = manifest.inspection?.pages ?? [];
    if (inspected.length !== manifest.pages.length) fail("not every page was marked inspected");
    for (const page of manifest.pages) {
      const proof = inspected.find((entry) => entry.index === page.index);
      if (!proof || proof.sha256 !== page.sha256 || proof.file !== page.file) {
        fail(`inspection proof missing or stale for page ${page.index}`);
      }
      for (const check of ["clipping", "textBoundaries", "pageOrder", "visualBalance", "controlsRemoved"]) {
        if (proof.checks?.[check] !== "pass") fail(`inspection check ${check} failed for page ${page.index}`);
      }
      if (typeof proof.note !== "string" || proof.note.trim().length < 12) fail(`inspection note missing for page ${page.index}`);
    }
  }
  return { baseDir };
}

export function verifyManifest(manifestPath, requireApproval = true) {
  const absoluteManifest = path.resolve(manifestPath);
  const manifest = readJson(absoluteManifest);
  const paths = validateManifestShape(manifest, absoluteManifest, requireApproval);
  return { manifest, manifestPath: absoluteManifest, ...paths };
}

export async function exportArtifact(args) {
  const inputPath = path.resolve(args.input ?? "");
  const outputDir = path.resolve(args.out ?? "");
  if (!args.input || !fs.existsSync(inputPath) || !fs.statSync(inputPath).isFile()) {
    fail(`input HTML does not exist: ${inputPath}`, 2);
  }
  if (path.extname(inputPath).toLowerCase() !== ".html") fail("input must be an .html file", 2);
  if (!args.out) fail("--out is required", 2);
  ensureNewOutputDirectory(outputDir);
  const stagingDir = `${outputDir}.staging-${process.pid}`;
  if (fs.existsSync(stagingDir)) fail(`staging directory already exists: ${stagingDir}`);
  fs.mkdirSync(stagingDir, { recursive: false, mode: 0o700 });

  let browser;
  try {
    if (args.forceFailure || process.env.OPENCLAW_TELEGRAM_EXPORT_FORCE_FAILURE === "1") {
      fail("forced exporter failure canary", 70);
    }
    const workspaceRoot = findWorkspaceRoot(__dirname);
    const { playwright, modulePath } = await loadPlaywright(workspaceRoot);
    const launched = await launchBrowser(playwright, workspaceRoot);
    browser = launched.browser;
    const context = await browser.newContext({
      viewport: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const blockedRequests = [];
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (
        url.split("#")[0] === pathToFileURL(inputPath).href ||
        url.startsWith("data:") ||
        url.startsWith("blob:") ||
        url.startsWith("about:")
      ) {
        await route.continue();
      } else {
        blockedRequests.push(url);
        await route.abort("blockedbyclient");
      }
    });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.goto(pathToFileURL(inputPath).href, { waitUntil: "load" });
    await page.addStyleTag({ content: STATIC_HIDE_CSS });
    await page.emulateMedia({ media: "screen", colorScheme: "light", reducedMotion: "reduce" });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    if (blockedRequests.length > 0) {
      fail(`HTML is not self-contained; blocked external requests: ${blockedRequests.join(", ")}`, 30);
    }
    if (consoleErrors.length > 0) {
      fail(`browser console errors: ${consoleErrors.join(" | ")}`, 31);
    }

    const audit = await page.evaluate(({ selector, width, height }) => {
      const pages = [...document.querySelectorAll(selector)];
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      return pages.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const interactive = [
          ...element.querySelectorAll("button, input, select, textarea, [role='button'], [contenteditable='true']"),
        ]
          .filter(visible)
          .map((candidate) => candidate.outerHTML.slice(0, 180));
        return {
          index: index + 1,
          width: rect.width,
          height: rect.height,
          clientWidth: element.clientWidth,
          clientHeight: element.clientHeight,
          scrollWidth: element.scrollWidth,
          scrollHeight: element.scrollHeight,
          interactive,
          expectedWidth: width,
          expectedHeight: height,
        };
      });
    }, { selector: PAGE_SELECTOR, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    if (audit.length < 1) fail(`HTML must contain at least one ${PAGE_SELECTOR} element`, 32);
    if (audit.length > 20) fail(`refusing ${audit.length} pages; maximum is 20`, 33);
    for (const item of audit) {
      if (Math.abs(item.width - PAGE_WIDTH) > 0.5 || Math.abs(item.height - PAGE_HEIGHT) > 0.5) {
        fail(`page ${item.index} must be exactly ${PAGE_WIDTH}x${PAGE_HEIGHT} CSS pixels; got ${item.width}x${item.height}`, 34);
      }
      if (
        item.scrollWidth > item.clientWidth + 1 ||
        item.scrollHeight > item.clientHeight + 1
      ) {
        fail(
          `page ${item.index} overflows: client=${item.clientWidth}x${item.clientHeight}, scroll=${item.scrollWidth}x${item.scrollHeight}`,
          35,
        );
      }
      if (item.interactive.length > 0) {
        fail(`page ${item.index} contains visible interactive controls: ${item.interactive.join(" | ")}`, 36);
      }
    }

    const pages = [];
    const locators = page.locator(PAGE_SELECTOR);
    for (let index = 0; index < audit.length; index += 1) {
      const file = `page-${String(index + 1).padStart(2, "0")}.png`;
      const destination = path.join(stagingDir, file);
      await locators.nth(index).screenshot({
        path: destination,
        animations: "disabled",
        caret: "hide",
        scale: "device",
        type: "png",
      });
      const dimensions = parsePngDimensions(destination);
      const expectedWidth = PAGE_WIDTH * DEVICE_SCALE_FACTOR;
      const expectedHeight = PAGE_HEIGHT * DEVICE_SCALE_FACTOR;
      if (dimensions.width !== expectedWidth || dimensions.height !== expectedHeight) {
        fail(`encoded page ${index + 1} is ${dimensions.width}x${dimensions.height}; expected ${expectedWidth}x${expectedHeight}`, 37);
      }
      pages.push({
        index: index + 1,
        file,
        width: dimensions.width,
        height: dimensions.height,
        sha256: sha256File(destination),
      });
    }

    const manifest = {
      schemaVersion: 1,
      exporterVersion: SCRIPT_VERSION,
      status: "awaiting_visual_inspection",
      staticOnly: true,
      htmlDeliveryAllowed: false,
      title: args.title ?? path.basename(inputPath, path.extname(inputPath)),
      createdAt: new Date().toISOString(),
      source: {
        file: inputPath,
        sha256: sha256File(inputPath),
      },
      runtime: {
        playwrightModule: modulePath,
        chromiumExecutable: launched.executablePath,
        localLibraryPathApplied: browserEnvironment(workspaceRoot).LD_LIBRARY_PATH?.includes(
          path.join(workspaceRoot, "tmp", "playwright-libs"),
        ) ?? false,
      },
      pageContract: {
        selector: PAGE_SELECTOR,
        cssWidth: PAGE_WIDTH,
        cssHeight: PAGE_HEIGHT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
      },
      pages,
      telegramDelivery: {
        mode: "single_message_multi_attachment",
        attachmentFiles: pages.map((entry) => entry.file),
      },
      inspection: {
        required: true,
        completed: false,
        pages: [],
      },
    };
    writeJsonAtomic(path.join(stagingDir, "artifact-manifest.json"), manifest);
    await context.close();
    await browser.close();
    browser = undefined;
    fs.renameSync(stagingDir, outputDir);
    process.stdout.write(
      `${JSON.stringify({
        status: manifest.status,
        manifest: path.join(outputDir, "artifact-manifest.json"),
        pages: pages.length,
        attachments: pages.map((entry) => path.join(outputDir, entry.file)),
      })}\n`,
    );
  } catch (error) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // Preserve the original failure.
      }
    }
    if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

export function approveArtifact(args) {
  if (!args.manifest) fail("--manifest is required", 2);
  if (!args["inspection-evidence"]) fail("--inspection-evidence is required", 2);
  const manifestPath = path.resolve(args.manifest);
  const { manifest } = verifyManifest(manifestPath, false);
  if (manifest.status !== "awaiting_visual_inspection" && manifest.status !== "ready") {
    fail(`cannot approve manifest with status=${manifest.status}`);
  }
  const evidencePath = path.resolve(args["inspection-evidence"]);
  if (!fs.existsSync(evidencePath)) fail(`inspection evidence does not exist: ${evidencePath}`, 2);
  const evidence = readJson(evidencePath);
  const requiredChecks = [
    "clipping",
    "textBoundaries",
    "pageOrder",
    "visualBalance",
    "controlsRemoved",
  ];
  if (evidence.schemaVersion !== 1 || evidence.method !== "openclaw_image_tool_original") {
    fail("inspection evidence must use schemaVersion=1 and method=openclaw_image_tool_original", 50);
  }
  if (!Array.isArray(evidence.pages) || evidence.pages.length !== manifest.pages.length) {
    fail("inspection evidence must contain exactly one entry per manifest page", 51);
  }
  for (const page of manifest.pages) {
    const reviewed = evidence.pages.find((entry) => entry.index === page.index);
    if (!reviewed || reviewed.file !== page.file || reviewed.sha256 !== page.sha256) {
      fail(`inspection evidence is missing or stale for page ${page.index}`, 52);
    }
    for (const check of requiredChecks) {
      if (reviewed.checks?.[check] !== "pass") {
        fail(`inspection check ${check} did not pass for page ${page.index}`, 53);
      }
    }
    if (typeof reviewed.note !== "string" || reviewed.note.trim().length < 12) {
      fail(`inspection note is too short for page ${page.index}`, 54);
    }
  }
  manifest.status = "ready";
  manifest.inspection = {
    required: true,
    completed: true,
    completedAt: new Date().toISOString(),
    method: "agent_visual_page_by_page",
    evidenceFile: path.basename(evidencePath),
    pages: evidence.pages,
  };
  writeJsonAtomic(manifestPath, manifest);
  verifyManifest(manifestPath, true);
  process.stdout.write(
    `${JSON.stringify({ status: "ready", manifest: manifestPath, pages: manifest.pages.length })}\n`,
  );
}

export function verifyArtifact(args) {
  if (!args.manifest) fail("--manifest is required", 2);
  const { manifest, manifestPath, baseDir } = verifyManifest(args.manifest, true);
  process.stdout.write(
    `${JSON.stringify({
      status: "ready",
      manifest: manifestPath,
      pages: manifest.pages.length,
      attachments: manifest.pages.map((entry) => path.join(baseDir, entry.file)),
    })}\n`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage(process.stdout);
    return;
  }
  if (!["export", "approve", "verify"].includes(args.command)) {
    printUsage();
    process.exitCode = 2;
    return;
  }
  if (args.command === "export") await exportArtifact(args);
  if (args.command === "approve") approveArtifact(args);
  if (args.command === "verify") verifyArtifact(args);
}

if (path.resolve(process.argv[1] ?? "") === __filename) {
  main().catch((error) => {
    process.stderr.write(`TELEGRAM_STATIC_EXPORT_FAILED: ${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  });
}
