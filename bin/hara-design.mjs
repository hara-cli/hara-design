#!/usr/bin/env node
// hara-design — local helper for the design plugin (preview + export without long node paths).
//
//   hara-design preview [dir] [--port N] [--open]   start the live-reload preview server on a design dir
//   hara-design export  <index.html> [--out f.html]  bundle a self-contained interactive HTML (no Chrome)
//   hara-design open    [dir] [--port N]            = preview --open
//
// `dir` defaults to: the newest .hara/design/<slug>/ under the cwd, else the cwd itself.
// Resolves preview/server.mjs + scripts/export.mjs relative to THIS file, so it works from the dev clone
// or the installed plugin copy regardless of where you run it.

import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync, lstatSync, readlinkSync, mkdirSync, symlinkSync, rmSync, cpSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [cmd, ...rest] = process.argv.slice(2);

function flag(name) {
  const i = rest.indexOf(`--${name}`);
  return i >= 0;
}
function opt(name, def) {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : def;
}
function positional() {
  const valueFlags = new Set(["port", "out", "target"]);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) continue;
    const prev = rest[i - 1];
    if (prev && prev.startsWith("--") && valueFlags.has(prev.slice(2))) continue; // skip a flag's value
    return a;
  }
  return undefined;
}

// newest .hara/design/<slug>/ under cwd, else cwd
function defaultDir() {
  const base = join(process.cwd(), ".hara", "design");
  if (existsSync(base)) {
    const dirs = readdirSync(base)
      .map((d) => join(base, d))
      .filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } })
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    if (dirs[0]) return dirs[0];
  }
  return process.cwd();
}

function usage() {
  console.log(`hara-design — local helper for the design plugin

  hara-design install            [--claude|--codex] install the design skill into a CLI:
                                                     (no flag) → register as a hara plugin
                                                     --claude  → link skills/design → ~/.claude/skills/design
                                                     --codex   → link skills/design → ~/.agents/skills/design
                                   add --copy to copy instead of symlink · --force to replace an existing dir
  hara-design uninstall          [--claude|--codex] undo the matching install (safe: only removes our own link/copy)
  hara-design init    [name]                       scaffold THIS directory as a design project (basic webpage)
  hara-design preview [dir] [--port N] [--open]    live preview server on a design dir
  hara-design open    [dir] [--port N]             preview + open the browser
  hara-design gallery [dir] [--global] [--port N]  browse all designs under a library root (read-only)
  hara-design export  <index.html> [--out f.html]   bundle a self-contained interactive HTML
  hara-design handoff <index.html> [--target all|css|tailwind|swiftui|flutter] [--out dir]
                                                   emit an agent-consumable design handoff
                                                   (DTCG tokens + theme + components.md + HANDOFF.md)

dir defaults to the newest .hara/design/<slug>/ under the current directory.`);
}

// start the preview/gallery server on a dir; auto-open the browser when wantOpen
// Launch the preview server DETACHED, then exit. The server is long-running; if we stayed attached,
// `hara-design open` would block forever — which HANGS an agent's turn when the design skill launches it
// (the bug Jeff hit: "/design … working 100s"). So: spawn detached, read the chosen URL off stdout, open
// the browser, print it, unref + exit. The server keeps running in the background; `hara-design stop` ends it.
function startServer(dir, wantOpen, port, catalog) {
  // Free the requested port first so a re-open REPLACES a stale server (running servers don't pick up new code;
  // otherwise the old one keeps the port and you keep seeing old output — the bug Jeff kept hitting).
  try { execFileSync("bash", ["-c", `lsof -ti:${port} 2>/dev/null | xargs kill -9 2>/dev/null`], { stdio: "ignore", timeout: 4000 }); } catch { /* nothing on the port */ }
  // And kill any server already previewing the SAME dir on another port — EADDRINUSE port-bumping used
  // to leave strays accumulating (three background servers on one machine was a real report).
  try { execFileSync("pkill", ["-f", `preview/server\.mjs --dir ${dir}( |$)`], { stdio: "ignore", timeout: 4000 }); } catch { /* none */ }
  const sargs = [join(root, "preview", "server.mjs"), "--dir", dir, "--port", port];
  if (catalog) sargs.push("--catalog");
  const child = spawn("node", sargs, {
    stdio: ["ignore", "pipe", "ignore"],
    detached: true,
  });
  let done = false;
  const finish = (url) => {
    if (done) return;
    done = true;
    if (url && wantOpen) {
      const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      try { execFileSync(openCmd, [url]); } catch { /* user can open manually */ }
    }
    console.log(url ? `Preview: ${url}  ·  running in background — stop with: hara-design stop` : "Preview server started in background.");
    try { child.stdout.destroy(); } catch {}
    child.unref();
    process.exit(0);
  };
  child.stdout.on("data", (b) => {
    const m = /http:\/\/127\.0\.0\.1:\d+/.exec(b.toString());
    if (m) finish(m[0]);
  });
  child.on("error", () => finish(null));
  setTimeout(() => finish(null), 5000); // safety net: detach even if the URL line never arrives
}

