#!/usr/bin/env node
// Export a design artifact to PDF — `node scripts/export.mjs --in <index.html> [--out <file.pdf>]`.
// Zero npm deps: drives a headless Chrome/Chromium already on the machine (decks print as slides via their own
// print CSS; pages print as a long document). PPTX export is deferred — print to PDF covers most needs.

import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const inArg = arg("in");
if (!inArg) {
  console.error("usage: node scripts/export.mjs --in <index.html> [--out <file.pdf>]");
  process.exit(2);
}
const inPath = resolve(inArg);
if (!existsSync(inPath)) {
  console.error(`not found: ${inPath}`);
  process.exit(2);
}
const outPath = resolve(arg("out", join(dirname(inPath), basename(inPath).replace(/\.html?$/i, "") + ".pdf")));

// For a prototype asset (has <section data-route>), inline the FROZEN framework (proto.css + proto.js) into a temp
// file beside the asset (so relative assets still resolve) and print THAT — proto.js builds the fixed per-screen
// print layout (cover + each screen framed on its own page), giving a consistent, designer-grade PDF regardless of
// the page's own CSS. Static pages print as-is.
const here = dirname(fileURLToPath(import.meta.url));
const sharedDir = join(here, "..", "skills", "design", "references", "shared");
let printPath = inPath, tmpPath = null;
try {
  let html = readFileSync(inPath, "utf8");
  if (/\sdata-route\s*=/.test(html) && !/\/__proto\.|hara-print/.test(html)) {
    const css = readFileSync(join(sharedDir, "proto.css"), "utf8");
    const js = readFileSync(join(sharedDir, "proto.js"), "utf8");
    html = (html.includes("</head>") ? html.replace("</head>", `<style>${css}</style></head>`) : `<style>${css}</style>` + html);
    html = (html.includes("</body>") ? html.replace("</body>", `<script>${js}</script></body>`) : html + `<script>${js}</script>`);
    tmpPath = join(dirname(inPath), `.hara-export-${process.pid}.html`);
    writeFileSync(tmpPath, html, "utf8");
    printPath = tmpPath;
  }
} catch {
  /* fall back to printing the input as-is */
}

const CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge",
].filter(Boolean);

function resolveChrome() {
  for (const c of CANDIDATES) {
    if (c.includes("/")) {
      if (existsSync(c)) return c;
    } else {
      try {
        const p = execFileSync("which", [c], { encoding: "utf8" }).trim();
        if (p) return p;
      } catch {
        /* not on PATH */
      }
    }
  }
  return null;
}

const chrome = resolveChrome();
if (!chrome) {
  console.error(
    "No Chrome/Chromium found. Install Google Chrome (or set CHROME_BIN), or open the page and print to PDF from the browser.",
  );
  process.exit(3);
}

const fileUrl = "file://" + printPath;
try {
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=6000",
      `--print-to-pdf=${outPath}`,
      fileUrl,
    ],
    { stdio: ["ignore", "ignore", "inherit"], timeout: 60000 },
  );
  console.log(`PDF: ${outPath}`);
} catch (e) {
  console.error(`export failed: ${e.message}`);
  if (tmpPath) try { rmSync(tmpPath); } catch {}
  process.exit(1);
} finally {
  if (tmpPath) try { rmSync(tmpPath); } catch {}
}
