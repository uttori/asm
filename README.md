# Uttori ASM

Uttori ASM is a pluggable assembler, disassembler, and debugger toolkit for TypeScript and Node.js. Its architecture-neutral core owns parsing, the three-stage assembly pipeline, symbols, macros, includes, diagnostics, output writing, and editor analysis. Target-neutral packages add versioned analysis projects, conservative control-flow traversal, evidence, reversible source export, and an emulator-neutral debug contract. Plugins own targets, reversible instruction specifications, address spaces, output formats, mapper behavior, target directives, expression functions, lifecycle behavior, and per-session state.

The repository contains nine publishable packages:

| Package                             | Purpose                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@uttori/asm-cli`                   | Installable `uttori-asm` command and Node.js host defaults                                             |
| `@uttori/asm-core`                  | Generic assembler runtime, analysis APIs, and plugin contracts                                         |
| `@uttori/asm-debug-adapter`         | Emulator-neutral backend, replay/conformance harness, sidecar protocol, and DAP bridge                 |
| `@uttori/asm-debug-sidecar-ares`    | Clean-room MIT translator/process host for a separately maintained ares runtime                        |
| `@uttori/asm-debug-sidecar-mesence` | Clean-room MIT translator/process host for a separately maintained MesenCE runtime                     |
| `@uttori/asm-disassembler`          | Native analysis projects, evidence, conservative traversal, transactions, assets, and export contracts |
| `@uttori/asm-plugin-loader-node`    | Trusted Node.js plugin discovery and `uttori-asm.config.json` loading                                  |
| `@uttori/asm-plugin-snes`           | SNES/SFC target with 65816, SPC700, Super FX, and Asar compatibility                                   |
| `@uttori/asm-plugin-65xx`           | NMOS, CMOS, Commodore, Hudson, Mitsubishi, and MEGA65 encoders with native and ca65-shaped raw targets |

The private language-server, VS Code, and plugin-author workspaces compose those packages. The language server and extension use the same loaded plugin environment as command-line builds, so diagnostics and editor catalogs match the selected target.

## Requirements & Installation

- Node.js v26 or newer for the assembler packages, CLI, bundled editor tools, and development suite.

```sh
git clone https://github.com/uttori/asm.git
cd asm
npm install
```

The packages are ESM and currently expose TypeScript source as their runtime import. Use a TypeScript-aware runtime or bundler; this repository uses `tsx` during development.

## Generic Core Usage

The core has no default target and never imports a plugin. Activate plugins, freeze the environment, then pass an explicit target to every build or analysis session:

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

Construction without a resolved environment and target results in an error. Encoders, directive handlers, lifecycle hooks, and mutable plugin state are created independently for each session.

For individual stages, call `buildProgramModel()` followed by `runStage("collectDefinitions")`, `runStage("resolveLayout")`, and `runStage("emitProgram")`. `assembleProgram()` runs all three. `analyzeSource()`, `analyzeDocument()`, `analyzeProgram()`, and `analyzeWorkspace()` use the production front end with recovery-oriented diagnostics.

## SNES Quick Start

The SNES package exposes an explicit environment factory and target ID:

```ts
import fs from "node:fs";
import { Assembler } from "@uttori/asm-core";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

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

See the [SNES Plugin Reference](packages/plugin-snes/README.md) for target aliases, architectures, mapper directives, expressions, checksum options, and output behavior.

## SNES Disassembly Quick Start

Create and analyze a native, versioned project without copying ROM bytes into it:

```sh
npm run cli -- disassemble game.sfc game.analysis
npm run cli -- analyze game.analysis --rom game.sfc
npm run cli -- export game.analysis game.source --rom game.sfc
npm run cli -- verify-roundtrip game.source --rom game.sfc
```

