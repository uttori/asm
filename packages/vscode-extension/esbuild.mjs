import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [path.join(here, "src/disassembly-maintenance-process.ts")],
  outfile: path.join(here, "out/disassembly-maintenance-process.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
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
  platform: "node",
  format: "cjs",
  target: "node20",
  logLevel: "info",
});

await build({
  entryPoints: [path.join(here, "src/extension.ts")],
  outfile: path.join(here, "out/extension.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
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
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  logLevel: "info",
});

// Ship the language-server bundle alongside the extension so it can be launched
// over stdio. Run `npm run lsp:build` first to produce this file.
const serverBundle = path.resolve(here, "../language-server/out/server.mjs");
const serverDestination = path.join(here, "server", "server.mjs");
if (existsSync(serverBundle)) {
  mkdirSync(path.dirname(serverDestination), { recursive: true });
  cpSync(serverBundle, serverDestination);
  console.log(`Copied language server bundle to ${serverDestination}`);
} else {
  console.warn(`Language server bundle missing at ${serverBundle}; run "npm run lsp:build" first.`);
}

// Ship the MIT protocol translators with the extension. Emulator executables,
// runtime resources, and their licenses remain separately managed inputs.
const sidecars = [
  ["ares", path.resolve(here, "../debug-sidecar-ares/out/sidecar.mjs")],
  ["mesence", path.resolve(here, "../debug-sidecar-mesence/out/sidecar.mjs")],
];
for (const [name, source] of sidecars) {
  const destination = path.join(here, "sidecars", `${name}.mjs`);
  if (existsSync(source)) {
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(source, destination);
    console.log(`Copied ${name} debug sidecar to ${destination}`);
  } else {
    console.warn(`Debug sidecar missing at ${source}; run "npm run sidecar:build" first.`);
  }
}
