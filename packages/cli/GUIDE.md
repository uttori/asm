# CLI guide

The Uttori ASM command-line interface assembles projects from a terminal or build script and hosts
ROM analysis, evidence import, and byte-verified source export. It composes the architecture-neutral
core, project configuration loader, and architecture plugins.

- [Assemble](#assemble), [options](#assemble-options), and [arguments and errors](#arguments-paths-and-errors)
- [Programmatic use](#programmatic-use)
- [SNES](#snes): defaults, analysis, runtime evidence, and source export
- [Development](#development)

## Install

Requires Node.js 26 or newer.

```sh
npm install --save-dev @uttori/asm-cli
npx uttori-asm --help
```

Use `npx` for a local installation. The unprefixed `uttori-asm` commands below assume the executable is on PATH (for example, inside an npm script or after a global installation):

```sh
npx --package @uttori/asm-cli uttori-asm main.asm output.bin
npx uttori-asm main.asm output.bin
uttori-asm main.asm output.bin
```

Inside this repository, the root command delegates to this workspace:

```sh
npm run cli -- main.asm output.bin
```

## Assemble

```sh
npx uttori-asm main.asm output.bin
npx uttori-asm patch.asm patched.bin --base-image original.bin
npx uttori-asm main.asm output.bin --debug
```

An omitted output path uses the target's extension. `--debug` also writes `<output>.debug.json`.
`--base-image` preserves unwritten bytes. Target checksum finalization still applies.
Assembly creates output directories and replaces the chosen output. Use a separate output path to preserve a base ROM.
Binary and debug-map destinations must be distinct from each other and the source / config.

`uttori-asm.config.json` selects plugins, target, architecture, and include paths. `--config` chooses
a file. `--plugin`, `--target`, `--architecture`, and `--include-path` override project choices.
Use `--help` for the full command and option list.

Project configuration takes precedence over host defaults. Command-line overrides take precedence
over project configuration. See [configuration and path resolution](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) and the [SNES defaults](#default-behavior).

## Assemble Options

| Option                             | Meaning                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `--config path`                    | Load a particular `uttori-asm.config.json`                        |
| `--plugin module`                  | Append a plugin module. Repeatable                                |
| `--target id`                      | Override the configured target                                    |
| `--architecture id`                | Override the initial architecture                                 |
| `--base-image path`                | Read and patch an existing binary image                           |
| `--debug`                          | Collect source metadata and write `<output>.debug.json`           |
| `--debug-map path`                 | Collect source metadata and write the debug map at `path`         |
| `--include-path path`              | Add a source or binary lookup directory. Repeatable               |
| `--plugin-option plugin:key=value` | Override one plugin option. Values are JSON-decoded when possible |
| `--verbose`                        | Print the resolved plugins, target, and architecture              |
| `--help`                           | Print usage                                                       |

Examples:

```sh
uttori-asm patch.asm patched.bin --base-image clean.bin

uttori-asm main.asm build/main.bin --debug-map build/main.debug.json

uttori-asm main.asm --plugin ./plugin.js --target custom.raw \
  --architecture custom.cpu --include-path includes \
  --plugin-option custom.plugin:mode='"strict"' --verbose
```

## Arguments, Paths, and Errors

Valued options accept `--flag value` or `--flag=value`.
Boolean flags take no value: omit them to disable them, so `--force=false` throws an error.
Repeat `--plugin`, `--include-path`, `--plugin-option`, and `--entry` as needed, other repeated valued options use the last value.
Unknown flags, flags for another command, missing values, invalid limits, and excess positional arguments fail before work.
Use an explicit `assemble` if a source filename matches a command name.

Paths use the host OS's syntax. CLI input/output/config/base/ROM paths are relative to the current
working directory. Plugin and include paths follow the [configuration resolution rules](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md).
Quote paths containing spaces. Use `--` to stop option parsing, for example
`uttori-asm assemble -- --source.asm output.bin`. A valued option whose value begins with `--` needs
the equals form.

Normal success and `--help` return **0**. Argument, input, configuration, compilation, verification,
and cleanup failures return **1**, with diagnostics on stderr. An analysis that records an explicit
incomplete result returns 0. Inspect its status and reasons before treating discovery as complete.
Help, progress, verbose details, and success messages use stdout. Warnings use stderr. Output is
human-readable and has no uniform machine-readable schema. Use the exit status rather than matching
a success line, since a later step or cleanup can fail.

Assembly replaces the chosen binary and optional debug map. Parent directories are created, both
artifacts are computed and staged before publication, and each file is replaced by rename. Bad map
paths or staging failures leave prior artifacts intact. Outputs must be distinct and cannot alias the
entry source or selected config. An explicitly chosen base-image output can still patch that base
in place. Choose a separate output to retain it. Publication is atomic per file, not across both files
if termination or a rename error occurs between them.

The CLI installs no signal handlers and exposes no `AbortSignal` on `runCli`. Ctrl-C uses Node's
default termination behavior (commonly shell status 130 on POSIX). It does not promise graceful
cleanup or a returned API status. Before publication, interruption preserves the old assembly
artifacts. A staged temporary sibling may remain. Hosts needing
cooperative cancellation should use the underlying project APIs.

## Programmatic Use

The package exports `parseCliArguments()`, `runCli()`, the `CliArguments` interface, and the generated usage text:

```ts
import { runCli } from "@uttori/asm-cli";

process.exitCode = await runCli(["main.asm", "output.bin"]);
```

`parseCliArguments(argv)` parses tokens without file I/O or plugin loading and throws `Error` for invalid arguments.
Paths remain unresolved, list fields and the outer plugin-option map are shallow-frozen.
Required input / ROM presence is checked during execution so `--help` can stand alone.

`runCli(argv = process.argv.slice(2))` uses the process working directory, filesystem, and console.
It returns `0` or `1` and attempts session and plugin disposal before settling, including when cleanup itself fails.
It neither calls `process.exit()` nor changes `process.exitCode`, the executable wrapper sets the status.
Plugins are trusted in-process code.
Serialize calls when changing the process working directory or intercepting console output.
There is no graceful-cancellation API.

Use `@uttori/asm-core` directly when the host needs structured results and owns file handling.

## SNES

The bundled `@uttori/asm-plugin-snes` provides the default assembly target. The CLI's ROM analysis,
native instruction-trace import, and native source-export commands below currently operate on SNES projects.
Installing another architecture plugin changes assembly choices. It does not add these SNES analysis
workflows to that architecture. See the [SNES manual](https://github.com/uttori/asm/blob/master/packages/plugin-snes/MANUAL.md)
for mapper, instruction, and hardware details.

### Default Behavior

When neither `uttori-asm.config.json` nor an explicit `--plugin` is present, the CLI activates the bundled `@uttori/asm-plugin-snes` package and selects its `snes.sfc` target. Core itself has no default target.

If the output path is omitted, the selected target supplies its default extension:

```sh
uttori-asm main.asm
# Writes main.sfc for the default SNES target.
```

Project configuration takes precedence over the host default. Command-line overrides take precedence over project configuration.

### Patching SNES ROMs

`--base-image` seeds the complete output before assembly, preserving bytes that source does not
replace and allowing growth beyond the original image. Target finalization still applies: the SNES
target normally updates its checksum. To preserve those fields, configure the SNES plugin's
`checksumEnabled: false` option. Mapper addresses describe headerless ROM content. Remove a copier
header before patching and restore it afterward if needed.

### Git source workflow

Create a Git source project, then edit assembly, assets, and research as ordinary files:

```sh
npx uttori-asm source init game-source game.sfc --mapper lorom
# Optional creation import: --dizraw research.dizraw
npx uttori-asm source import game-source capture.act2
# Import several archives in selection order:
npx uttori-asm source import game-source first.act2 second.act2 trace.json
npx uttori-asm source analyze game-source
npx uttori-asm source prepare game-source
npx uttori-asm source preview game-source <candidate-commit>
git -C game-source add <reviewed-paths>
git -C game-source commit -m "Checkpoint source edits"
npx uttori-asm source apply game-source <candidate-commit>
# Resolve any conflicts in Git/VS Code and stage the resolutions.
npx uttori-asm source finish game-source
npx uttori-asm source build game-source
```

Git must have an author configured. Creation verifies an exact original-ROM build before adopting
an immutable generation commit. Preparation and preview preserve uncommitted edits; applying a
candidate requires a clean checkout and reuses the existing commit; no new commit is required when
there are no local edits. Preserve any named existing edits before applying. `source abort` returns
an active merge to the pre-merge commit. Review and stage the generated changes before `source finish`
validates the resolved build and commits the merge.

Capture imports log the absolute filename, archive identity, named stages, and provisional SQLite
merge counts with rate and estimated remaining time to stderr; JSON results stay on stdout. Bulk
imports commit each file independently and stop on failure or cancellation. The error identifies the
failed file and completed/unattempted counts. Retrying the same queue preserves earlier imports
without duplicating observations.

Each worktree keeps its latest successfully prepared generation. Preparing a replacement releases
older candidate pins and their preview after original-ROM verification succeeds. Failed or cancelled
rendering preserves the previous proposal. Finished generations remain in ordinary source history.

Tracked research under `.uttori/research/` retains original identities and preferred names.
SQLite indexes those choices alongside capture evidence. Private ROM/evidence bindings live in
ignored `.uttori-local/`; a clone needs its own local binding and retained evidence before generation.
Working source may intentionally differ from the ROM; only pure generations require original-ROM
equality. ROMs and emulator binaries are not distributed.

### Analysis Projects

Create a native analysis project from a user-supplied ROM:

```sh
uttori-asm disassemble game.sfc game.analysis
```

Mapper detection is conservative. If the scored header candidates are inconclusive, creation stops until `--mapper` is supplied. `--header-size 0|512` overrides copier-header detection. All supported mapper names are shown by `--help`.

An uncompressed DiztinGUIsh project can be imported while creating the project:

```sh
uttori-asm disassemble game.sfc game.analysis --dizraw game.dizraw --mapper hirom
```

The importer stores its deterministic loss report in SQLite's imports table. Compressed `.diz` input and `.dizraw` export are unsupported.

`--instruction-trace` imports stream through SQLite without loading prior runtime history. Use separate commands for large captures.

SQLite storage shares runtime facts across captures, stores exact instruction / state pairs once, and retains compact per-capture counts and provenance. Imports preserve prior runtime history. Exact reimports do not rewrite records or run VACUUM.

To reclaim unused pages in a current-format database during explicit maintenance:

```sh
uttori-asm project-compact game.analysis
```

Compaction checkpoints WAL, prunes unused dictionary entries, and runs VACUUM. It preserves logical records and revision and checks that there is sufficient temporary disk space.

Validate metadata and stream runtime history, optionally checking the exact ROM identity:

```sh
uttori-asm project-validate game.analysis --rom game.sfc
```

Run conservative 65816 control-flow analysis and persist its CFG, state, evidence, conflicts, and coverage back into the project:

```sh
uttori-asm analyze game.analysis --rom game.sfc
```

Additional entry points can be supplied with repeatable `--entry` options using `$`, `0x`, or decimal
notation. Quote shell-sensitive addresses, for example `--entry='$008000'`.
These are 24-bit CPU addresses, not ROM file offsets. `--max-work-items` is a positive
integer (default 1,000,000). `--max-call-depth` is nonnegative (default 16, with 0 discarding call context).
Hitting either bound reports explicit incomplete analysis rather than silently truncating it. A pass
that would lose existing decoded code can instead fail without replacing saved analysis.

Editable `target-set` and `target-override` records in the SQLite analysis table are retained on subsequent runs and take precedence over unresolved static targets.

The complete ROM remains external. Imported captures can retain bounded instruction bytes.

### Offline Runtime Evidence

Import a native instruction recording into an existing project:

```sh
uttori-asm evidence-import game.analysis --rom game.sfc \
  --instruction-trace instruction-trace.json
```

Every import verifies the project's exact ROM identity and stored mapper first. Native instruction traces preserve ordered pull chunks and producer-loss metadata and use the same `snes.cpu` CPU-bus identity as native analysis projects. An identical reimport preserves facts and the semantic revision, while refreshing its import receipt.

Native trace files are read incrementally with a default 32 GiB file-size limit. Use `--trace-max-mib` to override it (default 32768 MiB). Git source imports use `limits.captureBytes` in `.uttori/project.json` (bytes), with no default size ceiling for either primary recordings or graphics companions. This avoids JavaScript's single-string size limit. `full` is the only supported trace-index mode and retains all supplied registers, bytes, execution counts and bus observations. SQLite project imports have no fixed record ceiling; input-file and configured storage budgets still apply. Library imports that retain counters or final records in memory default to an 8,000,000-record budget. Each evidence import commits independently; retry a failed companion import to complete its catalog binding without duplicating CPU facts. The editor file-size control for ordinary trace imports is `asm.trace.maxImportSizeMiB`.

See the [trace contract](https://github.com/uttori/asm/blob/master/packages/disassembler/TRACES.md) for cancellation, storage-policy changes, and failures after commit.

Compact imports defer the detailed conflict/explanation report to avoid expanding every saved register observation during import. Run `evidence-report` separately when those diagnostics are needed, with enough memory for the project's full set of observations.

Inspect retained contradictions and runtime-derived explanations:

```sh
uttori-asm evidence-report game.analysis evidence-report.json
```

### Regeneration and layout

Generation renders native instructions, stable raw ROM blocks, headers, and vector words into an
immutable Git commit. RAM maps, structure maps and asset include recipes are tracked inputs.
Regeneration never overwrites the working source directory. Git merges the new pure generation
with your committed source edits. Name declarations ensure later calls use the same research name.

`source build` validates the selected project's saved files and publishes matching ROM/debug-map
artifacts. `.uttori/layout.json` declares object extents, CPU state, proven free space and supported
references. `source relocate <project> <object-id>` proposes relocation and reference repair;
`source expand <project> <capacity-bytes>` proposes supported mapper-preserving capacity growth.
Review the resulting source changes before committing. Unsupported or ambiguous references block
relocation. Free space is never inferred from padding alone.

### Storage policy

```sh
uttori-asm project-storage game.analysis
uttori-asm project-storage game.analysis --cache-max-mib 256 --storage-max-mib 0
```

`project-storage` reports capture receipts and database allocation, applies any supplied limits,
and recycles disposable caches and WAL. `--storage-max-mib` rejects whole new publications above a
live-page budget (0 disables the ceiling). Imports retain discovered code, decoding variants,
execution counts, annotations and capture receipts without copying source files. Reimporting the same
capture under another profile reuses its retained facts, with a warning, instead of counting events
twice. Import output includes storage deltas. Maintenance output includes per-step durations.
See the [storage contract](https://github.com/uttori/asm/blob/master/packages/disassembler/API.md#working-index-and-storage).

### Project safety and recovery

Creation requires a missing destination. Regeneration uses native Git merge state and durable
candidate identities. A failed build preserves the last successful artifact pair. Resolve conflicts
in the ordinary index, then finish; abort is available while the merge remains active. Do not delete
active operation locks or manufacture generation hashes. `source status` reports recovery state,
and `source clean` removes only unreferenced scratch/build material whose ownership is established.
Research files and capture evidence are never disposable caches.

## Development

```sh
npm run typecheck --workspace @uttori/asm-cli
npm run build --workspace @uttori/asm-cli
npm run smoke --workspace @uttori/asm-cli
```

The Node 26 executable is generated at `out/cli.mjs`. Compiled ESM and declarations are generated
under `dist/`. Programmatic imports work in ordinary Node without a TypeScript loader. Packing the
workspace rebuilds both forms through its `prepack` hook.

Contributor setup, ownership, tests, and release expectations are in the repository [contributor guide](../../CONTRIBUTING.md).

Licensed under [MIT](https://github.com/uttori/asm/blob/master/LICENSE).
