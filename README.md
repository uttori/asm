# snes-asm-js

An Asar-compatible SNES assembler written in TypeScript, with built-in 65816, SPC700, and Super FX support.

The repository also includes a Language Server Protocol implementation and a VS Code extension powered by the same parser and analysis pipeline as the assembler.

The assembler can create a binary from source or apply assembly to an existing ROM. It is designed for programmatic use, command-line builds, and editor tooling.

## Features

- Three-stage assembly pipeline: definition collection, layout resolution, and byte emission.
- 65816, SPC700, inline SPC700, and Super FX instruction encoding.
- LoROM, HiROM, ExLoROM, ExHiROM, SA-1, full SA-1, Super FX, and mapper-free layouts.
- Named, local, relative, static, macro, namespaced, and struct-member labels.
- Defines, user functions, macros (including variadic macros), structs, namespaces, loops, and conditional assembly.
- Data, fill/pad, freespace, binary include, source include, character-table, and SPC block directives.
- Asar-compatible expression syntax, checksum behavior, and selected compatibility no-ops.
- File-provider abstraction for disk, memory, and unsaved editor overlays.
- Recovery-friendly analysis with structured diagnostics, symbols, references, precise source ranges, and an include graph.

## Requirements

- Node.js 20 or newer for the assembler and bundled editor tools.
- A Node.js release accepted by AVA 8 (`^22.20`, `^24.12`, or `>=26`) to run the development test suite.
- npm for the documented workspace scripts.

## Install

Clone the repository and install all workspace dependencies:

```sh
git clone https://github.com/MatthewCallis/snes-asm-js.git
cd snes-asm-js
npm install
```

The package is ESM and currently exports its TypeScript source. Use it from a TypeScript-aware runtime or bundler (the repository uses `tsx` during development).

## Command Line

Assemble a source file into a new binary:

```sh
npm run cli -- path/to/main.asm path/to/main.sfc
```

Apply the assembly to an existing ROM:

```sh
npm run cli -- path/to/patch.asm path/to/patched.sfc path/to/base.sfc
```

The optional checksum mode may appear after the positional arguments:

```sh
npm run cli -- main.asm main.sfc base.sfc --checksum-mode=asar
npm run cli -- main.asm main.sfc --checksum-mode=simple
```

`asar` is the default and follows Asar-compatible header/checksum behavior.
`simple` uses a direct 16-bit sum and is useful for controlled compatibility fixtures.

## Programmatic API

```ts
import fs from "node:fs";
import path from "node:path";
import { Assembler } from "snes-asm-js";

const sourceFile = path.resolve("src/main.asm");
const source = fs.readFileSync(sourceFile, "utf8");
const baseRom = fs.existsSync("game.sfc")
  ? new Uint8Array(fs.readFileSync("game.sfc"))
  : undefined;

const assembler = new Assembler(baseRom, { collectSourceMetadata: false });
assembler.setCurrentFile(sourceFile);
assembler.setIncludePaths([path.dirname(sourceFile)]);
assembler.setChecksumMode("asar");
assembler.assembleSource(source, sourceFile);

fs.writeFileSync("build/game.sfc", assembler.getBinaryOutput());
```

`collectSourceMetadata: false` is intended for ROM-only builds and skips symbol, reference, include-graph, and address-to-line artifacts. Leave it enabled (the default) when reading those artifacts directly. The `analyze*` APIs always use their own metadata-enabled analysis session.

For callers that need control over individual phases:

```ts
const program = assembler.buildProgramModel(source, sourceFile);

assembler.runStage("collectDefinitions", program);
assembler.runStage("resolveLayout", program);
assembler.runStage("emitProgram", program);
```

`assembler.assembleProgram(program)` runs those three stages in order.

### Analysis API

Analysis uses the production front end and recovers after local assembly errors where possible:

```ts
const result = assembler.analyzeSource(source, sourceFile);

console.log(result.diagnostics);
console.log(result.symbols);
console.log(result.references);
console.log(result.includeEdges);
```

The analysis result also includes the parsed `program` model. `analyzeDocument`, `analyzeProgram`, and `analyzeWorkspace` are available for editor and build-tool integrations.

## Source Example

```asm
lorom
org $008000

!counter = $10

Start:
  sei
  clc
  xce
  stz !counter

.loop:
  inc !counter
  bra .loop
```

The language is intentionally close to Asar. See [`fixtures/asar/tests`](fixtures/asar/tests) for focused supported examples and [`fixtures/integration`](fixtures/integration) for real-world regression projects.

## Compatibility Scope

This project targets practical Asar compatibility, but it is not yet a complete
drop-in replacement for every Asar feature. The main fixture suite and the
slideshow and Chou Makaimura integration projects are used as byte-parity gates.
Known unsupported or deferred syntax is retained under
[`fixtures/asar/tests/Unsupported`](fixtures/asar/tests/Unsupported) so the
boundary remains visible.

