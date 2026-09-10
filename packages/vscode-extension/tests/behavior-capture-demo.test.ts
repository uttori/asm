import { createRequire } from "node:module";
import vm from "node:vm";

import { build } from "esbuild";

import { test } from "../../../tests/ava-helper.js";

const bundled = await build({
  entryPoints: ["packages/vscode-extension/src/behavior-capture-demo.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const module = {
  exports: {} as typeof import("../src/behavior-capture-demo.js"),
};
vm.runInNewContext(bundled.outputFiles[0]!.text, {
  module,
  exports: module.exports,
  require: createRequire(import.meta.url),
  Buffer,
  process,
  setTimeout,
  clearTimeout,
  performance,
});
const { runBehaviorCaptureDemo } = module.exports;

test("idle demo exercises replay, multi-batch capture, subtraction, and idempotent comments without a ROM", async (t) => {
  const demo = await runBehaviorCaptureDemo();
  const byAddress = new Map(demo.review.candidates.map((entry) => [entry.address, entry]));
  t.is(byAddress.get(0x808000)?.classification, "shared");
  t.false(byAddress.has(0x808010));
  for (const address of [0x808020, 0x808030]) {
    t.is(byAddress.get(address)?.classification, "action-only");
    t.is(byAddress.get(address)?.score, 1);
    t.true(
      demo.comments.some((entry) => entry.address === address && entry.text.includes("Open Menu")),
    );
  }
  t.is(demo.review.observedEvents, 9);
  t.is(demo.review.droppedEvents, 0);
  t.true(
    demo.capture.windows.every(
      (entry) => entry.stopReason === "instruction-limit" && entry.trace.chunks.length >= 3,
    ),
  );
  t.true(demo.review.warnings.some((entry) => entry.includes("Synthetic")));
  t.true(
    demo.comments.some(
      (entry) => entry.id === "manual" && entry.text === "Handwritten comment: keep me.",
    ),
  );
  t.true(demo.changed);
  t.false(demo.repeatedChanged);
});
