# hara-design

**Design in the [hara](https://github.com/hara-cli/hara) CLI.** Talk to hara in your terminal; it generates
self-contained HTML — landing pages, dashboards, app prototypes, decks — in any of **138 brand-grade design
systems**, and you preview it **live in your browser**. You drive entirely from the CLI; the web is view-only
(no web-side chat).

It ships as a hara **plugin**: one `design` skill + a tiny live-reload preview server + a catalog of design
systems, skill recipes, craft rules, and device frames.

```
you (hara CLI) ──talk──▶ hara (the design engine)
                              │ writes index.html
                              ▼
                    .hara/design/<slug>/index.html
                              │ fs.watch
                              ▼
              preview/server.mjs ──live-reload──▶ your browser
```

## Install

```bash
hara plugin install file:/path/to/hara-design     # → ~/.hara/plugins/design
# then, in any hara session:
hara
> /design   # (or just describe what you want to design)
```

## How a session goes
1. You describe what you want ("a dark crypto-trading dashboard").
2. hara locks a quick brief (it asks a few questions in the CLI), picks/confirms a **design system**, and plans.
3. hara writes `index.html` to `.hara/design/<slug>/` and starts the preview server — open the printed URL.
4. You iterate by talking to hara ("make the hero bigger, narrow the sidebar") — the browser auto-reloads.
5. Before finalizing, hara self-checks against the recipe's P0 checklist + a 5-dimension critique (anti-AI-slop).

## What's inside
- `skills/design/SKILL.md` — the driver: the staged design quality workflow (brief → direction → plan → build →
  checklist → critique → emit), adapted to the CLI.
- `skills/design/references/design-systems/` — **138** `DESIGN.md` systems + an `INDEX.md` (regenerate with
  `node scripts/build-ds-index.mjs`).
- `skills/design/references/skills/` — **54** recipe `SKILL.md` (landing, dashboard, deck, mobile, report…).
- `skills/design/references/craft/` — anti-AI-slop / color / typography rules.
- `frames/` — pixel-accurate device frames (iPhone, Android, iPad, MacBook, browser) for multi-screen prototypes.
- `preview/server.mjs` — zero-dependency static + live-reload preview server.
- `scripts/build-ds-index.mjs` — regenerate the design-systems index. `scripts/export.mjs` — print to PDF.

## Credits / license
Apache-2.0. Design content + the design workflow are adapted from
[Open Design](https://github.com/nexu-io/open-design) (Apache-2.0) — see `NOTICE`.
