#!/usr/bin/env node
// Prepend machine-readable YAML frontmatter to every design-system DESIGN.md so an agent can
// grep/parse token values (id / category / palette / fonts) instead of scraping English prose.
//
// IDEMPOTENT: files that already start with `---\n` frontmatter are skipped (never double-added).
// The original prose body is left 100% intact — frontmatter is purely PREPENDED.
//
// Run:  node scripts/add-frontmatter.mjs            (all systems)
//       node scripts/add-frontmatter.mjs --only a,b (limit to dirs a,b — for sampling)
//       node scripts/add-frontmatter.mjs --dry-run  (print, write nothing)

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dsRoot = join(here, "..", "skills", "design", "references", "design-systems");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyArg = args.find((a) => a.startsWith("--only"));
const only = onlyArg
  ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : args[args.indexOf(onlyArg) + 1] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

// --- extractors ---------------------------------------------------------------

function extractCategory(raw) {
  const m = /^>\s*Category:\s*(.+?)\s*$/im.exec(raw);
  return m ? m[1].trim() : null;
}

// All unique hex colors (#RGB / #RRGGBB / #RRGGBBAA), first-seen order, capped at 10.
function extractPalette(raw) {
  const re = /#[0-9a-fA-F]{3,8}\b/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    const hex = m[0];
    // valid CSS hex lengths only: 3, 4, 6, 8
    const len = hex.length - 1;
    if (len !== 3 && len !== 4 && len !== 6 && len !== 8) continue;
    const key = hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hex);
    if (out.length >= 10) break;
  }
  return out;
}

// Tokens that are CSS keywords / OpenType features / generic stacks — never real font NAMES.
const FONT_STOPWORDS = new Set([
  "sans-serif", "serif", "monospace", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace",
  "cursive", "fantasy", "inherit", "initial", "unset", "normal", "none", "auto",
  "-apple-system", "blinkmacsystemfont", "sans", "mono",
  // common OpenType feature tags that show up in backticks
  "ss01", "ss02", "ss03", "ss04", "ss09", "cv01", "cv02", "cv03", "cv05", "cv11", "tnum", "salt",
  "liga", "dlig", "kern", "calt", "frac", "onum", "pnum", "lnum", "case", "zero", "cswh", "swsh",
]);

// Descriptive bullet labels that masquerade as fonts (e.g. "No italic variants",
// "Usage Split", "Weight range", "Feature"). A real font name never contains these words.
const FONT_LABEL_NOISE = /\b(variants?|typeface|features?|range|split|italics?|observed|usage|weight|fallbacks?|source|note|primary and only|and only|secondary)\b/i;

