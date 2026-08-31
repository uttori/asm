# Uttori ASM

Uttori ASM is a pluggable assembler toolkit for TypeScript and Node.js. Its architecture-neutral core owns parsing, the three-stage assembly pipeline, symbols, macros, includes, diagnostics, output writing, and editor analysis. Plugins own targets, instruction encoders, address spaces, output formats, target directives, expression functions, lifecycle behavior, and per-session state.

The repository ships four production packages:

| Package                          | Purpose |
| -------------------------------- | ------- |
| `@uttori/asm-core`               | Generic assembler runtime, analysis APIs, and plugin contracts |
| `@uttori/asm-plugin-loader-node` | Trusted Node.js plugin discovery and `uttori-asm.config.json` loading |
| `@uttori/asm-plugin-snes`        | SNES/SFC target with 65816, SPC700, Super FX, and Asar compatibility |
| `@uttori/asm-plugin-65xx`        | NMOS, CMOS, Commodore, Hudson, Mitsubishi, and MEGA65 encoders with native and ca65-shaped raw targets |

The language server and VS Code extension use the same loaded plugin environment as command-line builds, so diagnostics and editor catalogs match the selected target.

## Requirements & Installation

- Node.js v20 or newer for the assembler and bundled editor tools.
- A Node.js release accepted by AVA 8 (`^22.20`, `^24.12`, or `>=26`) for the development suite.

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

See the [SNES Plugin Reference](plugins/snes/README.md) for target aliases, architectures, mapper directives, expressions, checksum options, and output behavior.


### Command Line / Zero-Configuration CLI

With no `uttori-asm.config.json` and no explicit plugin, the CLI product supplies the bundled SNES plugin as its host-level default. Core itself still has no default.

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
npm run cli -- examples/plugin-author/main.asm build/main.bin \
  --config examples/plugin-author/uttori-asm.config.json

# Overrides
npm run cli -- main.asm --plugin ./plugin.js --target custom.raw \
  --architecture custom.cpu --base-image base.bin --include-path includes \
  --plugin-option custom.plugin:mode="strict" --verbose
