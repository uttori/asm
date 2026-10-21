import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  checkRuntimeBundle,
  runtimeBundleFor,
  runtimeBundles,
} from "../../scripts/runtime-bundles.mjs";
import { test } from "../ava-helper.js";

const hash = (text: string): string => createHash("sha256").update(text).digest("hex");

test("runtime inventory rejects the wrong host and detects dirty worker inputs and outputs", (t) => {
  const bundle = runtimeBundles.find((entry) => entry.output.endsWith("out/source-process.mjs"))!;
  t.throws(
    () =>
      runtimeBundleFor({
        outfile: path.resolve(bundle.output),
        entryPoints: [path.resolve(bundle.source)],
        target: "node26",
      }),
    { message: /mismatch/ },
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "uttori-runtime-receipt-"));
  t.teardown(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of [bundle.source, bundle.output, bundle.notices]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "original");
  }
  fs.writeFileSync(
    path.join(root, `${bundle.output}.manifest.json`),
    JSON.stringify({
      version: 1,
      ...bundle,
      sha256: hash("original"),
      noticesSha256: hash("original"),
      inputs: [{ file: bundle.source, sha256: hash("original") }],
    }),
  );
  t.notThrows(() => checkRuntimeBundle(bundle, root));
  for (const file of [bundle.source, bundle.output, bundle.notices]) {
    fs.writeFileSync(path.join(root, file), "changed");
    t.throws(() => checkRuntimeBundle(bundle, root), { message: /Stale runtime/ });
    fs.writeFileSync(path.join(root, file), "original");
  }
});
