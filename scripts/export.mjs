#!/usr/bin/env node
// Export a design artifact to a SELF-CONTAINED interactive HTML — `node scripts/export.mjs --in <index.html> [--out <file.html>]`.
// Inlines the FROZEN framework (proto.css + proto.js) into the asset so the delivered file opens anywhere (double-click,
// email, static host), fully interactive (device frame, Grid board, Play tap-through) — no preview server, no Chrome.
// proto.js self-mounts a Grid/Play toggle when opened standalone. A static page (no <section data-route>) is copied as-is.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const inArg = arg("in");
if (!inArg) {
  console.error("usage: node scripts/export.mjs --in <index.html> [--out <file.html>]");
  process.exit(2);
}
const inPath = resolve(inArg);
if (!existsSync(inPath)) {
  console.error(`not found: ${inPath}`);
  process.exit(2);
}
const outPath = resolve(arg("out", join(dirname(inPath), basename(inPath).replace(/\.html?$/i, "") + ".export.html")));

const sharedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "design", "references", "shared");
let html = readFileSync(inPath, "utf8");
// Prototype asset (has <section data-route>) and not already injected → inline the frozen framework.
if (/\sdata-route\s*=/.test(html) && !/\/__proto\./.test(html)) {
  const css = readFileSync(join(sharedDir, "proto.css"), "utf8");
  const js = readFileSync(join(sharedDir, "proto.js"), "utf8");
  html = html.includes("</head>") ? html.replace("</head>", `<style>${css}</style></head>`) : `<style>${css}</style>` + html;
  html = html.includes("</body>") ? html.replace("</body>", `<script>${js}</script></body>`) : html + `<script>${js}</script>`;
}
writeFileSync(outPath, html, "utf8");
console.log(`HTML: ${outPath}`);
