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
import { watch, existsSync } from "node:fs";
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
// The launcher detaches us (spawn detached + unref) right after reading the URL line, closing its read end
// of our stdout pipe. We never write stdout post-startup, but guard EPIPE so a stray write can't crash a
// backgrounded preview.
process.stdout.on("error", () => {});

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

const LIVERELOAD = `<script src="/__livereload.js"></script><script src="/__refpick.js"></script>`;

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
  if (path === "/__refpick.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    res.end(await readFile(join(here, "refpick.js")));
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
  // GET /__artifact → the design's index.html itself (loaded inside the device-preview iframe; live-reloads)
  if (path === "/__artifact") {
    const abs = safeJoin(artifactDir, "index.html");
    if (abs && (await serveFile(res, abs, { injectReload: true }))) return;
  }
  // GET / → device-preview chrome (single design: phone/tablet/desktop toggle) OR gallery (library root)
  if (path === "/") {
    if (existsSync(join(artifactDir, "index.html"))) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(await deviceChrome(artifactDir));
      return;
    }
    const gallery = await renderGallery(artifactDir);
    if (gallery) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(gallery);
      return;
    }
    // no index.html yet + not a library → a "designing…" placeholder that auto-upgrades to the device preview
    // the moment the agent writes index.html (so the web is meaningful the whole time the CLI works)
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(`<!doctype html><meta charset=utf-8><title>Designing… · hara-design</title>
<style>
 html,body{margin:0;height:100%;background:#0c0d10;color:#e8eaed;font:15px/1.6 system-ui,-apple-system,sans-serif}
 .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:2rem}
 .dot{width:38px;height:38px;border-radius:50%;border:3px solid #23262e;border-top-color:#5b8cff;animation:spin .9s linear infinite}
 @keyframes spin{to{transform:rotate(360deg)}}
 h1{font-size:19px;font-weight:600;margin:0} p{color:#8b90a0;margin:0;max-width:42ch}
 code{font-family:ui-monospace,Menlo,monospace;color:#aab1c4}
</style>
<div class="wrap"><div class="dot"></div>
 <h1>🎨 Designing…</h1>
 <p>Your design will appear here live as hara builds it. Keep driving in the terminal — this page updates on every change.</p>
 <p><code>${esc(artifactDir)}</code></p>
</div>${LIVERELOAD}`);
    return;
  }
  // any other path → the artifact dir (sibling assets, screens/, or <slug>/ opened from the gallery)
  const rel = path.replace(/^\/+/, "");
  const abs = safeJoin(artifactDir, rel);
  if (abs && (await serveFile(res, abs, { injectReload: true }))) return;

  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><meta charset=utf-8><body style="font:16px system-ui;padding:3rem;color:#555">
    <h2>hara-design preview</h2><p>No <code>${rel}</code> in <code>${artifactDir}</code> yet.</p>
    <p>Waiting — the page reloads automatically when the file appears.</p>${LIVERELOAD}`);
});

// Device-preview chrome: a toolbar (phone/tablet/desktop/full) wrapping the artifact in a resizable iframe
// (src=/__artifact, which live-reloads), so the user sees mobile + desktop effects with one click.
async function deviceChrome(root) {
  let title = "Preview";
  let device = ""; // <meta name="hara-preview" content="phone|tablet|desktop"> → fixed width, no toggle (not responsive)
  try {
    const head = (await readFile(join(root, "index.html"), "utf8")).slice(0, 4000);
    const tm = /<title>([^<]*)<\/title>/i.exec(head);
    if (tm && tm[1].trim()) title = tm[1].trim();
    const dm = /<meta\s+name=["']hara-preview["']\s+content=["']([^"']+)["']/i.exec(head);
    if (dm) device = dm[1].trim().toLowerCase();
  } catch {
    /* defaults */
  }
  const WIDTHS = { phone: 390, tablet: 834, desktop: 1280 };
  const fixed = Object.prototype.hasOwnProperty.call(WIDTHS, device);
  const defaultW = fixed ? WIDTHS[device] : 0; // 0 = Full. Default Full so a wide design is NEVER clipped at a fake 1280.
  const showToggle = !fixed; // a declared single device isn't responsive → just show it that way (no device switcher)
  const initLabel = defaultW ? defaultW + "px" : "Full";
  return `<!doctype html><meta charset=utf-8><title>${esc(title)} · preview</title>
