import { chmodSync, cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
// VS Code 1.128 embeds Node 24. Standalone tools target Node 26; every executable shipped
// inside the VSIX is built separately for the editor's runtime, including forked workers.
const editorRuntime = "node24";
await build({
  entryPoints: [path.join(here, "src/live-bus-analysis-process.ts")],
  outfile: path.join(here, "out/live-bus-analysis-process.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  logLevel: "info",
});
await build({
  entryPoints: [path.join(here, "src/disassembly-maintenance-process.ts")],
  outfile: path.join(here, "out/disassembly-maintenance-process.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  logLevel: "info",
});
mkdirSync(path.join(here, "schemas"), { recursive: true });
cpSync(
  path.resolve(here, "../plugin-snes/heuristics.schema.json"),
  path.join(here, "schemas/snes-heuristics.schema.json"),
);

await build({
  entryPoints: [path.join(here, "src/analysis-worker.ts")],
  outfile: path.join(here, "out/analysis-worker.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  logLevel: "info",
});

await build({
  entryPoints: [path.join(here, "src/extension.ts")],
  outfile: path.join(here, "out/extension.js"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  // `vscode` is provided by the host at runtime and must not be bundled.
  external: ["vscode"],
  logLevel: "info",
});

// Bundle the Extension Host smoke entry separately. VS Code loads test runners through CommonJS,
// while keeping the TypeScript source in this workspace lets the same strict type/lint gates cover
// the real-host assertions. `.vscodeignore` excludes the runner from the release VSIX.
await build({
  entryPoints: [path.join(here, "tests-host/index.ts")],
  outfile: path.join(here, "tests-host/out/index.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  external: ["vscode"],
  logLevel: "info",
});

// Build from source on every package operation: copying an optional pre-existing bundle can
// silently ship a stale server or omit it entirely. Native emulator artifacts remain external.
const embeddedExecutables = [
  ["../language-server/src/server.ts", "server/server.mjs", true],
  ["../debug-sidecar-ares/src/sidecar.ts", "sidecars/ares.mjs", false],
  ["../debug-sidecar-mesence/src/sidecar.ts", "sidecars/mesence.mjs", false],
];
for (const [source, destination, needsRequireShim] of embeddedExecutables) {
  const outfile = path.join(here, destination);
  const banner = ["#!/usr/bin/env node"];
  if (needsRequireShim) {
    // vscode-languageserver contains CommonJS dependencies even though our server entry is ESM.
    banner.push(
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __dirname_fn } from 'node:path';",
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __dirname_fn(__filename);",
    );
  }
  await build({
    entryPoints: [path.resolve(here, source)],
    outfile,
    bundle: true,
    conditions: ["uttori-source"],
    platform: "node",
    format: "esm",
    target: editorRuntime,
    logOverride: { "import-is-undefined": "error" },
    banner: { js: banner.join("\n") },
    logLevel: "info",
  });
  chmodSync(outfile, 0o755);
}
