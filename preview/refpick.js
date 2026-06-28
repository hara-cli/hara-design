// click-to-reference — inert until the device-preview chrome turns on "Inspect" (postMessage {haraInspect}).
// In inspect mode: hover highlights an element, click copies a STABLE, agent-readable reference to it
// (tag + #id + .class + a short text snippet) to the clipboard, so you can paste it into the hara CLI and say
// "make this smaller". The web stays read-only — this only EMITS a reference, it never edits.
(function () {
  var on = false;
  var last = null;

  function refOf(el) {
    var t = el.tagName ? el.tagName.toLowerCase() : "?";
    var id = el.id ? "#" + el.id : "";
    var cls = el.classList && el.classList.length ? "." + el.classList[0] : "";
    var txt = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
    return t + id + cls + (txt ? ' "' + txt + '"' : "");
  }

  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data.haraInspect === "undefined") return;
    on = !!e.data.haraInspect;
    document.documentElement.style.cursor = on ? "crosshair" : "";
    if (!on && last) { last.style.outline = ""; last = null; }
  });

  document.addEventListener(
    "mouseover",
    function (e) {
      if (!on) return;
      if (last) last.style.outline = "";
      last = e.target;
      if (last && last.style) last.style.outline = "2px solid #5b8cff";
    },
    true,
  );

  document.addEventListener(
    "click",
    function (e) {
      if (!on) return;
      e.preventDefault();
      e.stopPropagation();
      var r = refOf(e.target);
      try { navigator.clipboard.writeText(r); } catch (_) { /* clipboard may be blocked; toast still shows */ }
      try { parent.postMessage({ haraCopied: r }, "*"); } catch (_) {}
    },
    true,
  );
})();
