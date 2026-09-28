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
- Inline **Uttori ASM Debugger** with replay and live ares backends. Source / instruction breakpoints, stepping, threads, stack frames, registers, native watch expressions, memory, and virtual disassembly source.
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

For testing, open `packages/vscode-extension` as the VS Code workspace, select **Run Uttori Assembly Extension (No Debugger)** in Run and Debug, and press F5. The included launch task builds both the language server and extension. This starts the development host without attaching a JavaScript debugger; assembly and emulator debugging still work inside that host. Select **Run Uttori Assembly Extension** when you need breakpoints in the extension's TypeScript, or **Extension + Server** to also attach to the language server. Run `npm run vscode:package` from the repository root to produce a `.vsix`.

If VS Code reports **Extension host did not start in 10 seconds** and no Uttori output channels appear, check **Output → Log (Window)** in the development window and **Log (Extension Host)** in the launching window. A `debugBrk: true` timeout paired with JavaScript debugger `ECONNREFUSED ::1:<port>` errors means the debugger has failed to attach to the paused host before extensions can activate. Stop that launch and use **Run Uttori Assembly Extension (No Debugger)**, or **Run → Run Without Debugging** with the original launch configuration. Increasing the timeout does not fix that connection failure.

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

Source editors show configurable information independently of instruction documentation. The default compact preset shows file/CPU locations and available qualified execution counts. Use **Assembly: Choose Editor Information Preset** for compact, authoring, or disassembly defaults; **Configure Inline Fields** chooses common fields. Authoring uses successful build maps and output bytes without a native analysis project. Resolved operands are captured during encoding and require a rebuild for older maps. The **eye button beside Build Binary** toggles inline information without disabling hover. The clickable **Inline** status bar item explains unavailable information; **Assembly: Show Inline Source Information Status** lists changed or missing dependencies and map failures. Long source lines no longer move nearby annotations offscreen. `asm.editorInfo.*` settings control each surface, template fields, placement, and budgets; explicit legacy visibility and column settings remain supported. Decorations use the editor theme. See [Editor Information](README.md#editor-information) for configuration examples.

**Assembly: Inspect Line Information** loads detailed project/runtime state, transitions, memory, evidence, and control-flow previews on request, with page selection for long output. Stored evidence is unchanged. CPU aliases retain their own execution counts. Source/dependency changes invalidate the snapshot immediately. Debugger disassembly and navigation keep their existing annotation formatter.

Annotations are presented only when a validated native project and debug map name the same target and exact ROM content SHA-256/size, and the current source bytes still match the debug map's source SHA-256. Editing a mapped source clears its decorations immediately. Saving restores them only if the new bytes match a map. Logical addresses and explicit output offsets are indexed separately and filtered by architecture. The extension never guesses a mapper projection, changes emulator instructions, or lets an invalid analysis project prevent debugger startup.

Compact source overlays query indexed execution counts without decoding detail payloads. Selected state fields, the inspector, and debugger overlays query SQLite for the requested addresses before decoding bounded detail payloads. The first request builds derived address/output indexes. Later reads update only changed entries. Frequently executed instructions show a bounded state/memory preview marked **details limited**. Execution totals include every matching observation. Debugger startup loads matching manifests, then batches annotation queries for each displayed disassembly page. Annotation queries, form edits, and source refresh share their own worker process. Bulk Coverage, Sources, and graph queries use a separate process, so their queue or failure cannot cancel an edit. Each process uses the configured analysis memory budget and serializes its own requests.

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

The extension ships the MIT ares protocol sidecar, but never bundles an emulator executable, its runtime resources, or a test ROM. Live launch is allowed only in a trusted workspace and requires explicit paths to a versioned runtime manifest, the manifest-matched emulator executable, and its portable runtime root. The exact `program` bytes must still match the debug map before the emulator starts.

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

The extension starts the ares sidecar without a shell, passes a fresh 256-bit session token through the child environment rather than command-line arguments, and rejects any capability profile that differs from the built editor profile. An optional `sidecar` path is a development-only override for the bundled MIT module. It does not bypass protocol, token, or capability validation.

Watches evaluate only bounded integer expressions against the selected stopped frame's registers. Native `$hex`, `%binary`, low/high/bank selectors, arithmetic, comparisons, logical operations, bitwise operations, shifts, and parentheses are supported. Expressions cannot call JavaScript, read files, access emulator memory, or mutate emulator state.

The ares manifest selects `"frontend": "desktop"` for a graphical game window, audio, and controller input. `"headless"` (the default when omitted) remains available for automation. Both use the same debugger/trace bridge. A desktop runtime must contain the separately built and hashed application resources. A headless executable cannot become graphical by changing the manifest alone. Launch pauses at entry: **Continue (F5)** starts gameplay. Configure controls in **ares Settings → Input**. The desktop stays responsive while the CPU is paused, and runs while unfocused for capture dialogs.

Set a source breakpoint by clicking the editor gutter or pressing **F9** on a generated assembly line, then use **Continue (F5)**. A label, comment, or directive breakpoint moves to the next mapped executable line and VS Code shows the resolved location. Breakpoints may also be added, removed, or changed while the emulator is running: the adapter performs a hidden pause/update/resume transaction because the native emulator protocols only mutate execute breakpoints at a stopped boundary. The next matching instruction produces a normal breakpoint stop, where stepping and inspection are available. Use **Debug in Emulator**, not **Run in Emulator**, when breakpoints are required.

Run **Assembly: Configure Emulator Runtime** once per workspace and select the ares runtime manifest, emulator executable, and runtime directory. The absolute binding is kept in machine-local extension storage rather than project settings. **Run in Emulator** and **Debug in Emulator** build first and launch only the returned ROM/debug-map pair. If no picker binding exists, these commands reuse a single unambiguous live runtime explicitly configured in the folder's `launch.json`. Conflicting runtime configurations require the picker. Unresolved variables other than `${workspaceFolder}` are not guessed. Startup status, the chosen frontend, native stderr, and failures appear in **Output → Uttori Emulator**. Launch errors also produce a notification. Optional analysis annotations load asynchronously after debugger connection rather than delaying initialization. **Run and Watch** rebuilds on a debounced save and performs a deterministic full emulator restart only when a successful build changes the ROM or map. A compilation error leaves the current session running, and VS Code reapplies source breakpoints against the replacement map.

Generated configs contain `entryPoints: ["main.asm"]`. To open a parent folder instead of the generated directory, set `asm.configFile` to `disassembly/uttori-asm.config.json` and `asm.analysisProject` to `disassembly/analysis` in the parent's `.vscode/settings.json`. Paths read from the config resolve beside that config. Explicit `asm.*` path settings resolve from the workspace root. Run **Build Binary** before using a direct F5 launch after switching workspace roots so portable debug-map source paths match the launch's `sourceRoot`. At launch the debugger also checks the map's portable source paths against the configured root and adjacent artifact parents, choosing and logging the best on-disk match. This keeps source navigation valid for an initial generated map when the project is opened from its parent folder.

Every generated SNES project also includes `defines.asm`. `main.asm` includes it before the bank sources, and emitted absolute MMIO operands use conventional names such as `INIDISP`, `NMITIMEN`, and `DMAP0` instead of anonymous addresses. The file also supplies controller, interrupt/status, and DMA-channel masks. Every generated register and mask definition has its own adjacent description, so hovering a symbolic operand shows that register's purpose. Generated banks continue to express processor width with `.a8`/`.a16` and `.i8`/`.i16` directives.

While stopped, the Variables view groups registers by processor and native group, decodes the 65816 `N V M X D I Z C E` flags while retaining raw `P`/`E`, lists only named memory spaces whose backend reads are guaranteed side-effect-free, and shows 32 bytes from the 65816 or SPC700 stack pointer. Native bridges currently expose an explicit “current frame only” row instead of inventing a call stack. Virtual disassembly is discarded and regenerated at every stopped boundary.

Replay scripts can model instruction, step-in, step-over, and step-out transitions. The live ares bridge negotiates exact instruction and step-in support only. Step-over and step-out are labeled unavailable and rejected instead of being approximated.

## Commands

- **Assembly: Create Disassembly Project from ROM** (`asm.createDisassemblyProject`) - creates, analyzes, exports, and byte-verifies a new project in an empty directory.
- **Assembly: Import Diz Disassembly Project** (`asm.importDizProject`) - imports an uncompressed DiztinGUIsh `.dizraw` project with a matching ROM and reports deterministic conversion loss.
- **Assembly: Build Binary** (`asm.build`) - assembles the active file with the selected target and atomically publishes its matching debug map. Available from the command palette and the editor title run menu when editing an Uttori Assembly file. Unsaved buffers are built and source-fingerprinted as-is.
- **Assembly: Toggle Build on Save (Watch)** (`asm.toggleWatch`) - rebuilds the entry file (first `asm.entryPoints` value, else the active file) every time an assembly file is saved. A status bar item shows the watch state. Click it to toggle.
- **Assembly: Configure Emulator Runtime** (`asm.configureEmulatorRuntime`) - validates and stores the machine-local ares manifest, executable, and runtime root.
- **Assembly: Run in Emulator** (`asm.runEmulator`) - builds the artifact pair and launches the configured live backend without enabling breakpoints.
- **Assembly: Debug in Emulator** (`asm.debugEmulator`) - builds and launches the configured live backend with the VS Code debugger UI.
- **Assembly: Run and Watch** (`asm.runAndWatch`) - debounces saves and fully reloads a changed, successfully rebuilt ROM while retaining the current session after build failures.
- **Assembly: Start Runtime Trace Recording** (`asm.trace.start`) - starts an explicit execution window, selects a negotiated processor stream, and asks for a local destination. The default `asm.debug.traceMode: "lossless-instructions"` writes a durable `.act2` archive and a context companion with WRAM snapshots, a pre-action save state, controller replay data, screenshots, and a short separate graphics capture. Explicit `live` capture writes compact JSON chunks. `lossless-bus` requires the separate capture-bus ares runtime and records CPU/DMA/HDMA accesses with timing, channel and transfer phase to ACT2. `lossless-bus-transfers` requires the separate capture-transfer runtime and adds explicit DMA run / HDMA payload-burst boundaries and channel snapshots.
- **Assembly: Stop Runtime Trace Recording** (`asm.trace.stop`) - stops the producer, drains remaining events, and closes the artifact with observed and dropped-event counts. Lossless capture finishes without generating an intermediate JSON file. A terminated live session preserves incomplete JSON. A terminated lossless session preserves its checkpointed `.act2.partial` archive. Saving remains non-mutating. The completion notification offers the separate, explicit import/update action.
- **Assembly: Stop Execution Capture and Show Routines** (`asm.trace.stopAnalyze`) - stops the current instruction window and immediately runs the explicit trace-import/update workflow. Its report lists statically evidenced routine candidates in first-observed order, dynamic instruction counts, unique PCs, and contiguous execution spans. Unknown and conflicting PCs remain separate instead of becoming invented function boundaries. For bus recording, the same command saves the archive and opens the CPU/DMA/HDMA activity report through the separate bus importer.
- **Assembly: Import Bus Capture and Show DMA/HDMA Activity** (`asm.trace.importBus`) - streams a completed lossless bus ACT2 archive into the matching ROM's analysis project and shows per-channel reads, writes, HDMA phases and unowned contexts. Imports run in the maintenance process, are atomic and idempotent, and retain aggregate facts independently of the source file. Ordered timing/raster history requires the original capture. These are byte-access counts, not inferred transfer boundaries or instruction execution. Transfer-enabled archives additionally report completed, interrupted and partial windows, with bounded starting-register examples. Full ordered configuration history requires the archive. Both bus modes also show bounded VRAM/CGRAM/OAM port destination candidates, unknown setup/latches, and data-supplying events. These are register-derived candidates, not verified graphics memory updates. Reproducing this view requires the archive. No generated source or open ROM file is required.
- **Assembly: Import Runtime Trace and Update Disassembly** (`asm.trace.importRegenerate`) - validates and imports saved JSON or ACT2 traces, uses unique observed 65816 PCs as conservative code observations, reruns analysis, rewrites generated source, verifies an exact ROM round trip, and opens a report with the instruction/code-byte deltas and all attributable routine candidates. ACT2 chunks pass directly from the binary decoder into indexing and routine reporting, with no JSON write/read round trip. An observed PC proves reachability but does not invent a function boundary or `Fn_*` label.
- **Assembly: Open Disassembly RAM Map** (`asm.ramMap.open`) - opens the persistent, user-owned `ram-map.json` beside the generated source. Add or revise canonical `$7E0000`–`$7FFFFF` locations here. The adjacent generated JSON Schema provides validation and completion.
  Generated RAM comments omit source citations by default. Set `"includeSourceInformation": true` at the map's top level and regenerate to include them. Descriptive notes remain visible in either mode.
- **Assembly: Show Disassembly Update Status** (`asm.disassembly.status`) - reports whether `generated-files.json` was exported from the current analysis revision and RAM-map bytes, verifies generated-file hashes, and summarizes static code, mapped RAM variables, runtime evidence, trace imports, and heuristic comments.
- **Assembly: Analyze and Regenerate Disassembly** (`asm.disassembly.regenerate`) - chooses a metadata refresh or conservative analysis using current labels/manual edits, regenerates the source tree and `ram-defines.asm` from `ram-map.json`, substitutes exact known WRAM operands (including low-WRAM mirrors), and proves the rebuild byte-identical. Label rename offers this as an immediate follow-up action.
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

### Source ownership and generation status

The editor's **Disassembly** submenu, hover, quick actions, and status bar share ownership resolution. Choose **Inspect Disassembly Ownership** to see the saved and generated revisions, original ROM identity, stable owner ID, native address, emitted CPU alias, ROM interval, and provenance. A colocated analysis project takes precedence; unresolved copies are reported rather than silently selected.

- **Edit Owned Metadata** opens the existing native editor for supported labels, instructions, and raw data locations.
- **Open Owning Input** opens `ram-map.json`, `struct-map.json`, or `asset-includes.json` for mapped entities.
- **Show Owning Disassembly Status** and **Regenerate Owning Disassembly** scope maintenance to the resolved project.

Status distinguishes current generated source, saved metadata awaiting regeneration, changed inputs, unsaved source edits, external changes, unavailable ownership maps, and unresolved projects. The inspector checks the selected file and ownership map; full generated-file integrity is available through the status command. It explicitly reports ROM/build verification as **not checked by this inspector**. Source freshness alone is not proof of a successful build. Inspection is a timestamped snapshot with a refresh action.

Exact owner actions disappear when the buffer differs from its recorded generation. Source files remain text-editable; preserve any direct edits before regeneration. Use the metadata editor for persistent name, comment, classification, state, target, and map corrections.

### Names and comments that survive regeneration

Regeneration preserves the saved analysis when an incomplete run would lose known ROM code. Source export also checks each existing code range before writing and refuses code-to-raw regressions, including when new code elsewhere would hide the loss in the total byte count. Imported trace evidence remains available after a rejected update. Resolve the reported analysis limit or conflict and retry. Intentional code-to-data changes require the CLI export option `--allow-code-regression`. An exact ROM round trip verifies bytes, not retained disassembly.

Open generated source at a label, data comment, instruction, or symbolic reference and choose **Disassembly → Edit Owned Metadata**. **Assembly: Edit Disassembly Metadata** opens the same editor from the command palette; the previous **Edit Disassembly Annotation** command and shortcut remain aliases. Coverage's classification, state, target, and rename commands also use this editor.

1. Select an existing record or **New record at selection**. Collections are searchable and paged in groups of 100.
2. Change the fields, then choose **Preview changes**. Review exact before/after records, retained evidence, and added/removed assembly names.
3. Choose **Save reviewed change**. Success means **metadata saved; regeneration pending**.
4. Choose **Regenerate source**, then inspect the Disassembly result for generation and ROM verification. Regeneration currently uses full analysis; metadata-only refresh coordination is a later phase.

**Labels:** the native name preserves imported spelling. **Assembly name** sets the exact emitted symbol; blank uses the normal generated spelling. **Remove Disassembly Label Name** preserves comments and the existing analysis-entry policy by default. It suppresses that native name and the automatic function-name fallback at its ROM offset. Other explicit aliases at the same address remain. A generated function can be suppressed without changing its code-discovery evidence. **Reset Name** returns an imported label to its original naming policy; resetting a manually created label removes that record and permits automatic fallback. New labels default to presentation-only; existing labels keep their saved entry-point policy.

**Comments:** create, edit, and remove standalone comments without introducing a label or requiring a CFG node. Inline instruction comments remain saved if their instruction becomes unavailable; export renders a marked standalone comment where possible. Clear an above-label or beside-label comment field to remove just that comment.

**Classification / CPU state / entry points:** select a saved interval to replace its classification or bounds, remove the interval, or split it at an interior address. Blank CPU fields remove saved hints. Point checkboxes replace the saved point set, including removal of an entry point. Other overlapping records remain visible and can be corrected separately; imported evidence is retained in receipts.

**Targets:** edit the complete list to remove incorrect indirect targets, manage named entry-point sets, or remove the record. SNES control-flow targets use CPU addresses. No target union is applied by these editor operations.

**RAM and structure maps:** choose a collection and entry to edit its JSON, then **Apply entry to map draft**. Field definitions and descriptions are edited inside their layout; selecting a generated field opens that layout. Bindings, constants, and justified instruction uses have their own collections. Whole-file JSON remains available. Preview validates the complete map, references between layouts/bindings/expressions, ROM intervals, and the shared namespace with native labels, hardware, and generated functions. New map files are created only on Save. These are metadata declarations; they do not change ROM bytes.

**Restore after reopening:** choose a native edit in **Saved edit receipts**, or choose **Show map receipts** and select a file edit. **Review restoration** prepares the exact inverse only when the touched records/file still match the saved result. Saving an inverse creates another receipt, so it can also be reversed. Native receipts are stored in SQLite; map receipts retain exact UTF-8 file versions in `analysis/metadata-map-history`. Coverage Undo/Redo opens this persisted receipt history in the worker-backed metadata editor. Undo and redo save inverse metadata changes and clearly leave source regeneration pending.

Names are checked against RAM, hardware, functions, layouts, bindings, and constants before saving. Regeneration rewrites generated references. A conservative reference scan blocks removal/rename when user-owned `.asm`, `.s`, or `.inc` files **inside the source-export root** still reference the old symbol; it may include comments and does not scan external include trees. Update those references as part of the reviewed change. F2 continues to reject text-only edits touching generated files.

Saved decisions protect the same native IDs on reimport. Different artifacts with different IDs remain separate claims. Reanalysis retains the edit receipts. Evidence records and original versions remain available rather than being erased. Preview does not write files; saves recheck analysis revision, captured source bytes, map hashes, bounds, and names. Validation errors retain the open draft. Reloading saved data keeps edited text and shows the current saved records or map for comparison. Review the retained draft again before saving against the new revision.

Native and JSON-map saves share per-project and per-source writer leases and a durable operation journal. Each reviewed save has a stable ID. If the worker response is lost, **Reconcile save outcome** checks the original SQLite/file receipt and returns its outcome without applying it twice. A map receipt contains exact original and candidate UTF-8 bytes; a conflicting external edit is preserved. These are recoverable serialized saves, not an atomic transaction across SQLite and files.

**Recover draft / operation history** offers recent drafts after reopening the editor. Autosave retains raw native fields, incomplete JSON, selected map-entry text, the original revision, and reviewed operation identity under `analysis/.editing`. Drafts are never automatically committed. **Show saved operation outcomes** distinguishes prepared, committed, failed, and conflicted saves. Successful saves are omitted from draft recovery.

Regeneration combines all pending saved edits. A provable chain of name/comment-only edits reuses saved analysis; classification, entry-point, target, map changes, or unknown revisions require reanalysis. An explicit Analyze command with no pending metadata changes still runs analysis. Different selected projects can run independently.

Source generation happens in a sibling staging directory. The previous generation and candidate both pass exact ROM comparison before visible files are replaced. Publication rechecks the SQLite revision and consumed source inputs, holds writer leases, and writes a recovery journal before replacing generated files. The manifest is published last. Normal builds, ownership lookup, and integrity checks reject an incomplete replacement or a generation switch.

If the editor or worker stops during publication, run **Assembly: Recover Disassembly Publication** (`asm.disassembly.recoverPublication`). A fully applied candidate is acknowledged; a partial replacement restores the retained previous generation. External edits block recovery with the conflicting paths and both retained locations. Preserve those edits and reconcile with a complete retained generation before retrying. Do not delete active locks or change manifest hashes. Dead local process locks are reclaimed automatically; live or unknown owners are not displaced.

**Show Disassembly Status** separates current input/source revisions from durable ROM verification. Regeneration returns a failure outcome to the metadata panel when it does not complete. Verified build outputs/debug maps remain in the candidate tree; use normal Build for artifacts referring to the visible source. Sibling `.disassembly-previous-*` / `.disassembly-candidate-*` generations and publication journals are retained without automatic pruning. They consume disk space; retain any generation referenced by an unresolved journal. Source staging excludes the native analysis directory, captures, build outputs, `.git`, and dependencies, rejects symlinks, and is bounded to 1 GiB.

New exports include `source-ownership.json`, bound to analysis revision, ROM identity, and generated-file hashes. It supports data-only owners and stable native IDs before assembly. Preserve direct generated-source edits before regeneration; use the metadata editor or project APIs instead of editing the database directly. Generated `annotation-report.json` lists saved annotations that cannot be placed in the current ROM export.

### Record an Execution Window

1. Start a debug session with a manifest-matched ares runtime that supports instruction tracing.
2. While paused, choose **Start Runtime Trace Recording** and a destination file.
3. Continue until the behavior of interest has run, then pause.
4. Choose **Stop Execution Capture and Show Routines** to import, analyze, regenerate, and verify.
5. Inspect the new source entry, instruction observations, and unresolved locations.

A trace records executed instructions. It does not reconstruct a complete call stack. Pause before stopping when the end boundary matters. Bounded live streams report dropped events. Lossless modes require the matching capture runtime.

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
- `asm.trace.maxImportSizeMiB` - native trace import file-size limit (default 2048 MiB / 2 GiB). Set it in the project's `.vscode/settings.json`, for example `"asm.trace.maxImportSizeMiB": 4096` for a 4 GiB capture. Both import and routine reports read chunks incrementally, with progress and cancellation, instead of loading the entire recording into a JavaScript string. Project imports index distinct facts in SQLite. This setting is separate from the static-analysis budget.
- `asm.trace.indexMode` - native SNES CPU captures default to `65816-analysis`: joint PC/bytes and normalized decoder state (P width bits, E, D, DB), exact counts and bus observations. Other processors use full indexing when the setting is unset. Explicit `full` and the `65816-disassembly` profile remain available. General-register history requires the original capture. The source hash still covers the entire capture. A different-profile reimport reuses the retained facts and reports that choice.

Instruction imports use SQLite for distinct facts and final records, so all profiles can exceed
the in-memory library's 2M/8M record limits. Input-file and configured storage budgets still apply.
The file-size limit is independent of the number of indexed facts: one instruction with a new
register snapshot creates both an instruction record and a CPU-state record in the full index.

Workspace plugin configuration is disabled in restricted workspaces. Trust the workspace to activate `uttori-asm.config.json` or `asm.plugins`. The bundled SNES target remains available before trust is granted, including explicit builds and build on save. Analysis edits and live emulator launch require a trusted local filesystem workspace.

## Runtime Capture

Use **Disassembly → Runtime Capture** to record and import a bounded runtime window.

`asm.debug.traceDetail` selects full execution details (default) or explicit PC-only recording. Full capture rejects runtimes without instruction-detail support. Check the active workspace's `launch.json` runtime paths and restart debugging with a rich-trace build. Capture notifications show the selected mode and report dropped events, including when stopping to analyze. Both modes still use bounded buffers: a longer recording can lose events and does not guarantee more unique code coverage. New trace producer identities include the executable SHA-256 so supplemental runtime builds can be distinguished. Per-project `analysis/heuristics.json` configures evidence-backed role comments. Captured RAM instructions open from the analysis graph using their saved bytes. See [configuration, workflow, and remaining trace limits](https://github.com/uttori/asm/blob/master/packages/plugin-snes/ANALYSIS.md).

The sidebar defaults to **Project**, **Outline**, **Disassembly**, **Sources**, **Analysis Coverage**, then **Functions & Calls** (hidden until enabled). **Project** contains project settings and index details. **Disassembly** groups source regeneration, annotation editing, RAM tools, heuristics, and runtime capture. Expandable groups remember their state within each view.

Under **Heuristics**, **Edit rules** opens the project's `heuristics.json` (creating defaults only when the file does not exist). VS Code provides completion and validation using the existing heuristic configuration definition. Save the file, then choose **Run preview** to review role, confidence, and evidence findings from the current analysis. Preview runs in the analysis worker and does not change project files. **Analyze and regenerate** applies saved rules to source and verifies the ROM round trip. The same actions are available as **Assembly: Configure SNES Heuristic Rules** and **Assembly: Preview SNES Heuristic Findings** in the Command Palette.

Annotation forms open immediately with a loading message. The shared analysis worker validates and queries SQLite, verifies source maps, and returns only the selected label/comment data. Project revision and database change checks invalidate cached results. Saving retains source-hash checks and optimistic transaction checks, and also runs in the worker.

### Editing the Webviews

The Project, Disassembly, and annotation interfaces live in `media/panel.html`, `media/disassembly.html`, `media/annotation.html`, and `media/metadata.html`, each with a matching `.css` and `.js` file. The Disassembly stylesheet imports the shared Project styles. Edit those files directly. Production form assets are separate from TypeScript. The host smoke test injects a small DOM driver to exercise the packaged controls under CSP. `src/webview-template.ts` loads the packaged HTML and substitutes only CSP/resource placeholders. Dynamic project and annotation values arrive through messages and render as text or input values.

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

Capture context is enabled by default (`asm.debug.captureContext`). Use **Add Capture Milestone**
to label a paused screenshot, **Replay Capture Inputs** to reproduce the captured action, or
**Restore Capture Pre-action State** to try a different action from the same state. These require
a matching local ares runtime and ROM. See the [capture bundle reference](../debug-sidecar-ares/CAPTURE.md#default-research-bundle)
for file contracts, visual timing, replay validation, and graphics scope limits.

## Owned ROM modifications and build targets

Use **Assembly: Create ROM Modification Project** to verify the baseline and create a user-owned directory alongside the disassembly. It contains `modification.json`, a pinned `baseline-interface.asm`, and `inputs/`. Generated bank assembly remains owned by the exporter.

Use **Add ROM Replacement…** from the Disassembly context menu or Command Palette. The wizard offers a little-endian 16-bit value, assembly instructions/data, or binary data. It displays the actual original bytes before creating the input. Offsets are **headerless ROM file offsets**, not CPU addresses. A selected generated field can supply an offset; verify its meaning and encoding before changing it. Labels and prose alone do not prove an encoding.

Each replacement records a unique ID, original bytes, exact byte budget, input filename, and initial 65816 accumulator/index widths. Edit the owned input directly. Instructions, `db`/`dw`, data structures, includes under `inputs/`, and fixed-size binary replacements are supported. The pinned interface exposes verified top-level ROM labels, hardware/RAM constants and structures. `Patch_<id>` exposes each replacement's manually placed address to other replacements. Source includes cannot escape the owned input directory or use symlinks.

The status-bar target selector controls the normal Build, Run, Debug and Watch commands:

| Target                      | Build contract                                                                |
| --------------------------- | ----------------------------------------------------------------------------- |
| Baseline                    | Reassemble generated source and require exact original-ROM equality.          |
| Modified ROM                | Verify the pinned baseline, then apply only declared exact-size replacements. |
| Configured assembly project | Existing general assembler workflow.                                          |

Explicit **Verify Baseline ROM**, **Build Modified ROM**, **Run Modified ROM**, **Debug Modified ROM**, and **Run Modified ROM and Watch** commands are also available. `asm.modificationProject` selects the manifest; `asm.buildTarget` persists the target for the workspace. Watch detects editor saves and external assembly/binary input changes. Switching targets stops the old watch. Save changes before building; builds consume disk snapshots.

Each successful modified build gets its own immutable `build/<id>/` directory with a headerless ROM and matching debug map, a final ROM retaining the original copier header, and `verification.json`. `build/current.json` is updated only after the complete generation is written. Failed or cancelled builds preserve the last successful output. The debugger checks the exact selected ROM/map identity and passes that build hash to ares for the session. Installed runtime manifests and their executable/resource pins stay unchanged. No automatic pruning is performed.

Modified verification checks the baseline ROM and generation hashes, interface hash, expected original bytes, mapper bounds, overlapping ranges, exact emission sizes, and dependency stability. It rejects unmapped/noncanonical writes, repeated writes and implicit gaps, including writes whose value happens to equal the original. A replacement must fit within one mapper bank. Checksums are preserved unless explicitly replaced. Modification builds deliberately differ from the baseline; that difference is reported as a changed-byte count, not a failed baseline comparison.

Baseline execution counts, captured processor state and uploaded-code mappings are not carried into the modified target. **Create Analysis Project for Modified ROM** builds and initializes a separate workspace bound to the new ROM hash. Capture import already requires that hash. No labels, classifications, captures or other metadata are automatically migrated from the baseline. Relocated metadata needs reviewed address mappings.

Regeneration preserves the separate modification inputs. A changed baseline generation requires the reviewed rebase workflow below; do not change its hashes to bypass that check. Automatic allocation, pointer discovery, trampolines, and automatic metadata migration remain outside this workflow.

## Assets, placement, source recovery and rebase

The **Disassembly** context menu groups these commands under **ROM Assets and Placement** and **Source Recovery and Rebase**. All are also available in the Command Palette. These workflows require a trusted workspace and saved input files.

**Assets:** Add a binary replacement for the exact native stream, then choose **Extract Editable ROM Asset**. Supported native documents are planar 2/3/4/8bpp and Mode 7 tiles (indexed PNG), BGR555 palettes, BG/Mode 7 maps, and native BRR blocks (JSON). Tile extraction requires the actual shared palette's ROM offset; palette slots, including duplicate colors, are retained. Compression requires an explicit pipeline JSON with `transforms: [{id, version, options}]` and a configured reversible plugin. Extraction must reencode to the exact original stream; unsupported or noncanonical encodings fail without replacing ownership.

Use **Open Owned ROM Asset Externally** to launch the operating system's associated editor, or **Open Owned ROM Input** to open it in VS Code. PNG imports require indexed pixels and the extracted palette slots. A truecolor export, reordered palette, or changed colors is rejected; shared palettes have a separate owner and can be edited as native palette JSON. **Import Edited ROM Asset** copies a replacement into a new owned input and retains its predecessor. For a binary owner without a recipe, select explicit recipe JSON containing `format`, `version`, `mediaType`, and optionally `output`, `options`, `palette`, and `transforms`. Resource paths must start with `inputs/`. Build reencodes owned asset inputs every time and rejects codec-version drift, lossy transforms, overflow, and unrequested padding. The existing asset preview and the extracted PNG support visual inspection; native BRR JSON edits preserve block fields, and this workflow does not promise a visual audio editor.

**Placement and growth:** **Prepare ROM Allocation Plan** opens a saved plan for one owner. Edit its headerless `offset` and allocation `size`; optional `expansion: {size, fill}` declares a larger ROM and its fill byte. Short binary/asset encodings need an explicit `fill`; assembly must emit its exact allocation. Each pointer lists a unique `id`, headerless `offset`, `width` of 2 or 3 bytes, optional target `addend`, and the actual CPU `bank` for a 16-bit pointer. Save and use **Apply ROM Allocation Plan**. The plan is pinned to the manifest you reviewed. Ranges must be canonical, within one mapper bank, and non-overlapping. Pointers refer to `Patch_<owner>`; branch and exact-emission validation run in the following build. ROM header size fields and checksum bytes are not repaired implicitly: own and edit those bytes explicitly when required by your ROM.

**Remove ROM Replacement** removes an owner while retaining its inputs and prior manifest under `.history/`. Update references to its `Patch_<id>` symbol before rebuilding. The last successful build remains available when a subsequent build fails.

**Rebase:** projects retain generated source, metadata input files, the original ROM, and the symbols interface under `.baselines/`. No analysis database or captures are copied. Existing phase-4 projects upgrade when selected, using an intact live or retained publication matching their existing pin; missing historical bytes are reported instead of guessed. **Review ROM Baseline Rebase** creates a new project against the selected verified baseline. `rebase-review.json` links the base, incoming and old owned ROMs, the candidate output or build error, and conflicts with owner IDs and offsets. Fill `resolutions` with `keep-owned` or `take-baseline` for each conflict. Changed symbols/types conservatively require review of assembly owners.

For manual conflict resolution, edit the **candidate** inputs (for example, update a renamed symbol), then open the saved `rebase-review.json` and run **Refresh ROM Rebase Review**. This retains reviewed input versions, rebuilds the candidate, and lists `editedInputs`. Review those changes and the resulting output. **Accept ROM Rebase** rechecks both projects and builds the resolved candidate before selecting it. Failed or stale reviews retain all versions and leave the original target intact. Mapper/copier-header changes need a new project and manual address mapping. Rebase does not migrate analysis labels or captures between ROM identities.

**Source edits:** Save a generated-file edit and choose **Review Generated Source Edit**. The exact edited file and original version are retained under `.source-drafts/`, with a diff and ownership report. Supported imports are one contiguous owner change: label rename/removal, a complete standalone comment, or bounded instruction/data source. **Import Reviewed Source Edit** writes native semantic operations or an owned replacement, restores generated source, and verifies/regenerates. A metadata import creates a new generation, so the modification project then needs rebase. Changed source/revisions stop the operation and retain the draft. Multi-owner edits, struct-field syntax, include/layout changes, and ambiguous edits remain saved drafts with a manual next action.

**Restore Reviewed Generated Source** also works for unsupported drafts. It restores only the reviewed file after checking that no newer edit replaced it; restoration and full-ROM verification are reported separately. From a saved source review, **Create Detached Source Project** copies the verified baseline plus the preserved edited file into a new directory with manual ownership. Without a review selected, it copies a clean verified baseline. There is no `generated-files.json` in the detached tree; `detached-source.json` records provenance. An included draft remains unverified until you build it. Relative plugin module paths are anchored to their original location, so external plugin dependencies still need to be available. Open the detached directory as a workspace and use the configured assembly target.

Watch covers owned inputs and baseline generated/input files. A changed baseline stops the next modified build with a rebase-required or integrity error. Retained baselines, review drafts, history and build outputs are not automatically pruned.

### Visual ROM editing, metadata migration, and retained storage

Run **Assembly: Open ROM Editing Workbench** for the selected modification project. The same workbench is available through **Edit ROM Data or Asset Visually**, **Migrate Metadata to Another ROM**, and **Manage ROM Project Storage**. The panel stays bound to that project when editor focus changes.

- **Data & assets:** select an existing replacement. Binary tables offer explicit little-endian unsigned 8/16/24/32-bit fields with original values alongside edits. Assembly inputs remain editable as source. Indexed PNGs have a pixel canvas and numeric pixel controls; duplicate palette colors retain separate slots. Native BGR555 palettes expose 5-bit channels and the unused high bit. BG and Mode 7 maps expose cells in native storage order and their attributes. Undo/redo affects the draft. **Preview & validate ROM** builds an isolated candidate and displays original/candidate ROM bytes. **Save reviewed input** publishes a new input version only while the manifest, dependencies, and baseline still match. Build afterward to refresh Run/Debug artifacts. Failed previews and raw form drafts remain recoverable through **Recover draft**.
- **Labels & annotations:** opens the bound baseline's metadata inspector. RAM declarations, structure layouts and fields, bindings, and constants now have structured input controls. Advanced JSON remains available, including guarded instruction-use declarations. Apply an entry to the map draft, preview its cross-file validation, save, and regenerate as before.
- **Allocation:** shows owned ROM ranges and a form for explicit offsets, sizes, fill, growth, and pointer updates. Review the concrete plan before applying it. Unowned bytes are not claimed to be free space. A subsequent build validates encoding and placement; pointer discovery, trampolines, checksum changes, and mapper changes remain explicit work.
- **Rebase conflicts:** opens a prepared rebase review and shows original, incoming, and owned bytes side by side. Each conflict requires a resolution. Save decisions, rebuild the candidate review after source reconciliation, then accept and verify it. Acceptance does not silently select a different Run/Debug project.

**Metadata migration** can build the current modified ROM or use another selected ROM. The target must use the same mapper and copier-header convention. Optional relocation ranges are explicit headerless `from`, `to`, and `size` values; overlapping ranges are rejected. Review items are searchable and paged. Every selection is explicit, including byte-identical items: equal bytes alone do not prove unchanged meaning. Changed anchor context is marked for review, and intervals crossing a relocation boundary are blocked.

Migration writes a **new, independently verified workspace** containing its own ROM copy. Selected labels, comments, manual/imported classifications, structure libraries and bindings, and RAM declarations can migrate. Bindings require their structure library. Labels become presentation-only, classifications lose CPU-state/flow hints, and runtime observations, original capture evidence, control-flow targets, regions, guarded instruction uses, and asset-codec annotations are not copied. Their exclusion counts are visible in the review. The new project requires fresh analysis/captures for execution facts. A stale source revision, ROM, or map input rejects acceptance. Failed staged work is retained for inspection; a repeated completed operation reconciles its result without replacing an existing project.

**Storage & recovery** measures retained builds, baseline snapshots, manifest history, editor/source/migration/rebase drafts, metadata drafts, and journal-identified source generations. It shows why each protected item is retained and lets you pin milestones. Current baseline dependencies, the last successful build, ROMs used by analysis projects in the displayed sibling-project scope, unresolved drafts, and active publication recovery generations are protected. Editable inputs, databases, and capture archives are never cleanup candidates. Pins are recorded against absolute artifact paths; review/re-pin them after moving the project.

Cleanup is an explicit permanent deletion of selected eligible history, with a final item-count/space confirmation and a persisted progress receipt. The backend reacquires writer leases and checks the inventory/content fingerprint before deleting. Active debugging blocks the UI cleanup action. Projects outside the displayed scope, hidden project directories, and dependencies reached only through symbolic links are not discoverable; pin artifacts they need before cleanup. Baselines referenced by retained manifest history remain protected until that history is separately reviewed and removed.

These are general native editors. Game-specific room composition, map layout inference, full audio authoring, arbitrary plugin model forms, automatic allocation/pointer discovery, and unrestricted source reverse-import remain separate extensions.