```

Useful CLI options are:

| Option | Meaning |
| ------ | ------- |
| `--config path`                    | Load a particular `uttori-asm.config.json` |
| `--plugin module`                  | Append a plugin module; repeatable |
| `--target id`                      | Override the configured target |
| `--architecture id`                | Override the initial architecture |
| `--base-image path`                | Read and patch an existing binary image |
| `--include-path path`              | Add a source/binary lookup directory; repeatable |
| `--plugin-option plugin:key=value` | Override one plugin option; values are JSON-decoded when possible |
| `--verbose`                        | Print resolved plugins, target, and architecture |
| `--help`                           | Print CLI usage |

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

| Field          | Meaning |
| -------------- | --- |
| `$schema`      | Optional editor/schema URI |
| `plugins`      | Ordered plugin modules and package-specific option objects |
| `target`       | Target contribution ID or alias |
| `architecture` | Architecture contribution ID or alias valid for the target |
| `includePaths` | Paths resolved relative to the configuration file |

Package names resolve like normal ESM imports. Relative and absolute paths resolve from the configuration directory. The loader validates plugin options before activation, rejects duplicate modules and ownership collisions, freezes successful environments, and disposes replaced environments in reverse activation order.

## Plugin Authoring

A plugin is a default-exported `AssemblerPlugin` built with the documented `@uttori/asm-core/plugin` entry point. Its manifest contains:

- `id`, `name`, `version`, and `apiVersion`;
- optional `description`; and
- optional `requires` entries containing a plugin ID and semver range.

`validateOptions()` normalizes configuration before `activate()` registers contributions. Version 1 supports session-state slots, architectures, address spaces, output formats, directive sets, expression sets, lifecycle hooks, and targets. Contribution IDs should be namespaced to the plugin. Duplicate IDs and user-facing aliases fail activation with owner-rich diagnostics; overrides are not supported.

The [plugin author example](examples/plugin-author/README.md) is a runnable copy of the tiny fixture-plugin pattern. It contributes a raw target, one-byte encoder, flat address space, output format, directive metadata, and cloned per-session state. Production plugins must import only `@uttori/asm-core` or `@uttori/asm-core/plugin`, never internal source paths.

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

The extension in [editors/vscode](editors/vscode) auto-associates **Uttori SNES** (`uttori-snes`) with `.asm`, `.src`, `.SRC`, `.s`, and `.inc`. **Uttori 65xx** (`uttori-65xx`) is a manual language mode via **Change Language Mode**. It bundles SNES for zero-configuration workspaces and propagates `asm.configFile`, `asm.plugins`, `asm.target`, `asm.architecture`, `asm.entryPoints`, `asm.includePaths`, `asm.buildOutput`, and `asm.baseImage` to the server. In restricted workspaces it refuses workspace plugin/configuration execution and publishes a warning.

```sh
npm run vscode:typecheck
npm run vscode:package
```

See the [extension README](editors/vscode/README.md) for the end-user command and settings reference.

## Compatibility Scope

See the [SNES plugin README](plugins/snes/README.md) for extensive SNES compatibility.

### 65xx ca65 Compatibility

This matrix describes source compatibility. Use target `65xx.ca65-raw` (alias `ca65-raw`) for a headerless flat image, or `65xx.nes` for the selected iNES/ld65-shaped layout. Both targets use the same 65xx instruction encoders and ca65 source profile.

Status meanings:

- **Supported**: accepted with the documented ca65 source meaning within the target's image model.
- **Partial**: useful source behavior is implemented, but object, linker, or an advanced ca65 semantic is intentionally absent.
- **Unsupported**: rejected rather than silently ignored.

### ca65 CPUs & Instructions

| Feature | Status | Notes |
| ------- | ------ | ----- |
| `.setcpu` / `.cpu`, `.pushcpu`, `.popcpu`    | Supported | Selects and stacks the active encoder during assembly. |
| CPU shorthand directives                     | Supported | `.p02`, `.p02x`, `.pdtv`, `.psc02`, `.pc02`, `.pwc02`, `.pce02`, `.p4510`, `.p45gs02`, `.p6280`, and `.pm740`. |
| CPU conditionals                             | Supported | Matching `.ifp*` forms for every plugin-owned CPU. |
| CPU names                                    | Supported | `6502`, `6502X`, `6502DTV`, `65SC02`, `65C02`, `W65C02`, `65CE02`, `4510`, `45GS02`, `HuC6280`, and `M740`. 65816-derived CPUs remain SNES-plugin-owned. |
| Legal, undocumented, and vendor instructions | Supported | Includes 6502X, HuC6280, M740, 65CE02/4510, and 45GS02 forms represented by the declarative catalogs. |

### ca65 Expressions & Symbols

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Hex, binary, decimal, and octal literals                             | Supported   | `$`, `%`, decimal, and ca65 `@` octal syntax. |
| Low/high/bank operators                                              | Supported   | Unary `<`, `>`, and `^`. |
| Pseudo-functions                                                     | Supported   | `.defined`, `.lobyte`, `.hibyte`, `.bankbyte`, `.loword`, and `.hiword`. |
| Inequality and symbol assignment                                     | Supported   | `<>`, `=`, and `:=` source forms. |
| Address-size forcing                                                 | Supported   | `z:`, `a:`, and `f:` are carried into architecture-owned operand classification. |
| Global, cheap-local, and unnamed labels                              | Supported   | Includes `@name`, `:`, `:+`, `:++`, `:-`, and `:--`; file-local symbols remain isolated across included assembly units. |
| `.scope` / `.endscope`, `.proc` / `.endproc`, `Scope::Name`          | Partial     | Flattened into file-local symbol keys. Scope type declarations, address-size annotations, and object visibility metadata are not modeled. |
| `.export` / `.import`                                                | Partial     | Resolves symbols across source files assembled in one session. No relocatable external symbol records are emitted. |
| `.exportzp`, `.importzp`, `.globalzp`, `.forceimport`, `.autoimport` | Unsupported | These require relocatable object/linker semantics and produce an explicit diagnostic. |

### ca65 Directives & Control Flow

| Feature | Status | Notes |
| ------- | ------ | ----- |
| `.byte` / `.byt`, `.word` / `.addr`, `.dbyt`                          | Supported   | Includes ca65 byte ordering. |
| `.dword`, `.faraddr`, `.lobytes`, `.hibytes`                          | Supported   | Emits 32-bit, 24-bit, or selected-byte values respectively. |
| `.res`, `.align`, `.org`                                              | Supported   | Operates directly on the selected flat or iNES image. |
| `.include`, `.incbin`                                                 | Supported   | `.incbin` uses ca65 `file, offset, size` arguments. |
| `.if`, `.elseif`, `.else`, `.endif`, `.ifdef`, `.ifndef`              | Supported   | Dotted forms lower to the shared conditional engine. |
| `.assert`                                                             | Partial     | A false assertion stops assembly with its message. ca65 warning/link-time assertion actions are not reproduced. |
| `.undefine`                                                           | Supported   | Removes a symbol definition through the shared symbol engine. |
| `.segment`, `.pushseg`, `.popseg` on `65xx.ca65-raw`                  | Partial     | Segment names and stack intent are accepted while bytes remain in source order in one flat image. |
| `.segment` on `65xx.nes`                                              | Partial     | Implements the selected MEMORY/SEGMENTS load/run/fill model used by the NES integration fixture; it is not a general ld65 linker. |
| `.constructor`, `.destructor`, `.interruptor`, `.reloc`, `.debuginfo` | Unsupported | Object/linker/debug directives produce an explicit diagnostic. |

## Macros & Repetition

| Feature | Status | Notes |
| ------- | ------ | ----- |
| `.macro` / `.endmacro` and bare invocation                               | Supported | Comma-separated parameters and ca65 `\parameter` substitution are supported. |
| `.repeat` / `.endrepeat`                                                 | Supported | Optional named repeat counters are available as ordinary expressions. |
| `.local`, `.exitmacro`                                                   | Unsupported | Rejected with a macro-compatibility diagnostic. |
| Token-list/string macros, `.match`, `.xmatch`, `.mid`, `.left`, `.right` | Unsupported | The advanced ca65 token macro language is not implemented. |

## Object & Linker Boundary

The profile does not emit cc65 relocatable objects, libraries, relocation records, general ld65 configurations, linker-time imports/exports, or full debug/listing metadata. Adding those capabilities is a separate target/output project that is not currently planned.

The byte-level CPU differential fixtures are pinned to ca65 commit [`e11fb5c39371046ebe25485f984f644c5a0d65d3`](https://github.com/cc65/cc65/commit/e11fb5c39371046ebe25485f984f644c5a0d65d3).

The real-world integration gate assembles the selected Zelda 1 ca65 disassembly to its golden iNES image.

## Development

| Command | Purpose |
| --- | --- |
| `npm test` | Run all AVA tests (excludes optional external fixtures) |
| `npm run typecheck` | Type-check root, workspaces, scripts, and the author example |
| `npm run check:boundaries` | Enforce core/plugin/LSP ownership boundaries |
| `npm run test:coverage` | Run source coverage |
| `npm run verify` | Run formatting, lint, boundaries, types, declarations, coverage, LSP, and editor gates |
| `npm run pack:check` | Assert required runtime files and the loader schema exist in package dry-runs |
| `npm run fixture:asar` | Run the Asar fixture harness |
| `npm run fixture:slideshow` | Run the slideshow integration fixture |
| `npm run benchmark:smoke` | Run in-repo correctness-checked smoke benchmarks |
| `npm run fixtures:status` | Report external submodule, ROM, and worktree readiness |
| `npm run test:external` | Run Chou / Yoshi / SMRPG / TMNT / Zelda parity tests |
| `npm run ci:external` | Strict preflight, serial external tests, clean-worktree check |

Core verification is `npm run verify`, `npm run pack:check`, `npm run fixture:asar`, `npm run fixture:slideshow`, and `npm run benchmark:smoke`. Those gates do not initialize submodules or require local ROMs.

External-fixture verification is separate: initialize the needed submodule under `fixtures/external/`, put ROM-dependent inputs in `Local Only/fixtures/roms/`, then run `npm run fixtures:status` and `npm run test:external`. See [fixtures/external/README.md](fixtures/external/README.md).

There are explicit Chou and SMRPG benchmark commands, they will fail with setup instructions when prerequisites are missing. They were created to profile the assembler and avoid silly mistakes taking a subsecond compile to minutes.

## Repository Layout

```text
editors/vscode/               VS Code client and bundled artifacts
examples/plugin-author/       runnable third-party plugin template
fixtures/                     focused and production integration projects
language-server/              LSP transport and environment controller
packages/core/                architecture-neutral runtime and plugin API
packages/plugin-loader-node/  Node discovery, config loader, and JSON schema
plugins/65xx/                 65xx-family instruction models, encoders, and fixtures
plugins/snes/                 SNES implementation and parity tests
scripts/                      boundary, package, fixture, smoke, and benchmark gates
src/                          generic CLI host
tests/                        core, loader, LSP, and cross-package tests
```

## License

MIT © Matthew Callis. See [LICENSE](LICENSE).
