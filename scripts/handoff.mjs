#!/usr/bin/env node
// handoff.mjs — turn a generated design artifact into an AGENT-CONSUMABLE handoff a frontend coding agent can
// build the production app from. Mechanical half: extract the artifact's :root tokens → DTCG tokens.json, emit
// per-framework theme files, copy the reference HTML, and scaffold components.md / HANDOFF.md. The judgment half
// (component decomposition, props, state, responsive) is filled in by the agent per the design skill.
//
//   node scripts/handoff.mjs --in <index.html> [--out <dir>] [--target all|css|tailwind|swiftui|flutter]
//
// Token source = the artifact's :root custom properties (the concrete, agent-bound design), NOT the prose
// DESIGN.md. var(--x) values become DTCG aliases {group.x}; theme files resolve them to concrete values.
// Zero deps (node builtins). Style Dictionary is the upgrade path if the catalog of targets grows.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : def;
}
const inPath = resolve(arg("in", ""));
if (!arg("in") || !existsSync(inPath)) {
  console.error("usage: node scripts/handoff.mjs --in <index.html> [--out <dir>] [--target all|css|tailwind|swiftui|flutter]");
  process.exit(2);
}
const outDir = resolve(arg("out", join(dirname(inPath), "handoff")));
const targetArg = (arg("target", "all") || "all").toLowerCase();
const ALL_TARGETS = ["css", "tailwind", "swiftui", "flutter"];
const targets = targetArg === "all" ? ALL_TARGETS : targetArg.split(",").map((s) => s.trim()).filter((t) => ALL_TARGETS.includes(t));

const html = readFileSync(inPath, "utf8");

