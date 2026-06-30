#!/usr/bin/env node
// Add a `mood:` key (the AESTHETIC axis, orthogonal to `category:` which is the INDUSTRY axis) to
// every design-system DESIGN.md frontmatter, so an agent can offer VIBE-FIRST selection:
// "pick a vibe -> I narrow to a best-fit system" instead of only a flat id list.
//
// Each of the 150 systems is mapped to EXACTLY ONE of 7 moods (see MOOD_OF below). The mapping is
// the single source of truth — `scripts/build-moods.mjs` reads the SAME map to generate MOODS.md.
//
// IDEMPOTENT: a file that already has a `mood:` line is skipped (never double-added). The `mood:`
// line is inserted right after the `category:` line (or, if absent, before the closing `---`).
// Prose body is left 100% intact.
//
// totality-festival uses a DIFFERENT legacy frontmatter (no `id:`/`category:`, a `colors:` map and
// an H1 further down). It is handled gracefully: we insert `mood:` after the opening `---` and
// leave the rest untouched. It still appears in MOODS.md.
//
// Run:  node scripts/add-mood.mjs            (all systems)
//       node scripts/add-mood.mjs --dry-run  (print plan, write nothing)
//       node scripts/add-mood.mjs --only a,b (limit to dirs a,b)

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

// --- the 7 moods (canonical order + descriptions; consumed by build-moods.mjs too) -------------

export const MOODS = [
  {
    name: "Minimal & Precise",
    vibe: "System sans, restrained chrome, monochrome + one accent. Content-first, engineered calm.",
    when: "Pick for SaaS, dashboards, dev tools, B2B utility, docs — anything that should feel clean, fast, and trustworthy without shouting.",
  },
  {
    name: "Editorial & Refined",
    vibe: "Serif display, typographic hierarchy, print-grade craft. Reads like a magazine, not a UI.",
    when: "Pick for long-form, publications, portfolios, resumes, brand stories, white papers — when the words and the page are the product.",
  },
  {
    name: "Warm & Soft",
    vibe: "Rounded/serif, cream & earthy tones, gentle shadows. Friendly, approachable, human.",
    when: "Pick for consumer, lifestyle, community, payments-made-friendly, onboarding — when you want users to feel welcomed, not impressed.",
  },
  {
    name: "Bold & Expressive",
    vibe: "Vivid color, big type, playful energy, gradients & motion. Personality turned up.",
    when: "Pick for launches, creative tools, gaming, marketing pages, anything youthful — when you want to grab attention and feel alive.",
  },
  {
    name: "Tech & Utility",
    vibe: "Dense, mono, data/HUD, cyan/green-on-black, terminal-native. Information at speed.",
    when: "Pick for analytics, trading, infra, monitoring, AI/agent tooling, command centers — when density and signal beat decoration.",
  },
  {
    name: "Luxe & Premium",
    vibe: "Black/gold, vast space, cinematic imagery, quiet authority. High-end and expensive-feeling.",
    when: "Pick for luxury brands, automotive, flagship product reveals, premium consumer — when it must feel aspirational and rare.",
  },
  {
    name: "Brutalist & Retro",
    vibe: "Giant type, visible grid, raw/anti-design, pixel & nostalgia. Intentionally rough and loud.",
    when: "Pick for statement sites, art/indie, arcade/8-bit, throwback themes — when 'polished' is the wrong answer and rawness is the point.",
  },
];

const MOOD_NAMES = new Set(MOODS.map((m) => m.name));

// --- the classification: every one of the 150 systems -> exactly one mood ----------------------
// Decided from frontmatter (category + palette) + the prose tone line. No "other" bucket needed.

