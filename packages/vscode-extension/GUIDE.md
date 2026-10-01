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

## Creating and editing a Git source project

In a trusted workspace, run **Assembly Source: Create Git Source Project**, select the original ROM,
a new destination and the mapper (or detection). **Create Git Source Project from Diz Research** also
imports uncompressed `.dizraw` annotations into tracked declarations. Creation verifies the original
ROM and establishes Git generation ancestry before selecting the completed project.

Source lives under `source/`; research, generation and layout declarations live under `.uttori/`.
The ignored `.uttori-local/` holds machine-local ROM/evidence bindings and build artifacts. Edit source
and assets directly. Use F2 for supported symbol renames, or the research commands for aliases,
annotations, state assumptions and classifications. Research edits open ordinary dirty documents;
VS Code provides undo/redo, save, hot exit and Source Control diffs.

Prepare regeneration whenever new evidence or recipes are ready. Preview incorporates supported
unsaved edits. Before applying, save and commit your checkpoint in Git. Apply uses a native merge;
resolve conflicts with Source Control or Merge Editor, stage them, then validate and finish.
An intentional edited ROM need not equal the original; the incoming pure generation must.

## Analysis Coverage

The **Analysis Coverage** view discovers up to 32 native `analysis.json` projects in the workspace, or reads the project selected by `asm.analysisProject`. Discovery reads only manifests. Expanding a project validates native metadata and builds projections in background Node processes using the project's `asm.analysis.maxMemoryMiB` budget (default 4096 MiB). A fatal heap error is isolated from the extension host. SQLite selects and pages the required records. Summaries and at most 200 rows per page cross back to the UI. Sources are expanded lazily, and inline annotations request only visible source lines. Requests within each process run one at a time. Reads have a 60-second execution timeout, excluding time queued behind another view. A failed process reports the operation and memory budget and can be retried by refreshing the view. Summary groups report exclusive classified/unknown/conflict totals, overlapping opcode / operand / data asset classifications, and executed / operand / read / written runtime overlays.

The ROM map is a coalesced list of half-open file-offset segments, paged at 200 rows so expanding a large ROM cannot enqueue the entire map in VS Code at once. CPU and RAM addresses are never guessed into ROM offsets: records without an explicit file address or file offset remain visible under **Projection diagnostics**.

Coverage actions open tracked research declarations for the selected source project. The selected
project's local evidence binding also drives Coverage and Sources in worktrees. SQLite imports and
research projections remain transactional; authored changes live in Git files, not database undo history.

## Sources navigation

The **Sources** view groups persisted capture and import evidence. Selecting a location retains its address space, ROM identity, captured bytes, and record provenance.

Opening a location first looks for an exact current debug-map source range with matching ROM output identity and matching source-file hash. If no current source exists, an active Uttori debug session can provide virtual disassembly through DAP. The final fallback is a read-only view of persisted CFG records. It does not re-decode the ROM and marks unavailable operand bytes as `??`. Stale source mappings are reported rather than trusted.

## Analysis Annotations

