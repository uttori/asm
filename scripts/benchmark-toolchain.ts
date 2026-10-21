import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { fingerprintNodeToolchain } from "@uttori/asm-plugin-loader-node";

const output = process.argv[2];
assert.ok(output, "Pass a JSON receipt path");
const entries = ["packages/cli/src/index.ts", "packages/game-secret-of-mana/src/index.ts"].map(
  (file) => path.resolve(file),
);
const bundle = path.resolve("packages/cli/out/cli.mjs");
const samples = [];
const read = fs.readFileSync;
try {
  for (let sample = 0; sample < 6; sample++) {
    let filesRead = 0,
      bytesRead = 0;
    // Instrument the real filesystem calls, preserving overloads and returned ownership. This is
    // a separate benchmark process; no production host shares the temporary observer.
    fs.readFileSync = new Proxy(read, {
      apply(target, receiver, args) {
        const value: unknown = Reflect.apply(target, receiver, args);
        assert.ok(typeof value === "string" || ArrayBuffer.isView(value));
        filesRead++;
        bytesRead += typeof value === "string" ? Buffer.byteLength(value) : value.byteLength;
        return value;
      },
    });
    const started = performance.now();
    const identity = fingerprintNodeToolchain(entries, [bundle]);
    samples.push({
      state: sample === 0 ? "cold" : "warm",
      wallMs: performance.now() - started,
      filesRead,
      bytesRead,
      packages: identity.packages.length,
      sha256: identity.sha256,
      boundaryRssBytes: process.memoryUsage().rss,
    });
  }
} finally {
  fs.readFileSync = read;
}
assert.equal(new Set(samples.map((sample) => sample.sha256)).size, 1);
const times = samples
  .slice(1)
  .map((sample) => sample.wallMs)
  .toSorted((a, b) => a - b);
fs.writeFileSync(
  output,
  JSON.stringify(
    {
      version: 1,
      node: process.version,
      platform: process.platform,
      bundleSha256: createHash("sha256").update(read(bundle)).digest("hex"),
      samples,
      warm: { medianMs: times[2], p95Ms: times[4] },
      peakProcessRssBytes: process.resourceUsage().maxRSS * 1024,
      decision:
        "No cross-operation cache: each guard must still detect dirty executable bytes. A bundle receipt is a freshness check, not permission to trust unchanged metadata.",
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(samples));