export const MOOD_OF = {
  // --- Minimal & Precise: system sans, restrained, mono + one accent --------------------------
  "linear-app": "Minimal & Precise",
  vercel: "Minimal & Precise",
  notion: "Minimal & Precise",
  cal: "Minimal & Precise",
  github: "Minimal & Precise",
  expo: "Minimal & Precise",
  "x-ai": "Minimal & Precise",
  ollama: "Minimal & Precise",
  replicate: "Minimal & Precise",
  openai: "Minimal & Precise",
  "mistral-ai": "Minimal & Precise",
  ibm: "Minimal & Precise",
  shadcn: "Minimal & Precise",
  clean: "Minimal & Precise",
  minimal: "Minimal & Precise",
  simple: "Minimal & Precise",
  sleek: "Minimal & Precise",
  spacious: "Minimal & Precise",
  levels: "Minimal & Precise",
  bento: "Minimal & Precise",
  flat: "Minimal & Precise",
  default: "Minimal & Precise",
  contemporary: "Minimal & Precise",
  uber: "Minimal & Precise",
  coinbase: "Minimal & Precise",
  ant: "Minimal & Precise",
  application: "Minimal & Precise",
  dashboard: "Minimal & Precise",
  enterprise: "Minimal & Precise",
  corporate: "Minimal & Precise",
  professional: "Minimal & Precise",
  material: "Minimal & Precise",
  intercom: "Minimal & Precise",
  mintlify: "Minimal & Precise",
  resend: "Minimal & Precise",
  webex: "Minimal & Precise",
  cohere: "Minimal & Precise",
  agentic: "Minimal & Precise",
  loom: "Minimal & Precise",
  meta: "Minimal & Precise",
  cisco: "Minimal & Precise",
  hashicorp: "Minimal & Precise",
  perspective: "Minimal & Precise", // spatial/isometric but on clean light surfaces, structural
  glassmorphism: "Minimal & Precise", // frosted/translucent but elegant & restrained

  // --- Editorial & Refined: serif display, typographic, considered, print-grade ---------------
  "atelier-zero": "Editorial & Refined",
  kami: "Editorial & Refined",
  editorial: "Editorial & Refined",
  modern: "Editorial & Refined", // "contemporary editorial style with serif typography"
  refined: "Editorial & Refined", // "elegant serif typography, understated palettes"
  elegant: "Editorial & Refined",
  publication: "Editorial & Refined",
  wired: "Editorial & Refined",
  theverge: "Editorial & Refined",
  urdu: "Editorial & Refined",
  sanity: "Editorial & Refined", // "content-first editorial layout"
  "warm-editorial": "Editorial & Refined", // serif-led magazine; warmth, but editorial is the spine
  storytelling: "Editorial & Refined", // narrative-driven, copy-led journeys

  // --- Warm & Soft: rounded/serif, cream/earthy, friendly -------------------------------------
  airbnb: "Warm & Soft",
  stripe: "Warm & Soft", // warm-but-technical; the soft weight-300 + warm gradients lean soft
  claude: "Warm & Soft",
  cafe: "Warm & Soft",
  friendly: "Warm & Soft",
  zapier: "Warm & Soft",
  mastercard: "Warm & Soft", // warm cream canvas, editorial warmth
  starbucks: "Warm & Soft",
  slack: "Warm & Soft",
  wise: "Warm & Soft",
  lovable: "Warm & Soft", // warm paper canvas, friendly dev aesthetic
  clay: "Warm & Soft", // organic shapes, soft gradients, warm neutrals
  xiaohongshu: "Warm & Soft",
  wechat: "Warm & Soft",
  posthog: "Warm & Soft", // warm cream, playful-friendly hedgehog
  zapier_dup: "Warm & Soft", // (no such id; placeholder guarded by validation)
  claymorphism: "Warm & Soft", // soft puffy 3D clay, playful but soft
  neumorphism: "Warm & Soft", // soft extruded tactile surfaces

  // --- Bold & Expressive: vivid color, big type, playful energy -------------------------------
  spotify: "Bold & Expressive",
  duolingo: "Bold & Expressive",
  figma: "Bold & Expressive",
  canva: "Bold & Expressive",
  miro: "Bold & Expressive",
  framer: "Bold & Expressive",
  webflow: "Bold & Expressive",
  airtable: "Bold & Expressive",
  bold: "Bold & Expressive",
  colorful: "Bold & Expressive",
  vibrant: "Bold & Expressive",
  expressive: "Bold & Expressive",
  energetic: "Bold & Expressive",
  dramatic: "Bold & Expressive",
  gradient: "Bold & Expressive",
  neon: "Bold & Expressive",
  cosmic: "Bold & Expressive",
  creative: "Bold & Expressive",
  artistic: "Bold & Expressive",
  fantasy: "Bold & Expressive",
  doodle: "Bold & Expressive",
  lingo: "Bold & Expressive", // bright colors, tactile 3D borders, playful
  renault: "Bold & Expressive", // vibrant aurora gradients, bold energy
  discord: "Bold & Expressive", // blurple, playful accent moments
  pinterest: "Bold & Expressive", // image-first, red accent, lively masonry
  arc: "Bold & Expressive", // gradient warmth, translucent, expressive browser
  "totality-festival": "Bold & Expressive", // cosmic-premium festival, amber corona + cyan energy
  futuristic: "Bold & Expressive", // forward-looking, sleek innovation energy
  huggingface: "Bold & Expressive", // sunny yellow, cheerful and dense
  skeumorphism: "Bold & Expressive", // textured, 3D, expressive realism
  storytelling_dup: "Bold & Expressive", // (guarded placeholder)

  // --- Tech & Utility: dense, mono, data/HUD, cyan/green -------------------------------------
  hud: "Tech & Utility",
  "trading-terminal": "Tech & Utility",
  "mission-control": "Tech & Utility",
  warp: "Tech & Utility",
  mono: "Tech & Utility", // monospace matrix hacker-chic
  cursor: "Tech & Utility",
  raycast: "Tech & Utility",
  superhuman: "Tech & Utility",
  supabase: "Tech & Utility",
  mongodb: "Tech & Utility",
  clickhouse: "Tech & Utility",
  composio: "Tech & Utility",
  sentry: "Tech & Utility",
  kraken: "Tech & Utility",
  binance: "Tech & Utility",
  revolut: "Tech & Utility",
  voltagent: "Tech & Utility",
  "together-ai": "Tech & Utility",
  "opencode-ai": "Tech & Utility",
  minimax: "Tech & Utility",
  nvidia: "Tech & Utility",
  elevenlabs: "Tech & Utility",
  runwayml: "Tech & Utility",
  perplexity: "Tech & Utility", // deep-dark, dense info hierarchy, single violet accent

  // --- Luxe & Premium: black/gold, spacious, cinematic, high-end ------------------------------
  apple: "Luxe & Premium",
  luxury: "Luxe & Premium",
  premium: "Luxe & Premium",
  bmw: "Luxe & Premium",
  "bmw-m": "Luxe & Premium",
  bugatti: "Luxe & Premium",
  ferrari: "Luxe & Premium",
  lamborghini: "Luxe & Premium",
  tesla: "Luxe & Premium",
  spacex: "Luxe & Premium", // stark black/white, full-bleed cinematic
  nike: "Luxe & Premium", // monochrome, massive type, full-bleed photography
  playstation: "Luxe & Premium", // quiet-authority display type, cinematic channel layout
  shopify: "Luxe & Premium", // dark-first cinematic, neon-green accent, ultra-light type
  vodafone: "Luxe & Premium", // monumental uppercase display, cinematic chapter bands

  // --- Brutalist & Retro: giant type, visible grid, raw, pixel & nostalgia --------------------
  brutalism: "Brutalist & Retro",
  neobrutalism: "Brutalist & Retro",
  dithered: "Brutalist & Retro",
  vintage: "Brutalist & Retro",
  retro: "Brutalist & Retro",
  pacman: "Brutalist & Retro",
  tetris: "Brutalist & Retro",
  paper: "Brutalist & Retro", // paper-textured, print/retro tactile, throwback
};

