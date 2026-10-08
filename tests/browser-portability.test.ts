import path from "node:path";
import vm from "node:vm";

import test from "ava";
import { build } from "esbuild";

test("portable SNES assembly bundles and runs without Node globals", async (t) => {
  const result = await build({
    stdin: {
      contents: `
        import { Assembler, MemoryAssemblyFileProvider } from "@uttori/asm-core";
        import { createSnesAssemblerEnvironment } from "@uttori/asm-plugin-snes";
        globalThis.assemblyResult = (async () => {
          const assembler = new Assembler({
            environment: await createSnesAssemblerEnvironment(),
            target: "snes.sfc",
            architecture: "snes.65816",
            targetOptions: { checksumEnabled: false },
            fileProvider: new MemoryAssemblyFileProvider(),
          });
          try {
            assembler.assembleSource("lorom\\norg $008000\\nMVN $10 + 2,$30 + 4", "example.asm");
            return Array.from(assembler.getBinaryOutput());
          } finally {
            assembler.dispose();
          }
        })();
      `,
      resolveDir: path.resolve(import.meta.dirname, ".."),
      sourcefile: "browser-example.js",
    },
    bundle: true,
    platform: "browser",
    conditions: ["browser", "uttori-source"],
    format: "esm",
    target: "es2022",
    write: false,
    logLevel: "silent",
  });
  // Await dependency initialization like a module worker, without supplying any Node host globals.
  const context = {
    TextEncoder,
    TextDecoder,
    // TextEncoder returns a host byte array, so share its Web constructors with the sandbox.
    Uint8Array,
    ArrayBuffer,
    assemblyResult: undefined as Promise<number[]> | undefined,
  };
  await vm.runInNewContext(`(async () => { ${result.outputFiles[0].text}\n })()`, context);
  t.deepEqual(Array.from((await context.assemblyResult) ?? []), [0x54, 0x12, 0x34]);
});
