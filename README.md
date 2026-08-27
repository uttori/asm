# uttori-asm

Uttori ASM is a pluggable assembler toolkit for TypeScript and Node.js. Its architecture-neutral core owns parsing, the three-stage assembly pipeline, symbols, macros, includes, diagnostics, output writing, and editor analysis. Plugins own targets, instruction encoders, address spaces, output formats, target directives, expression functions, lifecycle behavior, and per-session state.

The repository ships four production packages:

| Package | Purpose |
| --- | --- |
| `@uttori/asm-core` | Generic assembler runtime, analysis APIs, and plugin contracts |
| `@uttori/asm-plugin-loader-node` | Trusted Node.js plugin discovery and `uttori-asm.config.json` loading |
| `@uttori/asm-plugin-snes` | SNES/SFC target with 65816, SPC700, Super FX, and Asar compatibility |
| `@uttori/asm-plugin-65xx` | NMOS, CMOS, Commodore, and MEGA65 65xx encoders with a configurable-origin flat raw target |

The language server and VS Code extension use the same loaded plugin environment as command-line builds, so diagnostics and editor catalogs match the selected target.

## Requirements and installation

- Node.js 20 or newer for the assembler and bundled editor tools.
- A Node.js release accepted by AVA 8 (`^22.20`, `^24.12`, or `>=26`) for the development suite.
- npm workspaces.

```sh
git clone https://github.com/MatthewCallis/uttori-asm.git
cd uttori-asm
npm install
```

The packages are ESM and currently expose TypeScript source as their runtime import. Use a TypeScript-aware runtime or bundler; this repository uses `tsx` during development.

## Generic core usage

Core has no default target and never imports a plugin. Activate plugins, freeze the environment, then pass an explicit target to every build or analysis session:

```ts
import { Assembler, PluginManager } from "@uttori/asm-core";
import examplePlugin from "./my-plugin.js";

const manager = new PluginManager();
await manager.activatePlugins([{ plugin: examplePlugin, options: { byte: 0x42 } }]);

const assembler = new Assembler({
  environment: manager.freeze(),
  target: "example.raw",
});

try {
  assembler.assembleSource("org 0\nbyte", "main.asm");
  console.log(assembler.getBinaryOutput());
} finally {
  assembler.dispose();
  await manager.dispose();
}
```

Construction without a resolved environment and target is an error. Encoders, directive handlers, lifecycle hooks, and mutable plugin state are created independently for each session.

For individual stages, call `buildProgramModel()` followed by `runStage("collectDefinitions")`, `runStage("resolveLayout")`, and `runStage("emitProgram")`. `assembleProgram()` runs all three. `analyzeSource()`, `analyzeDocument()`, `analyzeProgram()`, and `analyzeWorkspace()` use the production front end with recovery-oriented diagnostics.

## SNES quick start

The SNES package exposes an explicit environment factory and target ID:

```ts
import fs from "node:fs";
import { Assembler } from "@uttori/asm-core";
import {
  createSnesAssemblerEnvironment,
  SNES_TARGET_ID,
} from "@uttori/asm-plugin-snes";

const environment = await createSnesAssemblerEnvironment();
const assembler = new Assembler({
  environment,
  target: SNES_TARGET_ID,
  targetOptions: { checksumMode: "asar", checksumEnabled: true },
});

try {
  assembler.assembleSource("lorom\norg $008000\nsei", "main.asm");
  fs.writeFileSync("main.sfc", assembler.getBinaryOutput());
} finally {
  assembler.dispose();
}
```

See the [SNES plugin reference](plugins/snes/README.md) for target aliases, architectures, mapper directives, expressions, checksum options, and output behavior.

## Command line

With no `uttori-asm.config.json` and no explicit plugin, the CLI product supplies the bundled SNES plugin as its host-level default. Core itself still has no default.

```sh
# SNES zero-configuration build
npm run cli -- path/to/main.asm path/to/main.sfc

# Explicit project/plugin build
npm run cli -- examples/plugin-author/main.asm build/main.bin \
  --config examples/plugin-author/uttori-asm.config.json

# Overrides
npm run cli -- main.asm --plugin ./plugin.js --target custom.raw \
  --architecture custom.cpu --base-image base.bin --include-path includes \
  --plugin-option custom.plugin:mode="strict" --verbose
```

Options are `--config`, repeatable `--plugin`, `--target`, `--architecture`, `--base-image`, repeatable `--include-path`, repeatable `--plugin-option <plugin:key=value>`, `--verbose`, and `--help`. When output is omitted, the selected target supplies its extension.

Resolution precedence is CLI/editor overrides, then project configuration, then host defaults. Configured plugins retain declaration order; explicit `--plugin` entries append without reordering.

## Project configuration

`@uttori/asm-plugin-loader-node` discovers `uttori-asm.config.json` from the project directory or accepts an explicit file. The published schema is available as `@uttori/asm-plugin-loader-node/asm-config.schema.json`.

```json
{
  "$schema": "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
  "plugins": [
    {
      "module": "@uttori/asm-plugin-snes",
      "options": {
        "checksumMode": "asar",
        "checksumEnabled": true,
        "asarSuperFxMoveShortAddress": false
      }
    }
  ],
  "target": "snes.sfc",
  "architecture": "snes.65816",
  "includePaths": ["./", "./include"]
}
```

