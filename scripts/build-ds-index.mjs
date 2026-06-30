#!/usr/bin/env node
// Generate skills/design/references/design-systems/INDEX.md — one scannable line per design system
// (id · title · category · 1-line summary) so the design skill can pick from all ~138 systems by reading
// ONE small file, then load only the chosen DESIGN.md. Keeps token cost flat regardless of catalog size.
//
// Title = first H1. Category = "> Category: <name>" blockquote. Summary = first paragraph after the H1
// (Category line stripped, capped). Ported from open-design apps/daemon/src/design-systems.ts.

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dsRoot = join(here, "..", "skills", "design", "references", "design-systems");

function cleanTitle(raw) {
  return raw.replace(/^Design System (Inspired by|for)\s+/i, "").trim();
}
// Read a single scalar key from a leading YAML frontmatter block (--- ... ---), if present.
function frontmatterValue(raw, key) {
  if (!/^---\r?\n/.test(raw)) return null;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return null;
  const block = raw.slice(0, end);
  const m = new RegExp(`^${key}:\\s*(.+?)\\s*$`, "im").exec(block);
  return m ? m[1].trim() : null;
}
function extractCategory(raw) {
  // Prefer machine-readable frontmatter (added by add-frontmatter.mjs); fall back to prose scan.
  const fm = frontmatterValue(raw, "category");
  if (fm) return fm;
  const m = /^>\s*Category:\s*(.+?)\s*$/im.exec(raw);
  return m?.[1] ?? "Uncategorized";
}
function summarize(raw) {
  const lines = raw.split(/\r?\n/);
  const firstH1 = lines.findIndex((l) => /^#\s+/.test(l));
  if (firstH1 === -1) return "";
  const afterH1 = lines.slice(firstH1 + 1);
  const nextHeading = afterH1.findIndex((l) => /^#{1,6}\s+/.test(l));
  const window = (nextHeading === -1 ? afterH1 : afterH1.slice(0, nextHeading))
    .join("\n")
    .replace(/^>\s*Category:.*$/gim, "")
    .replace(/^>\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return (window.split(/\. /)[0] || window).slice(0, 160).trim();
}

const rows = [];
for (const entry of readdirSync(dsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const file = join(dsRoot, entry.name, "DESIGN.md");
  let raw;
  try {
    if (!statSync(file).isFile()) continue;
    raw = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const titleMatch = /^#\s+(.+?)\s*$/m.exec(raw);
  const title = cleanTitle(titleMatch?.[1] ?? entry.name);
  rows.push({ id: entry.name, title, category: extractCategory(raw), summary: summarize(raw) });
}
rows.sort((a, b) => a.id.localeCompare(b.id));

const lines = [
  "# Design systems index",
  "",
  `${rows.length} systems. Pick one by **id** (the first column), then read its \`<id>/DESIGN.md\` for the full spec.`,
  "Match the brief's tone/brand to a system; when the user names one explicitly, honor that.",
  "",
  "| id | title | category | summary |",
  "|---|---|---|---|",
  ...rows.map((r) => `| \`${r.id}\` | ${r.title} | ${r.category} | ${r.summary.replace(/\|/g, "\\|")} |`),
  "",
];
const out = join(dsRoot, "INDEX.md");
writeFileSync(out, lines.join("\n"));
console.log(`wrote ${out} — ${rows.length} design systems`);
