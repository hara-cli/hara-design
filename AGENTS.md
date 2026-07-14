# Repository Guidelines

## Scope & Structure

This repository ships the `@nanhara/hara-design` npm package and Hara plugin. The CLI entry point is `bin/hara-design.mjs`; the agent workflow is in `skills/design/`; design-system source lives under `skills/design/references/design-systems/`; device assets are in `frames/`; preview/export code is in `preview/` and `scripts/`; tests are in `test/`. Keep `package.json` and `plugin.json` versions aligned.

## Development & Tests

- `npm test` runs the complete dependency-free `node:test` suite.
- `npm run preview` starts the local preview server; stop it when the check is complete.
- `npm run export -- <input> [options]` exercises the self-contained HTML exporter.
- `npm run build-index` regenerates `skills/design/references/design-systems/INDEX.md` after catalog changes.
- `npm pack --dry-run` verifies the actual npm payload.

Use ESM, two-space indentation, semicolons, and focused helpers matching adjacent code. Add regression coverage for CLI parsing, path handling, exports, and preview security boundaries. Treat reference content and frames as product assets: preserve attribution and do not bulk-rewrite them without a scoped reason.

## Generated Output & Release Boundary

Do not hand-edit the generated design-system `INDEX.md`; update its source systems and rebuild it. User prototypes under `.hara/design/`, preview caches, exported HTML, screenshots, and packed `.tgz` files are generated artifacts and should not be committed unless they are deliberate fixtures.

The GitHub workflow tests Node 18, 22, and 24. A `vX.Y.Z` tag matching both manifests publishes to npm after tests and package inspection; manual dispatch is also a publication action. Do not tag or dispatch until those gates pass and release authorization is clear. Verify npm after publication before announcing it.

## Security & Hara Feedback

Never commit API keys, backend commands containing credentials, tokens, cookies, or private customer designs. Bound file serving/export paths to the requested project and treat authored HTML as untrusted content.

The canonical intake and status channel is Feishu `hara 反馈群` (`oc_17590648f393135cde6a6b9cd6f1c710`). Pull the newest messages and relevant attachments before issue work. Report discovered bugs with version, reproduction/evidence, and expected versus actual behavior, always redacted. After a verified release, reply to each original fixed report with the fixed version and focused checks, then post the group-level version, concise changes, upgrade command, and verification request; mention any named tester.
