#!/usr/bin/env node
// hara-design init — scaffold the CURRENT directory as a standalone design project. The directory IS the
// deliverable asset: a basic index.html starter you design via hara, preview live, and hand off / export / commit.

import { existsSync, copyFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = process.cwd();
const name = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : basename(cwd);

const indexPath = join(cwd, "index.html");
if (existsSync(indexPath)) {
  console.error(`index.html already exists in ${cwd} — not overwriting. (Design it with hara, or 'hara-design open .')`);
  process.exit(1);
}

// basic webpage = the web-prototype seed (tokens + class system, neutral + ready to compose); minimal fallback if absent
const seed = join(root, "skills", "design", "references", "skills", "web-prototype", "assets", "template.html");
if (existsSync(seed)) {
  copyFileSync(seed, indexPath);
} else {
  writeFileSync(
    indexPath,
    `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/><title>${name}</title>
<style>
:root{--bg:#ffffff;--fg:#111418;--muted:#6b7280;--accent:#3358ff;--font-display:Georgia,serif;--font-body:system-ui,-apple-system,sans-serif}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font-family:var(--font-body)}
.hero{text-align:center;padding:2rem}h1{font-family:var(--font-display);font-size:clamp(36px,7vw,72px);letter-spacing:-.03em;margin:0}
p{color:var(--muted);margin-top:1rem}
</style></head>
<body><div class="hero"><h1>${name}</h1><p>A hara-design project — describe what you want in hara to build it out.</p></div></body></html>
`,
  );
}

const readme = join(cwd, "README.md");
if (!existsSync(readme)) {
  writeFileSync(
    readme,
    `# ${name}

A **hara-design** project. The design lives in \`index.html\` — this directory is the deliverable asset.

- **Design it:** run \`hara\` and describe what you want (or \`/design\`). hara edits \`index.html\`.
- **Preview:** \`hara-design open .\` — opens the browser and live-reloads as you edit.
- **Deliver:**
  - \`hara-design export index.html\` → PDF
  - \`hara-design handoff index.html --target tailwind\` → an agent-buildable handoff (DTCG tokens + theme + specs)
  - or just commit / share this folder — it's self-contained.
`,
  );
}

console.log(`Initialized design project "${name}" in ${cwd}`);
console.log(`  index.html (basic starter) + README.md`);
console.log(`Next:  hara  → describe your design   ·   hara-design open .  → live preview`);