// ---- parse the first :root { ... } block into { name: value } ----
function parseRoot(src) {
  const m = /:root\s*\{([\s\S]*?)\}/.exec(src);
  const vars = {};
  if (!m) return vars;
  for (const decl of m[1].split(";")) {
    const kv = /^\s*(--[A-Za-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/.exec(decl);
    if (kv) vars[kv[1]] = kv[2].replace(/\s+/g, " ").trim();
  }
  return vars;
}
const vars = parseRoot(html);
// breakpoints the design actually uses (from its @media queries) — so the frontend agent rebuilds the shifts
const breakpoints = [...new Set([...html.matchAll(/@media[^{]*?(?:max|min)-width:\s*(\d+)px/gi)].map((m) => parseInt(m[1], 10)))].sort((a, b) => a - b);
if (Object.keys(vars).length === 0) {
  console.error(`No :root custom properties found in ${inPath}. The artifact should define design tokens in :root.`);
  process.exit(1);
}

// ---- classify a token by name + value ----
const isColor = (v) => /^#[0-9a-fA-F]{3,8}$|^(rgb|rgba|hsl|hsla|oklch|oklab|color)\(/.test(v) || /\bvar\(/.test(v);
const isDimension = (v) => /^-?[\d.]+(px|rem|em|vw|vh|%|ch)$|clamp\(|calc\(|min\(|max\(/.test(v);
function classify(name, value) {
  const n = name.replace(/^--/, "").toLowerCase();
  if (/font.*(family|stack)|^font-(display|body|mono|sans|serif)|family/.test(n) || /(serif|sans-serif|monospace|system-ui)/i.test(value)) return "fontFamily";
  if (/weight/.test(n)) return "fontWeight";
  if (/(^|[-_])(fs|font-size|text|size|h[1-6]|display|lead|caption|micro)([-_]|$)/.test(n) && (isDimension(value) || /clamp/.test(value))) return "fontSize";
  if (/(gap|space|spacing|pad|margin|inset)/.test(n) && isDimension(value)) return "spacing";
  if (/radius|rounded|corner/.test(n)) return "radius";
  if (/shadow|elevation/.test(n)) return "shadow";
  if (/(container|maxw|max-width|width|gutter|breakpoint)/.test(n) && isDimension(value)) return "size";
  if (isColor(value)) return "color";
  if (isDimension(value)) return "dimension";
  return "other";
}
const DTCG_TYPE = { color: "color", fontFamily: "fontFamily", fontWeight: "fontWeight", fontSize: "dimension", spacing: "dimension", radius: "dimension", shadow: "shadow", size: "dimension", dimension: "dimension", other: "string" };
const GROUP = { color: "color", fontFamily: "font", fontWeight: "fontWeight", fontSize: "fontSize", spacing: "space", radius: "radius", shadow: "shadow", size: "size", dimension: "dimension", other: "misc" };

// strip a leading kind prefix from a token name for a cleaner key (e.g. --fs-h1 → h1, --gap-md → md)
function shortKey(name) {
  return name.replace(/^--/, "").replace(/^(fs|font-size|font|gap|space|spacing|radius|shadow|size|color|c)[-_]/, "");
}
// resolve var(--x) chains to a concrete value (best-effort, for theme files)
function resolveVal(value, seen = new Set()) {
  const m = /var\(\s*(--[A-Za-z0-9-]+)\s*(?:,([^)]+))?\)/.exec(value);
  if (!m) return value;
  const ref = m[1];
  if (seen.has(ref) || !(ref in vars)) return (m[2] || value).trim();
  seen.add(ref);
  return resolveVal(value.replace(m[0], resolveVal(vars[ref], seen)), seen);
}
// DTCG alias if the value is a single var() ref into our own tokens
function aliasOf(value, classOf) {
  const m = /^var\(\s*(--[A-Za-z0-9-]+)\s*(?:,[^)]+)?\)$/.exec(value.trim());
  if (m && m[1] in vars) {
    const refClass = classify(m[1], vars[m[1]]);
    return `{${GROUP[refClass]}.${shortKey(m[1])}}`;
  }
  return null;
}

// ---- build DTCG tokens.json ----
const dtcg = {};
const flat = []; // {group, key, name, value, resolved, class}
for (const [name, value] of Object.entries(vars)) {
  const cls = classify(name, value);
  const group = GROUP[cls];
  const key = shortKey(name) || name.replace(/^--/, "");
  const resolved = resolveVal(value);
  dtcg[group] = dtcg[group] || { $type: DTCG_TYPE[cls] };
  const alias = aliasOf(value, cls);
  dtcg[group][key] = { $value: alias || resolved, $type: DTCG_TYPE[cls], ...(name !== `--${key}` ? { $extensions: { "run.hara.cssVar": name } } : {}) };
  flat.push({ group, key, name, value, resolved, cls });
}

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "theme"), { recursive: true });
writeFileSync(join(outDir, "tokens.json"), JSON.stringify(dtcg, null, 2) + "\n");
copyFileSync(inPath, join(outDir, "reference.html"));

// ---- per-framework theme emitters (resolved values) ----
const colors = flat.filter((t) => t.cls === "color");
const fonts = flat.filter((t) => t.cls === "fontFamily");
const spacing = flat.filter((t) => ["spacing", "radius", "size", "fontSize", "dimension"].includes(t.cls));
const hex6 = (v) => { const m = /^#([0-9a-fA-F]{6})$|^#([0-9a-fA-F]{3})$/.exec(v.trim()); if (!m) return null; let h = m[1] || m[2].split("").map((c) => c + c).join(""); return h.toLowerCase(); };

function emitCss() {
  const lines = [":root {"];
  for (const t of flat) lines.push(`  ${t.name}: ${t.value};`);
  lines.push("}");
  writeFileSync(join(outDir, "theme", "tokens.css"), lines.join("\n") + "\n");
}
function emitTailwind() {
  const colObj = Object.fromEntries(colors.map((t) => [t.key, t.resolved]));
  const fontObj = Object.fromEntries(fonts.map((t) => [t.key, t.resolved.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""))]));
  const spaceObj = Object.fromEntries(spacing.filter((t) => ["spacing", "size"].includes(t.cls)).map((t) => [t.key, t.resolved]));
  const radObj = Object.fromEntries(flat.filter((t) => t.cls === "radius").map((t) => [t.key, t.resolved]));
  const cfg = { theme: { extend: { colors: colObj, fontFamily: fontObj, spacing: spaceObj, borderRadius: radObj } } };
  writeFileSync(join(outDir, "theme", "tailwind.config.js"),
    "/** Generated from the design's :root tokens. */\nmodule.exports = " + JSON.stringify(cfg, null, 2) + ";\n");
}
function emitSwiftui() {
  const lines = ["import SwiftUI", "", "// Generated design tokens. Color(hex:) values are converted from the design's :root.", "enum DesignTokens {"];
  lines.push("  // Colors");
  for (const t of colors) {
    const h = hex6(t.resolved);
    if (h) {
      const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
      lines.push(`  static let ${camel(t.key)} = Color(red: ${r.toFixed(3)}, green: ${g.toFixed(3)}, blue: ${b.toFixed(3)})`);
    } else lines.push(`  // ${camel(t.key)} = ${t.resolved}  (non-hex: set manually)`);
  }
  if (fonts[0]) { lines.push("  // Fonts"); for (const t of fonts) lines.push(`  static let ${camel(t.key)}Font = "${t.resolved.split(",")[0].trim().replace(/^['"]|['"]$/g, "")}"`); }
  lines.push("}");
  writeFileSync(join(outDir, "theme", "Theme.swift"), lines.join("\n") + "\n");
}
function emitFlutter() {
  const lines = ["import 'package:flutter/material.dart';", "", "// Generated design tokens from the design's :root.", "class DesignTokens {"];
  for (const t of colors) {
    const h = hex6(t.resolved);
    if (h) lines.push(`  static const ${camel(t.key)} = Color(0xFF${h.toUpperCase()});`);
    else lines.push(`  // ${camel(t.key)} = ${t.resolved}  (non-hex: set manually)`);
  }
  for (const t of fonts) lines.push(`  static const ${camel(t.key)}Font = '${t.resolved.split(",")[0].trim().replace(/^['"]|['"]$/g, "")}';`);
  lines.push("}");
  writeFileSync(join(outDir, "theme", "app_theme.dart"), lines.join("\n") + "\n");
}
function camel(k) { return k.replace(/[-_]+(.)/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, "_$1"); }

const EMIT = { css: emitCss, tailwind: emitTailwind, swiftui: emitSwiftui, flutter: emitFlutter };
for (const t of targets) EMIT[t]?.();

// ---- scaffold components.md (skeleton the agent fills) ----
const sections = [...html.matchAll(/<(section|header|footer|nav|main|aside)\b[^>]*>/gi)].map((m) => {
  const tag = m[1].toLowerCase();
  const idm = /\bid=["']([^"']+)["']/.exec(m[0]);
  const clm = /\bclass=["']([^"']+)["']/.exec(m[0]);
  return `- \`${tag}${idm ? "#" + idm[1] : ""}${clm ? "." + clm[1].split(" ")[0] : ""}\` — _(name this component, list its props/variants/states)_`;
});
writeFileSync(join(outDir, "components.md"), `# Components — ${basename(inPath)}

> SKELETON — the design skill fills this in. For each region: a component name, its props (with TS-ish types),
> variants, interactive states (hover/active/disabled/loading), responsive behavior, and which **tokens** it uses
> (reference tokens by name, e.g. \`color.accent\`, never raw hex).

## Breakpoints
Design these viewports (the reference uses ${breakpoints.length ? "@media at " + breakpoints.map((b) => b + "px").join(", ") : "fluid/clamp, no explicit @media"}):
- **390px** (mobile): single column, stacked, touch-friendly spacing, no horizontal scroll.
- **1280px** (desktop): full multi-column grids, expanded spacing.
${breakpoints.length ? "Shift layout at: " + breakpoints.map((b) => "≤" + b + "px").join(", ") + "." : "Add explicit breakpoints if the layout needs to shift."}

## Inventory (auto-detected regions — refine into real components)
${sections.join("\n") || "- _(no top-level regions detected — decompose from reference.html)_"}

## Per component (template)
### <ComponentName>
- **Element:** \`selector in reference.html\`
- **Description:** what it is / does
- **Props:** \`name: type\` …
- **Variants / states:** …
- **Tokens used:** \`color.…\`, \`space.…\`, \`fontSize.…\`
- **Responsive:** 390px (mobile) → 1280px (desktop) — what changes (columns, sizes, hidden/shown)
`);

// ---- interactions.md: detect interactive signals, scaffold the state/handlers/routes spec ----
const counts = {
  buttons: (html.match(/<button\b|class=["'][^"']*\bbtn\b|role=["']button["']/gi) || []).length,
  forms: (html.match(/<form\b/gi) || []).length,
  inputs: (html.match(/<(input|select|textarea)\b/gi) || []).length,
  links: (html.match(/<a\b[^>]*href=/gi) || []).length,
  scripts: (html.match(/<script\b(?![^>]*\bsrc=)/gi) || []).length,
  react: /text\/babel|react(-dom)?(\.|@)/i.test(html),
  screens: (html.match(/\?screen=|\/screens\//gi) || []).length,
  frames: (html.match(/\/frames\/[a-z-]+\.html/gi) || []).length,
  tweaks: /--motion|--density|EDITMODE-BEGIN|data-tweak/i.test(html),
  dataAttrs: [...new Set((html.match(/\bdata-[a-z-]+=/gi) || []).map((s) => s.toLowerCase()))],
  localStorage: /localStorage/.test(html),
};
const interactive = counts.buttons + counts.forms + counts.inputs + counts.scripts > 0 || counts.react || counts.screens > 0;
const tier = counts.screens > 1 ? "flow (multi-screen)" : counts.react || counts.scripts > 0 ? "stateful" : "static";
const intLines = [`# Interactions — ${basename(inPath)}`, "",
  "> SKELETON — the design skill fills this in so a frontend agent rebuilds the **behavior**, not just the visuals.",
  "> Reference \`reference.html\` for the working interactions; describe state, handlers, transitions, and navigation.", "",
  `## Detected`,
  `- **Interaction tier:** ${tier}`,
  `- buttons: ${counts.buttons} · forms: ${counts.forms} · inputs: ${counts.inputs} · links: ${counts.links}`,
  `- inline scripts: ${counts.scripts}${counts.react ? " · **React** (UMD+Babel) present" : ""}${counts.localStorage ? " · uses localStorage" : ""}`,
  `- screens/frames: ${counts.screens} screen refs, ${counts.frames} device frames${counts.tweaks ? " · **Tweaks** live-knobs panel present" : ""}`,
  counts.dataAttrs.length ? `- data-attributes: ${counts.dataAttrs.join(", ")}` : "",
  "",
  "## State model (fill in)",
  "For each stateful component: the state it owns + initial value.",
  "```",
  "TabBar      { activeTab: 'overview' | 'usage' | 'billing' = 'overview' }",
  "ThemeToggle { mode: 'light' | 'dark' = 'light' }   // persisted to localStorage",
  "```",
  "",
  "## Event handlers (fill in)",
  "`selector` → `event` → effect (state change / navigation / side-effect).",
  "```",
  ".tab            → click  → setActiveTab(tab)",
  ".theme-toggle   → change → setMode($value); localStorage['theme']=$value",
  "form.signup     → submit → validate(); POST /api/signup; show loading→success|error",
  "```",
  "",
  "## Navigation / routes (fill in — for flows)",
  counts.screens > 0
    ? "Map which element navigates to which screen.\n```\nscreens/01-onboarding.html  --[.next]-->  screens/02-paywall.html\nscreens/02-paywall.html     --[.subscribe]-->  screens/03-home.html\n```"
    : "_(single screen — no inter-screen navigation)_",
  "",
  "## Motion & a11y",
  "- Transitions/animations (durations; scale with `--motion-mult`; honor `prefers-reduced-motion`).",
  "- Keyboard: focus order, focus-visible, Esc/Enter behaviors. ARIA roles/labels for custom controls.",
  ""];
writeFileSync(join(outDir, "interactions.md"), intLines.filter((l) => l !== "").join("\n") + "\n");

// ---- HANDOFF.md (the AGENTS.md-style brief for the downstream frontend agent) ----
writeFileSync(join(outDir, "HANDOFF.md"), `# Design handoff — build this for real

You are a frontend engineer agent. Build the production app to **faithfully match \`reference.html\`** (open it —
it is the visual ground truth), using the design tokens in this folder. **Never hardcode colors/sizes/fonts —
always reference the tokens.**

## What's here
- **\`reference.html\`** — the approved design, self-contained. Your output must match it.
- **\`tokens.json\`** — the design tokens in [DTCG](https://www.designtokens.org) format (\`$value\`/\`$type\`,
  \`{alias}\` references). The single source of truth for color/type/spacing/radius.
- **\`theme/\`** — the tokens pre-mapped for your stack:${targets.map((t) => `\n  - \`${({ css: "tokens.css", tailwind: "tailwind.config.js", swiftui: "Theme.swift", flutter: "app_theme.dart" })[t]}\` (${t})`).join("")}
- **\`components.md\`** — the component inventory: names, props, variants, states, responsive rules, tokens used.
- **\`interactions.md\`** — the **behavior**: state model, event handlers, navigation/routes, motion + a11y. Rebuild
  these, not just the visuals.

## How to build
1. Wire the theme file for your stack into the project (Tailwind: merge \`tailwind.config.js\`; CSS: import
   \`tokens.css\`; SwiftUI/Flutter: add the tokens file). Use token names, not raw values.
2. Implement each component in \`components.md\` — match structure, props, states, and responsive behavior.
3. Wire the **interactions** in \`interactions.md\` — state, event handlers, navigation, transitions; honor
   \`prefers-reduced-motion\` and keyboard/ARIA. Diff behavior against \`reference.html\`.
4. Compose the page/screen to match \`reference.html\` (layout, spacing rhythm, hierarchy).
5. Verify against \`reference.html\` at mobile + desktop widths, and exercise the interactions. Keep the
   single-accent / restraint discipline.

## Target stack
${targets.join(", ")}  ·  (regenerate for another stack: \`hara-design handoff reference.html --target <stack>\`)
`);

console.log(`Handoff written → ${outDir}`);
console.log(`  tokens.json (${flat.length} tokens) · reference.html · theme/{${targets.join(",")}} · components.md · interactions.md (${tier}) · HANDOFF.md`);