<style>
 :root{--bg:#0c0d10;--bar:#15171c;--fg:#e8eaed;--muted:#8b90a0;--border:#23262e;--accent:#5b8cff}
 *{box-sizing:border-box} html,body{margin:0;height:100%}
 body{background:var(--bg);color:var(--fg);font:13px system-ui,-apple-system,sans-serif;display:flex;flex-direction:column}
 .bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--bar);border-bottom:1px solid var(--border)}
 .bar .title{font-weight:560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38vw}
 .bar .sp{flex:1}
 .seg{display:flex;background:#0f1116;border:1px solid var(--border);border-radius:8px;overflow:hidden}
 .seg button{appearance:none;background:transparent;color:var(--muted);border:0;padding:6px 12px;font:inherit;cursor:pointer}
 .seg button:hover{color:var(--fg)} .seg button.on{background:var(--accent);color:#fff}
 .w{font-family:ui-monospace,Menlo,monospace;color:var(--muted);min-width:62px;text-align:right}
 .stage{flex:1;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:18px}
 .frame{background:#fff;border:1px solid var(--border);border-radius:10px;overflow:hidden;box-shadow:0 24px 70px -34px #000;height:100%;transition:width .15s ease}
 .frame.full{border-radius:0;box-shadow:none;border:0}
 iframe{display:block;border:0;width:100%;height:100%;background:#fff}
 .ins{appearance:none;background:#0f1116;color:var(--muted);border:1px solid var(--border);border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer}
 .ins:hover{color:var(--fg)} .ins.on{background:var(--accent);color:#fff;border-color:var(--accent)}
 .toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#15171c;border:1px solid var(--border);color:var(--fg);padding:10px 14px;border-radius:9px;font-size:13px;max-width:80vw;box-shadow:0 16px 40px -20px #000;opacity:0;transition:opacity .2s;pointer-events:none}
 .toast.show{opacity:1} .toast code{font-family:ui-monospace,Menlo,monospace;color:#9fc1ff}
</style>
<div class="bar">
 <span class="title">${esc(title)}</span>
 ${showToggle ? `<div class="seg" id="seg">
  <button data-w="390">📱 Phone</button>
  <button data-w="834">▭ Tablet</button>
  <button data-w="1280">🖥 Desktop</button>
  <button data-w="0" class="on">↔ Full</button>
 </div>` : ""}
 <button class="ins" id="insp" title="Click an element to copy a reference you can paste into hara">🔎 Inspect</button>
 <span class="sp"></span><span class="w" id="w">${initLabel}</span>
</div>
<div class="stage"><div class="frame ${defaultW ? "" : "full"}" id="frame" style="width:${defaultW ? defaultW + "px" : "100%"}"><iframe id="pv" src="/__artifact"></iframe></div></div>
<div class="toast" id="toast"></div>
<script>
 var frame=document.getElementById('frame'),wl=document.getElementById('w'),seg=document.getElementById('seg');
 var pv=document.getElementById('pv'),insp=document.getElementById('insp'),toast=document.getElementById('toast'),tt;
 function set(w){
   if(w&&w>0){frame.style.width=w+'px';frame.classList.remove('full');wl.textContent=w+'px';}
   else{frame.style.width='100%';frame.classList.add('full');wl.textContent='Full';}
   if(seg)[].forEach.call(seg.children,function(b){b.classList.toggle('on',String(w)===b.dataset.w);});
   try{localStorage.setItem('hara-design-w',String(w));}catch(e){}
 }
 if(seg)seg.addEventListener('click',function(e){var b=e.target.closest('button');if(b)set(parseInt(b.dataset.w,10));});
 var inspecting=false;
 function tellFrame(){try{pv.contentWindow.postMessage({haraInspect:inspecting},'*');}catch(e){}}
 insp.addEventListener('click',function(){inspecting=!inspecting;insp.classList.toggle('on',inspecting);tellFrame();
   if(inspecting)showToast('Inspect on — click an element to copy a reference for hara');});
 pv.addEventListener('load',tellFrame); // re-arm after live-reload
 function showToast(html){toast.innerHTML=html;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('show');},3200);}
 window.addEventListener('message',function(e){if(e.data&&e.data.haraCopied){showToast('Copied → paste into hara: <code>'+String(e.data.haraCopied).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];})+'</code>');}});
 var DEFAULT_W=${defaultW}, SHOW_TOGGLE=${showToggle};
 if(SHOW_TOGGLE){var s=parseInt((function(){try{return localStorage.getItem('hara-design-w');}catch(e){return null;}})()||String(DEFAULT_W),10);set(isNaN(s)?DEFAULT_W:s);}
 else{set(DEFAULT_W);} // fixed device declared via hara-preview meta → show at that width, ignore the global toggle pref
</script>`;
}

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