Mapper detection stops for an explicit override when evidence is inconclusive. `.dizraw` can be
imported during project creation, but native syntax/project output is the goal and Diz export is not
supported. See the [CLI analysis workflow](packages/cli/README.md#analysis-projects),
[disassembler package](packages/disassembler/README.md), and
[system architecture](docs/disassembler-architecture.md).

### Command Line / Zero-Configuration CLI

With no `uttori-asm.config.json` and no explicit plugin, the CLI product supplies the bundled SNES plugin as its host-level default. Core itself still has no default.

The CLI is published as the [`@uttori/asm-cli` package](packages/cli/README.md). Its installed executable is `uttori-asm`; the repository-level `npm run cli` command delegates to that workspace.

```sh
# SNES zero-configuration build
npm run cli -- path/to/main.asm path/to/main.sfc
```

When output is omitted, the selected target supplies its extension.

```sh
npm run cli -- main.asm
➜ main.sfc
```

Patch an existing ROM image instead of starting with an empty output buffer:

```sh
npm run cli -- patch.asm patched.sfc --base-image clean.sfc
```

```sh
# Explicit project/plugin build
npm run cli -- packages/plugin-author/main.asm build/main.bin \
  --config packages/plugin-author/uttori-asm.config.json

# Overrides
npm run cli -- main.asm --plugin ./plugin.js --target custom.raw \
  --architecture custom.cpu --base-image base.bin --include-path includes \
  --plugin-option custom.plugin:mode="strict" --verbose
```

Useful CLI options are:

| Option                             | Meaning                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `--config path`                    | Load a particular `uttori-asm.config.json`                        |
| `--plugin module`                  | Append a plugin module; repeatable                                |
| `--target id`                      | Override the configured target                                    |
| `--architecture id`                | Override the initial architecture                                 |
| `--base-image path`                | Read and patch an existing binary image                           |
| `--include-path path`              | Add a source/binary lookup directory; repeatable                  |
| `--plugin-option plugin:key=value` | Override one plugin option; values are JSON-decoded when possible |
| `--verbose`                        | Print resolved plugins, target, and architecture                  |
| `--help`                           | Print CLI usage                                                   |

Resolution precedence is CLI/editor overrides, then project configuration, then host defaults. Configured plugins retain declaration order; explicit `--plugin` entries append without reordering.

## Project Configuration

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

| Field          | Meaning                                                    |
| -------------- | ---------------------------------------------------------- |
| `$schema`      | Optional editor/schema URI                                 |
| `plugins`      | Ordered plugin modules and package-specific option objects |
| `target`       | Target contribution ID or alias                            |
| `architecture` | Architecture contribution ID or alias valid for the target |
| `includePaths` | Paths resolved relative to the configuration file          |

Package names resolve like normal ESM imports. Relative and absolute paths resolve from the configuration directory. The loader validates plugin options before activation, rejects duplicate modules and ownership collisions, freezes successful environments, and disposes replaced environments in reverse activation order.

## Plugin Authoring

A plugin is a default-exported `AssemblerPlugin` built with the documented `@uttori/asm-core/plugin` entry point. Its manifest contains:

- `id`, `name`, `version`, and `apiVersion`;
- optional `description`; and
- optional `requires` entries containing a plugin ID and semver range.

`validateOptions()` normalizes configuration before `activate()` registers contributions. Version 1 supports session-state slots, architectures, address spaces, output formats, directive sets, expression sets, lifecycle hooks, and targets. Contribution IDs should be namespaced to the plugin. Duplicate IDs and user-facing aliases fail activation with owner-rich diagnostics; overrides are not supported.

The [plugin author example](packages/plugin-author/README.md) is a runnable copy of the tiny fixture-plugin pattern. It contributes a raw target, one-byte encoder, flat address space, output format, directive metadata, and cloned per-session state. Production plugins must import only `@uttori/asm-core` or `@uttori/asm-core/plugin`, never internal source paths.

### Trusted-Code Warning

Plugins are trusted, in-process JavaScript modules. Loading one can execute arbitrary code with the assembler process's permissions. Only configure packages or paths you trust. The CLI loads explicitly configured plugins; VS Code loads workspace-configured plugins only after Workspace Trust is granted. Contribution state is session-isolated, but this is _not_ a security sandbox.

## Language Server & VS Code

Build and smoke-test the stdio language server:

```sh
npm run lsp:typecheck
npm run lsp:build
npm run lsp:smoke
```

It supports incremental diagnostics, symbols, definitions, references, rename, hover, completion, signature help, semantic tokens, unsaved overlays, and target-filtered tooling catalogs.

The extension in [packages/vscode-extension](packages/vscode-extension) auto-associates **Uttori SNES** (`uttori-snes`) with `.asm`, `.src`, `.SRC`, `.s`, and `.inc`. **Uttori 65xx** (`uttori-65xx`) is a manual language mode via **Change Language Mode**. It bundles SNES for zero-configuration workspaces and propagates `asm.configFile`, `asm.plugins`, `asm.target`, `asm.architecture`, `asm.entryPoints`, `asm.includePaths`, `asm.buildOutput`, and `asm.baseImage` to the server. In restricted workspaces it refuses workspace plugin/configuration execution and publishes a warning.

```sh
npm run vscode:typecheck
npm run vscode:package
```

See the [extension README](packages/vscode-extension/README.md) for the end-user command and settings reference.

## Compatibility Scope

See the [SNES plugin README](packages/plugin-snes/README.md) for extensive SNES Asar compatibility and new additions.

See the [65xx plugin README](packages/plugin-65xx/README.md) for extensive 65xx ca65 compatibility and new additions (including the Asar supported concept like structs, macros, ...).

## Development

| Command                     | Purpose                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `npm test`                  | Run all AVA tests (excludes optional external fixtures)                                |
| `npm run typecheck`         | Type-check root, workspaces, scripts, and the author example                           |
| `npm run check:boundaries`  | Enforce core/plugin/LSP ownership boundaries                                           |
| `npm run test:coverage`     | Run source coverage                                                                    |
| `npm run test:fuzz`         | Run deterministic hostile-input decoder/project/trace/protocol fuzzing                 |
| `npm run test:roundtrip`    | Run native decoder, source-export, CLI, and byte-rebuild round trips                   |
| `npm run verify`            | Run formatting, lint, boundaries, types, declarations, coverage, LSP, and editor gates |
| `npm run pack:check`        | Assert required runtime files and the loader schema exist in package dry-runs          |
| `npm run cli:build`         | Build the distributable `uttori-asm` executable                                        |
| `npm run cli:smoke`         | Launch the bundled executable and verify its help path                                 |
| `npm run fixture:asar`      | Run the Asar fixture harness                                                           |
| `npm run fixture:slideshow` | Run the slideshow integration fixture                                                  |
| `npm run benchmark:smoke`   | Run in-repo correctness-checked smoke benchmarks                                       |
| `npm run vscode:smoke`      | Launch VS Code 1.128.0 and exercise real extension activation, LSP, views, and build   |
| `npm run fixtures:status`   | Report external submodule, ROM, and worktree readiness                                 |
| `npm run test:external`     | Run Chou / Yoshi / SMRPG / TMNT / Zelda parity tests                                   |
| `npm run ci:external`       | Strict preflight, serial external tests, clean-worktree check                          |

Core verification is `npm run verify`, `npm run pack:check`, `npm run test:roundtrip`, `npm run fixture:asar`, `npm run fixture:slideshow`, and `npm run benchmark:smoke`. Those gates do not initialize submodules or require local ROMs. The Extension Host smoke downloads a pinned VS Code build but still uses only a temporary synthetic workspace.

External-fixture verification is separate: initialize the needed submodule under `fixtures/external/`, put ROM-dependent inputs in `Local Only/fixtures/roms/`, then run `npm run fixtures:status` and `npm run test:external`. See [fixtures/external/README.md](fixtures/external/README.md).

There are explicit Chou and SMRPG benchmark commands, they will fail with setup instructions when prerequisites are missing. They were created to profile the assembler and avoid silly mistakes taking a subsecond compile to minutes.

## Repository Layout

```text
fixtures/                     focused and production integration projects
packages/cli/                 command-line host, executable bundle, and CLI tests
packages/core/                architecture-neutral runtime and plugin API
packages/debug-adapter/       emulator-neutral backend, framing, replay, conformance, and DAP
packages/debug-sidecar-ares/  MIT ares translator and separately managed process host
packages/debug-sidecar-mesence/ MIT MesenCE translator and separately managed process host
packages/disassembler/        native project, evidence, analysis, edit, asset, and export primitives
packages/language-server/     LSP transport and environment controller
packages/plugin-65xx/         65xx-family instruction models, encoders, and fixtures
packages/plugin-author/       runnable third-party plugin template
packages/plugin-loader-node/  Node discovery, config loader, and JSON schema
packages/plugin-snes/         SNES implementation and parity tests
packages/vscode-extension/    VS Code client and bundled artifacts
scripts/                      boundary, package, fixture, smoke, and benchmark gates
tests/                        core, loader, LSP, and cross-package tests
```

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md), then read the
[disassembler architecture](docs/disassembler-architecture.md) and
[testing/release guide](docs/testing-and-release.md) for the part you are changing. The contributor
guide includes a beginner glossary, package ownership, change recipes, security/license boundaries,
performance-comment requirements, private-fixture rules, troubleshooting, and a review checklist.

`DISASSEMBLER_ROADMAP_V2.md` is the progress source of truth for disassembler work and must be
updated after every completed implementation step.

## License

MIT © Matthew Callis. See [LICENSE](LICENSE).