// Strip the placeholder/guarded keys (they map to no real dir; kept only to document intent).
for (const k of Object.keys(MOOD_OF)) {
  if (k.endsWith("_dup")) delete MOOD_OF[k];
}

// --- frontmatter editing ----------------------------------------------------------------------

function insertMood(raw, mood) {
  const lines = raw.split(/\r?\n/);
  // Find the frontmatter block bounded by the first two `---` lines.
  if (lines[0].trim() !== "---") return null; // no frontmatter at all -> caller decides
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      close = i;
      break;
    }
  }
  if (close === -1) return null;

  // Already tagged?
  for (let i = 1; i < close; i++) {
    if (/^mood:\s*/.test(lines[i])) return "ALREADY";
  }

  // Prefer inserting right after the `category:` line; else just before the closing `---`.
  let insertAt = close; // default: line index of the closing `---`
  for (let i = 1; i < close; i++) {
    if (/^category:\s*/.test(lines[i])) {
      insertAt = i + 1;
      break;
    }
  }
  lines.splice(insertAt, 0, `mood: ${mood}`);
  return lines.join("\n");
}

// --- main -------------------------------------------------------------------------------------
// Only run the tagging loop when invoked directly (`node scripts/add-mood.mjs`), not when this
// module is imported for its MOODS / MOOD_OF exports (e.g. by build-moods.mjs).

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) main();

function main() {

const entries = readdirSync(dsRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => (only ? only.includes(name) : true))
  .sort((a, b) => a.localeCompare(b));

let added = 0;
let skipped = 0;
const unmapped = [];
const badMood = [];

for (const id of entries) {
  const file = join(dsRoot, id, "DESIGN.md");
  let raw;
  try {
    if (!statSync(file).isFile()) continue;
    raw = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const mood = MOOD_OF[id];
  if (!mood) {
    unmapped.push(id);
    continue;
  }
  if (!MOOD_NAMES.has(mood)) {
    badMood.push(`${id} -> ${mood}`);
    continue;
  }

  const result = insertMood(raw, mood);
  if (result === "ALREADY") {
    console.log(`skip   ${id} (already has mood)`);
    skipped++;
    continue;
  }
  if (result === null) {
    console.log(`WARN   ${id} (no parseable frontmatter block — left untouched)`);
    continue;
  }

  if (dryRun) {
    console.log(`would  ${id}  -> mood: ${mood}`);
  } else {
    writeFileSync(file, result);
    console.log(`add    ${id}  -> mood: ${mood}`);
  }
  added++;
}

console.log(`\nDONE: added=${added}, skipped=${skipped}, total=${added + skipped}`);
if (unmapped.length) {
  console.log(`\nUNMAPPED (${unmapped.length}) — these dirs have NO mood in MOOD_OF:`);
  console.log("  " + unmapped.join(", "));
}
if (badMood.length) {
  console.log(`\nBAD MOOD NAMES (${badMood.length}): ${badMood.join(", ")}`);
}

} // end main()
