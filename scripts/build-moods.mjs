#!/usr/bin/env node
// Generate skills/design/references/design-systems/MOODS.md — the agent-facing VIBE index — from
// the SAME canonical map used to tag frontmatter (scripts/add-mood.mjs). One source of truth: edit
// MOOD_OF / MOODS in add-mood.mjs, re-run add-mood.mjs, then re-run this. The tone line for each
// system is pulled live from its DESIGN.md so MOODS.md never drifts from the prose.
//
// Run:  node scripts/build-moods.mjs            (writes MOODS.md)
//       node scripts/build-moods.mjs --dry-run  (print to stdout)

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MOODS, MOOD_OF } from "./add-mood.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dsRoot = join(here, "..", "skills", "design", "references", "design-systems");
const dryRun = process.argv.includes("--dry-run");

// Pull the one-line tone for a system: the LAST blockquote line of the intro that isn't the
// "> Category:" / "> Surface:" metadata line. Falls back to "" if none found.
function toneOf(id) {
  const file = join(dsRoot, id, "DESIGN.md");
  let raw;
  try {
    if (!statSync(file).isFile()) return "";
    raw = readFileSync(file, "utf8");
  } catch {
    return "";
  }
  const lines = raw.split(/\r?\n/);
  // Find the H1, then collect the contiguous blockquote/intro lines after it.
  const h1 = lines.findIndex((l) => /^#\s+/.test(l));
  const scan = h1 === -1 ? lines : lines.slice(h1 + 1);
  const quote = [];
  let started = false;
  for (const l of scan) {
    if (/^>\s?/.test(l)) {
      started = true;
      quote.push(l.replace(/^>\s?/, "").trim());
    } else if (l.trim() === "" || l.trim() === "---") {
      // blank line before the intro starts -> keep scanning; blank line AFTER -> intro is over
      if (started) break;
    } else if (/^#{1,6}\s/.test(l)) {
      break; // hit the next heading -> intro is over
    } else {
      // a bare (non-`>`) prose line — part of the intro (e.g. urdu's tone sits outside the quote)
      started = true;
      quote.push(l.trim());
    }
  }
  // Drop metadata-ish leading lines; join the rest into one tone sentence.
  const body = quote.filter((q) => q && !/^(Category|Surface)\s*:/.test(q));
  return body.join(" ").replace(/\s+/g, " ").trim();
}

// Invert MOOD_OF -> mood => [ids]
const byMood = new Map(MOODS.map((m) => [m.name, []]));
for (const [id, mood] of Object.entries(MOOD_OF)) {
  if (!byMood.has(mood)) byMood.set(mood, []);
  byMood.get(mood).push(id);
}
for (const arr of byMood.values()) arr.sort((a, b) => a.localeCompare(b));

const total = Object.keys(MOOD_OF).length;

let out = "";
out += "# Moods — vibe-first design-system index\n\n";
out +=
  "Every one of the design systems here belongs to exactly one **mood** — the *aesthetic* axis " +
  "(how it FEELS), orthogonal to `category` in each `DESIGN.md` (the *industry* axis, e.g. Fintech, " +
  "Media).\n\n";
out +=
  "**How to use this:** the user picks a **vibe** (or you suggest one from their brief); you then " +
  "read this file, pick the matching mood below, and choose — or offer 2-3 of — the best-fit " +
  "system(s) within it. Each system also carries a `mood:` key in its `DESIGN.md` frontmatter, so " +
  "you can `grep -l \"mood: <Mood>\"` to filter. If the user already named a brand/system, skip " +
  "the vibe step and use that directly (see INDEX.md).\n\n";
out += `_${MOODS.length} moods · ${total} systems · each system maps to exactly one mood._\n\n`;
out += "---\n\n";

for (const m of MOODS) {
  const ids = byMood.get(m.name) || [];
  out += `## ${m.name}  (${ids.length})\n\n`;
  out += `${m.vibe}\n\n`;
  out += `**When to pick:** ${m.when}\n\n`;
  for (const id of ids) {
    const tone = (toneOf(id) || "").slice(0, 70).trim(); // differentiator, not documentation — DESIGN.md has the rest
    out += `- \`${id}\`${tone ? ` — ${tone}` : ""}\n`;
  }
  out += "\n";
}

out = out.replace(/\n+$/, "\n");

if (dryRun) {
  process.stdout.write(out);
} else {
  writeFileSync(join(dsRoot, "MOODS.md"), out);
  console.log(`wrote MOODS.md  (${MOODS.length} moods, ${total} systems)`);
}
