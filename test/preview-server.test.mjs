import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { get } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const previewServer = join(here, "..", "preview", "server.mjs");

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = get({ hostname: "127.0.0.1", port, path }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.setTimeout(5_000, () => req.destroy(new Error(`request timed out: ${path}`)));
    req.once("error", reject);
  });
}

function waitUntilReady(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => reject(new Error(`preview server did not start: ${stderr}`)), 5_000);
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.includes("Preview: http://127.0.0.1:")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`preview server exited before startup (${code}): ${stderr}`));
    });
  });
}

test("preview serves normal files but rejects escaping symlinks on every file route", { timeout: 15_000 }, async () => {
  const sandbox = mkdtempSync(join(tmpdir(), "hara-design-server-test-"));
  const root = join(sandbox, "preview");
  const outside = join(sandbox, "outside.html");
  const index = join(root, "index.html");
  mkdirSync(join(root, "page"), { recursive: true });
  writeFileSync(index, "<!doctype html><title>Safe</title><body>safe preview</body>");
  writeFileSync(outside, "<!doctype html><title>TOP-SECRET</title><body>outside secret</body>");
  symlinkSync(outside, join(root, "leak.html"));
  symlinkSync(outside, join(root, "page", "index.html"));

  const port = await reservePort();
  const child = spawn(process.execPath, [previewServer, "--dir", root, "--port", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitUntilReady(child);

    const normal = await request(port, "/__artifact");
    assert.equal(normal.status, 200);
    assert.match(normal.body, /safe preview/);

    for (const path of ["/leak.html", "/page/"]) {
      const response = await request(port, path);
      assert.equal(response.status, 404, path);
      assert.doesNotMatch(response.body, /outside secret|TOP-SECRET/, path);
    }

    rmSync(index);
    symlinkSync(outside, index);
    for (const path of ["/__artifact", "/__export"]) {
      const response = await request(port, path);
      assert.equal(response.status, 404, path);
      assert.doesNotMatch(response.body, /outside secret|TOP-SECRET/, path);
    }
    const rootResponse = await request(port, "/");
    assert.equal(rootResponse.status, 200);
    assert.match(rootResponse.body, /Designing/);
    assert.doesNotMatch(rootResponse.body, /outside secret|TOP-SECRET/);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    rmSync(sandbox, { recursive: true, force: true });
  }
});
