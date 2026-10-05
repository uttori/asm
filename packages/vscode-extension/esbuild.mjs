import { chmodSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build as esbuild } from "esbuild";

import { withBundleNotices } from "../../scripts/bundle-notices.mjs";

const build = withBundleNotices(esbuild);

const here = path.dirname(fileURLToPath(import.meta.url));
// VS Code 1.128 embeds Node 24. Standalone tools target Node 26. Every executable shipped
// inside the VSIX is built separately for the editor's runtime, including forked workers.
const editorRuntime = "node24";
// These directories contain only build outputs. Clearing them prevents removed worker entry points
// from surviving a rebuild and being shipped accidentally by the VSIX packager.
for (const directory of ["out", "server", "sidecars", "tests-host/out"]) {
  rmSync(path.join(here, directory), { recursive: true, force: true });
}
// Data Tools' optional debug branches use top-level await. Production workers keep logging
// disabled, which lets their portable conversion code bundle into the required CJS hosts.
const dataToolsDebugDisabled = {
  "process.env.UTTORI_DATA_DEBUG": "false",
  "process.env.UTTORI_AUDIOWAV_DEBUG": "false",
};
await build({
  entryPoints: [path.join(here, "src/assets/png-worker.ts")],
  outfile: path.join(here, "out/png-worker.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  define: dataToolsDebugDisabled,
  logLevel: "info",
});
await build({
  entryPoints: [path.join(here, "src/editor-info/worker.ts")],
  outfile: path.join(here, "out/editor-information-worker.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  logLevel: "info",
});
// Source operations need import.meta.url for content-based toolchain identity and plugin loading.
await build({
  entryPoints: [path.join(here, "src/source/process.ts")],
  outfile: path.join(here, "out/source-process.mjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "esm",
  target: editorRuntime,
  define: { ...dataToolsDebugDisabled, UTTORI_SOURCE_BUNDLED: "true" },
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
// Worker sources live with their features; keep output names aligned with the process launchers.
await build({
  entryPoints: [path.join(here, "src/runtime/live-bus-analysis-process.ts")],
  outfile: path.join(here, "out/live-bus-analysis-process.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  logLevel: "info",
});
mkdirSync(path.join(here, "schemas"), { recursive: true });

await build({
  entryPoints: [path.join(here, "src/analysis/worker.ts")],
  outfile: path.join(here, "out/analysis-worker.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  define: dataToolsDebugDisabled,
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
  define: dataToolsDebugDisabled,
  logLevel: "info",
});

// Bundle the Extension Host smoke entry separately. VS Code loads test runners through CommonJS,
// while keeping the TypeScript source in this workspace lets the same strict type/lint gates cover
// the real-host assertions. `.vscodeignore` excludes the runner from the release VSIX.
await build({
  entryPoints: [path.join(here, "tests-host/extension-driver.ts")],
  outfile: path.join(here, "tests-host/out/extension-driver.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  external: ["vscode"],
  define: dataToolsDebugDisabled,
  logLevel: "info",
});
await build({
  entryPoints: [path.join(here, "tests-host/asset-recovery-driver.ts")],
  outfile: path.join(here, "tests-host/out/asset-recovery-driver.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  external: ["vscode"],
  define: dataToolsDebugDisabled,
  logLevel: "info",
});
await build({
  entryPoints: [path.join(here, "tests-host/index.ts")],
  outfile: path.join(here, "tests-host/out/index.cjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "cjs",
  target: editorRuntime,
  external: ["vscode"],
  define: dataToolsDebugDisabled,
  logLevel: "info",
});

// Build from source on every package operation: copying an optional pre-existing bundle can
// silently ship a stale server or omit it entirely. Native emulator artifacts remain external.
/** @type {Array<[string, string, boolean]>} Source, packaged path and CommonJS shim requirement. */
const embeddedExecutables = [
  ["../language-server/src/server.ts", "server/server.mjs", true],
  ["../debug-sidecar-ares/src/sidecar.ts", "sidecars/ares.mjs", false],
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

// The LSP preview request spawns this sibling worker by URL; it must be packaged
// beside the embedded server for both local and remote Extension Hosts.
await build({
  entryPoints: [path.resolve(here, "../language-server/src/asset-preview-worker.ts")],
  outfile: path.join(here, "server/asset-preview-worker.mjs"),
  bundle: true,
  conditions: ["uttori-source"],
  platform: "node",
  format: "esm",
  target: editorRuntime,
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "info",
});
