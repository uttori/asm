import path from "node:path";
import vm from "node:vm";

import type { DebugMap } from "@uttori/asm-core/debug-map";
import { build } from "esbuild";

import { test } from "../../../tests/ava-helper.js";

const bundled = await build({
  entryPoints: [path.resolve("packages/vscode-extension/src/debug-analysis-annotations.ts")],
  write: false,
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["./analysis-worker-client.js", "./coverage-tree.js"],
});

test("debugger annotations load lazily, batch a page, filter aliases, and tolerate query failure", async (t) => {
  const calls: { directory: string; operation: string; ranges?: unknown[] }[] = [];
  let fail = false;
  const module = { exports: {} };
  vm.runInNewContext(bundled.outputFiles[0].text, {
    exports: module.exports,
    module,
    queueMicrotask,
    require: (id: string) => {
      if (id === "./coverage-tree.js")
        return { findAnalysisProjectDirectories: async () => ["matching", "foreign"] };
      if (id === "./analysis-worker-client.js")
        return {
          analysisWorker: () => ({
            request: async (
              directory: string,
              operation: string,
              input?: { ranges: unknown[] },
            ) => {
              calls.push({ directory, operation, ...input });
              if (operation === "manifest")
                return {
                  target: "fixture",
                  rom: { contentSha256: directory, contentSize: 1024 },
                };
              if (fail) throw new Error("Unavailable");
              return [
                {
                  addressSpace: "cpu",
                  address: 256,
                  outputOffsets: [0],
                  architectures: ["cpu"],
                  text: "12×",
                },
                {
                  addressSpace: "foreign",
                  address: 256,
                  outputOffsets: [0],
                  architectures: ["other"],
                  text: "wrong CPU",
                },
              ];
            },
          }),
        };
      throw new Error(`Unexpected import ${id}`);
    },
  });
  const api = module.exports as typeof import("../src/debug-analysis-annotations.js");
  const lookup = await api.createDebugInstructionAnnotation({
    target: "fixture",
    output: { sha256: "matching", size: 1024 },
  } as DebugMap);
  t.truthy(lookup);
  t.deepEqual(
    calls.map(({ operation }) => operation),
    ["manifest", "manifest"],
  );
  const address = { architecture: "cpu", addressSpace: "cpu", address: 256, outputOffset: 0 };
  const mirror = { ...address, address: 512 };
  const values = await Promise.all([lookup!(address), lookup!(mirror), lookup!(address)]);
  t.deepEqual(values, ["12×", "12×", "12×"]);
  t.is(calls.length, 3, "one page query serves concurrent addresses and duplicate requests");
  t.is(calls[2].directory, "matching");
  t.is(calls[2].ranges?.length, 2);
  t.is(await lookup!(address), "12×");
  t.is(calls.length, 3, "repeated disassembly uses the session cache");
  fail = true;
  t.is(await lookup!({ ...address, address: 768 }), undefined);
});