Source editors show configurable information independently of instruction documentation. The default compact preset shows file/CPU locations and available qualified execution counts. Use **Assembly: Choose Editor Information Preset** for compact, authoring, or disassembly defaults; **Configure Inline Fields** chooses common fields. Authoring uses successful build maps and output bytes without a native analysis project. Resolved operands are captured during encoding and require a rebuild for older maps. The **eye button beside Build Binary** toggles inline information without disabling hover. The clickable **Inline** status bar item explains unavailable information; **Assembly: Show Inline Source Information Status** lists changed or missing dependencies and map failures. Long source lines no longer move nearby annotations offscreen. `asm.editorInfo.*` settings control each surface, template fields, placement, and budgets; explicit legacy visibility and column settings remain supported. Decorations use the editor theme. See [Editor Information](README.md#editor-information) for configuration examples.

**Assembly: Inspect Line Information** loads detailed project/runtime state, transitions, memory, evidence, and control-flow previews on request, with page selection for long output. Stored evidence is unchanged. CPU aliases retain their own execution counts. Source/dependency changes invalidate the snapshot immediately. Debugger disassembly and navigation keep their existing annotation formatter.

Annotations are presented only when a validated native project and debug map name the same target and exact ROM content SHA-256/size, and the current source bytes still match the debug map's source SHA-256. Editing a mapped source clears its decorations immediately. Saving restores them only if the new bytes match a map. Logical addresses and explicit output offsets are indexed separately and filtered by architecture. The extension never guesses a mapper projection, changes emulator instructions, or lets an invalid analysis project prevent debugger startup.

Compact source overlays query indexed execution counts without decoding detail payloads. Selected state fields, the inspector, and debugger overlays query SQLite for the requested addresses before decoding bounded detail payloads. The first request builds derived address/output indexes. Later reads update only changed entries. Frequently executed instructions show a bounded state/memory preview marked **details limited**. Execution totals include every matching observation. Debugger startup loads matching manifests, then batches annotation queries for each displayed disassembly page. Annotation queries, form edits, and source refresh share their own worker process. Bulk Coverage and Sources queries use a separate process, so their queue or failure cannot cancel an edit. Each process uses the configured analysis memory budget and serializes its own requests.

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

- **Assembly Source: Select Source Project** chooses the repository/worktree for subsequent actions.
- **Prepare Regeneration**, **Preview Regeneration**, **Apply Regeneration**, **Validate and Finish Merge**,
  and **Abort Regeneration** operate on the selected project and native Git state.
- **Edit Symbol Research** and **Edit Analysis Research** prepare tracked declaration edits.
- **Import Capture** adds compatible JSON/ACT2 evidence and its portable catalog identity.
- **Analyze Evidence** refreshes derived code using the selected branch's research.
- **Relocate Object** and **Expand ROM Capacity** propose supported layout changes and repair known references.
- **Assembly: Build Binary**, **Run in Emulator**, **Debug in Emulator**, and **Run and Watch** use the
  selected source project's validated build and matching debug map.
- **Start Runtime Trace Recording**, **Stop Runtime Trace Recording**, and **Stop Capture and Import Evidence**
  control capture. Import and regeneration remain separate operations.
- **Explain Analysis Evidence** opens read-only provenance and reverse references.

### Inspect Imported Sources

**Sources** lists imported artifacts by content identity, most recently imported captures first. Receipt timestamps also handle reimports. Sources without recorded dates follow in name order. Expand a source to inspect observed instructions, recorded memory accesses, attributed metadata, and capture notes. Instruction totals count distinct architecture/address-space/PC identities. Execution counts include all observations. Memory counts describe persisted fact rows, including differing values or processor states.

SQLite selects each page before decoding its records. The catalog reads only imports, evidence, and capture receipt timestamps. Opening a source never loads the full CFG or register history. Pages contain at most 200 items. Click an instruction or memory access to navigate to its qualified source or saved disassembly. **Assembly: Refresh Sources** (`asm.sources.refresh`) refreshes the view after external changes.

Use **Assembly: Show Analysis Output** for evidence-query diagnostics. Source operation progress and
failures appear in the source output channel. Cancellation and worker failure preserve authored files;
refresh source status before resuming an interrupted operation.

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
- `asm.trace.indexMode` - `full` is the only supported value. Every new instruction import retains supplied registers, bytes, execution counts and bus observations. Source identity covers the entire capture. Historical reduced-index receipts in existing Secret of Mana projects remain readable; reimport preserves their retained facts with a warning and does not restore omitted registers.

Instruction imports use SQLite for distinct facts and final records, so imports can exceed
the in-memory library's 8M record limit. Input-file and configured storage budgets still apply.
The file-size limit is independent of the number of indexed facts: one instruction with a new
register snapshot creates both an instruction record and a CPU-state record in the full index.

Workspace plugin configuration is disabled in restricted workspaces. Trust the workspace to activate `uttori-asm.config.json` or `asm.plugins`. The bundled SNES target remains available before trust is granted, including explicit builds and build on save. Analysis edits and live emulator launch require a trusted local filesystem workspace.

## Runtime Capture

Use the runtime recording commands to record a bounded window, then **Import Capture** in the Source Project tree.

`asm.debug.traceDetail` selects full execution details (default) or explicit PC-only recording. Full capture rejects runtimes without instruction-detail support. Check the active workspace's `launch.json` runtime paths and restart debugging with a rich-trace build. Capture notifications show the selected mode and report dropped events, including when stopping to analyze. Both modes still use bounded buffers: a longer recording can lose events and does not guarantee more unique code coverage. New trace producer identities include the executable SHA-256 so supplemental runtime builds can be distinguished. Captured RAM instructions open from Sources using their saved bytes. See [configuration, workflow, and remaining trace limits](https://github.com/uttori/asm/blob/master/packages/plugin-snes/ANALYSIS.md).

The sidebar provides **Project**, **Outline**, **Source Project**, **Sources**, and **Analysis Coverage**.
The source tree reflects the selected repository, candidate, merge state, and last validated build.

### Editing the Webviews

Only the project panel and native palette/indexed-PNG editors use HTML/CSS/JS under `media/`.
Their resource URLs and CSP are supplied by `src/webview-template.ts`. Regeneration and conflict
resolution use native tree, task, Problems, diff, Merge Editor and Source Control surfaces.
Rebuild host/worker code with `npm run vscode:build`; reload the extension after changing assets.

### Capture Storage Controls

`asm.analysis.cacheMaxMiB` defaults to 256 for disposable SQL projections. `asm.analysis.storageMaxMiB` defaults to 0 (no database publication ceiling). Explicit editor settings override the persisted project policy. Unset settings preserve policy choices made through the CLI.

Use `uttori-asm project-storage <analysis-directory>` to inspect capture receipts and storage usage, apply limits, and recycle caches/WAL. Imports read the source capture without copying it into the project. Keep the original recording when you need its full ordered history. Reopen clients after replacing a project database.

### Native ares File Capture

With the separately installed `ares-capture-file-desktop-runtime` candidate, set
`asm.debug.captureSink` to `native-file` and select any lossless `asm.debug.traceMode`.
Start recording while paused, then continue or step. Ares writes bounded binary ACT2 batches
directly to the selected local file. Stop Recording immediately shows finalization progress while
the archive and companion files drain, hash and sync. Import preparation shows progress while a
background process reads capture identity and validates generated source before importing facts. The
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

## Assets, growth and recovery

Open palettes and indexed PNGs with their native custom editors, or use an external editor that
preserves the declared representation. Palette indices retain duplicate colors. Atlas previews and
padding are not editable storage; paint the canonical tiles. Asset recipes remain tracked source
inputs. WAVE, tilemap, room and sprite data use their supported native codecs and ordinary files.

Growth needs explicit object identity, extent, bank/CPU assumptions and proven free ranges in
`.uttori/layout.json`. Relocation repairs only supported declared references and validates the complete
build. Unknown pointers, bank-dependent calls and ambiguous control flow block automatic repair.

Git retains source history. Build/scratch retention is bounded and protects active operations.
Use **Clean Source Cache** for eligible material. Missing capture archives do not authorize deletion
of normalized evidence. A failed or cancelled operation does not mark an unverified build current.