Compatibility-specific policy is centralized in
[`src/compatibility/asar-compatibility-profile.ts`](src/compatibility/asar-compatibility-profile.ts),
including checksum selection, mapper behavior, freespace availability, inline
SPC behavior, and intentional no-op directives.

## Language Server

The language server lives in [`language-server`](language-server) and supports:

- incremental document synchronization and diagnostics;
- document and workspace symbols;
- go-to-definition and find-references across source includes;
- hover documentation and completion for instructions, directives, and project symbols;
- instruction/directive signature help;
- semantic tokens; and
- cross-file rename for user-defined symbols.

Build and run it over standard input/output:

```sh
npm run lsp:typecheck
npm run lsp:build
./language-server/out/server.mjs --stdio
```

The generated server is self-contained except for the optional `debug` package.
It targets the [Language Server Protocol 3.18 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/),
uses UTF-16 positions explicitly, and is built on Microsoft’s stable 10.1.x
language client/server SDK.

## VS Code Extension

The extension in [`editors/vscode`](editors/vscode) registers SNES assembly for `.asm`, `.src`, `.SRC`, `.s`, and `.inc` files. In addition to the language server features above, it provides:

- **SNES Assembly: Build ROM** — build the active source, including unsaved editor contents;
- **SNES Assembly: Toggle Build on Save (Watch)** — rebuild the configured entry point whenever an assembly source is saved; and
- syntax highlighting, comment configuration, bracket pairing, and a watch status item.

Project settings:

| Setting | Purpose | Default |
| --- | --- | --- |
| `snesAsm.entryPoints` | Workspace-relative root files used for include-aware analysis and watch builds | `[]` |
| `snesAsm.includePaths` | Extra workspace-relative include search paths | `["./"]` |
| `snesAsm.architecture` | Default instruction catalog and assembler architecture | `"65816"` |
| `snesAsm.buildOutput` | Workspace-relative or absolute ROM output path | Source file with `.sfc` extension |
| `snesAsm.targetRom` | Workspace-relative or absolute base ROM to patch | none |

Build a VSIX package:

```sh
npm run vscode:package
```

For extension development, open `editors/vscode` as the VS Code workspace and press F5. Its launch task rebuilds both the server and extension before opening an Extension Development Host.

See the [extension README](editors/vscode/README.md) for the concise end-user reference.

## Development

Common commands:

| Command | Purpose |
| --- | --- |
| `npm test` | Run the AVA test suite |
| `npm run test:coverage` | Run tests with source coverage |
| `npm run coverage:verify` | Enforce aggregate and stable-module coverage thresholds |
| `npm run lint` | Lint production source |
| `npm run make-types` | Emit declarations to `dist` |
| `npm run fixture:asar` | Run the Asar fixture harness |
| `npm run fixture:slideshow` | Run the slideshow integration fixture |
| `npm run fixture:chou` | Run the Chou Makaimura integration fixture |
| `npm run benchmark:smoke` | Run correctness-checked smoke benchmarks |
| `npm run benchmark:chou` | Run one isolated, parity-checked Chou performance gate |
| `npm run benchmark:chou:stable` | Run three isolated Chou samples and enforce the performance budget |
| `npm run verify` | Run the primary lint, type, coverage, LSP, and extension checks |
| `npm run pack:check` | Inspect the npm package without publishing it |

The coverage gate currently requires at least 92% statements, 88% branches, and 93% functions overall, with stricter per-file thresholds for selected stable directive, macro, and LSP modules.

## Repository Layout

```text
src/                 assembler, IR, directives, services, and analysis APIs
src/lsp/             editor-neutral catalogs, indexing, and position lookup
language-server/     LSP transport and protocol providers
editors/vscode/      VS Code language client and extension contributions
tests/               unit, service-seam, integration, and editor-provider tests
fixtures/asar/       Asar compatibility sources and golden binaries
fixtures/integration real-world slideshow and disassembly regressions
scripts/             fixture runners and benchmark tooling
```

## Project Status & Direction

The production assembler uses one lowered execution pipeline for commands,
loops, conditionals, and includes. Directive effects and architecture encoders
are separated behind focused capability contracts, and the assembler and editor
features consume the same analysis artifacts.

The next optimization work should be measurement-led. Candidate areas include
expression caching, include memoization, cheaper pass-program cache keys, and
incremental language-server re-analysis. A public directive/architecture plugin
API is intentionally deferred until lifecycle, isolation, collision, versioning,
and analysis contracts are explicit.

## License

MIT © Matthew Callis. See [`LICENSE`](LICENSE).
