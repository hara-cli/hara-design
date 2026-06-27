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
import { readFile, stat } from "node:fs/promises";
import { watch } from "node:fs";
import { join, normalize, extname, dirname } from "node:path";
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
  // artifact dir
  const rel = path === "/" ? "index.html" : path.replace(/^\/+/, "");
  const abs = safeJoin(artifactDir, rel);
  if (abs && (await serveFile(res, abs, { injectReload: true }))) return;

  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><meta charset=utf-8><body style="font:16px system-ui;padding:3rem;color:#555">
    <h2>hara-design preview</h2><p>No <code>${rel}</code> in <code>${artifactDir}</code> yet.</p>
    <p>Waiting — the page reloads automatically when the file appears.</p>${LIVERELOAD}`);
});

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
