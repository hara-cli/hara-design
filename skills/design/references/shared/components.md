# components — copy-paste vanilla snippets (for one-offs beyond the `data-*` primitives)

Most interactivity is a `data-*` primitive (see `proto.md`) — prefer those. For richer, self-contained widgets
that aren't worth a framework primitive, drop one of these vanilla snippets straight into a screen. Zero deps; they
work in the live preview AND the exported standalone HTML.

## Sparkline — prefer the primitive
Don't hand-roll a sparkline: use `<div data-sparkline="3,7,5,9,6,8" data-spark-color="#5b6cff" style="height:32px"></div>`.
The framework renders the SVG (gradient area + polyline). See `proto.md` → Data viz.

## Canvas sketch pad (freehand draw)
A pointer/touch drawing surface — for "draw your idea" / annotate / signature screens. Self-contained: the inline
`<script>` runs in the asset (it does NOT need proto.js). Resizes to its container; pen color/size are plain vars.

```html
<div class="sketch" style="position:relative">
  <canvas data-sketch style="width:100%;height:260px;display:block;border-radius:14px;background:#0f1117;touch-action:none"></canvas>
  <div class="sketch-tools" style="position:absolute;left:10px;bottom:10px;display:flex;gap:8px">
    <button type="button" data-sketch-color="#8b5cf6" style="width:22px;height:22px;border-radius:50%;border:2px solid #fff3;background:#8b5cf6"></button>
    <button type="button" data-sketch-color="#22d3ee" style="width:22px;height:22px;border-radius:50%;border:2px solid #fff3;background:#22d3ee"></button>
    <button type="button" data-sketch-clear style="padding:0 10px;border-radius:11px;border:0;background:#fff2;color:#fff;font:600 12px system-ui">清除</button>
  </div>
</div>
<script>
(function () {
  var cv = document.currentScript.parentElement.querySelector("[data-sketch]");
  var ctx = cv.getContext("2d"), drawing = false, color = "#8b5cf6", dpr = window.devicePixelRatio || 1;
  function fit() { var r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 3; }
  function pos(e) { var r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; }
  function start(e) { drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); }
  function move(e) { if (!drawing) return; var p = pos(e); ctx.strokeStyle = color; ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); }
  function end() { drawing = false; }
  fit(); addEventListener("resize", fit);
  ["mousedown", "touchstart"].forEach(function (t) { cv.addEventListener(t, start); });
  ["mousemove", "touchmove"].forEach(function (t) { cv.addEventListener(t, move); });
  ["mouseup", "mouseleave", "touchend"].forEach(function (t) { cv.addEventListener(t, end); });
  var box = cv.parentElement;
  box.querySelectorAll("[data-sketch-color]").forEach(function (b) { b.addEventListener("click", function () { color = b.dataset.sketchColor; }); });
  var clr = box.querySelector("[data-sketch-clear]"); if (clr) clr.addEventListener("click", function () { ctx.clearRect(0, 0, cv.width, cv.height); });
})();
</script>
```

Keep snippets rare and self-contained — if you reach for many, it probably wants a real `data-*` primitive in proto.js instead.
