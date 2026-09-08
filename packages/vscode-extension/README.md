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

## Creating a Disassembly Project

In a trusted workspace, run **Assembly: Create Disassembly Project from ROM** and select a local
ROM plus an empty output directory. The extension detects the SNES mapper and copier header from
the file contents, asks for a mapper only when the evidence is ambiguous, creates and analyzes the
native project, exports editable source, verifies an exact rebuild, and opens the completed folder.

Use **Assembly: Import Diz Disassembly Project** for the same flow with a DiztinGUIsh `.dizraw`
project. Imported labels, comments, regions, CPU state, and classifications are preserved where the
native schema can represent them; the completion dialog reports warnings and unsupported fields.
Compressed `.diz` files are rejected until that format has bounded fixture coverage.

The generated workspace contains `main.asm`, `banks/`, `assets/`, `build/`, `analysis/`, documented
`snes-defines.asm`, user-owned `ram-map.json`, generated `ram-defines.asm`,
`generated-files.json`, the assembler configuration, and ready-to-use VS Code settings and replay
launch configuration. Use **Open Disassembly RAM Map**, edit a variable, then **Analyze and
Regenerate Disassembly**; status explicitly reports the source as stale between those two actions.
ROM bytes are not copied into the analysis project. The absolute ROM path is kept only in
machine-local extension storage and associated with the ROM's content identity.

## Analysis Coverage

The **Analysis Coverage** view discovers up to 32 native `analysis.json` projects in the workspace, or reads the project selected by `asm.analysisProject`. Discovery reads only manifests. Expanding a project validates shard hashes and builds projections in a shared, memory-bounded worker instead of the extension UI thread. Large shards are parsed record-by-record; summaries and at most 200 rows per page cross back to the UI. Functions and calls are also expanded lazily, and inline annotations request only visible source lines. A failed worker reports an error and can be retried by refreshing the view. Summary groups report exclusive classified/unknown/conflict totals, overlapping opcode/operand/data/asset classifications, and executed/operand/read/written runtime overlays.

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

