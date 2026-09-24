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
MesenCE evidence import, and native source-export commands below currently operate on SNES projects.
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

### Analyze & Export

```sh
npx uttori-asm disassemble game.sfc game.analysis
npx uttori-asm analyze game.analysis --rom game.sfc
npx uttori-asm export game.analysis game.source --rom game.sfc
npx uttori-asm verify-roundtrip game.source --rom game.sfc
```

Analysis metadata is stored in SQLite. Supply the same ROM for later operations. Ambiguous mapper detection requires `--mapper`.
Unknown bytes remain raw assets as `incbin` includes.
Export refuses modified generated files and loss of previously exported code unless the corresponding override is explicit.
A matching rebuild proves byte identity not a complete code discovery.

### SNES Commands

| Command            | Required Input                | Output / Default                                                                                        | Specific Options                                  |
| ------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `disassemble`      | ROM                           | Optional new/empty project directory. Otherwise `<rom stem>.analysis`                                   | `--mapper`, `--header-size`, `--dizraw`           |
| `analyze`          | Project directory and `--rom` | Updates the same project's analysis                                                                     | `--entry`, `--max-work-items`, `--max-call-depth` |
| `export`           | Project directory and `--rom` | Optional source directory. Otherwise `<project stem>.source`                                            | `--force`, `--allow-code-regression`              |
| `project-validate` | Project directory             | Validation result on stdout. No replacement records                                                     | Optional `--rom` to check identity                |
| `verify-roundtrip` | Source directory and `--rom`  | Rebuild paths from `generated-files.json`, normally `build/rebuilt-content.sfc` and `build/rebuilt.sfc` | None beyond `--rom`                               |

`disassemble` creates the analysis container. Run `analyze` separately to discover code. For example:

```sh
uttori-asm disassemble "game.sfc" "game.analysis" --mapper lorom
uttori-asm analyze "game.analysis" --rom "game.sfc"
uttori-asm project-validate "game.analysis" --rom "game.sfc"
uttori-asm export "game.analysis" "game.source" --rom "game.sfc"
uttori-asm verify-roundtrip "game.source" --rom "game.sfc"
```

