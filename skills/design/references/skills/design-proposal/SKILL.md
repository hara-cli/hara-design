---
name: design-proposal
description: A polished, print-ready CLIENT design proposal exported to PDF — cover + product narrative + the key screens explained + design rationale + roadmap. Use when the user wants to SHARE a design with a client or non-technical stakeholder, explain the product, justify design decisions, or hand over a case study. (Different from `handoff`, which targets a frontend coding agent and emits tokens/components.)
triggers:
  - "design proposal"
  - "proposal pdf"
  - "提案"
  - "设计方案"
  - "设计提案"
  - "pdf for client"
  - "share with client"
  - "产品解说"
  - "设计原理"
  - "设计说明"
  - "case study"
  - "design rationale"
od:
  mode: deck
  scenario: general
  preview:
    type: html
    entry: index.html
  design_system:
    requires: false
  example_prompt: "Make a client-ready PDF proposal for this design — cover, what it is, the key screens explained, the design rationale, and next steps. Export it to PDF."
---
# Design Proposal → PDF (client-facing)

Turn a finished design into a **shareable PDF** a client / non-technical stakeholder can read on their own:
what the product is, the key screens (with plain-language explanations), **why** the design works (the design
system + the UX decisions), and what's next. This is storytelling for a client — not a code handoff.

## Flow
1. **Gather** from the design: product name + one-line value prop; the audience; the design system used; the
   key screens; the 3–5 design decisions worth defending.
2. **Capture the screens as images.** The PDF is static (Chrome print-to-pdf) — iframes/live pages won't embed.
   Screenshot each key screen (use the browser/Playwright tools against the live preview, or serve-sim for an
   app) → save PNGs under `proposal-assets/`. Crop app screens to the device frame.
3. **Author `proposal.html`** from `template.html` in this folder: fill the cover + narrative + drop the screen
   images into the `<img>` slots. Set `--accent` to the design's brand color. Lead with value, not features.
4. **Export:** `hara-design export proposal.html --out proposal.pdf`. Each `.page` is one print page (landscape),
   so the PDF reads like a deck.

## Sections (in `template.html` — keep, reorder, or drop to fit)
- **Cover** — product name, one-line pitch, client / date, brand mark.
- **Overview** — what it is, who it's for, the job it does (≤3 sentences).
- **The screens** — each key screen: image + 2–3 lines on what the user does here and why it's designed this way.
- **Design rationale** — the design system chosen + why it fits the brand; the 3–5 key UX / visual decisions.
- **Roadmap / next steps** — phases; what you need from the client.

## Rules
- **Client language, not designer jargon.** "Tap to generate a track" beats "primary CTA triggers the gen flow."
- **Show, then explain.** Image first; one tight paragraph under it.
- **Print-safe:** the template sets `@page` size + `-webkit-print-color-adjust:exact` so backgrounds/colors
  survive the PDF, and `break-after:page` per section. Don't remove those.
- Embed images with **relative paths** (`proposal-assets/…`) so `export` resolves them from the html's dir.
- Preview it like any design first (`hara-design open proposal.html`'s dir) to proof it, then export.
