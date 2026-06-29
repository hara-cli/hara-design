// proto.js — hara-design's tiny prototype runtime. Inline this whole file in <script> before </body>.
// Zero deps, no build. It wires interactivity DECLARATIVELY via data-* attributes, so the design is a
// real (playable, happy-path) prototype — not a static mockup with dead controls. It is INERT when no
// data-* hooks are present (a pure static page pays nothing). It only ever reacts to clicks INSIDE the
// artifact — it never talks to the agent (that stays the CLI's job), so it respects the read-only preview.
//
// Primitives (see proto.md for the full contract):
//   route   <section class="screen" data-route="home">  +  [data-go="home"]  ( data-go="__back" pops history )
//   tabs    [data-tab-group]  >  [data-tab="id"]  +  [data-panel="id"]
//   toggle  [data-toggle="id"]      → flips .is-open + aria-expanded on #id
//   modal   [data-open="id"], [data-close], <div data-modal id="id">   (backdrop-click + Esc close)
//   form    <form data-form>        → submit fakes success; empty required → inline [data-error]
//   select  [data-select-group] > [data-select]   ·   [data-step="+1"] bumps the group's [data-value]
//   toast   [data-toast="Saved ✓"]  → transient toast (at least one per flow — feedback that it worked)
(function () {
  "use strict";
  var d = document;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hist = []; // route history for data-go="__back"

  // ── routing ────────────────────────────────────────────────────────────────
  var screens = [].slice.call(d.querySelectorAll("[data-route]"));
  function show(route, push) {
    var target = screens.filter(function (s) { return s.dataset.route === route; })[0] || screens[0];
    if (!target) return;
    if (push && target.dataset.route !== current()) hist.push(current());
    screens.forEach(function (s) {
      var on = s === target;
      s.hidden = !on;
      s.classList.toggle("is-active", on);
    });
    if (!reduce) { target.classList.remove("anim"); void target.offsetWidth; target.classList.add("anim"); }
    target.scrollTop = 0;
    if (("#" + target.dataset.route) !== location.hash) history.replaceState(null, "", "#" + target.dataset.route);
    d.documentElement.dataset.route = target.dataset.route; // exposed so the preview can read the current screen
  }
  function current() { return (d.querySelector("[data-route].is-active") || screens[0] || {}).dataset ? (d.querySelector("[data-route].is-active") || screens[0]).dataset.route : ""; }
  if (screens.length) show((location.hash || "").slice(1) || screens[0].dataset.route, false);
  addEventListener("hashchange", function () { var r = location.hash.slice(1); if (r) show(r, false); });

  // ── one delegated click handler for every primitive ─────────────────────────
  d.addEventListener("click", function (e) {
    var go = e.target.closest("[data-go]");
    if (go) { e.preventDefault(); var r = go.dataset.go; if (r === "__back") { var p = hist.pop(); if (p) show(p, false); } else show(r, true); return; }

    var tab = e.target.closest("[data-tab]");
    if (tab) {
      var group = tab.closest("[data-tab-group]") || d;
      group.querySelectorAll("[data-tab]").forEach(function (t) { t.classList.toggle("is-active", t === tab); t.setAttribute("aria-selected", t === tab); });
      group.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      return;
    }

    var tog = e.target.closest("[data-toggle]");
    if (tog) { var box = d.getElementById(tog.dataset.toggle); if (box) { var open = box.classList.toggle("is-open"); tog.setAttribute("aria-expanded", open); } return; }

    var op = e.target.closest("[data-open]");
    if (op) { var m = d.getElementById(op.dataset.open); if (m) { m.classList.add("is-open"); m.hidden = false; } return; }
    if (e.target.closest("[data-close]") || (e.target.matches("[data-modal]"))) {
      var dm = e.target.closest("[data-modal]"); if (dm) { dm.classList.remove("is-open"); dm.hidden = true; return; }
    }

    var sel = e.target.closest("[data-select]");
    if (sel) { var sg = sel.closest("[data-select-group]") || d; sg.querySelectorAll("[data-select]").forEach(function (o) { o.classList.toggle("is-selected", o === sel); o.setAttribute("aria-checked", o === sel); }); return; }

    var step = e.target.closest("[data-step]");
    if (step) { var sgp = step.closest("[data-select-group], [data-stepper]") || d; var out = sgp.querySelector("[data-value]"); if (out) { out.dataset.value = (parseInt(out.dataset.value || out.textContent || "0", 10) || 0) + parseInt(step.dataset.step, 10); out.textContent = out.dataset.value; } return; }

    var tst = e.target.closest("[data-toast]");
    if (tst) { toast(tst.dataset.toast); return; }
  });

  // Esc closes any open modal
  addEventListener("keydown", function (e) { if (e.key === "Escape") d.querySelectorAll("[data-modal].is-open").forEach(function (m) { m.classList.remove("is-open"); m.hidden = true; }); });

  // ── forms: fake happy-path success; empty required → inline error (no network) ──
  d.addEventListener("submit", function (e) {
    var f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
    var bad = [].slice.call(f.querySelectorAll("[required]")).filter(function (i) { return !String(i.value || "").trim(); });
    var err = f.querySelector("[data-error]"), ok = f.querySelector("[data-success]");
    if (bad.length) { if (err) { err.hidden = false; } bad[0].focus(); return; }
    if (err) err.hidden = true;
    if (ok) { ok.hidden = false; } else toast("Submitted ✓");
  });

  // ── toast ────────────────────────────────────────────────────────────────
  var tEl, tTimer;
  function toast(msg) {
    if (!tEl) { tEl = d.createElement("div"); tEl.className = "proto-toast"; d.body.appendChild(tEl); }
    tEl.textContent = msg; tEl.classList.add("show");
    clearTimeout(tTimer); tTimer = setTimeout(function () { tEl.classList.remove("show"); }, 2400);
  }

  // ── view modes (flow | grid | zoom): the read-only preview chrome can postMessage {haraView}; the
  // artifact switches how the screens lay out. Default = flow. Inert if the page has no [data-route] screens.
  function setView(v) {
    if (!screens.length) return;
    d.documentElement.dataset.view = v;
    if (v === "flow") { show(current() || screens[0].dataset.route, false); }
    else { screens.forEach(function (s) { s.hidden = false; s.classList.toggle("is-active", false); }); } // grid/zoom show all; CSS lays them out
  }
  addEventListener("message", function (e) { if (e.data && e.data.haraView) setView(e.data.haraView); });

  // expose a tiny read-only API the preview can poll (current screen → CLI context, never the reverse)
  window.__proto = { current: current, screens: screens.map(function (s) { return s.dataset.route; }) };
})();
