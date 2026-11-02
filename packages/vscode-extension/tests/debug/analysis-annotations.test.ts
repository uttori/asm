import { registerHooks } from "node:module";

import { test } from "../../../../tests/ava-helper.js";

const host = {
  calls: [] as { directory: string; operation: string; ranges?: unknown[] }[],
  fail: false,
  texts: ["12×"],
};

Object.assign(globalThis, { __uttoriDebugAnnotationsTest: host });

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      typeof context.parentURL === "string" &&
      /[/\\]debug[/\\]analysis-annotations\.(ts|js|mts|mjs)/.test(context.parentURL)
    ) {
      if (specifier === "../analysis/project-discovery.js") {
        return { shortCircuit: true, url: "debug-annotations-test:project-discovery" };
      }
      if (specifier === "../analysis/worker-client.js") {
        return { shortCircuit: true, url: "debug-annotations-test:worker-client" };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === "debug-annotations-test:project-discovery") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          export const findAnalysisProjectDirectories = async () => ["matching", "foreign"];
        `,
      };
    }
    if (url === "debug-annotations-test:worker-client") {
      return {
        shortCircuit: true,
        format: "module",
        source: `
          const host = globalThis.__uttoriDebugAnnotationsTest;
          export const analysisWorker = () => ({
            request: async (directory, operation, input) => {
              host.calls.push({ directory, operation, ...input });
              if (operation === "manifest") {
                return {
                  target: "fixture",
                  rom: { contentSha256: directory, contentSize: 1024 },
                };
              }
              if (host.fail) {
                throw new Error("Unavailable");
              }
              return [
                ...host.texts.map((text) => ({
                  addressSpace: "cpu",
                  address: 256,
                  outputOffsets: [0],
                  architectures: ["cpu"],
                  text,
                })),
                {
                  addressSpace: "foreign",
                  address: 256,
                  outputOffsets: [0],
                  architectures: ["other"],
                  text: "wrong CPU",
                },
              ];
            },
          });
        `,
      };
    }
    return nextLoad(url, context);
  },
});

const { createDebugInstructionAnnotation } =
  await import("../../src/debug/analysis-annotations.js");

test.serial(
  "debugger annotations load lazily, batch a page, filter aliases, and tolerate query failure",
  async (t) => {
    host.calls = [];
    host.fail = false;
    host.texts = ["12×"];
    const lookup = await createDebugInstructionAnnotation({
      target: "fixture",
      output: { sha256: "matching", size: 1024 },
    });
    t.truthy(lookup);
    t.deepEqual(
      host.calls.map(({ operation }) => operation),
      ["manifest", "manifest"],
    );
    const address = { architecture: "cpu", addressSpace: "cpu", address: 256, outputOffset: 0 };
    const mirror = { ...address, address: 512 };
    const values = await Promise.all([lookup!(address), lookup!(mirror), lookup!(address)]);
    t.deepEqual(values, ["12×", "12×", "12×"]);
    t.is(host.calls.length, 3, "one page query serves concurrent addresses and duplicate requests");
    t.is(host.calls[2].directory, "matching");
    t.is(host.calls[2].ranges?.length, 2);
    t.is(await lookup!(address), "12×");
    t.is(host.calls.length, 3, "repeated disassembly uses the session cache");
    host.fail = true;
    t.is(await lookup!({ ...address, address: 768 }), undefined);
  },
);

test.serial("debugger deduplicates aliases before applying one total display budget", async (t) => {
  host.calls = [];
  host.fail = false;
  host.texts = ["first", "first", "", "second", "x".repeat(220)];
  const lookup = await createDebugInstructionAnnotation({
    target: "fixture",
    output: { sha256: "matching", size: 1024 },
  });
  const text = await lookup!({
    architecture: "cpu",
    addressSpace: "cpu",
    address: 256,
    outputOffset: 0,
  });
  t.is(text?.length, 220);
  t.true(text?.startsWith("first | second | "));
  t.true(text?.endsWith("…"));
  t.false(text?.includes("wrong CPU"));
});