**Assembly: Build Binary** now always emits an identity-matched pair: the configured ROM output and
`<output>.debug.json`. The build result includes the binary SHA-256, debug-map fingerprint, target,
architecture, and per-artifact change state. Unsaved editor buffers are fingerprinted from the exact
overlay bytes used by the assembler.

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
  "emulator": "${workspaceFolder}/.debug/ares/ares.app/Contents/MacOS/ares",
  "runtimeDirectory": "${workspaceFolder}/.debug/ares"
}
```

Use `"backend": "mesence"` with the corresponding patched MesenCE manifest, executable, and runtime root to expose its negotiated 65816, SPC700, and SuperFX threads. The extension starts sidecars without a shell, passes a fresh 256-bit session token through the child environment rather than command-line arguments, and rejects any capability profile that differs from the built editor profile. An optional `sidecar` path is a development-only override for the bundled MIT module; it does not bypass protocol, token, or capability validation.

Watches evaluate only bounded integer expressions against the selected stopped frame's registers. Native `$hex`, `%binary`, low/high/bank selectors, arithmetic, comparisons, logical operations, bitwise operations, shifts, and parentheses are supported. Expressions cannot call JavaScript, read files, access emulator memory, or mutate emulator state.

The ares manifest selects `"frontend": "desktop"` for a graphical game window, audio, and controller
input; `"headless"` (also the legacy default when omitted) remains available for automation. Both
use the same debugger/trace bridge. A desktop runtime must contain the separately built and hashed
application resources; a headless executable cannot become graphical by changing the manifest alone.
Launch pauses at entry: **Continue (F5)** starts gameplay. Configure controls in **ares Settings → Input**.
The desktop stays responsive while the CPU is paused, and runs while unfocused for capture dialogs.

Set a source breakpoint by clicking the editor gutter or pressing **F9** on a generated assembly
line, then use **Continue (F5)**. A label, comment, or directive breakpoint moves to the next mapped
executable line and VS Code shows the resolved location. Breakpoints may also be added, removed, or
changed while the emulator is running: the adapter performs a hidden pause/update/resume transaction
because the native emulator protocols only mutate execute breakpoints at a stopped boundary. The
next matching instruction produces a normal breakpoint stop, where stepping and inspection are
available. Use **Debug in Emulator**, not **Run in Emulator**, when breakpoints are required.

Run **Assembly: Configure Emulator Runtime** once per workspace and select ares or MesenCE,
its versioned runtime manifest, emulator executable, and runtime directory. The absolute
binding is kept in machine-local extension storage rather than project settings. **Run in
Emulator** and **Debug in Emulator** build first and launch only the returned ROM/debug-map pair.
If no picker binding exists, these commands reuse a single unambiguous live runtime explicitly
configured in the folder's `launch.json`. Conflicting runtime configurations require the picker;
unresolved variables other than `${workspaceFolder}` are not guessed.
If a saved picker binding selects an older runtime, reconfigure it to use the desktop runtime.
Startup status, the chosen frontend, native stderr, and failures appear in **Output → Uttori Emulator**;
launch errors also produce a notification. Optional analysis annotations load asynchronously after
debugger connection rather than delaying initialization.
**Run and Watch** rebuilds on a debounced save and performs a deterministic full emulator restart
only when a successful build changes the ROM or map. A compilation error leaves the current
session running, and VS Code reapplies source breakpoints against the replacement map.

Generated configs contain `entryPoints: ["main.asm"]`. To open a parent folder instead of the
generated directory, set `asm.configFile` to `disassembly/uttori-asm.config.json` and
`asm.analysisProject` to `disassembly/analysis` in the parent's `.vscode/settings.json`.
Paths read from the config resolve beside that config; explicit `asm.*` path settings resolve
from the workspace root. Run **Build Binary** before using a direct F5 launch after switching
workspace roots so portable debug-map source paths match the launch's `sourceRoot`. At launch the
debugger also checks the map's portable source paths against the configured root and adjacent
artifact parents, choosing and logging the best on-disk match. This keeps source navigation valid
for an initial generated map when the project is opened from its parent folder.

Every generated SNES project also includes `snes-defines.asm`. `main.asm` includes it before the
bank sources, and emitted absolute MMIO operands use conventional names such as `INIDISP`,
`NMITIMEN`, and `DMAP0` instead of anonymous addresses. The file also supplies controller,
interrupt/status, and DMA-channel masks. Every generated register and mask definition has its own
trailing description, so hovering a symbolic operand shows that register's purpose. Generated banks
continue to express processor width with `.a8`/`.a16` and `.i8`/`.i16` directives.

While stopped, the Variables view groups registers by processor and native group, decodes the
65816 `N V M X D I Z C E` flags while retaining raw `P`/`E`, lists only named memory spaces whose
backend reads are guaranteed side-effect-free, and shows 32 bytes from the 65816 or SPC700 stack
pointer. Native bridges currently expose an explicit “current frame only” row instead of inventing
a call stack. Virtual disassembly is discarded and regenerated at every stopped boundary.

Replay scripts can model instruction, step-in, step-over, and step-out transitions. The current
live ares and MesenCE bridges negotiate exact instruction and step-in support only; step-over and
step-out are labeled unavailable and rejected instead of being approximated.

## Commands

- **Assembly: Create Disassembly Project from ROM** (`asm.createDisassemblyProject`) - creates,
  analyzes, exports, and byte-verifies a new project in an empty directory.
- **Assembly: Import Diz Disassembly Project** (`asm.importDizProject`) - imports an uncompressed
  DiztinGUIsh `.dizraw` project with a matching ROM and reports deterministic conversion loss.
- **Assembly: Build Binary** (`asm.build`) - assembles the active file with the
  selected target and atomically publishes its matching debug map. Available from the command
  palette and the editor title run menu when editing an Uttori Assembly file. Unsaved buffers are
  built and source-fingerprinted as-is.
- **Assembly: Toggle Build on Save (Watch)** (`asm.toggleWatch`) - rebuilds the
  entry file (first `asm.entryPoints` value, else the active file) every time an
  assembly file is saved. A status bar item shows the
  watch state; click it to toggle.
- **Assembly: Configure Emulator Runtime** (`asm.configureEmulatorRuntime`) - validates and stores
  the machine-local manifest, executable, and runtime root for ares or MesenCE.
- **Assembly: Run in Emulator** (`asm.runEmulator`) - builds the artifact pair and launches the
  configured live backend without enabling breakpoints.
- **Assembly: Debug in Emulator** (`asm.debugEmulator`) - builds and launches the configured live
  backend with the VS Code debugger UI.
- **Assembly: Run and Watch** (`asm.runAndWatch`) - debounces saves and fully reloads a changed,
  successfully rebuilt ROM while retaining the current session after build failures.
- **Assembly: Start Runtime Trace Recording** (`asm.trace.start`) - starts an explicit execution window, selects a negotiated processor stream, asks for a local destination, and continuously drains bounded batches to a versioned native JSON artifact with disk writes providing backpressure.
- **Assembly: Stop Runtime Trace Recording** (`asm.trace.stop`) - stops the producer, drains remaining events, and closes the artifact with observed and dropped-event counts. A terminated session preserves valid incomplete JSON. Saving remains non-mutating; the completion notification offers the separate, explicit import/update action.
- **Assembly: Stop Execution Capture and Show Routines** (`asm.trace.stopAnalyze`) - stops the current execution window and immediately runs the explicit trace-import/update workflow. Its report lists statically evidenced routine candidates in first-observed order, dynamic instruction counts, unique PCs, and contiguous execution spans. Unknown and conflicting PCs remain separate instead of becoming invented function boundaries.
- **Assembly: Import Runtime Trace and Update Disassembly** (`asm.trace.importRegenerate`) - validates and imports a saved trace, uses unique observed 65816 PCs as conservative code observations, reruns analysis, rewrites generated source, verifies an exact ROM round trip, and opens a report with the instruction/code-byte deltas and all attributable routine candidates. An observed PC proves reachability but does not invent a function boundary or `Fn_*` label.
- **Assembly: Open Disassembly RAM Map** (`asm.ramMap.open`) - opens the persistent, user-owned `ram-map.json` beside the generated source. Add or revise canonical `$7E0000`–`$7FFFFF` locations here; the adjacent generated JSON Schema provides validation and completion.
- **Assembly: Show Disassembly Update Status** (`asm.disassembly.status`) - reports whether `generated-files.json` was exported from the current analysis revision and RAM-map bytes, verifies generated-file hashes, and summarizes static code, mapped RAM variables, runtime evidence, trace imports, and behavior comments.
- **Assembly: Analyze and Regenerate Disassembly** (`asm.disassembly.regenerate`) - reruns conservative analysis using current labels/manual edits, regenerates the source tree and `ram-defines.asm` from `ram-map.json`, substitutes exact known WRAM operands (including low-WRAM mirrors), and proves the rebuild byte-identical. Label rename and behavior-capture application offer this as an immediate follow-up action.
- **Assembly: Refresh Analysis Coverage** (`asm.coverage.refresh`) - reloads validated native project manifests and shards. The view also refreshes when an `analysis.json` manifest or `analysis/*.json` shard changes.
- **Assembly: Refresh Functions & Calls** (`asm.analysisGraph.refresh`) - reloads the validated function/call projection. The view also refreshes with the same manifest and shard file watchers as Analysis Coverage.
- **Open Analysis Source or Disassembly** (`asm.analysis.navigate`) - the inline tree action for an exact function, call site, or unresolved-flow location. It prefers current source, then live DAP disassembly, then persisted CFG records.
- **Assembly: Classify Analysis Range** (`asm.coverage.classifyRange`) - adds a manual native classification through the conflict-safe project transaction layer. A segment context action preselects its exact range.
- **Assembly: Set Analysis State / Entry Point** (`asm.coverage.setStateEntryPoint`) - selects an existing classified interval and adds a separate manual overlay, leaving the base annotation intact. The compact input accepts `entry`, `e=native|emulation`, `m=8|16`, `x=8|16`, `carry=set|clear`, and `$`/`0x`/decimal `pbr`, `dbr`, `d`, and `s` values. Contradictory overlapping state is persisted as a conflict.
- **Assembly: Resolve Indirect Target** (`asm.coverage.resolveTarget`) - selects an unresolved or previously overridden site and adds comma-separated targets in that record's existing address space. New targets and manual evidence are unioned with earlier runtime/import/manual observations rather than replacing them.
- **Assembly: Rename Analysis Label** (`asm.coverage.renameLabel`) - renames one stable native label record and attaches certain manual provenance while retaining every earlier evidence id, then offers **Analyze and Regenerate** so the new name appears in generated source.
- **Assembly: Edit Disassembly Annotation** (`asm.disassembly.editAnnotation`) - opens an address-aware form from a generated label, instruction, or symbolic reference. Creates persistent labels for generated `Fn_*` names, edits comments above/beside labels and beside instructions, and offers **Save and Regenerate**. Available in the editor context menu and on **Cmd+Option+A** (macOS) / **Ctrl+Alt+A** (Windows/Linux).
- **Assembly: Explain Analysis Evidence** (`asm.coverage.explainEvidence`) - opens a read-only Markdown explanation for any persisted record, including the complete evidence records, reverse references, and related conflicts. Segment context narrows the picker to records projected there; this command remains available in an untrusted workspace because it does not write.
- **Assembly: Undo Last Analysis Edit** (`asm.coverage.undo`) - removes or restores only the exact unchanged records from the last session edit. Undo refuses if another process changed the result or started using its new evidence.
- **Assembly: Redo Last Analysis Edit** (`asm.coverage.redo`) - reapplies the last undone classification, state/entry overlay, target resolution, label rename, or disassembly annotation against a newly loaded project revision.

### Names and comments that survive regeneration

Open generated 65816 source and place the cursor on `Fn_C3002C`, an instruction, or a symbolic
reference to the routine. Run **Assembly: Edit Disassembly Annotation** (or use its context menu
action/shortcut). Enter `APU_IPL_Bootstrap` as the label name, then fill in the multiline comment
above the label and either inline comment field. The form previews the placement. **Save Annotation**
persists the metadata; **Save and Regenerate** also reruns analysis, rewrites source, and verifies
that the rebuilt ROM is byte-identical.

```asm
; Initialize communication with the APU IPL.
APU_IPL_Bootstrap: ; Bootstrap entry
  PHB ; Save the data bank
```

The label uses the exact name entered, without an added `L_` prefix. Generated calls/jumps/branches
to explicitly named targets use that same symbol when its exact exported address is known, retaining
operand width and bank semantics. New annotation labels do not seed additional code analysis.
Leave the name empty on an unlabeled instruction to add only an instruction comment. Clear a comment
field to remove that comment; other imported/handwritten comments and earlier evidence are preserved.
The standard **Undo/Redo Last Analysis Edit** commands cover these edits too.

Selection checks the debug map's ROM identity and source hashes. Symbol references resolve through
definitions in the mapped source, so an annotation saved since the last export cannot redirect an
old source name to a different address. If the source is dirty or stale, restore/regenerate it first.
Concurrent project changes are rejected when saving; reopen the form to load the latest revision.
Without an assembly editor active, the command offers the project's native labels and function
candidates in a picker.

Annotations live in the transactional analysis project. Ordinary F2/source edits do not persist them,
and editing the hash-checked analysis shards by hand invalidates the project manifest. Generated
`annotation-report.json` lists annotations that cannot be placed in the current ROM export. If a
previously annotated instruction becomes unavailable, its inline comment remains saved and is
rendered as a marked standalone comment where possible.

### Capturing the Secret of Mana Squaresoft logo window

This is conventionally an **execution-window trace** or **PC trace**. The routine table is a
dynamic-coverage view over the existing static call graph; it is not a complete dynamic call stack
or causal program slice.

1. Launch **Secret of Mana (ares)** in debug mode. The debugger stops at the reset entry point.
2. In the Assembly sidebar, select **Start capture** and save a trace such as
   `captures/squaresoft-logo.trace.json`.
3. Continue execution. When the Squaresoft logo has been visible for roughly three seconds and
   before it begins fading to the title screen, pause the debugger.
4. Select **Stop / show routines**. The extension drains and closes the exact window, imports its
   observed PCs, regenerates the disassembly, verifies the ROM round trip, and opens the routine
   report.
5. Start with the routines near the beginning of the table, then inspect high-count routines and
   the unowned-PC section. After adding labels, entry points, or indirect targets, regenerate and
   import the saved trace again to improve attribution.

Pause before stopping when the end boundary matters: the trace recorder observes instructions
while the emulator is running, while the Stop command itself is an editor action rather than a
cycle-exact emulator breakpoint. The current instruction stream is supplied by the headed patched
ares runtime. MesenCE remains useful for interactive inspection but does not yet negotiate an
instruction-trace stream.

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

## Behavior capture: locating code behind an action

Start with **Assembly: Run Idle Capture Demo** (also **Idle demo** in the Assembly Project panel).
It runs a synthetic baseline and action through the real recorder, comparison, and in-memory comment
merger without a ROM, emulator, or project writes. The report identifies `$808020` and `$808030` as
action-only, retains `$808000` as shared, excludes idle-only `$808010`, preserves a handwritten comment,
and verifies idempotent application. **Assembly: Open Behavior Capture Guide** explains the live
Secret of Mana room/menu workflow. Both are available without an active debug session.

With the trace-enabled ares runtime, use **Assembly: Capture Idle Baseline** while the game is
idle. Repeat to collect several independent windows. Use **Assembly: Capture Behavior**, select
the idle files, enter a label such as `Open Menu`, choose a stopping condition, then perform the
action. If paused, choose **Start and Continue** to arm tracing and resume together, or **Start Paused**
to step manually. A paused CPU is not an idle baseline; zero-event captures produce a warning.
**Assembly: Stop Behavior
Capture** ends either kind of capture early.

Each capture has time and instruction caps (defaults: 5 seconds / 250,000 instructions). Address,
label, and source-line stops delimit observed events after polling; use an existing breakpoint if
you need the CPU to halt exactly. Trace recording and behavior capture cannot run concurrently.
Do not rebuild between the selected baseline and action captures. Return to the same starting state
for each observation; the integration does not automatically restore save states. Use the desktop
runtime for player-driven tests; headless runtimes cannot display the game or accept controller input.

**Assembly: Review and Apply Capture** displays action-only, frequency-enriched, and shared code,
function candidates, mapped source locations when the matching debug session is available, and an
ordered trace excerpt. Select the instructions you actually want to annotate, then confirm.
Application adds provenance-bearing candidate comments and observed execution to the matching
native project; it preserves existing comments, labels, source files, and control-flow evidence.
Cancel makes no edits, and applying the same selection again is a no-op. Comments appear in
hash-current inline annotations and subsequent debugger disassembly requests. The completion
message reports the exact record deltas and offers **Analyze and Regenerate**. Its follow-up report
shows instruction/code-byte deltas and lists changed generated files, so a five-second comparison
has an explicit result even when it adds no new code.

This is **dynamic feature location / differential execution profiling**, not proof that the chosen
code causes the behavior. Shared routines remain visible. Lost events and incomplete captures are
reported, and no transitions are invented across missing events. Files retain all captured windows
for repeatable analysis. They contain project-sensitive addresses and labels; keep Secret of Mana
captures private.

MesenCE has no instruction trace stream yet and is explicitly unsupported for capture. Synthetic
replay exercises the workflow but is not real-game evidence. Source-only projects (including
SLIDESHOW) can capture/review; applying annotations requires a native analysis project.

`asm.debug.traceDetail` selects full execution details (default, when supported) or PC-only recording. Per-project `analysis/heuristics.json` configures evidence-backed role comments. Captured RAM instructions open from the analysis graph using their saved bytes. See [configuration, workflow, and remaining trace limits](../../docs/snes-function-heuristics-and-runtime-code.md).
