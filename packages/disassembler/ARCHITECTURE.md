# Disassembler architecture

This document explains how the assembler, native analysis project, SNES processors, source export,
runtime evidence, debugger, and VS Code presentation fit together. It is the design reference for
contributors. Public commands remain documented in the package READMEs.

## Design goals

The disassembler is designed to be:

- conservative: insufficient evidence produces ambiguity, unresolved flow, or raw bytes.
- reversible: accepted code and assets can be emitted in native Uttori ASM syntax and rebuilt.
- explainable: every imported, inferred, observed, or manual fact retains provenance.
- deterministic logical records: canonical JSON values, stable IDs, and transactional SQLite storage.
- target-extensible: generic analysis never imports SNES or emulator implementation types.
- safe on untrusted input: schemas, identities, paths, frames, counts, and work are validated and
  bounded. And
- editor-friendly: the same qualified identities connect projects, source maps, DAP, and runtime
  traces without guessing.

Perfect static disassembly is not a goal. Code/data separation, indirect targets, runtime-generated
code, and processor state can be undecidable from ROM bytes alone.

## Package ownership

```text
                         hosts
       ┌──────────────────┼────────────────────┐
       │                  │                    │
      CLI          language server         VS Code
       │                  │             ┌──────┴──────┐
       │                  │             │             │
       ├──── plugin loader + target plugins      debug adapter
       │                        │                  │
       │                        │          neutral sidecar protocol
       │                        │                  │
       │                        │             ares sidecar
       │                        │                  │
       ├──────────── disassembler        separate emulator process
       │                        │
       └────────────────────── core
```

The arrows show composition, not permission to leak lower-layer types upward.

| Package/workspace                | Owns                                                                                                                                       | Must not own                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `@uttori/asm-core`               | parsing, expressions, stages, symbols, diagnostics, plugin contracts, decoder-neutral types, debug maps                                    | SNES opcodes, mappers, project storage, emulator APIs    |
| `@uttori/asm-disassembler`       | ROM identity, project schema/storage, transactions, generic analysis, evidence, coverage, call graph, asset declarations, export manifests | SNES mapping/opcodes, Diz fields, DAP, emulator commands |
| `@uttori/asm-plugin-snes`        | 65816/SPC700/SuperFX specifications, state transfer, SNES mapping/detection, Diz import, native source rendering                           | VS Code UI, DAP, native process lifecycle                |
| `@uttori/asm-plugin-65xx`        | other 65xx-family specifications and targets                                                                                               | SNES-specific behavior                                   |
| `@uttori/asm-plugin-loader-node` | trusted Node plugin discovery and configuration                                                                                            | plugin semantics                                         |
| `@uttori/asm-cli`                | command parsing and explicit workflow orchestration                                                                                        | duplicate analysis or mapper algorithms                  |
| `@uttori/asm-debug-adapter`      | neutral backend, replay, conformance, framing, DAP translation                                                                             | emulator SDK/command types, project mutation             |
| ares sidecar                     | native transport translation, runtime validation, child lifecycle                                                                          | DAP, VS Code models, project format                      |
| language server                  | editor protocol and workspace analysis over the plugin environment                                                                         | independent opcode catalogs                              |
| VS Code extension                | commands, views, trust policy, navigation, DAP host                                                                                        | analysis inference or emulator implementation            |

`npm run check:boundaries` checks critical dependency and forbidden-identifier rules. A boundary that
needs target behavior receives an explicit target/plugin callback or descriptor.

## Internal module boundaries

`src/index.ts` is the public facade. Implementations import concrete files; they do not import the
facade or create directory barrels. `npm run check:boundaries` checks area dependencies for runtime
and type imports, in addition to package ownership rules.

| Area       | Owns                                                                                | Allowed lower areas                                            |
| ---------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `internal` | Bounded indexes/caches, temporary uniqueness sets, durable filesystem primitives    | None                                                           |
| `model`    | Record contracts, ROM identity, semantic validation, bus/PPU effect validation      | `internal`                                                     |
| `analysis` | Static worklist, coverage, instruction/source/call contracts, evidence explanations | `model`, `internal`                                            |
| `edits`    | Proposed metadata/annotation changes and conditional undo                           | `model`, `analysis/project-evidence`, `internal`               |
| `runtime`  | Trace parsing, evidence reduction, transfer/graphics/PPU accumulation               | `model`, `edits`, `internal`                                   |
| `storage`  | Connection lifecycle, physical codecs, queries, invalidation, retention             | `model`, `analysis`, `runtime`, `internal`                     |
| `project`  | Validated snapshots, revision-checked commits, durable trace imports                | `model`, `analysis`, `edits`, `runtime`, `storage`, `internal` |
| `source`   | Generated manifests, ownership, integrity, recovery/publication                     | `model`, `internal`                                            |

