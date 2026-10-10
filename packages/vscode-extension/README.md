# Uttori Assembly

The [asset editing guide](../cli/ASSET_INTERCHANGE.md) covers saved Aseprite/PNG
export, review, application and interrupted-edit recovery.

Multiple target assembly, disassembly, ROM analysis, and debugging in VS Code. Currently supports SNES and 65xx (NES, 6502-likes).

## Requirements & Installation

Use the latest stable VS Code release. The current extension API floor is 1.140.0;
acceptance targets latest stable as it advances. The extension uses VS Code's bundled
runtime. No separate Node.js installation is required. Live debugging needs a separately
installed, manifest-matched emulator.

Install **Uttori Assembly** (`matthewcallis.uttori-asm-vscode`) from Extensions, or use **Extensions: Install from VSIX** with the release VSIX.

## Quick Start

1. Open a local project folder and create `main.asm`:

```asm
lorom
org $008000
sei
```

2. Select **Uttori SNES** as the language mode if it was not detected.
3. Run **Assembly: Build Binary**. The default target writes `main.sfc` and `main.sfc.debug.json`.

This example demonstrates assembly. It is not a bootable game. For NES / 6502 projects, configure the 65xx plugin and target in `uttori-asm.config.json`. Use `asm.configFile` when that file is nested.

## Features

- Diagnostics, completion, hover, symbols, navigation, rename, and semantic highlighting.
- Project builds, build on save, and configurable entry points and include paths.
- ROM disassembly, SQLite analysis views, persistent annotations, and verified source regeneration.
- Replay debugging and optional ares live debugging.
- Runtime capture and evidence import when supported by the selected native runtime.
- `includeAsset` format/option completion, path navigation, image thumbnails, and WAVE/BRR comparison previews.

Run **Assembly Source: Create Git Source Project** (or **Create Git Source Project from Diz Research**).
The **Source Project** tree shows a **Next** action and an ordered **Update Source from Evidence** flow:

1. **Analyze Evidence** after importing captures or changing analysis research.
2. **Prepare Regeneration** to generate an incoming candidate.
3. **Preview with Current Edits** shows clickable file diffs under **Generation Preview**, including predicted conflicts and supported unsaved edits, without changing the checkout.
4. **Apply Previewed Generation** uses the existing commit when the checkout is clean. If Preview names existing local edits, save and commit or move those edits first to preserve the merge's abort point.
5. Resolve conflicts with the native Merge Editor and stage the intended changes in Source Control.
6. **Validate and Finish Regeneration** builds the staged result, validates it and creates the merge commit.

If imported evidence identities are missing from the tracked catalog, **Next** first offers **Refresh Capture Catalog**.
This records their identities without reimporting captures or regenerating source.

**Build Current Source** is separate: save your edits and build whenever you want to run or debug.
It requires no Git commit and does not incorporate new evidence. If an input changes during a build,
the error names the affected files, offers **Save All and Rebuild**, and links to **Uttori Analysis**
output for details. Unchanged save notifications and unrelated evidence/output files do not reject a build.

Assembly and assets are ordinary editable files. F2 updates supported symbol uses and their tracked research identity. **Edit Symbol
Research** and **Edit Analysis Research** open normal JSON documents with native undo, save and Git diffs.

Hover a PNG `includeAsset` statement to inspect source and native sizes and its composed thumbnail. Open the restricted **Asset Preview** link for composed and native storage order. Hover a WAVE-to-BRR statement for a waveform and select **Play source PCM and decoded BRR** to open a player. Playback begins only when you press a player control and stops when the panel closes or hides. A missing, invalid, cancelled, or edited input does not reuse old media. Preview is available in trusted file workspaces; builds remain authoritative for custom converters, numeric expressions, and emitted addresses.

