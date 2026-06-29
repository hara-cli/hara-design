# proto.js — the interactive-prototype contract

hara-design produces **playable prototypes**, not static mockups. Whenever a design has any interactive
control, **copy `proto.js` into the artifact dir** and load it (`<script src="proto.js"></script>` before
`</body>`), then wire controls with `data-*` attributes below. `proto.js` is **inert** if no hooks are present,
so a pure static page costs nothing.

> A design = a self-contained **directory**. Shipping `proto.js` beside `index.html` keeps it self-contained.

## The six primitives (wire markup, not bespoke JS)

| Want | Markup |
|---|---|
| **Screen / flow** | screens are `<section class="screen" data-route="home">`; any control navigates with `data-go="checkout"`. Back button: `data-go="__back"`. Hash-routing + browser-back come free. |
| **Tabs** | wrapper `[data-tab-group]`; triggers `[data-tab="panelId"]`; panels `[data-panel="panelId"]`. Active gets `.is-active`. |
| **Toggle / accordion / switch** | trigger `data-toggle="boxId"`; target `#boxId` gets `.is-open` (+ `aria-expanded`). |
| **Modal / sheet** | opener `data-open="sheetId"`; container `<div data-modal id="sheetId" hidden>`; closers `[data-close]`; backdrop-click + Esc also close. Open adds `.is-open`. |
| **Form feedback** | `<form data-form>` → submit fakes success (shows `[data-success]` or a toast); an empty `[required]` shows inline `[data-error]`. No network. |
| **Select / stepper** | group `[data-select-group]` with options `[data-select]` (one gets `.is-selected`); `[data-step="+1"]`/`"-1"` bumps the group's `[data-value]`. |
| **Toast** | `data-toast="Saved ✓"` on any control → a transient toast. (≥1 per flow — proof it did something.) |

Style the states yourself: `.is-active`, `.is-open`, `.is-selected`, and a **press** feel (`button:active{transform:scale(.98)}`), `:focus-visible`, and a `.proto-toast{ /* fixed, bottom-center */ }` + `.proto-toast.show{opacity:1}`.

## View modes (the preview drives these; you just author screens)
The read-only preview can switch how the screens lay out — **flow** (one screen, walk it), **grid** (all screens), **zoom** (one enlarged). You don't build the toggle; just make each screen a `[data-route]` section. `proto.js` exposes the current screen on `document.documentElement.dataset.route` and a `window.__proto.current()` getter so the preview always knows which screen you're on.

## The "No Dead Controls" rule (P0 — a prototype fails without it)
**Every element that LOOKS interactive must either be wired (a `data-*` above or a real `href`) OR be visibly,
intentionally static** (`data-static` + `aria-disabled="true"` + a disabled style, or a `· soon` affordance).
No control may look live and do nothing. Decorative chrome (status-bar glyphs, the device bezel) is `aria-hidden`.

The 8-item flow checklist — paste at the top of the artifact and tick before "ready":
`[ ] nav/tab switches [ ] screen→screen [ ] press feedback [ ] input echoes [ ] toggle works [ ] modal opens/closes [ ] list→detail [ ] ≥1 toast`

## Scope guard — real enough, not a real app
Happy-path only · realistic **static fixtures** (clearly sample data, never invented metrics) · **3–6 screens**
per flow (more → ask) · no backend / network / persistence (a `localStorage` theme toggle is the ceiling) ·
one motion flourish (the route transition is it). `prefers-reduced-motion` is respected by `proto.js`.
