import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { safeJoin } from "../preview/safe-path.mjs";

function fixture(t) {
  const sandbox = mkdtempSync(join(tmpdir(), "hara-design-preview-test-"));
  const root = join(sandbox, "preview");
  const secretDir = join(sandbox, "preview-secret");
  const assetsDir = join(root, "assets");
  mkdirSync(assetsDir, { recursive: true });
  mkdirSync(secretDir);

  const hero = join(assetsDir, "hero.png");
  const secret = join(secretDir, "key.txt");
  writeFileSync(hero, "image");
  writeFileSync(secret, "secret");
  t.after(() => rmSync(sandbox, { recursive: true, force: true }));
  return { root, secretDir, hero, secret };
}

test("safeJoin keeps normal files and in-root symlinks beneath the serving root", (t) => {
  const { root, hero } = fixture(t);
  const alias = join(root, "assets", "hero-alias.png");
  symlinkSync(hero, alias);

  assert.equal(safeJoin(root, "assets/hero.png"), realpathSync(hero));
  assert.equal(safeJoin(root, "assets/hero-alias.png"), realpathSync(hero));
  assert.equal(safeJoin(root, ""), realpathSync(root));
});

test("safeJoin rejects traversal, sibling-prefix escapes, and malformed escapes", (t) => {
  const { root } = fixture(t);
  assert.equal(safeJoin(root, "../preview-secret/key.txt"), null);
  assert.equal(safeJoin(root, "%2e%2e/preview-secret/key.txt"), null);
  assert.equal(safeJoin(root, "%E0%A4%A"), null);
});

test("safeJoin rejects file and directory symlinks that resolve outside the serving root", (t) => {
  const { root, secretDir, secret } = fixture(t);
  const fileLink = join(root, "assets", "leak.txt");
  const dirLink = join(root, "linked-secret");
  const pageDir = join(root, "page");
  mkdirSync(pageDir);
  symlinkSync(secret, fileLink);
  symlinkSync(secretDir, dirLink, "dir");
  symlinkSync(secret, join(pageDir, "index.html"));

  assert.equal(safeJoin(root, "assets/leak.txt"), null);
  assert.equal(safeJoin(root, "linked-secret/key.txt"), null);
  // Mirrors serveFile's directory-index re-check.
  assert.equal(safeJoin(pageDir, "index.html"), null);
});