For F5, set `"sourceProject": true` in an `uttori-asm` launch configuration and select the desired
backend/runtime. The extension builds that workspace and supplies the verified ROM and debug map;
fixed `program`/`debugMap` paths are unnecessary. A failed build cancels launch. Build & Run,
Build & Debug and Watch use the same selected source workflow.

The **Capture** group in Source Project exposes **Start Capture**, **Stop Capture**, and **Stop
Capture and Import Evidence**. Launch either an ares golden-ROM or Git source debug session,
choose the recording file, then Continue (F5) to record execution. Stop finalizes the archive and
offers import; Stop and Import also imports it into the selected source project. Recording and
finalization state stays visible, including recordings started from the command palette. The
Source Project title also has Record/Stop buttons during an ares debug session.

**Import Captures** accepts multiple ACT2 or JSON archives. Files import sequentially, with the
filename and queue position in the notification and **Uttori Analysis** Output log. Merge updates
include provisional record counts, percentage, rate and estimated remaining time. Quiet source
operations show the worker PID, elapsed time and age of the last progress update every ten seconds;
this indicates a pending worker, while record counts show measurable progress. Output also records
completion, failure, archive hashes and import totals. Failure or cancellation stops the queue and
preserves completed imports; retrying the queue is safe.

The default import budget is 32 GiB per archive. Git source imports apply
`limits.captureBytes` in `.uttori/project.json` to both the primary recording and each graphics
companion; other trace imports use `asm.trace.maxImportSizeMiB` (default 32768). Streaming reads
keep the file-size limit separate from heap and static-analysis work budgets.

ACT2 archives and their complete context directories are temporary inputs, with deletion under
your control. After successful import, project operations use persisted facts, bounded graphics
reports and provenance hashes, so you can remove the originals. The catalog does not promise that
an archive still exists. Capture replay and state restore operate only on temporary files you
explicitly select while they are available; they are independent of the imported project evidence.

Indexed PNG and palette custom editors share VS Code's save/undo/recovery lifecycle. Preview can include unsaved supported text and binary edits. Apply requires a clean checkout; the existing commit suffices, and generated changes are reviewed and staged before Finish commits them.
Apply appears after preview when the checkout is clean, and is retired when the merge starts. Finish becomes available once conflicts are resolved and changes staged. Finish clears the completed candidate, including stale selections restored from editor state. After reloading with a pending candidate, preview again before applying; a missing private preview produces a recovery instruction instead of a filesystem error.

## Editor Information

Source overlays and hover show compact information from a matching build map. Instruction documentation is unchanged. The default **compact** preset shows file/CPU locations and available execution observations. **Authoring** adds emitted bytes and resolved operands without requiring a disassembly project; **disassembly** adds the available resolved operand to the compact hover.

Run **Assembly: Choose Editor Information Preset**, **Configure Inline Fields**, or **Inspect Line Information**. The eye button beside Build Binary toggles inline information independently of hover and removes a replaced legacy visibility setting at the same scope. The **Inline** status bar item reports whether information is off, loading, displayed, or unavailable. Click it or run **Assembly: Show Inline Source Information Status** for exact source/dependency hash or size mismatches, missing maps, unsaved files, and provider errors. Detailed state, memory, evidence, and CFG records are available in the inspector, with bounded previews and pages.

Configure the project in `.vscode/settings.json`, for example:

```json
{
  "asm.editorInfo.preset": "authoring",
  "asm.editorInfo.inline.parts": [
    "${output_offset_cpu}",
    "${output_offset_file}",
    "${output_bytes}",
    "operand=${operand_value}"
  ],
  "asm.editorInfo.inline.separator": " / ",
  "asm.editorInfo.inline.placement": "aligned",
  "asm.editorInfo.inline.column": 80,
  "asm.editorInfo.inline.color": "#FFA65C",
  "asm.editorInfo.hover.rows": [
    "Output Offsets: ${output_offsets}",
    "Execution Observations: ${execution_observations}"
  ]
}
```

