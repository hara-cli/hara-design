import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "bin", "hara-design.mjs");

for (const args of [[], ["help"], ["--help"], ["-h"]]) {
  const label = args[0] || "no arguments";
  test(`CLI ${label} prints help and exits successfully`, () => {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /hara-design — local helper/);
    assert.match(result.stdout, /hara-design preview/);
  });
}