function looksLikeFont(name) {
  const n = name.trim().replace(/^['"]|['"]$/g, "").trim();
  if (!n) return false;
  if (n.length < 2 || n.length > 40) return false;
  if (FONT_STOPWORDS.has(n.toLowerCase())) return false;
  if (/^font-/i.test(n) || /:/.test(n)) return false; // CSS declarations e.g. "font-smoothing: antialiased"
  if (/^[0-9.\s,]+$/.test(n)) return false; // pure numbers/weights
  if (/^#/.test(n)) return false; // hex
  if (/[{}()/]/.test(n)) return false; // template/CSS junk, or "Arial / Helvetica" slash combos
  if (/\d+px|\d+rem|rgba?\(/i.test(n)) return false;
  if (/^no\b/i.test(n)) return false; // "No italic variants", "No secondary typeface"
  if (FONT_LABEL_NOISE.test(n)) return false; // descriptive label, not a font name
  // must contain at least one letter
  if (!/[A-Za-z]/.test(n)) return false;
  return true;
}

// Grab the body of a "### Font Family" subsection (until the next ### or ## heading).
function fontFamilyBlock(raw) {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((l) => /^###\s+Font Family\b/i.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{2,3}\s+/.test(l));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

// Best-effort font NAME extraction. Returns array (possibly empty).
// Strategy, in priority order, applied to the "### Font Family" block when present:
//   1. Bold role label whose VALUE is a backticked or bold font name
//      e.g.  - **Primary**: `Inter Variable`, fallbacks ...   -> Inter Variable
//      e.g.  - **Airbnb Cereal VF** (primary and only): ...    -> Airbnb Cereal VF (bold IS the name)
//   2. First backticked token on each bullet, first comma-segment (the primary font of a stack)
// Generic keywords / OpenType features are filtered out. If nothing clean parses, returns [].
function extractFonts(raw) {
  const block = fontFamilyBlock(raw);
  const scope = block != null ? block : ""; // only trust the dedicated section; prose is too noisy
  if (!scope) return [];

  const fonts = [];
  const seen = new Set();
  const add = (name) => {
    const n = name.trim().replace(/^['"]|['"]$/g, "").trim();
    if (!looksLikeFont(n)) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    fonts.push(n);
  };

  for (const line of scope.split(/\r?\n/)) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (!bullet) continue;
    const body = bullet[1];

    // role label: **Role**: value   OR   **Role:** value
    const roleMatch = /^\*\*([^*]+?)\s*[:：]?\s*\*\*\s*[:：]?\s*(.*)$/.exec(body);
    const roleLabel = roleMatch ? roleMatch[1].trim() : "";
    const value = roleMatch ? roleMatch[2] : body;

    const ROLE_RE = /^(primary|secondary|display|text|body|heading|headings?|mono(space)?|ui|sans|serif|brand|accent|title|marketing|editorial|label|code)\b/i;

    // first backticked group in the value
    const tick = /`([^`]+)`/.exec(value);
    if (tick) {
      const first = tick[1].split(",")[0]; // primary font of a stack
      add(first);
      continue;
    }

    // no backtick in value: maybe the bold label itself is the font name
    // (e.g. "**Airbnb Cereal VF** (primary and only)") — accept only if NOT a plain role word
    if (roleLabel && !ROLE_RE.test(roleLabel) && /[A-Za-z]/.test(roleLabel)) {
      add(roleLabel);
    }
  }

  return fonts.slice(0, 8);
}

// --- frontmatter assembly -----------------------------------------------------

function yamlList(arr) {
  return "[" + arr.map((s) => JSON.stringify(s)).join(", ") + "]";
}

function buildFrontmatter({ id, category, palette, fonts }) {
  const lines = ["---", `id: ${id}`];
  if (category) lines.push(`category: ${category}`);
  if (palette.length) lines.push(`palette: ${yamlList(palette)}`);
  if (fonts.length) lines.push(`fonts: ${yamlList(fonts)}`);
  lines.push("---", "");
  return lines.join("\n");
}

// --- main ---------------------------------------------------------------------

let added = 0;
let skipped = 0;
const emptyPalette = [];

const entries = readdirSync(dsRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => (only ? only.includes(name) : true))
  .sort((a, b) => a.localeCompare(b));

for (const id of entries) {
  const file = join(dsRoot, id, "DESIGN.md");
  let raw;
  try {
    if (!statSync(file).isFile()) continue;
    raw = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  if (raw.startsWith("---\n") || raw.startsWith("---\r\n")) {
    console.log(`skip   ${id} (already has frontmatter)`);
    skipped++;
    continue;
  }

  const category = extractCategory(raw);
  const palette = extractPalette(raw);
  const fonts = extractFonts(raw);
  if (palette.length === 0) emptyPalette.push(id);

  const fm = buildFrontmatter({ id, category, palette, fonts });
  const next = fm + raw;

  if (dryRun || only) {
    console.log(`\n----- ${id} -----\n${fm}`);
  }
  if (!dryRun) {
    writeFileSync(file, next);
  }
  console.log(
    `add    ${id}  (category=${category ? "y" : "-"}, palette=${palette.length}, fonts=${fonts.length})`,
  );
  added++;
}

console.log(`\nDONE: added=${added}, skipped=${skipped}, total=${added + skipped}`);
if (emptyPalette.length) {
  console.log(`EMPTY PALETTE (${emptyPalette.length}): ${emptyPalette.join(", ")}`);
}
