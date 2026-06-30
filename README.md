# hara-design

**Design from your terminal — in [hara](https://github.com/hara-cli/hara), Claude Code, or Codex.** Describe what
you want; your agent generates self-contained, interactive HTML — landing pages, dashboards, app prototypes, decks
— in any of **150 brand-grade design systems**, previewed **live in your browser**. You drive entirely from the
CLI; the web is a view-only preview (no web-side chat).

It ships as an installable **skill**: the `design` skill + a tiny live-reload preview server + a catalog of design
systems, skill recipes, craft rules, and device frames — one shared core, a thin adapter per CLI.

![A landing page the design skill generated from a one-line brief in the linear-app design system](docs/demo-nimbus.png)

> Above: generated end-to-end from a one-line brief in the `linear-app` system, rendered live in the preview.

```
you (hara CLI) ──talk──▶ hara (the design engine)
                              │ writes index.html
                              ▼
                    .hara/design/<slug>/index.html
                              │ fs.watch
                              ▼
              preview/server.mjs ──live-reload──▶ your browser
```

## Install — works in hara, Claude Code, or Codex

The same `design` skill runs under any agent CLI. They all share **one core**: the `hara-design` command
(preview / export / handoff) + the `skills/design/` skill (SKILL.md + 150 design systems + recipes). Pick your host:

| Host | Install |
|---|---|
| **hara** | `hara plugin add github:hara-cli/hara-design` |
| **Claude Code** | `npm i -g @nanhara/hara-design` then `hara-design install --claude` |
| **Codex** | `npm i -g @nanhara/hara-design` then `hara-design install --codex` |

```bash
# hara — installs the skill into ~/.hara/plugins/design AND links `hara-design` into ~/.hara/bin
hara plugin add github:hara-cli/hara-design
echo 'export PATH="$HOME/.hara/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc   # one-time, command on PATH
# (developing a clone: hara plugin add file:~/work/projects/hara/hara-design)

# Claude Code — global command, then link the skill into ~/.claude/skills/design
npm i -g @nanhara/hara-design
hara-design install --claude       # symlinks skills/design → ~/.claude/skills/design (restart Claude Code)

# Codex — global command, then link the skill into ~/.agents/skills/design (Codex's user skill dir)
npm i -g @nanhara/hara-design
hara-design install --codex        # symlinks skills/design → ~/.agents/skills/design (new Codex session)
```

`install --claude` / `--codex` **symlink** the skill (a later `npm update` is picked up automatically); add
`--copy` for a standalone copy, `--force` to replace an existing dir. They never delete files they didn't create.
Undo with `hara-design uninstall --claude` / `--codex`. Bare `hara-design install` (no flag) registers the hara plugin.
After install, the `design` skill always launches preview/export via the `hara-design` command on your PATH, so
**every host needs `hara-design` reachable** — `npm i -g @nanhara/hara-design` (Claude Code / Codex) or hara's `~/.hara/bin` link.

> **Where does `hara-design` come from?** It's **this plugin/package** — *not* bundled with `hara` (the CLI) itself.
> `hara plugin add` links it into `~/.hara/bin`; `npm i -g @nanhara/hara-design` installs it the npm way. You don't
> strictly need it: inside hara just use `/design` (the agent calls the scripts by path); for manual preview/export
> you can always run `node ~/.hara/plugins/design/{preview/server.mjs,scripts/export.mjs}` directly.

Verify: `hara doctor` lists `design` under skills + plugins (hara); for Claude Code / Codex, the new session lists
the `design` skill and `hara-design` runs from your shell.

## Local workflow — open · develop · export

**1. Design — talk to your agent** (in any hara / Claude Code / Codex session):
```
hara
> a dark, modern-minimal landing page for a developer log-search tool, use the linear-app design system
```
hara locks a short brief, picks/confirms a **design system**, writes `index.html` to `.hara/design/<slug>/`,
and starts the live preview — open the printed `http://127.0.0.1:<port>`.

**A design is a self-contained directory = the deliverable asset.** Two ways to keep them:
- *Embedded* — `.hara/design/<slug>/` inside an existing project (a design alongside code).
- *Standalone project* — make the current directory itself the design (the whole dir IS the asset):
  ```bash
  hara-design init [name]   # scaffold THIS dir: a basic index.html + README, ready to design & deliver
  ```

**2. Open / preview / browse**:
```bash
hara-design open                 # newest .hara/design/<slug> under cwd, opens the browser
hara-design preview ./path/to/dir --port 4321
hara-design gallery [--global]   # browse ALL your designs (read-only library); --global = ~/.hara/design
```
The preview hot-reloads on every file change; the gallery lists every design with a live thumbnail (click to open & edit).

**3. Develop / iterate** — just talk to your agent ("make the hero bigger, narrow the sidebar"); each edit auto-reloads
the browser. Before finalizing, the skill self-checks against the recipe's **P0 checklist + a 5-dimension critique**
(anti-AI-slop). Add your own systems/recipes under `skills/design/references/` (then `npm run build-index`).

**4. Export & handoff**:
```bash
# Self-contained interactive HTML (frozen proto inlined; opens anywhere, no server/Chrome)
hara-design export  .hara/design/<slug>/index.html [--out out.html]

# Agent handoff — hand the design to a FRONTEND CODING AGENT to build the production app:
hara-design handoff .hara/design/<slug>/index.html --target tailwind   # or css | swiftui | flutter | all
```
`handoff` emits a `handoff/` folder a downstream agent can build from:
- `reference.html` — the design (visual ground truth)
- `tokens.json` — design tokens in [DTCG](https://www.designtokens.org) format (`{alias}` refs)
- `theme/<target>` — tokens pre-mapped for your stack (`tailwind.config.js` / `tokens.css` / `Theme.swift` / `app_theme.dart`)
- `components.md` + `HANDOFF.md` — the skill fills these with the component breakdown + build instructions, so a
  frontend agent reads the folder and rebuilds the app faithfully, using token references (never raw values).

## What's inside
- `skills/design/SKILL.md` — the driver: the staged design quality workflow (brief → direction → plan → build →
  checklist → critique → emit), adapted to the CLI.
- `skills/design/references/design-systems/` — **150** `DESIGN.md` systems + an `INDEX.md` (regenerate with
  `node scripts/build-ds-index.mjs`).
- `skills/design/references/skills/` — **219** recipe `SKILL.md` (landing, dashboard, deck, mobile, report…).
- `skills/design/references/craft/` — anti-AI-slop / color / typography rules.
- `frames/` — pixel-accurate device frames (iPhone, Android, iPad, MacBook, browser) for multi-screen prototypes.
- `preview/server.mjs` — zero-dependency static + live-reload preview server.
- `scripts/build-ds-index.mjs` — regenerate the design-systems index. `scripts/export.mjs` — bundle a self-contained interactive HTML.

## Credits / license
Apache-2.0. Design content + the design workflow are adapted from
[Open Design](https://github.com/nexu-io/open-design) (Apache-2.0) — see `NOTICE`.