Available fields are `output_offsets`, `output_offset_cpu`, `output_offset_file`, `output_bytes`, `output_size`, `operand_value`, `operand_values`, `execution_observations`, `execution_counts`, `execution_count_cpu`, and explicit `project_state.FIELD` / `runtime_state.FIELD` values. CPU locations are logical addresses; file offsets use the map's output coordinates, including output-format headers where mapped. `execution_counts` follows the file / CPU order of `output_offsets`; qualified counts are never summed across aliases. Missing observations are unavailable, distinct from a known zero count.

Missing fields remove the whole part/row and its separator. An empty parts/rows array displays nothing. `$${` escapes a literal `${`. Templates do not execute expressions or accept per-variable color directives. The default inline limit is 120 characters, byte previews contain up to eight bytes, and hover accepts up to eight rows. Explicit legacy visibility/column settings remain supported when their replacements are unset.

Overlays use `aligned` placement by default: short lines share a left edge at `asm.editorInfo.inline.column` (80 by default). Longer lines keep a three-column gap after their own source without pushing other overlays offscreen. Choose `afterLine` to keep each overlay three columns after its own source line. `asm.editorInfo.inline.color` sets the whole overlay's color: use a hex value such as `#FFA65C` for orange, or a VS Code theme color such as `editorWarning.foreground`. The default is `editorCodeLens.foreground`; theme colors follow theme changes automatically. These display settings update without rebuilding the project.

Rebuild once to add resolved operand metadata to an older debug map. Values come from the encoder's numeric evaluations; ambiguous/multiple operands use `operand_values`. A masked operand such as `RAM_EASTER_EGG_COUNTER & $FFFF` is distinct from the runtime address accessed after indexing. Dirty or mismatched source/dependencies suppress snapshot information. Hovering never starts a build, and failed builds do not publish partial output.

## Source Breakpoints

Click beside a line number or press **F9** in **Uttori SNES** or **Uttori 65xx** source. Launch with the matching binary and debug map to verify the marker. Comments and labels move to the next mapped executable line. Unmapped locations remain unverified.

For supported SNES cartridge mappings, a source breakpoint covers every confirmed ROM alias, so code mapped at `$C08005` can also stop when executed at `$008005`. Instruction breakpoints keep the exact address requested. You can add or remove source breakpoints while ares runs. The adapter briefly pauses execution to update its breakpoint table.

## Configuration & Limits

Use `uttori-asm.config.json` for project plugins, target, architecture, and paths. VS Code's `asm.*` settings override project values. See Settings under **Uttori Assembly** for all defaults.

Built-in assembly works in Restricted Mode. Workspace plugins execute code and require Workspace Trust. Analysis edits and live emulator launch require a trusted local filesystem workspace. Virtual workspaces are unsupported. Remote native-emulator workflows have not been validated. Replay is a snapshot viewer, not an emulator. Ares capabilities depend on its separately verified runtime.

For Git source builds, regeneration, imports and analysis queries, check **Output → Uttori Analysis**. It is available as soon as the extension activates and opens automatically when a source command fails. Standalone assembly builds and language-server diagnostics use **Uttori Assembly Language Server**; emulator operations use **Uttori Emulator**. Rebuild stale debug maps or regenerate stale source before retrying navigation/debugging.

Document formatting is unsupported in v1.0.0.

## Documentation & Support

- [Changelog](https://github.com/uttori/asm/blob/master/packages/vscode-extension/CHANGELOG.md)
- [User Guide](https://github.com/uttori/asm/blob/master/packages/vscode-extension/GUIDE.md)
- [Project Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md)
- [SNES Manual](https://github.com/uttori/asm/blob/master/packages/plugin-snes/MANUAL.md)
- [65xx Manual](https://github.com/uttori/asm/blob/master/packages/plugin-65xx/MANUAL.md)

[Report an issue](https://github.com/uttori/asm/issues). Licensed under [MIT](https://github.com/uttori/asm/blob/master/LICENSE).