`RecordIdSet` owns a temporary disk-backed SQLite set and its disposal; it never opens the project
database. `RomImage` performs explicit file I/O. Model contracts retain existing SNES capture
semantics. Type-only references within those contracts do not introduce executable cycles.

SQLite remains behind the connection-owning `SqliteAnalysisStore` facade. Read-only evidence
explanations are shared with edit/undo logic, so storage does not import editing workflows. PPU
effect validation is a model operation; capture accumulation is a runtime operation. Project
orchestration owns commit/revision policy, while source publication accepts already verified trees
and relies on its caller to hold the project/source lease.

Tests mirror these areas. Shared SQLite setup lives under `tests/helpers`; schema fixtures remain
under `tests/fixtures`. Compiler output mirrors source directories and must be cleaned before
rebuilding moved modules.

## Assembly and reversible instruction path

Core builds source in three explicit stages:

1. `collectDefinitions` discovers symbols/macros without emitting output.
2. `resolveLayout` stabilizes addresses and sizes.
3. `emitProgram` writes bytes and source metadata.

Each architecture has a declarative specification, encoder, decoder, formatter, and state model.
For 65816, decode width depends on E/M/X state. Unknown width returns explicit alternatives. Static
analysis does not select one based on the bytes that happen to follow. SPC700 and SuperFX follow the
same decode-format-encode contract, including truncated-input and out-of-bounds results.

The native-source exporter emits only syntax implemented by this project. Compatibility with Asar,
ca65, snes2asm, or Diz output formats is not a source-output goal. Unjustified bytes use native raw
data/incbin forms so readability work cannot compromise byte identity.

## ROM ingestion and identity

`RomImage` distinguishes the complete file from its headerless content:

- `sha256` and `fileSize` identify the exact user file.
- `contentSha256` and `contentSize` identify the cartridge content. And
- `headerSize` records `0` or a 512-byte copier header.

The project never serializes either byte array. Commands that read or export a project can require
the user ROM again and compare both stored identity and size.

SNES mapper detection is target-owned. It scores header candidates and records the candidates and
evidence. A tie or weak decision requires an explicit override. Numeric equality never converts a
file offset to a CPU, WRAM, ARAM, or GSU address. Every such conversion uses a target mapper or an
explicit persisted projection.

The selected SNES header is also parsed as a cartridge structure: title, map/speed mode, chipset,
ROM/RAM sizes, region, developer/version fields, checksum pair, optional expanded header, and all
16 native/emulation vector words. Reserved vector slots remain data. Only architecturally meaningful
handler vectors seed control-flow analysis.

## Native project format

An analysis project contains `analysis.sqlite` and an `analysis.json` watcher pointer. The database
stores the semantic manifest, monotonic revision, seven metadata collections, and columnar runtime
facts. SchemaVersion remains 3. Legacy JSON/shard containers and manifest migrations are removed.
Small user configuration, debug maps and capture interchange formats keep their JSON contracts.
SQLite's separate physical format version is 4. Globally shared runtime facts hold coordinates and
payloads. Compact observations retain source IDs, exact counts and provenance. Exact instruction/state
pairs share physical storage and expose virtual CPU-state records through a SQL view. Canonical hash
suffixes are interned once and referenced by integers, including both sides of a paired observation.
Known numeric 65816 snapshots use a versioned, checksummed packed codec that preserves all register
values and field presence. Other small runtime payloads use JSONB; larger payloads use the bounded,
checksummed compression codec. Capture receipts survive optional detail expiry. Metadata uses rowid tables to avoid excessive overflow
pages, while runtime indexes serve point, coverage, and memory-instruction queries.

Full reads validate record values, provenance, address-space bounds, region relationships and the
absence of ROM payloads. Metadata views skip runtime unless an explicit reducer requests a validated
stream. SQLite unique constraints enforce stored ID uniqueness without a separate validation index.

## Conflict-safe project edits

Readers capture rows and revision in one SQLite snapshot. Edit functions return changed records and
inverse operations. Publication validates the proposed records, acquires `BEGIN IMMEDIATE`, rejects
an obsolete revision, and commits rows, provenance and the next revision together. View updates
preserve omitted runtime history. Complete replacements replace it. Unchanged rows are retained.

