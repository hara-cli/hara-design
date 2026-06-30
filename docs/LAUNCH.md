# hara-design — launch copy (draft)

Gating asset: a 30s demo GIF (same skill in hara / Claude Code / Codex → live preview). Embed it where `[GIF]` is marked.
Cadence (苏秦): Week 0 prep (GIF + README first-screen + awesome PRs) → Week 1 Tue: Show HN + same-day X + r/ClaudeAI → Thu: Reddit/Discord → Week 2: dev.to → Month 2+: Product Hunt. HN and PH on different days.

---

## Show HN

**Title:**
`Show HN: hara-design – 219 design recipes for Claude Code, Codex, and hara CLI`

**Body:**

hara-design is an open-source skill that turns the coding agent you already use — hara, Claude Code, or Codex — into a design tool. You describe a UI in plain language; it generates a self-contained, interactive HTML prototype (landing page, dashboard, app flow, or deck) in one of 150 brand-grade design systems, previewed live in your browser.

Two questions I'd have, up front:

- **vs shadcn/v0?** Those hand you React components or a hosted generator. hara-design is a *skill that runs in your CLI*, outputs framework-free standalone HTML you own, and ships 150 curated design systems + 219 recipes — so the look is a deliberate choice, not the model's default. It also does multi-screen *playable* prototypes (tap through real flows in a device frame), not just isolated blocks.
- **Why not just prompt the agent directly?** You can — but you get generic taste and a one-off. The recipes encode a staged workflow (brief → direction lock → build → a P0 "no dead controls" checklist → a 5-dimension self-critique), and the 150 systems are real token sets (palette/type/spacing) the agent binds to. Consistent and on-brand instead of vibes.

How it works: the agent authors only the screens + design tokens; a frozen framework is *injected* by a tiny zero-dependency preview server (device bezel, view modes, interaction runtime). A multi-screen design behaves like a real app — the agent can't accidentally turn it into a slideshow. You drive entirely from the terminal; the web is a view-only, live-reload preview (no chat in the page).

It began as a fork of open-design and is Apache-2.0. The part I think is neat: the assets (systems / recipes / preview) are CLI-agnostic, so supporting Claude Code and Codex was one thin adapter each — `hara-design install --claude` (→ `~/.claude/skills`) or `--codex` (→ `~/.agents/skills`) symlinks the same skill in. One core, a wrapper per host.

Repo: https://github.com/hara-cli/hara-design

[GIF]

Feedback welcome — especially on the design-system catalog and the prototype interaction model.

---

## X / Twitter thread (@hara_cli)

**1/ (hook + GIF)**
Your coding agent writes code. Now it can design.

hara-design: describe a UI → get a *playable*, on-brand HTML prototype. Works in hara, Claude Code, and Codex. Open source (Apache-2.0).

[GIF: same skill in 3 CLIs → live preview]

**2/ (the problem it solves)**
Prompting an agent for UI gives you the model's generic taste and a throwaway.

hara-design ships 150 brand-grade design systems + 219 recipes — the look is a *choice*, and the workflow (brief → build → self-critique) is repeatable.

**3/ (how it works)**
The agent writes only screens + design tokens. A frozen framework is injected: device frame, view modes, tap-through interactions.

So multi-screen designs behave like a real app — not a slideshow. Preview live in the browser; drive from the terminal.

**4/ (multi-CLI install)**
Same skill, any agent:

```
npm i -g @nanhara/hara-design
hara-design install --claude   # or --codex
```

(hara: `hara plugin add github:hara-cli/hara-design`)

One core, a thin adapter per CLI.

**5/ (CTA)**
150 design systems, 219 recipes, self-contained HTML you own.

→ github.com/hara-cli/hara-design

Built in the open. Tell us what to add to the catalog.

---

## Demo GIF — 30s shot list (#11, the gating asset)

Record a real screen capture (CleanShot/QuickTime) — VHS can't capture the browser preview, which is the payoff.
Keep it real (no faked output). Target ~30s, then convert to GIF (or keep mp4 + a GIF poster).

1. **0–3s** — terminal, dark theme. Type `hara` (REPL opens) — or `claude` to make the "any agent" point.
2. **3–8s** — type the brief and hit enter:
   `a dark, modern-minimal landing page for a developer log-search tool — use the linear-app design system`
3. **8–16s** — agent works (speed up 2–3×): it picks the system, writes `index.html`, prints the preview URL.
4. **16–24s** — **cut to the browser**: the landing page renders live; a small scroll shows it's a real, polished page.
5. **24–30s** — quick beat: flip to **Grid** view (all screens) or a tap-through on an app prototype, then end on the
   `hara-design` mark + `github.com/hara-cli/hara-design`.

Optional 2-shot variant for the "works anywhere" angle: same brief, once in Claude Code, once in hara — split or sequential.
Capture at ≥2x retina, crop tight to the terminal+browser, keep total file < 8MB for HN/X inline play.

## awesome-list one-liner (for #13)

`[hara-design](https://github.com/hara-cli/hara-design) — Turn your coding agent (hara, Claude Code, Codex) into a design tool: plain-language → playable, on-brand HTML prototypes in 150 design systems, previewed live. Apache-2.0.`

Target lists: awesome-claude-code, awesome-ai-agents, awesome-llm-tools. GitHub topics: `claude-code`, `codex`, `design-system`, `ai-agent`, `skill`, `prototyping`.