| Field | Meaning |
| --- | --- |
| `$schema` | Optional editor/schema URI |
| `plugins` | Ordered plugin modules and package-specific option objects |
| `target` | Target contribution ID or alias |
| `architecture` | Architecture contribution ID or alias valid for the target |
| `includePaths` | Paths resolved relative to the configuration file |

Package names resolve like normal ESM imports. Relative and absolute paths resolve from the configuration directory. The loader validates plugin options before activation, rejects duplicate modules and ownership collisions, freezes successful environments, and disposes replaced environments in reverse activation order.

## Plugin authoring

A plugin is a default-exported `AssemblerPlugin` built with the documented `@uttori/asm-core/plugin` entry point. Its manifest contains:

- `id`, `name`, `version`, and `apiVersion`;
- optional `description`; and
- optional `requires` entries containing a plugin ID and semver range.

`validateOptions()` normalizes configuration before `activate()` registers contributions. Version 1 supports session-state slots, architectures, address spaces, output formats, directive sets, expression sets, lifecycle hooks, and targets. Contribution IDs should be namespaced to the plugin. Duplicate IDs and user-facing aliases fail activation with owner-rich diagnostics; overrides are not supported.

The [plugin author example](examples/plugin-author/README.md) is a runnable copy of the tiny fixture-plugin pattern. It contributes a raw target, one-byte encoder, flat address space, output format, directive metadata, and cloned per-session state. Production plugins must import only `@uttori/asm-core` or `@uttori/asm-core/plugin`, never internal source paths.

### Trusted-code warning

Plugins are trusted, in-process JavaScript modules. Loading one can execute arbitrary code with the assembler process’s permissions. Only configure packages or paths you trust. The CLI loads explicitly configured plugins; VS Code loads workspace-configured plugins only after Workspace Trust is granted. Contribution state is session-isolated, but this is not a security sandbox.

## Language server and VS Code

Build and smoke-test the stdio language server:

```sh
npm run lsp:typecheck
npm run lsp:build
npm run lsp:smoke
```

It supports incremental diagnostics, symbols, definitions, references, rename, hover, completion, signature help, semantic tokens, unsaved overlays, and target-filtered tooling catalogs.

The extension in [editors/vscode](editors/vscode) auto-associates **Uttori SNES** (`uttori-snes`) with `.asm`, `.src`, `.SRC`, `.s`, and `.inc`. **Uttori 65xx** (`uttori-65xx`) is a manual language mode via **Change Language Mode**. It bundles SNES for zero-configuration workspaces and propagates `asm.configFile`, `asm.plugins`, `asm.target`, `asm.architecture`, `asm.entryPoints`, `asm.includePaths`, `asm.buildOutput`, and `asm.baseImage` to the server. In restricted workspaces it refuses workspace plugin/configuration execution and publishes a warning.

```sh
npm run vscode:typecheck
npm run vscode:package
```

See the [extension README](editors/vscode/README.md) for the end-user command and settings reference.

## SNES compatibility scope

The first-party plugin targets practical Asar compatibility, including 65816, SPC700/inline SPC, Super FX, mapper and checksum behavior, freespace/RATS allocation, and selected compatibility no-ops. It is not a promise that every Asar feature is implemented. Focused fixtures live in `fixtures/asar/tests`; slideshow, Chou Makaimura, Yoshi’s Island, and disassembly projects provide byte-parity gates. Deferred syntax remains visible under `fixtures/asar/tests/Unsupported`.

Compatibility policy is isolated in `plugins/snes/src/asar/compatibility.ts`; no SNES target policy exists in core.

## Development

| Command | Purpose |
| --- | --- |
| `npm test` | Run all AVA tests |
| `npm run typecheck` | Type-check root, workspaces, scripts, and the author example |
| `npm run check:boundaries` | Enforce core/plugin/LSP ownership boundaries |
| `npm run test:coverage` | Run source coverage |
| `npm run verify` | Run formatting, lint, boundaries, types, declarations, coverage, LSP, and editor gates |
| `npm run pack:check` | Assert required runtime files and the loader schema exist in package dry-runs |
| `npm run fixture:asar` | Run the Asar fixture harness |
| `npm run fixture:slideshow` | Run the slideshow integration fixture |
| `npm run fixture:chou` | Run the Chou Makaimura integration fixture |
| `npm run benchmark:smoke` | Run correctness-checked smoke benchmarks |

The final migration gates are `npm run verify`, `npm run pack:check`, all three fixture commands above, and `npm run benchmark:smoke`.

## Repository layout

```text
packages/core/                architecture-neutral runtime and plugin API
packages/plugin-loader-node/  Node discovery, config loader, and JSON schema
plugins/snes/                 SNES implementation and parity tests
plugins/65xx/                 65xx-family instruction models, encoders, and fixtures
src/                          generic CLI host
language-server/              LSP transport and environment controller
editors/vscode/               VS Code client and bundled artifacts
examples/plugin-author/       runnable third-party plugin template
tests/                        core, loader, LSP, and cross-package tests
fixtures/                     focused and production integration projects
scripts/                      boundary, package, fixture, smoke, and benchmark gates
```

## License

MIT © Matthew Callis. See [LICENSE](LICENSE).