Use the ROM's actual mapper. All mapper names are listed by `--help`.
For saved annotations and backup/recovery, see the [analysis-project guide](https://github.com/uttori/asm/blob/master/packages/disassembler/PROJECTS.md).

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

Standalone `--instruction-trace` imports stream through SQLite without loading prior runtime history. Combined Mesen/native imports retain the existing atomic in-memory batch path. Use separate commands for large captures.

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
integer (default 100,000). `--max-call-depth` is nonnegative (default 8, with 0 discarding call context).
Hitting either bound reports explicit incomplete analysis rather than silently truncating it. A pass
that would lose existing decoded code can instead fail without replacing saved analysis.

Editable `target-set` and `target-override` records in the SQLite analysis table are retained on subsequent runs and take precedence over unresolved static targets.

The complete ROM remains external. Imported captures can retain bounded instruction bytes.

### Offline Runtime Evidence

Import stock MesenCE CDL, default 65816 trace text, and labels into an existing project:

```sh
uttori-asm evidence-import game.analysis --rom game.sfc --mesen-cdl game.cdl
uttori-asm evidence-import game.analysis --rom game.sfc \
  --mesen-trace game.trace --trace-metadata game.trace.json
uttori-asm evidence-import game.analysis --rom game.sfc --mesen-labels game.mlb
uttori-asm evidence-import game.analysis --rom game.sfc \
  --instruction-trace instruction-trace.json
```

Multiple evidence options can be supplied in one command. Every import verifies the project's exact ROM identity and stored mapper first. `CDLv2` also verifies its embedded ROM CRC. Native instruction traces preserve ordered pull chunks and producer-loss metadata and use the same `snes.cpu` CPU-bus identity as native analysis projects. An identical reimport preserves facts and the semantic revision, while refreshing its import receipt.

Native trace files are read incrementally with a default 2 GiB file-size limit. Use `--trace-max-mib 4096` to permit a 4 GiB capture. This avoids JavaScript's single-string size limit. Use `--trace-index 65816-disassembly` to reduce the index for large 65816 instruction captures: it preserves all PCs, fetched-byte and decoding-state variants, execution counts and bus observations in the analysis index, while full register history stays in the original capture. `--trace-index 65816-analysis` is the default for native SNES CPU captures. Other processors default to full. It normalizes aliases and retains only P width bits, E, D and DB, together with fetched bytes and the qualified PC. Explicit `full` retains general-register history. SQLite project imports have no fixed 2,000,000/8,000,000 record ceiling in any profile; input-file and configured storage budgets still apply. Library imports that retain counters or final records in memory default to 2,000,000 compact records or 8,000,000 full records. Budget overflow never commits a partial import. The editor equivalents are `asm.trace.maxImportSizeMiB` and `asm.trace.indexMode`.

See the [trace contract](https://github.com/uttori/asm/blob/master/packages/disassembler/TRACES.md) for cancellation, storage-policy changes, and failures after commit.

Compact imports defer the detailed conflict/explanation report to avoid expanding every saved register observation during import. Run `evidence-report` separately when those diagnostics are needed, with enough memory for the project's full set of observations.

MesenCE trace text has no embedded ROM fingerprint, so its required identity sidecar is explicit:

```json
{
  "schemaVersion": 1,
  "architecture": "snes.65816",
  "romContentSha256": "<64 lowercase hex characters>",
  "mapper": "lorom",
  "mesenRevision": "<optional source revision>"
}
```

Inspect retained contradictions and runtime-derived explanations, or export native labels for MesenCE:

```sh
uttori-asm evidence-report game.analysis evidence-report.json
uttori-asm mesen-labels-export game.analysis game.mlb --rom game.sfc
```

### Native Source Export

Export analyzed bytes as deterministic native 65816 source, with conservative raw assets for everything the analysis has not justified as code:

```sh
uttori-asm export game.analysis game.source --rom game.sfc
uttori-asm verify-roundtrip game.source --rom game.sfc
```

The export contains `main.asm`, mapper-bank sources under `banks/`, raw bytes under `assets/`,
documented hardware definitions in `defines.asm`, a checksum-preserving
`uttori-asm.config.json`, and a versioned `generated-files.json`.
It also creates a user-owned `ram-map.json`, its local `ram-map.schema.json`, and generated `ram-defines.asm`.
Edit `ram-map.json` and run `export` again to regenerate definitions and substitute exact known RAM / WRAM operands in the bank source.
RAM definition comments omit source citations by default. Set `"includeSourceInformation": true`
at the top level of `ram-map.json` to include them; descriptive notes remain visible in either mode.
The manifest hashes this input separately, so `verify-roundtrip` reports a stale map until source has been regenerated.
The manifest assigns every content byte to exactly one code, raw, padding, SNES-header, or vector span.
A copier header is preserved as its own asset when present.

`verify-roundtrip` first rejects modified generated files and stale user inputs, assembles `main.asm` through the normal CLI project environment, restores any copier header, and compares the complete file length and SHA-256.
A mismatch reports its first differing file and content offset.
The final rebuilt ROM is replaced only after comparison succeeds. The intermediate content build can still change on a failed comparison.
Re-export refuses local changes to generated files unless `--force` is explicit, changing `ram-map.json` is the normal regeneration workflow and does not require `--force`.

Re-export also refuses to turn any previously emitted code range into raw bytes, even if total code coverage increases elsewhere.
Review intentional code-to-data changes before using `--allow-code-regression`. `--force` only bypasses the generated-file edit check.
An incomplete analysis that loses previously decoded ROM bytes leaves the saved analysis intact.
Increase `--max-work-items` or adjust `--max-call-depth` before retrying.
A byte-identical round trip alone does not detect lost disassembly because `incbin` preserves the original bytes.

Regenerating an older export writes its hardware definitions to `defines.asm` and
updates the include and manifest together. Keep handwritten includes in sync with the regenerated
entry source. The definitions remain specific to the selected exporter.

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

Project creation refuses occupied directories. Normal source regeneration checks the hashes of
generated files and refuses local modifications. `--force` explicitly permits replacing those files.
`--allow-code-regression` separately permits losing previously emitted code. User-owned maps are
preserved, and changing them requires regeneration before verification.

SQLite recovers committed database state, but a
multi-file export or rebuild can be incomplete. Reopen/validate the project and regenerate/verify
before using its outputs. Preserve local source edits before any forced regeneration.

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
