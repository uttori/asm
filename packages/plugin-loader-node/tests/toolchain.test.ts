import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { test } from "../../../tests/ava-helper.js";
import { fingerprintNodeToolchain } from "../src/toolchain.js";

test("toolchain fingerprints ignore browser caches while retaining dirty executable source identity", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-toolchain-cache-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.0.0" }),
  );
  const source = path.join(root, "index.js");
  fs.writeFileSync(source, "export const value = 1;\n");
  const before = fingerprintNodeToolchain([source]);
  for (const cache of [".DS_Store", "Thumbs.db", "desktop.ini"]) {
    fs.writeFileSync(path.join(root, cache), "cache");
  }
  t.deepEqual(fingerprintNodeToolchain([source]), before);
  fs.writeFileSync(path.join(root, ".DS_Store"), "updated");
  t.deepEqual(fingerprintNodeToolchain([source]), before);
  fs.writeFileSync(source, "export const value = 2;\n");
  t.not(fingerprintNodeToolchain([source]).sha256, before.sha256);
});
