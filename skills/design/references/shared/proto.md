# proto — the interactive-prototype contract (asset vs framework)

hara-design produces **playable prototypes**, not static mockups. **You author only the ASSET** — `<section
data-route data-screen-label>` screens + design-system tokens + the `data-*` hooks below + one
`<meta name="hara-preview">`. **The FRAMEWORK is injected by the preview** (the device bezel per platform, the
Grid board + 真机 views, and the `proto.js` runtime): you never write a bezel, a status bar, view-mode CSS, or
`proto.js`/`proto.css`. proto is **inert** if a page has no `data-route`/`data-*` hooks (a pure static page pays
nothing). On **export**, the frozen `proto.js`+`proto.css` are copied beside the asset so the delivered dir runs
standalone — still self-contained, but frozen, never agent-authored.

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

Style the states yourself: `.is-active`, `.is-open`, `.is-selected`, `:focus-visible`, and a `.proto-toast{ /* fixed, bottom-center */ }` + `.proto-toast.show{opacity:1}`.

**Motion (opt-in, zero-config — the framework provides these, honoring `prefers-reduced-motion`):**
| Want | Markup |
|---|---|
| **Stagger-in** a list/grid | add `data-stagger` to the container → its direct children rise (fade + slide-up) in sequence on show; re-fires when a screen re-shows |
| **Press feedback** | add `data-press` to a button/card → tap-scale (`:active` → scale .96) |

The screen→screen route change is the **one flourish** — `data-stagger`/`data-press` are subtle accents, not a reason to pile on more animation.

## View modes (the preview drives these; you just author screens)
The read-only preview toggles two layouts — **Grid** (a board of all screens as device cards; click a card → opens it) and **真机** (one screen in the device frame, tap CTAs to walk the flow). You don't build the toggle; just make each screen a `[data-route]` section. `proto.js` exposes the current screen on `document.documentElement.dataset.route` and a `window.__proto.current()` getter so the preview always knows which screen you're on. Export prints a one-page **一拼 contact sheet** (device thumbnails) — also framework, not authored.

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
