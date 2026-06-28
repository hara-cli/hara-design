#!/usr/bin/env node
// hara-design — local helper for the design plugin (preview + export without long node paths).
//
//   hara-design preview [dir] [--port N] [--open]   start the live-reload preview server on a design dir
//   hara-design export  <index.html> [--out f.pdf]  print an artifact to PDF (headless Chrome)
//   hara-design open    [dir] [--port N]            = preview --open
//
// `dir` defaults to: the newest .hara/design/<slug>/ under the cwd, else the cwd itself.
// Resolves preview/server.mjs + scripts/export.mjs relative to THIS file, so it works from the dev clone
// or the installed plugin copy regardless of where you run it.

import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
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

  hara-design install                              register this package as the hara design plugin
  hara-design init    [name]                       scaffold THIS directory as a design project (basic webpage)
  hara-design preview [dir] [--port N] [--open]    live preview server on a design dir
  hara-design open    [dir] [--port N]             preview + open the browser
  hara-design gallery [dir] [--global] [--port N]  browse all designs under a library root (read-only)
  hara-design export  <index.html> [--out f.pdf]   print an artifact to PDF
  hara-design handoff <index.html> [--target all|css|tailwind|swiftui|flutter] [--out dir]
                                                   emit an agent-consumable design handoff
                                                   (DTCG tokens + theme + components.md + HANDOFF.md)

dir defaults to the newest .hara/design/<slug>/ under the current directory.`);
}

// start the preview/gallery server on a dir; auto-open the browser when wantOpen
function startServer(dir, wantOpen, port) {
  const child = spawn("node", [join(root, "preview", "server.mjs"), "--dir", dir, "--port", port], { stdio: ["ignore", "pipe", "inherit"] });
  let opened = false;
  child.stdout.on("data", (b) => {
    const s = b.toString();
    process.stdout.write(s);
    if (wantOpen && !opened) {
      const m = /http:\/\/127\.0\.0\.1:\d+/.exec(s);
      if (m) {
        opened = true;
        const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        try { execFileSync(openCmd, [m[0]]); } catch { /* user can open manually */ }
      }
    }
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

if (cmd === "init") {
  const child = spawn("node", [join(root, "scripts", "init.mjs"), ...(positional() ? [positional()] : [])], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
} else if (cmd === "preview" || cmd === "open") {
  startServer(resolve(positional() || defaultDir()), cmd === "open" || flag("open"), opt("port", "4321"));
} else if (cmd === "gallery") {
  const dir = flag("global") ? join(homedir(), ".hara", "design") : resolve(positional() || join(process.cwd(), ".hara", "design"));
  startServer(dir, !flag("no-open"), opt("port", "4321"));
} else if (cmd === "export") {
  const inFile = positional();
  if (!inFile) { console.error("usage: hara-design export <index.html> [--out f.pdf]"); process.exit(2); }
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
  // register this package as a hara plugin (handy after `npm i -g @nanhara/hara-design`)
  const child = spawn("hara", ["plugin", "add", `file:${root}`], { stdio: "inherit" });
  child.on("error", () => { console.error("`hara` not found — install hara first: npm i -g @nanhara/hara"); process.exit(1); });
  child.on("exit", (code) => process.exit(code ?? 0));
} else if (cmd === "uninstall") {
  const child = spawn("hara", ["plugin", "remove", "design"], { stdio: "inherit" });
  child.on("error", () => { console.error("`hara` not found."); process.exit(1); });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  usage();
  process.exit(cmd ? 1 : 0);
}