// ── Skill install adapters (Claude Code + Codex) ──────────────────────────────
// The bundled skill is skills/design/ (CLI-agnostic SKILL.md + references/). We expose it to a
// host CLI by placing it where that CLI discovers user skills. Symlink by default (so `npm update`
// / a fresh build is picked up with no re-install); --copy makes a standalone copy.
const skillSrc = join(root, "skills", "design"); // the source skill dir shipped in this package

// ~/.claude/skills/design  — Claude Code user skill dir.
function claudeSkillDir() { return join(homedir(), ".claude", "skills", "design"); }
// ~/.agents/skills/design  — Codex user-installed skill dir (verified against codex-rs skill loader:
// user scope discovers $HOME/.agents/skills and follows symlinked skill directories).
function codexSkillDir() { return join(homedir(), ".agents", "skills", "design"); }

// Is `p` a symlink that already points at our source skill dir? (idempotency check)
function pointsAtSource(p) {
  try {
    if (!lstatSync(p).isSymbolicLink()) return false;
    return realpathSync(p) === realpathSync(skillSrc);
  } catch { return false; }
}

// Check the `hara-design` command itself is reachable on PATH; print a hint if not.
function checkOnPath() {
  try { execFileSync("bash", ["-c", "command -v hara-design"], { stdio: "ignore" }); return true; }
  catch { return false; }
}

function installSkillInto(dest, label) {
  if (!existsSync(skillSrc)) {
    console.error(`Cannot find the bundled skill at ${skillSrc} — is this a complete install of @nanhara/hara-design?`);
    process.exit(1);
  }
  const useCopy = flag("copy");
  const force = flag("force");

  // Already correctly linked → nothing to do (idempotent).
  if (!useCopy && pointsAtSource(dest)) {
    console.log(`✓ ${label}: already linked  (${dest} → ${skillSrc})`);
    return printNextSteps(dest, label);
  }

  // Something is already at `dest`. NEVER blind-delete a user's files.
  if (existsSync(dest) || isBrokenSymlink(dest)) {
    const isOurs = pointsAtSource(dest) || isBrokenOurSymlink(dest);
    if (!force && !isOurs) {
      console.error(`✗ ${label}: ${dest} already exists and is not managed by hara-design.`);
      console.error(`  Refusing to overwrite. Re-run with --force to replace it, or move it aside first.`);
      process.exit(1);
    }
    // Ours (stale link) or --force: safe to remove and recreate.
    try { rmSync(dest, { recursive: true, force: true }); }
    catch (e) { console.error(`✗ ${label}: could not remove existing ${dest}: ${e.message}`); process.exit(1); }
  }

  mkdirSync(dirname(dest), { recursive: true });
  try {
    if (useCopy) {
      cpSync(skillSrc, dest, { recursive: true, dereference: true });
      console.log(`✓ ${label}: copied skill → ${dest}`);
    } else {
      symlinkSync(skillSrc, dest, "dir");
      console.log(`✓ ${label}: linked skill  ${dest} → ${skillSrc}`);
    }
  } catch (e) {
    console.error(`✗ ${label}: install failed: ${e.message}`);
    process.exit(1);
  }
  printNextSteps(dest, label);
}

function isBrokenSymlink(p) {
  try { lstatSync(p); return !existsSync(p); } catch { return false; }
}
function isBrokenOurSymlink(p) {
  // a dangling symlink we can't resolve — treat as ours only if its target string is our source
  try { return lstatSync(p).isSymbolicLink() && readlinkSync(p) === skillSrc; } catch { return false; }
}

function uninstallSkillFrom(dest, label) {
  if (!existsSync(dest) && !isBrokenSymlink(dest)) {
    console.log(`${label}: nothing installed at ${dest}.`);
    return;
  }
  const ours = pointsAtSource(dest) || isBrokenOurSymlink(dest);
  if (!ours && !flag("force")) {
    console.error(`✗ ${label}: ${dest} is not a hara-design link (looks like your own files). Not removing.`);
    console.error(`  If you really want it gone, remove it yourself or re-run with --force.`);
    process.exit(1);
  }
  try { rmSync(dest, { recursive: true, force: true }); console.log(`✓ ${label}: removed ${dest}`); }
  catch (e) { console.error(`✗ ${label}: could not remove ${dest}: ${e.message}`); process.exit(1); }
}

