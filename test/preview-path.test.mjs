import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { safeJoin } from "../preview/safe-path.mjs";

test("safeJoin keeps normal preview assets beneath the serving root", () => {
  const root = resolve("/tmp/hara-design-preview");
  assert.equal(safeJoin(root, "assets/hero.png"), resolve(root, "assets/hero.png"));
  assert.equal(safeJoin(root, ""), root);
});

test("safeJoin rejects traversal, sibling-prefix escapes, and malformed escapes", () => {
  const root = resolve("/tmp/hara-design-preview");
  assert.equal(safeJoin(root, "../hara-design-preview-secret/key.txt"), null);
  assert.equal(safeJoin(root, "%2e%2e/hara-design-preview-secret/key.txt"), null);
  assert.equal(safeJoin(root, "%E0%A4%A"), null);
});
