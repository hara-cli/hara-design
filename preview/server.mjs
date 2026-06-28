#!/usr/bin/env node
// hara-design live preview — a zero-dependency static server with live-reload, for the `design` skill.
//
// Serves a single artifact directory (where hara writes index.html + sibling assets) and the bundled device
// `frames/`, and pushes a browser reload over SSE whenever any file in the artifact dir changes. The agent
// writes/edits files; the user watches them update live in a real browser. localhost-only.
//
//   node server.mjs --dir <artifact dir> [--port 4321]
//
// Routing:
//   GET /                → <dir>/index.html  (livereload snippet injected before </body>)
//   GET /frames/<x>      → <repo>/frames/<x>  (device frames for multi-screen prototypes;
//                          reference screens root-absolute: ?screen=/screens/01.html)
//   GET /__livereload.js → the reload client     GET /__reload → SSE reload stream
//   GET /<path>          → <dir>/<path>          (sibling assets, screens/, css, images…)
//
// First stdout line is "Preview: http://127.0.0.1:<port>" so the launcher can read the chosen port.

import { createServer } from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import { watch } from "node:fs";
import { join, normalize, extname, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const framesDir = join(here, "..", "frames");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const artifactDir = normalize(arg("dir", process.cwd()));
const wantPort = parseInt(arg("port", "4321"), 10);

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
  ".ttf": "font/ttf", ".otf": "font/otf", ".mp4": "video/mp4", ".webm": "video/webm",
  ".mp3": "audio/mpeg", ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
};

const LIVERELOAD = `<script src="/__livereload.js"></script>`;

// keep the path inside its root — reject traversal
function safeJoin(root, urlPath) {
  const p = normalize(join(root, decodeURIComponent(urlPath)));
  return p.startsWith(root) ? p : null;
}

const sseClients = new Set();

async function serveFile(res, absPath, { injectReload = false } = {}) {
  let st;
  try {
    st = await stat(absPath);
  } catch {
    return false;
  }
  if (st.isDirectory()) absPath = join(absPath, "index.html");
  let buf;
  try {
    buf = await readFile(absPath);
  } catch {
    return false;
  }
  const ext = extname(absPath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  if (injectReload && ext === ".html") {
    let html = buf.toString("utf8");
    html = html.includes("</body>") ? html.replace("</body>", `${LIVERELOAD}</body>`) : html + LIVERELOAD;
    buf = Buffer.from(html, "utf8");
  }
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(buf);
  return true;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const path = url.pathname;

  if (path === "/__livereload.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    res.end(await readFile(join(here, "livereload.js")));
    return;
  }
  if (path === "/__reload") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write("retry: 1000\n\n");
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }
  if (path.startsWith("/frames/")) {
    const abs = safeJoin(framesDir, path.slice("/frames/".length));
    if (abs && (await serveFile(res, abs))) return;
  }
  // single-design dir → serve its index.html (+ subpaths). GET /<slug>/ opens a design from the library.
  const rel = path === "/" ? "index.html" : path.replace(/^\/+/, "");
  const abs = safeJoin(artifactDir, rel);
  if (abs && (await serveFile(res, abs, { injectReload: true }))) return;

  // library root (no index.html here, but <slug>/index.html subdirs) → a read-only gallery
  if (path === "/") {
    const gallery = await renderGallery(artifactDir);
    if (gallery) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(gallery);
      return;
    }
  }

  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><meta charset=utf-8><body style="font:16px system-ui;padding:3rem;color:#555">
    <h2>hara-design preview</h2><p>No <code>${rel}</code> in <code>${artifactDir}</code> yet.</p>
    <p>Waiting — the page reloads automatically when the file appears.</p>${LIVERELOAD}`);
});

// Read-only gallery: list <slug>/ subdirs that contain index.html (the design library). null if none.
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
async function renderGallery(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return null;
  }
  const cards = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const idx = join(root, e.name, "index.html");
    try {
      const st = await stat(idx);
      if (!st.isFile()) continue;
      const head = (await readFile(idx, "utf8")).slice(0, 2000);
      const m = /<title>([^<]*)<\/title>/i.exec(head);
      cards.push({ slug: e.name, title: (m && m[1].trim()) || e.name, mtime: st.mtimeMs });
    } catch {
      /* skip */
    }
  }
  if (!cards.length) return null;
  cards.sort((a, b) => b.mtime - a.mtime);
  const items = cards
    .map(
      (c) => `<a class="card" href="/${encodeURIComponent(c.slug)}/">
      <div class="thumb"><iframe src="/${encodeURIComponent(c.slug)}/index.html" tabindex="-1" scrolling="no" loading="lazy"></iframe></div>
      <div class="meta"><div class="t">${esc(c.title)}</div><div class="s">${esc(c.slug)}</div></div></a>`,
    )
    .join("\n");
  return `<!doctype html><meta charset=utf-8><title>Designs · hara-design</title>
<style>
 :root{--bg:#0c0d10;--fg:#e8eaed;--muted:#8b90a0;--border:#23262e;--card:#15171c}
 *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif}
 header{padding:26px 32px;border-bottom:1px solid var(--border)} header h1{margin:0;font-size:18px;font-weight:600}
 header p{margin:4px 0 0;color:var(--muted);font-size:13px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;padding:24px 32px}
 .card{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color .15s,transform .15s}
 .card:hover{border-color:#3a3f4b;transform:translateY(-2px)}
 .thumb{position:relative;aspect-ratio:16/10;overflow:hidden;background:#fff;border-bottom:1px solid var(--border)}
 .thumb iframe{position:absolute;top:0;left:0;width:1280px;height:800px;border:0;transform:scale(.219);transform-origin:top left;pointer-events:none}
 .meta{padding:11px 14px} .meta .t{font-weight:540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .meta .s{color:var(--muted);font-size:12px;font-family:ui-monospace,Menlo,monospace;margin-top:2px}
</style>
<header><h1>Designs</h1><p>${cards.length} design${cards.length > 1 ? "s" : ""} in ${esc(root)} — click to open &amp; edit (live-reloads)</p></header>
<div class="grid">${items}</div>${LIVERELOAD}`;
}

// debounced reload broadcast on any change in the artifact dir
let timer = null;
function broadcast() {
  for (const res of sseClients) {
    try {
      res.write("event: reload\ndata: 1\n\n");
    } catch {
      sseClients.delete(res);
    }
  }
}
try {
  watch(artifactDir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(broadcast, 80);
  });
} catch {
  // recursive watch unsupported → fall back to watching the dir non-recursively
  watch(artifactDir, () => {
    clearTimeout(timer);
    timer = setTimeout(broadcast, 80);
  });
}

function listen(port, triesLeft = 20) {
  server.once("error", (e) => {
    if (e.code === "EADDRINUSE" && triesLeft > 0) {
      listen(port + 1, triesLeft - 1);
    } else {
      console.error(`preview server error: ${e.message}`);
      process.exit(1);
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Preview: http://127.0.0.1:${port}`);
    console.log(`Watching: ${artifactDir}`);
  });
}
listen(Number.isFinite(wantPort) ? wantPort : 4321);