function printNextSteps(dest, label) {
  console.log("");
  console.log(`Next steps (${label}):`);
  if (label === "Claude Code") {
    console.log(`  • Restart Claude Code (or start a new session) so it picks up the new skill.`);
    console.log(`  • Then ask it to "design a landing page…", or invoke /design.`);
  } else {
    console.log(`  • Start a new Codex session so it discovers the skill under ~/.agents/skills/.`);
    console.log(`  • Then ask it to "design a landing page…", or reference $design.`);
  }
  console.log(`  • The 'design' skill launches preview/export via the 'hara-design' command on your PATH.`);
  if (!checkOnPath()) {
    console.log("");
    console.log(`  ⚠ 'hara-design' is not on your PATH yet. Install it globally so the skill can call it:`);
    console.log(`      npm i -g @nanhara/hara-design`);
  }
}

if (cmd === "init") {
  const child = spawn("node", [join(root, "scripts", "init.mjs"), ...(positional() ? [positional()] : [])], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
} else if (cmd === "preview" || cmd === "open") {
  const explicit = positional();
  const dir = resolve(explicit || defaultDir());
  // Guard (Dongqin's bug): with no explicit dir and nothing design-like here, defaultDir() used to
  // fall back to cwd — launched from $HOME that meant serving AND recursively WATCHING the whole home
  // directory ("no designs yet" page + the preview flashing on every unrelated file change).
  const looksLikeDesign = existsSync(join(dir, "index.html")) || existsSync(join(dir, ".hara", "design"));
  if (!explicit && !looksLikeDesign) {
    console.error(`✗ No design found under ${dir}.`);
    console.error(`  Start one:            hara-design init            (scaffold this directory)`);
    console.error(`  Or preview a design:  hara-design open <dir>      (a dir with an index.html)`);
    process.exit(2);
  }
  if (dir === homedir() && !existsSync(join(dir, "index.html"))) {
    console.error("✗ Refusing to serve your home directory (recursive file-watching the whole home makes the preview flash nonstop). Pass a design dir.");
    process.exit(2);
  }
  startServer(dir, cmd === "open" || flag("open"), opt("port", "4321"));
} else if (cmd === "gallery") {
  const dir = flag("global") ? join(homedir(), ".hara", "design") : resolve(positional() || join(process.cwd(), ".hara", "design"));
  startServer(dir, !flag("no-open"), opt("port", "4321"));
} else if (cmd === "systems" || cmd === "templates") {
  // visual design-system catalog — browse all systems by palette, click a card to copy its id for hara
  startServer(process.cwd(), true, opt("port", "4321"), true);
} else if (cmd === "stop") {
  // kill background preview server(s) started by `open`/`preview`/`gallery`
  const child = spawn("pkill", ["-f", join(root, "preview", "server.mjs")], { stdio: "ignore" });
  child.on("exit", (code) => { console.log(code === 0 ? "Stopped the preview server." : "No preview server running."); process.exit(0); });
  child.on("error", () => { console.log("No preview server running."); process.exit(0); });
} else if (cmd === "export") {
  const inFile = positional();
  if (!inFile) { console.error("usage: hara-design export <index.html> [--out f.html]"); process.exit(2); }
  const args = [join(root, "scripts", "export.mjs"), "--in", inFile];
  const out = opt("out");
  if (out) args.push("--out", out);
  const child = spawn("node", args, { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
} else if (cmd === "handoff") {
  const inFile = positional();
  if (!inFile) { console.error("usage: hara-design handoff <index.html> [--out dir] [--target all|css|tailwind|swiftui|flutter]"); process.exit(2); }
  const args = [join(root, "scripts", "handoff.mjs"), "--in", inFile];
  const out = opt("out"); if (out) args.push("--out", out);
  const target = opt("target"); if (target) args.push("--target", target);
  const child = spawn("node", args, { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
} else if (cmd === "install") {
  // Install the bundled `design` skill into a CLI. Default (no flag) = register as a hara plugin.
  // --claude → ~/.claude/skills/design ; --codex → ~/.agents/skills/design (codex's user skill dir).
  if (flag("claude")) installSkillInto(claudeSkillDir(), "Claude Code");
  else if (flag("codex")) installSkillInto(codexSkillDir(), "Codex");
  else {
    const child = spawn("hara", ["plugin", "add", `file:${root}`], { stdio: "inherit" });
    child.on("error", () => { console.error("`hara` not found — install hara first: npm i -g @nanhara/hara"); process.exit(1); });
    child.on("exit", (code) => process.exit(code ?? 0));
  }
} else if (cmd === "uninstall") {
  if (flag("claude")) uninstallSkillFrom(claudeSkillDir(), "Claude Code");
  else if (flag("codex")) uninstallSkillFrom(codexSkillDir(), "Codex");
  else {
    const child = spawn("hara", ["plugin", "remove", "design"], { stdio: "inherit" });
    child.on("error", () => { console.error("`hara` not found."); process.exit(1); });
    child.on("exit", (code) => process.exit(code ?? 0));
  }
} else {
  usage();
  process.exit(cmd ? 1 : 0);
}
