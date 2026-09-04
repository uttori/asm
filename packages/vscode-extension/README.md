# Uttori Assembly

Assembly language support powered by [uttori-asm](https://github.com/uttori/asm), currently bundled with the first-party SNES target and 65xx target.

Requires VS Code 1.128 or newer and implements the [Language Server Protocol 3.18 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/).

## Features

- Diagnostics from the assembler analysis pipeline (recovers from local errors).
- Document and workspace symbols.
- Go-to-definition and find-references across `incsrc`/`include` boundaries.
- Target-filtered hover and completion from the active plugins, including bundled 65816 / SPC700 / Super FX support.
- Signature help, semantic tokens, and cross-file rename for user-defined symbols.
- **Uttori SNES** and **Uttori 65xx** language modes (status bar / Change Language Mode). SNES is the default for `.asm` and includes SPC700, Super FX, and mapper directives; 65xx is CPU-only.
- Inline **Uttori ASM Debugger** with replay, live ares, and live MesenCE backends; source/instruction breakpoints, stepping, threads, stack frames, registers, native watch expressions, memory, and virtual disassembly source.
- Native **Analysis Coverage** tree for ROM classifications, conflicts, runtime coverage, and projection diagnostics.
- Native **Functions & Calls** tree for persisted function candidates, resolved call/interrupt edges, unresolved control flow, and ownership diagnostics.
- Hash-gated inline source and disassembly annotations for effective addresses, runtime coverage, memory access, and static/observed CPU state.

## Analysis Coverage

The **Analysis Coverage** view discovers up to 32 native `analysis.json` projects in the workspace, or reads the project selected by `asm.analysisProject`. Every manifest and shard is hash-validated before display. Summary groups report exclusive classified/unknown/conflict totals, overlapping opcode/operand/data/asset classifications, and executed/operand/read/written runtime overlays.

The ROM map is a coalesced list of half-open file-offset segments, paged at 200 rows so expanding a large ROM cannot enqueue the entire map in VS Code at once. CPU and RAM addresses are never guessed into ROM offsets: records without an explicit file address or file offset remain visible under **Projection diagnostics**.

In a trusted local workspace, use **Classify Analysis Range** from a segment or the command palette.
The command confirms the half-open range, native classification, and architecture, records certain
manual evidence, and preserves contradictory overlaps as visible conflict records. Each edit is
committed through an optimistic manifest/shard revision, cooperative project lock,
content-addressed shard generation, and atomic manifest-last replacement. Stale or locked edits fail
without overwriting another process. **Undo Last Analysis Edit** and **Redo Last Analysis Edit** are
session-scoped and verify the exact records before removal; restricted or non-workspace projects
remain read-only.

## Functions and Calls

The **Functions & Calls** view builds a target-neutral graph only from validated native project
records. Functions show incoming and outgoing calls plus their unresolved flow sites; project-level
groups also expose every call edge, unresolved site, and orphan relationship. Rows are paged at 200
items, and every displayed location keeps its named address space.

Opening a location first looks for an exact current debug-map source range with matching ROM output
identity and matching source-file hash. If no current source exists, an active Uttori debug session
can provide virtual disassembly through DAP. The final fallback is a read-only view of persisted CFG
records; it does not re-decode the ROM and marks unavailable operand bytes as `??`. Stale source
mappings are reported rather than trusted.

## Analysis Annotations

The active source editor shows compact instruction suffixes for execution counts, runtime coverage,
static effective addresses, attributed memory reads/writes, and static or observed state. Hover a
suffix for the complete target-neutral detail, including native record ids and evidence. Live/replay
DAP disassembly, virtual disassembly source, and persisted CFG fallback rows use the same compact
formatter, so the facts remain recognizable when source is unavailable.

Annotations are presented only when a validated native project and debug map name the same target
and exact ROM content SHA-256/size, and the current source bytes still match the debug map's source
SHA-256. Editing a mapped source clears its decorations immediately; saving restores them only if
the new bytes match a map. Logical addresses and explicit output offsets are indexed separately and
filtered by architecture. The extension never guesses a mapper projection, changes emulator
instructions, or lets an invalid analysis project prevent debugger startup.

## Replay Debugging

Build an exact binary and debug map first:

```sh
uttori-asm main.asm build/rebuilt-content.sfc --debug
```

Then choose **Uttori ASM: Replay Debug** or add this launch configuration:

```json
{
  "type": "uttori-asm",
  "request": "launch",
  "name": "Debug Uttori ASM (Replay)",
  "backend": "replay",
  "program": "${workspaceFolder}/build/rebuilt-content.sfc",
  "debugMap": "${workspaceFolder}/build/rebuilt-content.sfc.debug.json",
  "sourceRoot": "${workspaceFolder}"
}
```

The extension rejects stale maps whose binary identity does not match. Without a `replay` path it
synthesizes a deterministic timeline from the mapped source ranges; optionally set `replay` to a
versioned snapshot JSON file when testing a specific execution trace. The adapter runs inline in the
extension host and has no emulator dependency.

## Live Debugging

The extension ships the two MIT protocol sidecars, but never bundles an emulator executable, its runtime resources, or a test ROM. Live launch is allowed only in a trusted workspace and requires explicit paths to a versioned runtime manifest, the manifest-matched emulator executable, and its portable runtime root. The exact `program` bytes must still match the debug map before the emulator starts.

For the selected ares backend:

```json
{
  "type": "uttori-asm",
  "request": "launch",
  "name": "Debug Uttori ASM (ares)",
  "backend": "ares",
  "program": "${workspaceFolder}/build/rebuilt-content.sfc",
  "debugMap": "${workspaceFolder}/build/rebuilt-content.sfc.debug.json",
  "sourceRoot": "${workspaceFolder}",
  "runtimeManifest": "${workspaceFolder}/.debug/ares-runtime-manifest.json",
  "emulator": "${workspaceFolder}/.debug/ares/bin/ares-headless",
  "runtimeDirectory": "${workspaceFolder}/.debug/ares"
}
```

Use `"backend": "mesence"` with the corresponding patched MesenCE manifest, executable, and runtime root to expose its negotiated 65816, SPC700, and SuperFX threads. The extension starts sidecars without a shell, passes a fresh 256-bit session token through the child environment rather than command-line arguments, and rejects any capability profile that differs from the built editor profile. An optional `sidecar` path is a development-only override for the bundled MIT module; it does not bypass protocol, token, or capability validation.

Watches evaluate only bounded integer expressions against the selected stopped frame's registers. Native `$hex`, `%binary`, low/high/bank selectors, arithmetic, comparisons, logical operations, bitwise operations, shifts, and parentheses are supported. Expressions cannot call JavaScript, read files, access emulator memory, or mutate emulator state.

## Commands

- **Assembly: Build Binary** (`asm.build`) - assembles the active file with the
  selected target. Available from the command palette and the editor title run
  menu when editing an Uttori Assembly file. Unsaved buffers are
  built as-is.
- **Assembly: Toggle Build on Save (Watch)** (`asm.toggleWatch`) - rebuilds the
  entry file (first `asm.entryPoints` value, else the active file) every time an
  assembly file is saved. A status bar item shows the
  watch state; click it to toggle.
- **Assembly: Start Runtime Trace Recording** (`asm.trace.start`) - selects a negotiated processor stream, asks for a local destination, explicitly starts capture, and continuously drains bounded batches to a versioned native JSON artifact with disk writes providing backpressure.
- **Assembly: Stop Runtime Trace Recording** (`asm.trace.stop`) - stops the producer, drains remaining events, and closes the artifact with observed and dropped-event counts. A terminated session preserves valid incomplete JSON. Recording never imports or mutates an analysis project; use `uttori-asm evidence-import ... --instruction-trace ...` separately.
- **Assembly: Refresh Analysis Coverage** (`asm.coverage.refresh`) - reloads validated native project manifests and shards. The view also refreshes when an `analysis.json` manifest or `analysis/*.json` shard changes.
- **Assembly: Refresh Functions & Calls** (`asm.analysisGraph.refresh`) - reloads the validated function/call projection. The view also refreshes with the same manifest and shard file watchers as Analysis Coverage.
- **Open Analysis Source or Disassembly** (`asm.analysis.navigate`) - the inline tree action for an exact function, call site, or unresolved-flow location. It prefers current source, then live DAP disassembly, then persisted CFG records.
- **Assembly: Classify Analysis Range** (`asm.coverage.classifyRange`) - adds a manual native classification through the conflict-safe project transaction layer. A segment context action preselects its exact range.
- **Assembly: Set Analysis State / Entry Point** (`asm.coverage.setStateEntryPoint`) - selects an existing classified interval and adds a separate manual overlay, leaving the base annotation intact. The compact input accepts `entry`, `e=native|emulation`, `m=8|16`, `x=8|16`, `carry=set|clear`, and `$`/`0x`/decimal `pbr`, `dbr`, `d`, and `s` values. Contradictory overlapping state is persisted as a conflict.
- **Assembly: Resolve Indirect Target** (`asm.coverage.resolveTarget`) - selects an unresolved or previously overridden site and adds comma-separated targets in that record's existing address space. New targets and manual evidence are unioned with earlier runtime/import/manual observations rather than replacing them.
- **Assembly: Rename Analysis Label** (`asm.coverage.renameLabel`) - renames one stable native label record and attaches certain manual provenance while retaining every earlier evidence id.
- **Assembly: Explain Analysis Evidence** (`asm.coverage.explainEvidence`) - opens a read-only Markdown explanation for any persisted record, including the complete evidence records, reverse references, and related conflicts. Segment context narrows the picker to records projected there; this command remains available in an untrusted workspace because it does not write.
- **Assembly: Undo Last Analysis Edit** (`asm.coverage.undo`) - removes or restores only the exact unchanged records from the last session edit. Undo refuses if another process changed the result or started using its new evidence.
- **Assembly: Redo Last Analysis Edit** (`asm.coverage.redo`) - reapplies the last undone classification, state/entry overlay, target resolution, or label rename against a newly loaded project revision.

## Settings

- `asm.configFile` - optional workspace-relative path to `uttori-asm.config.json`.
- `asm.plugins` - plugin module specifiers or `{ module, options }` objects.
- `asm.target` - target contribution ID or alias.
- `asm.architecture` - architecture contribution ID or alias.
- `asm.entryPoints` - project entry-point files analysed as include roots.
- `asm.includePaths` - extra include search paths relative to the workspace.
- `asm.buildOutput` - output path (defaults to the target's output extension).
- `asm.baseImage` - optional base image to patch when building.
- `asm.analysisProject` - native analysis-project directory or `analysis.json` path, absolute or relative to each workspace folder. When empty, projects are discovered automatically.

Workspace plugin configuration is disabled in restricted workspaces. Trust the workspace to activate `uttori-asm.config.json` or `asm.plugins`; the bundled SNES target remains available before trust is granted.

## Building

From the repository root:

```
npm install
npm run lsp:build
npm run vscode:build
```

For debugging, open `packages/vscode-extension` as the VS Code workspace and press F5. The
included launch task builds both the language server and extension. Run
`npm run vscode:package` from the repository root to produce a `.vsix`.

`npm run vscode:smoke` builds the editor/server/sidecars, downloads the pinned VS Code test host once,
and exercises real extension activation, LSP registration, analysis view commands, and a temporary
build. Contributor boundaries, Workspace Trust rules, and the complete gate matrix are in
[CONTRIBUTING.md](../../CONTRIBUTING.md) and [Testing and release gates](../../docs/testing-and-release.md).
