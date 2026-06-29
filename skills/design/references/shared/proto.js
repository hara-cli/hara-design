// proto.js — hara-design's FIXED prototype runtime (paired with proto.css). The design ASSET never ships this;
// the preview injects it and export copies it frozen. It (1) reads <meta name="hara-preview"> and BUILDS the
// device frame around the asset's <section data-route> screens, (2) wires interactivity declaratively via data-*,
// (3) drives the view modes (grid/flow/detail) + present. The asset is only screens + tokens + data-* hooks —
// it can't author the frame. Inert if the page has no [data-route] screens (a plain static page pays nothing).
// It only reacts to clicks INSIDE the artifact; it never talks to the agent (read-only preview boundary).
(function () {
  "use strict";
  var d = document, docEl = d.documentElement, hist = [];
  var screens = [].slice.call(d.querySelectorAll("[data-route]"));

  // ── 1. Build the device host from the hara-preview meta (framework, not asset) ──
  var FRAMES = { mobile: "mobile", miniprogram: "miniprogram", wxapp: "miniprogram", mweb: "mweb", mobileweb: "mweb",
                 web: "web", desktop: "web", responsive: "web", phone: "mobile", showcase: "web", tablet: "web" };
  var meta = ((d.querySelector('meta[name="hara-preview"]') || {}).content || "").toLowerCase();
  var parts = meta.split(/[\s,/]+/).filter(Boolean);
  var frame = "mobile";
  for (var i = 0; i < parts.length; i++) if (FRAMES[parts[i]]) { frame = FRAMES[parts[i]]; break; }
  var os = parts.indexOf("android") >= 0 ? "android" : "ios";
  var bare = parts.indexOf("none") >= 0;
  var domain = ((d.querySelector('meta[name="hara-preview-url"]') || {}).content || "preview.app");

  if (screens.length) {
    var stage = mk("div", "hara-stage"), frm = mk("div", "hara-frame"), chr = mk("div", "hara-chrome"), vp = mk("div", "hara-viewport");
    chr.innerHTML =
      '<div class="hara-statusbar"><span>9:41</span><span>●●●&nbsp;&nbsp;◔&nbsp;&nbsp;▮</span></div>' +
      '<div class="hara-capsule"></div>' +
      '<div class="hara-urlbar"><span>🔒</span><div class="pill">🔒 ' + esc(domain) + "</div></div>" +
      '<div class="hara-titlebar"><div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div><div class="url">' + esc(domain) + "</div></div>" +
      '<div class="hara-home"></div>';
    while (d.body.firstChild) vp.appendChild(d.body.firstChild); // move screens + app shell into the viewport
    frm.appendChild(chr); frm.appendChild(vp); stage.appendChild(frm); d.body.appendChild(stage);
    docEl.dataset.frame = frame; docEl.dataset.os = os; if (bare) docEl.dataset.chrome = "none";
    docEl.dataset.view = parts.indexOf("showcase") >= 0 ? "grid" : "flow";

    // FIXED designer PDF layout (shown only in print): a cover + each screen framed on its own page with its
    // label. Export inlines proto + prints this — a consistent, designer-grade page-by-page PDF (not an
    // agent-improvised deck). Built once from clones; never interactive.
    var pr = mk("div", "hara-print");
    pr.innerHTML = '<div class="hara-print-cover"><div class="t">' + esc((d.title || "Design")) + '</div><div class="s">' + esc(parts.join(" ")) + " · " + screens.length + " screens</div></div>";
    screens.forEach(function (s) {
      var pg = mk("div", "hara-print-page"), bz = mk("div", "hara-print-bezel"), lb = mk("div", "hara-print-label");
      var clone = s.cloneNode(true); clone.hidden = false; clone.classList.add("is-active");
      bz.appendChild(clone); lb.textContent = s.dataset.screenLabel || s.dataset.route;
      pg.appendChild(bz); pg.appendChild(lb); pr.appendChild(pg);
    });
    d.body.appendChild(pr);
  }

  // ── 2. routing ──
  function show(route, push) {
    var t = screens.filter(function (s) { return s.dataset.route === route; })[0] || screens[0];
    if (!t) return;
    if (push && t.dataset.route !== cur()) hist.push(cur());
    screens.forEach(function (s) { var on = s === t; s.hidden = false; s.classList.toggle("is-active", on); });
    if (docEl.dataset.view === "grid") { /* grid shows all */ } else screens.forEach(function (s) { s.hidden = s !== t; });
    t.scrollTop = 0;
    if ("#" + t.dataset.route !== location.hash) history.replaceState(null, "", "#" + t.dataset.route);
    docEl.dataset.route = t.dataset.route;
    post({ haraRoute: t.dataset.route, haraScreenLabel: t.dataset.screenLabel || "", haraView: docEl.dataset.view });
  }
  function cur() { var a = d.querySelector("[data-route].is-active") || screens[0]; return a ? a.dataset.route : ""; }
  if (screens.length) show((location.hash || "").slice(1) || screens[0].dataset.route, false);
  addEventListener("hashchange", function () { var r = location.hash.slice(1); if (r && r !== cur()) show(r, false); });

  // ── 3. view modes (the chrome toggles these via postMessage {haraView}) ──
  function setView(v) {
    if (!screens.length) return;
    docEl.dataset.view = v;
    if (v === "grid") screens.forEach(function (s) { s.hidden = false; s.classList.remove("is-active"); });
    else show(cur() || screens[0].dataset.route, false);
    post({ haraViewNow: v });
  }
  addEventListener("message", function (e) {
    if (!e.data) return;
    if (e.data.haraView) setView(e.data.haraView);
    if (e.data.haraGo === "next" || e.data.haraGo === "prev") step(e.data.haraGo === "next" ? 1 : -1);
    if (typeof e.data.haraPresent !== "undefined") docEl.dataset.present = e.data.haraPresent ? "1" : "";
  });
  function step(n) { var ks = screens.map(function (s) { return s.dataset.route; }); var i = ks.indexOf(cur()); var j = Math.max(0, Math.min(ks.length - 1, i + n)); show(ks[j], false); }

  // ── 4. one delegated click handler for every primitive ──
  d.addEventListener("click", function (e) {
    // grid: click a screen card (not an inner control) → jump into flow at that screen
    if (docEl.dataset.view === "grid") { var card = e.target.closest("[data-route]"); if (card) { setView("flow"); show(card.dataset.route, false); return; } }
    var go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); var r = go.dataset.go; if (r === "__back") { var p = hist.pop(); if (p) show(p, false); } else show(r, true); return; }
    var tab = e.target.closest("[data-tab]");
    if (tab) { var g = tab.closest("[data-tab-group]") || d; g.querySelectorAll("[data-tab]").forEach(function (t) { t.classList.toggle("is-active", t === tab); }); g.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== tab.dataset.tab; }); return; }
    var tog = e.target.closest("[data-toggle]");
    if (tog) { var b = d.getElementById(tog.dataset.toggle); if (b) { var o = b.classList.toggle("is-open"); tog.setAttribute("aria-expanded", o); } return; }
    var op = e.target.closest("[data-open]");
    if (op) { var m = d.getElementById(op.dataset.open); if (m) { m.classList.add("is-open"); m.hidden = false; } return; }
    if (e.target.closest("[data-close]") || e.target.matches("[data-modal]")) { var dm = e.target.closest("[data-modal]"); if (dm) { dm.classList.remove("is-open"); dm.hidden = true; return; } }
    var sel = e.target.closest("[data-select]");
    if (sel) { var sg = sel.closest("[data-select-group]") || d; sg.querySelectorAll("[data-select]").forEach(function (o) { o.classList.toggle("is-selected", o === sel); }); return; }
    var st = e.target.closest("[data-step]");
    if (st) { var sgp = st.closest("[data-select-group],[data-stepper]") || d, out = sgp.querySelector("[data-value]"); if (out) { out.dataset.value = (parseInt(out.dataset.value || out.textContent || "0", 10) || 0) + parseInt(st.dataset.step, 10); out.textContent = out.dataset.value; } return; }
    var ts = e.target.closest("[data-toast]"); if (ts) toast(ts.dataset.toast);
  });
  addEventListener("keydown", function (e) {
    if (e.key === "Escape") d.querySelectorAll("[data-modal].is-open").forEach(function (m) { m.classList.remove("is-open"); m.hidden = true; });
    if (docEl.dataset.present === "1") { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); }
  });

  // ── 5. forms: fake happy-path success; empty required → inline error (no network) ──
  d.addEventListener("submit", function (e) {
    var f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    var bad = [].slice.call(f.querySelectorAll("[required]")).filter(function (i) { return !String(i.value || "").trim(); });
    var err = f.querySelector("[data-error]"), ok = f.querySelector("[data-success]");
    if (bad.length) { if (err) err.hidden = false; bad[0].focus(); return; }
    if (err) err.hidden = true; if (ok) ok.hidden = false; else toast("Submitted ✓");
  });

  // ── helpers ──
  var tEl, tTimer;
  function toast(msg) { if (!tEl) { tEl = mk("div", "proto-toast"); d.body.appendChild(tEl); } tEl.textContent = msg; tEl.classList.add("show"); clearTimeout(tTimer); tTimer = setTimeout(function () { tEl.classList.remove("show"); }, 2400); }
  function mk(t, c) { var n = d.createElement(t); n.className = c; return n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function post(o) { try { parent.postMessage(o, "*"); } catch (_) {} }
  window.__proto = { current: cur, screens: screens.map(function (s) { return s.dataset.route; }), setView: setView };
})();
