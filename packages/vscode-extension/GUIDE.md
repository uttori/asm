# VS Code user guide

Assembly language support powered by [uttori-asm](https://github.com/uttori/asm), currently bundled with the first-party SNES target and 65xx (NES, 6502-like) targets.

Requires VS Code 1.128 or newer and implements the [Language Server Protocol 3.18 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/).

The extension, workers, language server, and embedded sidecars run on VS Code's bundled Node 24 runtime. Installing the extension does not require a separate Node executable. Building this repository and using its standalone npm tools requires Node 26. Extension packaging builds its embedded tools directly from source for the editor runtime, independently of the Node 26 bundles.

## Features

- Diagnostics from the assembler analysis pipeline (recovers from local errors).
- Document and workspace symbols.
- Go-to-definition and find-references across `incsrc` / `include` boundaries.
- Target-filtered hover and completion from the active plugins, including bundled 65816 / SPC700 / Super FX support.
- Signature help, semantic tokens, and cross-file rename for user-defined symbols.
- **Uttori SNES** and **Uttori 65xx** language modes (status bar / Change Language Mode). SNES is the default for `.asm` and includes SPC700, Super FX, and mapper directives. 65xx is CPU-only.
- Inline **Uttori ASM Debugger** with replay, live ares, and live MesenCE backends. Source / instruction breakpoints, stepping, threads, stack frames, registers, native watch expressions, memory, and virtual disassembly source.
- Native **Analysis Coverage** tree for ROM classifications, conflicts, runtime coverage, and projection diagnostics.
- Optional **Functions & Calls** tree for persisted function candidates, resolved call/interrupt edges, unresolved control flow, and ownership diagnostics.
- Hash-gated inline source and disassembly annotations for effective addresses, runtime coverage, memory access, and static/observed CPU state.

## Building

From the repository root:

```
npm install
npm run lsp:build
npm run vscode:build
```

For debugging, open `packages/vscode-extension` as the VS Code workspace and press F5. The included launch task builds both the language server and extension. Run `npm run vscode:package` from the repository root to produce a `.vsix`.

`npm run vscode:smoke` builds the editor/server/sidecars, downloads the pinned VS Code test host once, and exercises real extension activation, LSP registration, analysis view commands, and a temporary build. Contributor boundaries, Workspace Trust rules, and the complete gate matrix are in [CONTRIBUTING.md](https://github.com/uttori/asm/blob/master/CONTRIBUTING.md) and [Testing and release gates](https://github.com/uttori/asm/blob/master/TESTING.md).

## Creating a Disassembly Project

In a trusted workspace, run **Assembly: Create Disassembly Project from ROM** and select a local ROM plus an empty output directory. The extension detects the SNES mapper and copier header from the file contents, asks for a mapper only when the evidence is ambiguous, creates and analyzes the native project, exports editable source, verifies an exact rebuild, and opens the completed folder.

Use **Assembly: Import Diz Disassembly Project** for the same flow with a DiztinGUIsh `.dizraw` project. Imported labels, comments, regions, CPU state, and classifications are preserved where the native schema can represent them. The completion dialog reports warnings and unsupported fields. Compressed `.diz` files are rejected until that format has bounded fixture coverage.

The generated workspace contains `main.asm`, `banks/`, `assets/`, `build/`, `analysis/`, documented `defines.asm`, user-owned `ram-map.json`, generated `ram-defines.asm`, `generated-files.json`, the assembler configuration, and ready-to-use VS Code settings and replay launch configuration. Use **Open Disassembly RAM Map**, edit a variable, then **Analyze and Regenerate Disassembly**. Status explicitly reports the source as stale between those two actions. ROM bytes are not copied into the analysis project. The absolute ROM path is kept only in machine-local extension storage and associated with the ROM's content identity.

## Analysis Coverage

The **Analysis Coverage** view discovers up to 32 native `analysis.json` projects in the workspace, or reads the project selected by `asm.analysisProject`. Discovery reads only manifests. Expanding a project validates native metadata and builds projections in background Node processes using the project's `asm.analysis.maxMemoryMiB` budget (default 4096 MiB). A fatal heap error is isolated from the extension host. SQLite selects and pages the required records. Summaries and at most 200 rows per page cross back to the UI. Functions and calls are also expanded lazily, and inline annotations request only visible source lines. Requests within each process run one at a time. Reads have a 60-second execution timeout, excluding time queued behind another view. A failed process reports the operation and memory budget and can be retried by refreshing the view. Summary groups report exclusive classified/unknown/conflict totals, overlapping opcode / operand / data asset classifications, and executed / operand / read / written runtime overlays.

The ROM map is a coalesced list of half-open file-offset segments, paged at 200 rows so expanding a large ROM cannot enqueue the entire map in VS Code at once. CPU and RAM addresses are never guessed into ROM offsets: records without an explicit file address or file offset remain visible under **Projection diagnostics**.

In a trusted local workspace, use **Classify Analysis Range** from a segment or the command palette. The command confirms the half-open range, native classification, and architecture, records certain manual evidence, and preserves contradictory overlaps as visible conflict records. Each edit is committed through a SQLite write transaction that checks the expected project revision. The small `analysis.json` watcher pointer is refreshed after commit. Stale or locked edits fail without overwriting another process. **Undo Last Analysis Edit** and **Redo Last Analysis Edit** are session-scoped and verify the exact records before removal. Restricted or non-workspace projects remain read-only.

## Functions & Calls

The **Functions & Calls** view is hidden by default. Enable it from the Assembly sidebar view menu when investigating a specific routine. Existing saved VS Code layouts keep their visibility choice. Function entries still provide generated labels and let heuristics attribute hardware access and callee roles to routines. The view builds a target-neutral graph only from validated native project records. Functions show incoming and outgoing calls plus their unresolved flow sites. Project-level groups also expose every call edge, unresolved site, and orphan relationship. Rows are paged at 200 items, and every displayed location keeps its named address space.

Opening a location first looks for an exact current debug-map source range with matching ROM output identity and matching source-file hash. If no current source exists, an active Uttori debug session can provide virtual disassembly through DAP. The final fallback is a read-only view of persisted CFG records. It does not re-decode the ROM and marks unavailable operand bytes as `??`. Stale source mappings are reported rather than trusted.

## Analysis Annotations

The active source editor shows instruction overlays aligned in a shared column for execution counts, runtime coverage, static effective addresses, attributed memory reads/writes, and static or observed state. Theme colors distinguish project state (blue), runtime observations (green), and state changes (amber). The text and hover retain the meaning without relying on color. Hover an overlay for the detail preview, including native record ids and evidence. The **eye button beside Build Binary** toggles these source overlays immediately and saves the choice for the project. Use `asm.analysis.showAnnotations` to configure visibility and `asm.analysis.annotationColumn` to adjust the preferred column (default 80). Longer annotated lines move the shared column to keep code clear. Tab alignment follows the editor's tab size. Live/replay DAP disassembly, virtual disassembly source, and persisted CFG fallback rows use the same compact formatter, so the facts remain recognizable when source is unavailable.

Annotations are presented only when a validated native project and debug map name the same target and exact ROM content SHA-256/size, and the current source bytes still match the debug map's source SHA-256. Editing a mapped source clears its decorations immediately. Saving restores them only if the new bytes match a map. Logical addresses and explicit output offsets are indexed separately and filtered by architecture. The extension never guesses a mapper projection, changes emulator instructions, or lets an invalid analysis project prevent debugger startup.

Source and debugger overlays query SQLite for the requested addresses before decoding payloads. The first request builds derived address/output indexes. Later reads update only changed entries. Frequently executed instructions show a bounded state/memory preview marked **details limited**. Execution totals include every matching observation. Debugger startup loads matching manifests, then batches annotation queries for each displayed disassembly page. Annotation queries, form edits, and source refresh share their own worker process. Bulk Coverage, Sources, and graph queries use a separate process, so their queue or failure cannot cancel an edit. Each process uses the configured analysis memory budget and serializes its own requests.

## Replay Debugging

**Assembly: Build Binary** now always emits an identity-matched pair: the configured ROM output and `<output>.debug.json`. The build result includes the binary SHA-256, debug-map fingerprint, target, architecture, and per-artifact change state. Unsaved editor buffers are fingerprinted from the exact overlay bytes used by the assembler.

You can also build an exact binary and debug map from the CLI:

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

The extension rejects stale maps whose binary identity does not match. Without a `replay` path it synthesizes a deterministic timeline from the mapped source ranges. Optionally set `replay` to a versioned snapshot JSON file when testing a specific execution trace. The adapter runs inline in the extension host and has no emulator dependency.

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
  "emulator": "${workspaceFolder}/.debug/ares/ares.app/Contents/MacOS/ares",
  "runtimeDirectory": "${workspaceFolder}/.debug/ares"
}
```

Use `"backend": "mesence"` with the corresponding patched MesenCE manifest, executable, and runtime root to expose its negotiated 65816, SPC700, and SuperFX threads. The extension starts sidecars without a shell, passes a fresh 256-bit session token through the child environment rather than command-line arguments, and rejects any capability profile that differs from the built editor profile. An optional `sidecar` path is a development-only override for the bundled MIT module. It does not bypass protocol, token, or capability validation.

Watches evaluate only bounded integer expressions against the selected stopped frame's registers. Native `$hex`, `%binary`, low/high/bank selectors, arithmetic, comparisons, logical operations, bitwise operations, shifts, and parentheses are supported. Expressions cannot call JavaScript, read files, access emulator memory, or mutate emulator state.

The ares manifest selects `"frontend": "desktop"` for a graphical game window, audio, and controller input. `"headless"` (the default when omitted) remains available for automation. Both use the same debugger/trace bridge. A desktop runtime must contain the separately built and hashed application resources. A headless executable cannot become graphical by changing the manifest alone. Launch pauses at entry: **Continue (F5)** starts gameplay. Configure controls in **ares Settings → Input**. The desktop stays responsive while the CPU is paused, and runs while unfocused for capture dialogs.

Set a source breakpoint by clicking the editor gutter or pressing **F9** on a generated assembly line, then use **Continue (F5)**. A label, comment, or directive breakpoint moves to the next mapped executable line and VS Code shows the resolved location. Breakpoints may also be added, removed, or changed while the emulator is running: the adapter performs a hidden pause/update/resume transaction because the native emulator protocols only mutate execute breakpoints at a stopped boundary. The next matching instruction produces a normal breakpoint stop, where stepping and inspection are available. Use **Debug in Emulator**, not **Run in Emulator**, when breakpoints are required.

Run **Assembly: Configure Emulator Runtime** once per workspace and select ares or MesenCE, its versioned runtime manifest, emulator executable, and runtime directory. The absolute binding is kept in machine-local extension storage rather than project settings. **Run in Emulator** and **Debug in Emulator** build first and launch only the returned ROM/debug-map pair. If no picker binding exists, these commands reuse a single unambiguous live runtime explicitly configured in the folder's `launch.json`. Conflicting runtime configurations require the picker. Unresolved variables other than `${workspaceFolder}` are not guessed. Startup status, the chosen frontend, native stderr, and failures appear in **Output → Uttori Emulator**. Launch errors also produce a notification. Optional analysis annotations load asynchronously after debugger connection rather than delaying initialization. **Run and Watch** rebuilds on a debounced save and performs a deterministic full emulator restart only when a successful build changes the ROM or map. A compilation error leaves the current session running, and VS Code reapplies source breakpoints against the replacement map.

Generated configs contain `entryPoints: ["main.asm"]`. To open a parent folder instead of the generated directory, set `asm.configFile` to `disassembly/uttori-asm.config.json` and `asm.analysisProject` to `disassembly/analysis` in the parent's `.vscode/settings.json`. Paths read from the config resolve beside that config. Explicit `asm.*` path settings resolve from the workspace root. Run **Build Binary** before using a direct F5 launch after switching workspace roots so portable debug-map source paths match the launch's `sourceRoot`. At launch the debugger also checks the map's portable source paths against the configured root and adjacent artifact parents, choosing and logging the best on-disk match. This keeps source navigation valid for an initial generated map when the project is opened from its parent folder.

Every generated SNES project also includes `defines.asm`. `main.asm` includes it before the bank sources, and emitted absolute MMIO operands use conventional names such as `INIDISP`, `NMITIMEN`, and `DMAP0` instead of anonymous addresses. The file also supplies controller, interrupt/status, and DMA-channel masks. Every generated register and mask definition has its own trailing description, so hovering a symbolic operand shows that register's purpose. Generated banks continue to express processor width with `.a8`/`.a16` and `.i8`/`.i16` directives.

While stopped, the Variables view groups registers by processor and native group, decodes the 65816 `N V M X D I Z C E` flags while retaining raw `P`/`E`, lists only named memory spaces whose backend reads are guaranteed side-effect-free, and shows 32 bytes from the 65816 or SPC700 stack pointer. Native bridges currently expose an explicit “current frame only” row instead of inventing a call stack. Virtual disassembly is discarded and regenerated at every stopped boundary.

Replay scripts can model instruction, step-in, step-over, and step-out transitions. The current live ares and MesenCE bridges negotiate exact instruction and step-in support only. Step-over and step-out are labeled unavailable and rejected instead of being approximated.

## Commands

- **Assembly: Create Disassembly Project from ROM** (`asm.createDisassemblyProject`) - creates, analyzes, exports, and byte-verifies a new project in an empty directory.
- **Assembly: Import Diz Disassembly Project** (`asm.importDizProject`) - imports an uncompressed DiztinGUIsh `.dizraw` project with a matching ROM and reports deterministic conversion loss.
- **Assembly: Build Binary** (`asm.build`) - assembles the active file with the selected target and atomically publishes its matching debug map. Available from the command palette and the editor title run menu when editing an Uttori Assembly file. Unsaved buffers are built and source-fingerprinted as-is.
- **Assembly: Toggle Build on Save (Watch)** (`asm.toggleWatch`) - rebuilds the entry file (first `asm.entryPoints` value, else the active file) every time an assembly file is saved. A status bar item shows the watch state. Click it to toggle.
- **Assembly: Configure Emulator Runtime** (`asm.configureEmulatorRuntime`) - validates and stores the machine-local manifest, executable, and runtime root for ares or MesenCE.
- **Assembly: Run in Emulator** (`asm.runEmulator`) - builds the artifact pair and launches the configured live backend without enabling breakpoints.
- **Assembly: Debug in Emulator** (`asm.debugEmulator`) - builds and launches the configured live backend with the VS Code debugger UI.
- **Assembly: Run and Watch** (`asm.runAndWatch`) - debounces saves and fully reloads a changed, successfully rebuilt ROM while retaining the current session after build failures.
- **Assembly: Start Runtime Trace Recording** (`asm.trace.start`) - starts an explicit execution window, selects a negotiated processor stream, and asks for a local destination. Live capture writes compact JSON chunks. `asm.debug.traceMode: "lossless-instructions"` writes a durable `.act2` archive. `lossless-bus` requires the separate capture-bus ares runtime and records CPU/DMA/HDMA accesses with timing, channel and transfer phase to ACT2. `lossless-bus-transfers` requires the separate capture-transfer runtime and adds explicit DMA run / HDMA payload-burst boundaries and channel snapshots.
- **Assembly: Stop Runtime Trace Recording** (`asm.trace.stop`) - stops the producer, drains remaining events, and closes the artifact with observed and dropped-event counts. Lossless capture finishes without generating an intermediate JSON file. A terminated live session preserves incomplete JSON. A terminated lossless session preserves its checkpointed `.act2.partial` archive. Saving remains non-mutating. The completion notification offers the separate, explicit import/update action.
- **Assembly: Stop Execution Capture and Show Routines** (`asm.trace.stopAnalyze`) - stops the current instruction window and immediately runs the explicit trace-import/update workflow. Its report lists statically evidenced routine candidates in first-observed order, dynamic instruction counts, unique PCs, and contiguous execution spans. Unknown and conflicting PCs remain separate instead of becoming invented function boundaries. For bus recording, the same command saves the archive and opens the CPU/DMA/HDMA activity report through the separate bus importer.
- **Assembly: Import Bus Capture and Show DMA/HDMA Activity** (`asm.trace.importBus`) - streams a completed lossless bus ACT2 archive into the matching ROM's analysis project and shows per-channel reads, writes, HDMA phases and unowned contexts. Imports run in the maintenance process, are atomic and idempotent, and retain aggregate facts independently of the source file. Ordered timing/raster history requires the original capture. These are byte-access counts, not inferred transfer boundaries or instruction execution. Transfer-enabled archives additionally report completed, interrupted and partial windows, with bounded starting-register examples. Full ordered configuration history requires the archive. Both bus modes also show bounded VRAM/CGRAM/OAM port destination candidates, unknown setup/latches, and data-supplying events. These are register-derived candidates, not verified graphics memory updates. Reproducing this view requires the archive. No generated source or open ROM file is required.
- **Assembly: Import Runtime Trace and Update Disassembly** (`asm.trace.importRegenerate`) - validates and imports saved JSON or ACT2 traces, uses unique observed 65816 PCs as conservative code observations, reruns analysis, rewrites generated source, verifies an exact ROM round trip, and opens a report with the instruction/code-byte deltas and all attributable routine candidates. ACT2 chunks pass directly from the binary decoder into indexing and routine reporting, with no JSON write/read round trip. An observed PC proves reachability but does not invent a function boundary or `Fn_*` label.
- **Assembly: Open Disassembly RAM Map** (`asm.ramMap.open`) - opens the persistent, user-owned `ram-map.json` beside the generated source. Add or revise canonical `$7E0000`–`$7FFFFF` locations here. The adjacent generated JSON Schema provides validation and completion.
- **Assembly: Show Disassembly Update Status** (`asm.disassembly.status`) - reports whether `generated-files.json` was exported from the current analysis revision and RAM-map bytes, verifies generated-file hashes, and summarizes static code, mapped RAM variables, runtime evidence, trace imports, and heuristic comments.
- **Assembly: Analyze and Regenerate Disassembly** (`asm.disassembly.regenerate`) - reruns conservative analysis using current labels/manual edits, regenerates the source tree and `ram-defines.asm` from `ram-map.json`, substitutes exact known WRAM operands (including low-WRAM mirrors), and proves the rebuild byte-identical. Label rename offers this as an immediate follow-up action.
- **Assembly: Refresh Analysis Coverage** (`asm.coverage.refresh`) - reloads validated SQLite project views. Project change notifications refresh the view. Use this command to request an explicit refresh.
- **Assembly: Refresh Functions & Calls** (`asm.analysisGraph.refresh`) - reloads the validated function/call projection. The view also refreshes with the same project change notifications as Analysis Coverage.
- **Open Analysis Source or Disassembly** (`asm.analysis.navigate`) - the inline tree action for an exact function, call site, or unresolved-flow location. It prefers current source, then live DAP disassembly, then persisted CFG records.
- **Assembly: Classify Analysis Range** (`asm.coverage.classifyRange`) - adds a manual native classification through the conflict-safe project transaction layer. A segment context action preselects its exact range.
- **Assembly: Set Analysis State / Entry Point** (`asm.coverage.setStateEntryPoint`) - selects an existing classified interval and adds a separate manual overlay, leaving the base annotation intact. The compact input accepts `entry`, `e=native|emulation`, `m=8|16`, `x=8|16`, `carry=set|clear`, and `$`/`0x`/decimal `pbr`, `dbr`, `d`, and `s` values. Contradictory overlapping state is persisted as a conflict.
- **Assembly: Resolve Indirect Target** (`asm.coverage.resolveTarget`) - selects an unresolved or previously overridden site and adds comma-separated targets in that record's existing address space. New targets and manual evidence are unioned with earlier runtime/import/manual observations rather than replacing them.
- **Assembly: Rename Analysis Label** (`asm.coverage.renameLabel`) - renames one stable native label record and attaches certain manual provenance while retaining every earlier evidence id, then offers **Analyze and Regenerate** so the new name appears in generated source.
- **Assembly: Edit Disassembly Annotation** (`asm.disassembly.editAnnotation`) - opens an address-aware form from a generated label, instruction, or symbolic reference. Creates persistent labels for generated `Fn_*` names, edits comments above/beside labels and beside instructions, and offers **Save and Regenerate**. Available in the editor context menu and on **Cmd+Option+A** (macOS) / **Ctrl+Alt+A** (Windows/Linux).
- **Assembly: Explain Analysis Evidence** (`asm.coverage.explainEvidence`) - opens a read-only Markdown explanation for any persisted record, including complete direct evidence, related conflicts, an exact reverse-reference count, and up to 200 reverse links. Segment context narrows the picker to records projected there. This command remains available in an untrusted workspace because it does not write.
- **Assembly: Undo Last Analysis Edit** (`asm.coverage.undo`) - removes or restores only the exact unchanged records from the last session edit. Undo refuses if another process changed the result or started using its new evidence.
- **Assembly: Redo Last Analysis Edit** (`asm.coverage.redo`) - reapplies the last undone classification, state/entry overlay, target resolution, label rename, or disassembly annotation against a newly loaded project revision.

### Inspect Imported Sources

**Sources** lists imported artifacts by content identity, most recently imported captures first. Receipt timestamps also handle reimports. Sources without recorded dates follow in name order. Expand a source to inspect observed instructions, recorded memory accesses, attributed metadata, and capture notes. Instruction totals count distinct architecture/address-space/PC identities. Execution counts include all observations. Memory counts describe persisted fact rows, including differing values or processor states.

SQLite selects each page before decoding its records. The catalog reads only imports, evidence, and capture receipt timestamps. Opening a source never loads the full CFG or register history. Pages contain at most 200 items. Click an instruction or memory access to navigate to its qualified source or saved disassembly. **Assembly: Refresh Sources** (`asm.sources.refresh`) refreshes the view after external changes.

Idle/behavior capture and source-baseline comparison have been removed while that workflow is reconsidered. Ordinary execution capture, capture import, provenance, and ROM rebuild verification remain available.

Disassembly update reports include a **Storage** comparison (database, WAL, free pages, shared facts, source relationships and capture receipts), plus a **Step timings** section with measured durations, each step's share of processing time, the total, and the slowest step. Trace imports include metadata reading, validation, SQL import, analysis, source/assets, ROM verification, and final counts. Reports retain event/PC totals, dropped events, and warnings without expanding routine ownership tables or rereading the recording for attribution. Worker details separate SQL index preparation, variant grouping, metadata queries, static/captured decoding, heuristics, and publication. Details are contained in their parent duration and are not added twice. Verification separates file validation, assembly parsing, ROM assembly, output writes/ byte comparison, and debug-map generation. Timings include process overhead but exclude user selections and opening the report. Failed regeneration reports retain completed timings and mark the failed stage. Annotation refresh logs its source refresh, verification, and revision-check timings to **Output → Uttori Analysis**.

Use **Assembly: Show Analysis Output** (`asm.analysis.showOutput`) during an import or regeneration. The channel logs timestamps, project/capture paths, worker PID and memory budget, phase durations, file-read progress, provisional merge counts, stderr, and completion or failure. Counts are logged at most every five seconds, plus phase boundaries and final totals. After ten seconds without a worker update, the editor reports elapsed time and the last known count. This heartbeat does not claim the worker has advanced. Sixty seconds without an update is logged as a warning. Reading 100% of the file or merging every record does not mean publication has committed: the commit and subsequent cache/WAL maintenance are reported separately. Cancellation waits for the current safe step. Check disassembly status before retrying an interrupted update.

### Names and comments that survive regeneration

Regeneration preserves the saved analysis when an incomplete run would lose known ROM code. Source export also checks each existing code range before writing and refuses code-to-raw regressions, including when new code elsewhere would hide the loss in the total byte count. Imported trace evidence remains available after a rejected update. Resolve the reported analysis limit or conflict and retry. Intentional code-to-data changes require the CLI export option `--allow-code-regression`. An exact ROM round trip verifies bytes, not retained disassembly.

Open generated 65816 source and place the cursor on `Fn_C3002C`, an instruction, or a symbolic reference to the routine. Run **Assembly: Edit Disassembly Annotation** (or use its context menu action/shortcut). Enter `APU_IPL_Bootstrap` as the label name, then fill in the multiline comment above the label and either inline comment field. The form previews the placement. **Save Annotation** persists the metadata. **Save and Regenerate** reuses the saved analysis to rewrite source and verifies that the rebuilt ROM is byte-identical. Labels and comments are validated and saved without walking the full analysis or runtime history. Opening the form uses selected SQLite records. Source export reads small validated metadata and streams every instruction variant from a covering SQL index. It does not reload CFG contexts or the runtime history. A concurrent project edit rejects a stale refresh. Changed RAM/structure inputs require full regeneration. Use **Analyze and Regenerate Disassembly** to decode pending traces or apply changes to analysis settings. Annotation refresh preserves the existing decoded instructions.

```asm
; Initialize communication with the APU IPL.
APU_IPL_Bootstrap: ; Bootstrap entry
  PHB ; Save the data bank
```

The label uses the exact name entered, without an added `L_` prefix. Generated calls/jumps/branches to explicitly named targets use that same symbol when its exact exported address is known, retaining operand width and bank semantics. New annotation labels do not seed additional code analysis. Leave the name empty on an unlabeled instruction to add only an instruction comment. Clear a comment field to remove that comment. Other imported/handwritten comments and earlier evidence are preserved. The standard **Undo/Redo Last Analysis Edit** commands cover these edits too.

Selection checks the debug map's ROM identity and source hashes. Symbol references resolve through definitions in the mapped source, so an annotation saved since the last export cannot redirect an old source name to a different address. If the source is dirty or stale, restore/regenerate it first. Concurrent project changes are rejected when saving. Reopen the form to load the latest revision. Without an assembly editor active, the command offers the project's native labels and function candidates in a picker.

Annotations live in the transactional analysis project. Ordinary F2/source edits do not persist them, and direct database edits bypass revision, evidence, and cache invariants. Use the editor or project APIs. Generated `annotation-report.json` lists annotations that cannot be placed in the current ROM export. If a previously annotated instruction becomes unavailable, its inline comment remains saved and is rendered as a marked standalone comment where possible.

### Record an Execution Window

1. Start a debug session with a manifest-matched ares runtime that supports instruction tracing.
2. While paused, choose **Start Runtime Trace Recording** and a destination file.
3. Continue until the behavior of interest has run, then pause.
4. Choose **Stop Execution Capture and Show Routines** to import, analyze, regenerate, and verify.
5. Inspect the new source entry, instruction observations, and unresolved locations.

A trace records executed instructions. It does not reconstruct a complete call stack. Pause before stopping when the end boundary matters. Bounded live streams report dropped events. Lossless modes require the matching capture runtime. MesenCE does not provide instruction tracing.

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
- `asm.analysis.maxWorkItems` - static-analysis budget when regenerating disassembly (default 100,000). This counts CPU-state and call-path exploration, not imported trace events. Larger values consume more time and memory. Incomplete analysis still cannot discard known code.
- `asm.analysis.maxMemoryMiB` - JavaScript heap budget for the separate analysis-view process and each maintenance process (default 4096 MiB). Increase this in project settings for unusually large analyses. Analysis views reuse a validated project cache. Changing the budget restarts that process on its next request. Import, analysis, export, verification, and reports run outside the editor process. Each maintenance phase exits before the next starts, releasing its loaded project. A process failure reports its operation and budget. Cancellation stops async trace reading promptly. Synchronous maintenance phases finish their current safe step before later phases are cancelled. Total process memory can exceed the heap budget.
- `asm.trace.maxImportSizeMiB` - native trace import file-size limit (default 2048 MiB / 2 GiB). Set it in the project's `.vscode/settings.json`, for example `"asm.trace.maxImportSizeMiB": 4096` for a 4 GiB capture. Both import and routine reports read chunks incrementally, with progress and cancellation, instead of loading the entire recording into a JavaScript string. The compact import index has a separate 2,000,000-record budget. Full indexes allow up to 8,000,000 records and need substantially more memory. Both fail before exhausting an individual engine collection. This setting is separate from the static-analysis budget.
- `asm.trace.indexMode` - native SNES CPU captures default to `65816-analysis`: joint PC/bytes and normalized decoder state (P width bits, E, D, DB), exact counts and bus observations. Other processors use full indexing when the setting is unset. Explicit `full` and the `65816-disassembly` profile remain available. General-register history requires the original capture. The source hash still covers the entire capture. A different-profile reimport reuses the retained facts and reports that choice.

Workspace plugin configuration is disabled in restricted workspaces. Trust the workspace to activate `uttori-asm.config.json` or `asm.plugins`. The bundled SNES target remains available before trust is granted.

## Runtime Capture

Use **Disassembly → Runtime Capture** to record and import a bounded runtime window.

`asm.debug.traceDetail` selects full execution details (default) or explicit PC-only recording. Full capture rejects runtimes without instruction-detail support. Check the active workspace's `launch.json` runtime paths and restart debugging with a rich-trace build. Capture notifications show the selected mode and report dropped events, including when stopping to analyze. Both modes still use bounded buffers: a longer recording can lose events and does not guarantee more unique code coverage. New trace producer identities include the executable SHA-256 so supplemental runtime builds can be distinguished. Per-project `analysis/heuristics.json` configures evidence-backed role comments. Captured RAM instructions open from the analysis graph using their saved bytes. See [configuration, workflow, and remaining trace limits](https://github.com/uttori/asm/blob/master/packages/plugin-snes/ANALYSIS.md).

The sidebar defaults to **Project**, **Outline**, **Disassembly**, **Sources**, **Analysis Coverage**, then **Functions & Calls** (hidden until enabled). **Project** contains project settings and index details. **Disassembly** groups source regeneration, annotation editing, RAM tools, heuristics, and runtime capture. Expandable groups remember their state within each view.

Under **Heuristics**, **Edit rules** opens the project's `heuristics.json` (creating defaults only when the file does not exist). VS Code provides completion and validation using the existing heuristic configuration definition. Save the file, then choose **Run preview** to review role, confidence, and evidence findings from the current analysis. Preview runs in the analysis worker and does not change project files. **Analyze and regenerate** applies saved rules to source and verifies the ROM round trip. The same actions are available as **Assembly: Configure SNES Heuristic Rules** and **Assembly: Preview SNES Heuristic Findings** in the Command Palette.

Annotation forms open immediately with a loading message. The shared analysis worker validates and queries SQLite, verifies source maps, and returns only the selected label/comment data. Project revision and database change checks invalidate cached results. Saving retains source-hash checks and optimistic transaction checks, and also runs in the worker.

### Editing the Webviews

The Project, Disassembly, and annotation interfaces live in `media/panel.html`, `media/disassembly.html`, and `media/annotation.html`, each with a matching `.css` and `.js` file. The Disassembly stylesheet imports the shared Project styles. Edit those files directly. There is no HTML or JavaScript embedded in TypeScript template strings. `src/webview-template.ts` loads the packaged HTML and substitutes only CSP/resource placeholders. Dynamic project and annotation values arrive through messages and render as text or input values.

The assets ship unchanged in the VSIX. Use VS Code's webview developer tools to inspect markup, styles, and the original JavaScript files. Reopen the annotation panel or reload the extension window after changing assets. `npm run vscode:build` rebuilds host/worker code when those files change.

### Capture Storage Controls

`asm.analysis.cacheMaxMiB` defaults to 256 for disposable SQL projections. `asm.analysis.storageMaxMiB` defaults to 0 (no database publication ceiling). Explicit editor settings override the persisted project policy. Unset settings preserve policy choices made through the CLI.

Use `uttori-asm project-storage <analysis-directory>` to inspect capture receipts and storage usage, apply limits, and recycle caches/WAL. Imports read the source capture without copying it into the project. Keep the original recording when you need its full ordered history. Reopen clients after replacing a project database.

### Native ares File Capture

With the separately installed `ares-capture-file-desktop-runtime` candidate, set
`asm.debug.captureSink` to `native-file` and select any lossless `asm.debug.traceMode`.
Start recording while paused, then continue or step. Ares writes bounded binary ACT2 batches
directly to the selected local file. Stop Recording waits for durable finalization. The
existing import and retention budgets still apply. Stream remains the default sink.
See [native file capture](https://github.com/uttori/asm/blob/master/packages/debug-sidecar-ares/CAPTURE.md) for setup, scope,
measured throughput, recovery and platform limitations.

The `ares-realtime-desktop-runtime` follow-up adds faster native checksums and live bus analysis.
With `native-file` and a lossless bus mode selected, enable `asm.debug.liveBusAnalysis` to choose
a matching project and see provisional counts/backlog in the status bar. The isolated worker
publishes only after complete archive validation. `asm.debug.liveBusMaxLagMiB` defaults to 256.
Exceeding it stops analysis while recording continues. Click the status bar or run
**Assembly: Stop Live Bus Analysis** to stop analysis independently. Dense PPU analysis can still
fall behind even when recording exceeds realtime. See [benchmarks and workflow](https://github.com/uttori/asm/blob/master/packages/debug-sidecar-ares/CAPTURE.md).