SQLite WAL handles interrupted writers and concurrent readers. The database is authoritative.
`analysis.json` is atomically refreshed after commit for watchers. A failed pointer refresh is a
warning about an already committed operation, not a failed edit. Explicit compaction checkpoints and
VACUUMs the database and prunes unused dictionaries. Normal edits create no filesystem generations.
Current projects use schema 3 and SQLite storage format 4 exclusively. The sole existing database
has already been converted; older storage readers and migration commands are removed. Imports
retain facts and capture receipts without copying source files.
Instruction analysis uses compact decoder-key/provenance summaries. Persistent SQL triggers record
new observation IDs, including writes from other connections. Grouping runs in a read snapshot and
publishes through an ownership token; intervening mutations discard the staged result. Append-only
imports update existing totals, while edits, deletions, replacements and rule changes rebuild from
the authoritative evidence. Representative IDs and register values remain those of the earliest
physical observation in each group. This cache is independent of the retained-state import profile.
Disposable caches and WAL have separate maintenance controls. See the
[storage contract](https://github.com/uttori/asm/blob/master/packages/disassembler/API.md#working-index-and-storage).

## Conservative static analysis

The generic engine in `@uttori/asm-disassembler` owns a deterministic bounded worklist. A target
adapter supplies:

- decode at a qualified address.
- abstract state transfer and state joins.
- entry and fallthrough/branch/call/return behavior.
- explicit target overrides. And
- target-owned logical/file projection.

The result contains CFG nodes/edges, function candidates, coverage, conflicts, unresolved flow,
evidence paths, and an explicit completion status. Analysis stops at data, unsafe overlap, ambiguous
width, invalid/truncated input, unresolved indirect control, or configured work/call-depth limits.
It does not convert the following byte into an opcode to keep a linear sweep moving.

Performance-critical traversal uses a stable heap worklist and interval indexes. Their ordering,
prefix-maximum, allocation, and direct-mapping invariants are documented beside the implementation.
Changes must preserve deterministic output and run the benchmark gate.

## Evidence and import

Evidence has a source (`manual`, `import`, `detector`, `static`, or `runtime`), producer id,
confidence, optional detail, and optional immutable artifact identity. Facts refer to evidence ids.
Evidence remains independently inspectable and reusable.

An importer should be pure until an explicit merge. It validates the selected project/ROM/mapper,
normalizes qualified addresses, produces stable records, and returns a loss report. Identical import
is a no-op. The one compositional exception is observed indirect targets: repeated runtime captures
union destinations and provenance rather than discarding an earlier legitimate target.

The `.dizraw` importer lives in the SNES plugin because Diz classifications and SNES mapping are
target-specific. It imports what can be represented and records unsupported fields. There is no
`.dizraw` export. Native instruction traces follow the same identity/provenance rule.

## Coverage, call graph, and instruction annotations

These are deterministic read-only projections over validated project records:

- `buildRomCoverageMap()` coalesces code, operand, data, asset, unknown, conflict, execution, and
  memory overlays. Overlapping classification totals intentionally overlap.
- `SqliteAnalysisStore.callGraph()` assigns ownership only through persisted function entries and evidence
  paths. Missing callers/callees stay orphaned.
- `buildInstructionAnalysisAnnotations()` combines CFG identity, static effective addresses,
  context-specific state transitions, manual/runtime state, execution/coverage, memory access, record
  ids, and provenance.

CPU/RAM facts appear as unprojected diagnostics unless a record supplies an explicit file offset.
Malformed optional metadata becomes a diagnostic, not a reason to fabricate presentation data.

## Assets and compression

Asset interval annotations retain versioned declarations and optional compression capacity/bank
policy. Known v1 native IDs resolve for analysis display without rewriting persisted data. The
disassembler does not load converters, render previews, or reencode declared ROM ranges.
`@uttori/asm-assets` owns standalone conversion and exact byte transforms; source assembly applies
them only through declared plugin registrations. ROM export remains conservative and keeps original
raw bytes until a separately verified ownership migration authorizes replacement.

## Native source export and round trip

Export plans give every content byte exactly one owner: native code, raw asset, padding, header, or
vector data. The versioned `generated-files.json` records source-project/ROM identities, generated
file hashes, user-owned metadata-input hashes, byte spans, build entries, outputs, and checksum
policy. The SNES exporter creates `ram-map.json` as the persistent editable input and regenerates
`ram-defines.asm` plus exact-address WRAM operand names from it. `$00`–`$3F` and `$80`–`$BF`
low-WRAM mirrors resolve to their canonical `$7E` addresses.

Internal and expanded cartridge-header fields and every vector word are emitted as named `db`/`dw`
source with decoded comments, rather than opaque assets. `defines.asm` covers the SNESdev PPU,
MMIO, and DMA/HDMA register tables, including documented shared-address aliases and compatibility
aliases for older generated names. Every symbol carries hover documentation.

Round-trip verification:

1. rejects a changed/missing generated file or a user input changed since the last export.
2. assembles the generated native project through the normal CLI/plugin environment.
3. Restores a copier header when present. And
4. compares complete length and SHA-256, reporting the first differing offset.

A byte-identical result proves preservation, not that every raw span has been semantically decoded.

## Debug architecture

The debugging path deliberately has two protocols:

```text
VS Code ⇄ DAP bridge ⇄ DebugBackend ⇄ authenticated neutral sidecar ⇄ private native protocol ⇄ emulator
```

`DebugBackend` exposes negotiated processor/address-space capabilities, lifecycle, threads, frames,
registers, side-effect-free memory, breakpoints, disassembly, and bounded pull tracing. Replay uses
the same contract and runs without an emulator.

The neutral sidecar wire format is four-byte big-endian length plus UTF-8 JSON. Each message has a
256-bit inherited session token and increasing sequence. Frame/buffer/queue, memory, disassembly,
breakpoint, trace, pending-request, and deadline limits fail closed. Child stdout is protocol-only.
Stderr is separately bounded and token-redacted.

The ares sidecar translates a narrow maintained-fork RSP surface. It is MIT clean-room code and
distributes no emulator. Runtime manifests pin executable, patch, ROM, resource, and build
identities. See the [ares distribution inventory](https://github.com/uttori/asm/blob/master/packages/debug-sidecar-ares/RUNTIME.md).

macOS arm64 is the first live-native validated host. Hosted portable workflows validate the
TypeScript protocol and editor architecture. They do not prove an emulator runtime until a separate
native artifact/conformance result exists for that host.

## Language and editor path

The language server uses the same plugin environment and source analysis as CLI builds. It does not
carry an independent opcode table. The VS Code extension starts the bundled server, registers build,
project, analysis, trace, and debug surfaces, and observes Workspace Trust.

Analysis project discovery is bounded and excludes `.git`, `node_modules`, and `Local Only`.
Project identities and selected SQLite records are validated before views render. Project writes require a trusted local
workspace and use the conflict-safe transaction APIs. Read-only evidence views can remain available
in restricted workspaces.

Source annotations/navigation require a debug map whose target and ROM identity match the project
and whose source hash matches the current file. If exact source is unavailable, a live DAP virtual
disassembly may be used. Otherwise persisted CFG records are rendered without re-decoding missing
bytes.

## Trust, copyright, and failure boundaries

- Plugins are trusted in-process code, not a sandbox. VS Code loads workspace-configured plugins only
  after Workspace Trust.
- ROMs, traces, projects, maps, sidecar messages, process output, and runtime manifests are untrusted
  data and validated before use.
- GPL implementation code stays in separately licensed emulator repositories. This repository may
  hold clean-room adapters, patch metadata, license notices, and tests that invoke an external
  process.
- Package and VSIX audits reject ROMs, local-only fixtures, emulator binaries/libraries, and
  unexpected native payloads.
- A side-effect-free memory declaration is required before a backend exposes a space to generic
  reads. A numerically valid CPU address is not proof that reading it is harmless.

## Where to add new behavior

| Behavior                                              | Owning extension point                            |
| ----------------------------------------------------- | ------------------------------------------------- |
| architecture-independent decoded operand/flow concept | core decoder contracts                            |
| processor opcode/state/effective-address behavior     | target plugin architecture                        |
| generic CFG/evidence/project projection               | disassembler                                      |
| mapper or source-format import                        | target plugin                                     |
| game asset/compressor                                 | asset library and game/target plugin registration |
| user workflow over existing APIs                      | CLI or editor host                                |
| emulator-independent debug semantic                   | debug adapter contract + conformance              |
| emulator command/transport                            | corresponding sidecar                             |
| editor-only rendering/navigation                      | VS Code extension                                 |

When two packages appear to need the same target-specific helper, define the smallest neutral data
contract in the lower layer and implement it in the target package. Do not import the target upward.

## Architecture change checklist

- Does the owning package have enough information without guessing?
- Are all address spaces qualified and conversions explicit?
- Does malformed, newer, truncated, ambiguous, or conflicting input fail visibly?
- Are iteration, recursion, frames, queues, paths, memory, and generated output bounded?
- Are ids/order/canonical bytes stable across platforms?
- Can a crash leave the last active manifest or child process in a known state?
- Does the change keep ROM and GPL/native payloads out of MIT packages?
- Do replay, conformance, fuzz, round-trip, and performance tests cover the appropriate boundary?
- Are public docs and ADRs updated with only observed claims?
