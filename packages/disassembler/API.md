# Analysis API and storage

Requires Node.js 26 or newer. The supported baseline is semantic schema 3 and SQLite storage format 2.

Architecture-neutral ROM identity, persistent analysis-project primitives, and conservative control-flow traversal for Uttori ASM.

The package stores identities, annotations, and bounded capture observations, including fetched
instruction bytes. It does not embed the source ROM image. Target plugins own mapping and import formats.

For a runnable workflow, see [create, edit, back up, and verify](https://github.com/uttori/asm/blob/master/packages/disassembler/PROJECTS.md).

## Ownership and coordinates

Addresses and lengths are bytes. Every address is qualified by a named space; equal numbers in two
spaces are not interchangeable. File-space addresses are offsets into headerless ROM content.
CPU addresses require the target plugin's mapper to become file offsets. Ranges are half-open
`[start, end)`: length is `end - start`, and the final byte is `end - 1`. Project validation enforces
the declared `addressBits` (1–53); interactive edit helpers also constrain file addresses/ranges to
the ROM content. `RomImage` copies input bytes
and returns copies from reads; its full-file hash includes a copier header and its content hash does not.

Snapshot/load helpers own and close their connections before returning decoded objects. Their
`readonly` types do not freeze objects at runtime. Prefer replacement arrays and keep the original
snapshot unchanged for undo and selected-record comparisons. Pure edit helpers persist nothing;
retain their inverse in caller-owned undo state and commit the inverse as a separate edit.

`openAnalysisProjectStore()` returns a caller-owned connection. Close it exactly once in `finally`.
Use a single `store.transaction(callback, false)` for related reads and consume iterators inside
that transaction. The callback must be synchronous; async/thenable returns are rejected and rolled
back. Prepare asynchronous inputs first. Calls cannot nest transactions or outlive `close()`.
`false` selects a deferred read snapshot, not an enforced read-only connection. Long-lived readers
can retain WAL pages. Lock contention waits up to five seconds before SQLite reports failure.

Advanced `SqliteAnalysisStore` exports remain public for bounded queries and host integrations.
Opening validates the physical format, not all records. Raw table replacement requires an active
transaction but does not perform semantic validation or publish a revision/pointer automatically.
Prefer the validated APIs below for application edits.

| API                                                                             | Replacement and preservation contract                                                                                                         |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadAnalysisProjectSnapshot`                                                   | Complete validated records, including all runtime history in memory.                                                                          |
| `loadAnalysisProjectViewSnapshot`                                               | Metadata plus optional runtime projection; omitted runtime is not an empty backing store.                                                     |
| `commitAnalysisProjectTransaction` / `commitPreparedAnalysisProjectTransaction` | Complete replacement, including runtime; require the caller's revision for existing projects.                                                 |
| `commitAnalysisProjectViewUpdate`                                               | Each supplied metadata array replaces that entire table; omitted tables and all runtime remain. `[]` clears a supplied table.                 |
| `commitAnalysisProjectAnnotationUpdate`                                         | Complete labels/comments/evidence tables; existing evidence must remain unchanged, other tables remain.                                       |
| `commitAnalysisProjectSelectedEdit`                                             | Patch stable IDs in the original/edited selection; preserve records outside it. Include required evidence; both runtime arrays must be empty. |
| `writeAnalysisProject` / `publishAnalysisProject`                               | Create or replace everything. They sample the revision at call time and cannot detect a replacement based on an old caller snapshot.          |

## Project Layout

An analysis directory contains the SQLite working store and a small watcher pointer:

```text
analysis.json       project identity, db: "analysis.sqlite", and revision
analysis.sqlite     metadata and columnar runtime tables (WAL mode)
```

SQLite owns the authoritative manifest and monotonic revision. `analysis.json` is refreshed by atomic
rename after commit so existing file watchers fire; readers use the database revision even if that
refresh was interrupted. Earlier development storage layouts are outside the support baseline. User configuration, debug maps,
source-export manifests, and native trace interchange remain JSON. Lossless ACT2 capture readers
can supply decoded chunks directly through `RuntimeTraceSource`.

Physical SQLite storage format 2 is recorded in `PRAGMA user_version`, independently of semantic
schema version 3 and the logical revision. `runtime_facts` shares coordinates and payloads globally;
`runtime_observations` retains each capture's identity, count and provenance. An exact instruction/state
pair occupies one fact and relationship, with a virtual CPU-state row exposed by the `runtime` SQL
view. Standalone state records remain independent. Point lookups index the negative virtual row IDs.
Runtime prefixes/evidence sets are interned and hash suffixes use binary keys. Small runtime payloads
use SQLite JSONB; larger records still use the bounded, checksummed DEFLATE codec when it saves space.
Metadata and compressed export projections use the same codec. Complete runtime arrays retain their
semantic shape and sort by ID; streaming consumers must not depend on physical row order.

The semantic collections retain the in-memory `AnalysisProjectShards` shape. Database reads use
stable ordering; rewrites preserve logical records rather than promising identical SQLite bytes.
Address ranges are half-open, every address must fit its declared space, evidence references must
exist, and region parents must be acyclic and contain their same-space children. Complete ROM payloads
are forbidden in project records; bounded instruction observations have explicit record contracts.

## Conflict-safe edits and recovery

`loadAnalysisProjectSnapshot()` reads validated records and their revision in one SQLite read
transaction. `commitAnalysisProjectTransaction()` acquires `BEGIN IMMEDIATE`, checks that revision
under the writer lock, and commits rows, provenance, manifest and revision together.
`prepareAnalysisProjectTransaction()` only validates an in-memory replacement; it creates no files.
Validation failures, stale revisions, and errors before commit preserve the previous publication.
`AnalysisProjectStaleError` requires reloading and reapplying intent; do not retry an old replacement
with a newer token. Preparation keeps the caller's project reference, reserves nothing, and commit
revalidates it. Every publication advances the revision, including semantically unchanged writes.
If SQLite automatically rolls back, cleanup preserves the original failure. Low-level transaction
callbacks roll back when they throw, including a caller's cancellation check. Synchronous commit APIs
do not accept an `AbortSignal`, and a timer cannot interrupt synchronous work on the same event loop.

A process interrupted during a transaction leaves either the earlier or committed publication,
never a partial set of records. The store uses WAL with `synchronous=NORMAL`: an OS crash or power
loss can lose recent commits, although SQLite preserves consistency. See
[SQLite's durability contract](https://www.sqlite.org/pragma.html#pragma_synchronous).
Filesystem writes outside the database, including source export, do not share this rollback boundary.

The watcher pointer is refreshed after commit. If refresh fails, a process warning reports it;
the commit result still succeeds, and its maintenance warning array does not collect that warning.
A stale **valid** pointer can reopen the authoritative database. A missing/corrupt pointer prevents
`openAnalysisProjectStore()` from opening; do not treat a parse failure as an empty project. Restore
a validated backup into a new directory before continuing. Keep the original files for diagnosis.

`loadAnalysisProjectViewSnapshot()` loads metadata only by default. An explicit reducer streams and
validates runtime rows in the same snapshot without retaining the full history. Use
`commitAnalysisProjectViewUpdate()` for these views: it replaces only supplied metadata tables and
preserves runtime history. Complete-project writers deliberately replace runtime too. Unchanged
rows are retained, and removal of evidence checks references from retained runtime facts.

`compactAnalysisProject()` and `uttori-asm project-compact` checkpoint and VACUUM SQLite during
explicit maintenance, pruning unused runtime dictionary entries after replacements. They check for
temporary disk space and do not run after no-op imports. For backups, use SQLite's backup
facilities or close every connection before copying the database and pointer; copying a live database
without its WAL can omit committed data.

The reversible edit primitives add certain manual evidence and return exact inverse records for
safe undo. `applyRangeClassificationEdit()` adds a classification without deleting prior
annotations and emits explicit ranged conflicts for contradictory overlaps.
`applyStateEntryPointEdit()` copies an existing classified interval into a manual state and/or
`points: ["in"]` overlay; incompatible overlapping state remains visible as a `manual-state`
conflict. `applyTargetResolutionEdit()` creates the sole target override at an indirect-flow site,
or unions new targets and evidence into the existing override because an indirect instruction may
legitimately have multiple destinations. `applyLabelRenameEdit()` changes one stable label and
retains its earlier evidence alongside certain manual rename provenance. Every corresponding
`revert*Edit()` refuses to remove or restore a record if its exact post-edit value changed or the new
evidence gained another reference.

`explainProjectEvidence()` resolves any project record by stable id, expands its direct evidence,
lists every reverse reference to that evidence, and includes persisted conflicts that name the
record or share its provenance. It is read-only and target-neutral: it does not infer a mapper,
project CPU/RAM addresses into ROM offsets, or claim that a shared evidence id proves more than its
stored record says.

`applyDisassemblyAnnotationEdit()` creates or updates a label at a qualified address and edits its
above-label and inline comments plus an independently identified inline instruction comment.
`ProjectLabel.sourceName` is the exact validated assembly symbol, `inlineComment` belongs beside
the label, and `ProjectComment.placement: "inline-instruction"` belongs beside an accepted instruction.
New presentation labels have `analysisEntryPoint: false`, keeping naming separate from code discovery.
Existing field omissions retain their prior behavior. The edit retains earlier evidence and returns
an exact inverse for `revertDisassemblyAnnotationEdit()`; commit it through the normal optimistic
transaction API. No ROM bytes or generated-source line numbers are used as annotation identities.

`commitAnalysisProjectAnnotationUpdate()` publishes only labels, comments and appended evidence
under the expected SQLite revision. It validates those tables against the authoritative manifest
and requires every existing evidence record to remain unchanged, so saving a comment does not
revalidate unrelated CFG records or scan runtime provenance. Broader edits and evidence removal
continue to use the full transaction APIs.

The generic static-analysis engine accepts target-provided decode, state-transfer, join, and address-entry callbacks. It deterministically emits CFG nodes and edges, function candidates, coverage, unresolved control flow, boundary conflicts, evidence paths, and explicit incomplete results when a work or call-context limit is reached. It never guesses through an ambiguous decode.

## Function and Call Graph

`SqliteAnalysisStore.callGraph()` projects persisted native analysis records into deterministic function,
call/interrupt, and unresolved-flow records. It derives function ownership only from persisted CFG
evidence paths and exact function-entry addresses; missing callers, callees, or unresolved-site
owners remain explicit orphan ids. Every location retains its named address space and known file
offsets, so presentation layers can navigate without guessing a mapper or conflating CPU, RAM, and
ROM identities. The projection is read-only and does not invent functions or decode ROM bytes.

## Instruction Annotations

`buildInstructionAnalysisAnnotations()` projects validated native records into deterministic,
target-neutral facts for each qualified instruction location. The projection combines persisted CFG
nodes, static effective-address explanations, distinct context-specific abstract-state transitions,
manual and runtime state observations, instruction execution counts, runtime coverage, attributed
memory reads/writes, record ids, and provenance. It retains architecture hints and explicit output
offsets so a host can present one logical instruction in source, ROM, or debugger views without
discarding its identity.

Logical evidence joins only by exact named address-space/address pairs. File-space evidence joins
only through an explicit persisted output offset; the projector never calls a mapper or assumes that
two equal numeric addresses describe the same memory. Opaque malformed effective-address metadata
is returned as a non-fatal diagnostic rather than rendered. Range joins use sorted indexes, keeping
the model suitable for large runtime-coverage collections without an annotation-by-instruction scan.

Editor previews use `prepareAnnotationQueries()` followed by `instructionAnnotationView(ranges)`
inside a read transaction. Additive SQLite indexes select logical addresses and explicit output
offsets before payload decoding. Initial setup extracts offsets from CFG/execution payloads once;
SQL triggers queue only changed rows for later extraction. Derived columns live with their owning
rows, so compaction and unrelated schema additions cannot detach offsets. A narrow offset/ID index
orders compressed export projections without duplicating their entire payload in a covering index. Index setup is
transactional and does not change the semantic revision.
`annotationEditView()` and `annotationNodesAt()` load names/provenance and selected boundaries for
label/comment forms without loading all CFG variants.

Persisted views use `SqliteAnalysisStore` queries: source counts/pages, ROM coverage totals and
200-row segment/detail pages, call ownership, processor hints, bounded navigation, and evidence
inspection. Coverage and graph builds use temporary SQL tables and publish complete results under
a short writer lock. Dependency triggers invalidate relevant caches; a comment edit does not rebuild
runtime coverage, graph ownership, or decoder variants.

`sourceExportView()` reads only editable metadata, functions, and conflicts. Pair it with
`instructionExportGroups()` in the same read transaction to stream every instruction variant in ROM
order. `runtimeInstructionVariants()` groups captured bytes and decoder state in SQL, then returns a
cursor. Prepare it before opening its consuming read transaction. Reanalysis reads grouped execution
seeds and selected MMIO accesses, while all original runtime facts remain in the database.

`commitAnalysisProjectSelectedEdit()` patches only selected stable IDs and checks retained evidence
before removal. Omitted CFG/runtime records are preserved. `commitRuntimeEvidenceBatch()` similarly
merges offline imports against destination IDs without expanding the saved trace history. Full
snapshot APIs remain available for callers explicitly requesting a complete in-memory project;
normal editor queries, source regeneration, and offline imports do not use them.

Viewport requests accept at most 2,000 ranges and locations. Previews retain at most 64 execution,
CPU-state, or attributed-memory records per location, with shared record budgets for large pages.
The view returns `limited` when a budget is reached and separate SQL execution totals covering all
matching execution records. Hosts must apply those totals to the projection and disclose limited
details; a bounded view must never replace the full analysis/export snapshot or be persisted as
complete history.

## Runtime Evidence

Runtime records are emulator-neutral. Its discriminated records describe aggregated instruction execution, memory reads/writes, CPU state at an instruction address, half-open executed/operand/read/written coverage, and observed control targets. Emulator-specific formats stop at target-plugin importers.

Runtime `EvidenceRecord` entries can pin an artifact's format/version, SHA-256, ROM content SHA-256, and mapper. Project validation rejects malformed identities, foreign ROM hashes, foreign mappers, invalid counts or widths, and out-of-range addresses before publishing records.

`mergeRuntimeEvidence()` only adds stable-id facts. Exact reimport is a no-op; a reused id with different content is rejected. Runtime-derived indirect target overrides are the one compositional exception: later captures union their targets and provenance without discarding earlier observations. `inspectRuntimeEvidence()` reports differing CPU-state, opcode, and instruction-size observations and explains the runtime provenance behind derived annotations and target overrides.

`uttori-asm-instruction-trace` is the native versioned artifact for explicit live instruction recordings. It stores a ROM content identity, producer revision, architecture/address-space identity, and ordered bounded-pull chunks with cumulative loss metadata. `importRuntimeInstructionTrace()` verifies that identity and ordering, applies only caller-declared recorder-to-project address-space aliases, aggregates addresses into stable execution records, and returns a `RuntimeEvidenceBatch`; its source identity always hashes the unchanged artifact and it never mutates or persists a project. Callers must separately invoke `mergeRuntimeEvidence()` as an explicit user action or configured recording workflow.

`importRuntimeTraceSourceIntoProject(source, directory, context, options)` accepts an in-memory
producer or decoded archive stream. A `RuntimeTraceSource` provides `metadata` and
`read(accept)`, calls the consumer synchronously for each ordered chunk, and rejects if the stream
or its terminal integrity check fails. Chunks are indexed incrementally in SQLite and published
atomically only after the reader completes. `createRuntimeTraceFileSource()` adapts existing JSON
files to this interface and avoids validating/copying every rich chunk twice. The source owns its
input byte budget; project import owns cancellation, index-record limits and revision checks.

For large native captures, `importRuntimeTraceIntoProject()` aggregates chunks in connection-local
SQLite temporary counters, then writes final columnar runtime rows directly into the project. There
is no second runtime scratch database, external sort, or shard serialization. Parsing and integrity
checks complete before the write transaction; ROM mismatch, cancellation, stale revisions, conflicting
stable IDs and storage failures roll back the whole publication. Exact reimport is a no-op and
missing facts are repaired. Only imports and evidence metadata are touched. Both index profiles
preserve their source identities, counts and contents. The runtime requires built-in `node:sqlite`.

The package also owns the architecture-neutral `uttori-asm-source-export` manifest contract. It
records generated file hashes, source/asset roles, half-open byte-ownership spans, source-project
and ROM identities, build entry points, outputs, and checksum policy. It separately records hashes
for user-owned metadata inputs, allowing status and verification to detect that regenerated output
is stale without treating an intentional metadata edit as damaged generated source. Helpers load
and validate generated trees and compare rebuilds by length, SHA-256, and first differing offset;
target plugins remain responsible for rendering their native source syntax.

## ROM Coverage Map

`buildRomCoverageMap()` produces a read-only, target-neutral projection of a validated project's ROM-content coverage. It combines file-space annotations, CFG records with explicit `fileOffset` values, regions, ranged conflicts, runtime execution offsets, and file-space runtime coverage into maximally coalesced half-open segments. Each segment keeps classification, runtime, provenance, region, and conflict ids separate so the presentation layer cannot hide contradictory evidence.

Summary totals distinguish exclusive classified, unknown, and conflicted bytes. Per-classification totals intentionally overlap when a byte has incompatible classifications. CPU and RAM records without an explicit file offset are returned in `unprojected`; the helper never guesses a mapper translation. Partially out-of-range records are clipped with diagnostics, and wholly invalid or out-of-ROM records remain visible as unprojected input.

## Asset Codecs

`AssetCodec` is the target-neutral boundary for binary assets. A codec declares a stable id, implementation version, byte-size/alignment bounds, and stable-id dependencies, then implements three separate operations:

- `inspect` determines the exact encoded extent, logical references, metadata, and nested codec requests without extracting files;
- `decode` returns a JSON-safe editable value plus optional runtime-only extracted files;
- `encode` recreates bytes from that decoded result.

`AssetCodecRegistry` accepts codecs in any registration order and resolves the complete dependency graph only by id, rejecting missing dependencies and cycles. `planAssets()` validates deterministic inspection, exact and source bounds, nesting, and address-space-qualified locations. Parent/child byte overlap is intentional; overlapping roots or siblings remain explicit plan conflicts.

`verifyAssetPlan()` is the mandatory no-op gate before later source-export integration. It repeats decode and encode, canonicalizes values and file ordering, validates extracted paths, rejects nondeterminism and size drift, and requires each encoded range to match its original bytes exactly. Extracted byte payloads are summarized by hash and size in the verification result and are never placed in analysis-project metadata.

`createBuiltinAssetCodecRegistry()` provides the first target-neutral codec set:

| Codec id                     | Editable representation                                                    | Important options                                                                 |
| ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `uttori.asset.raw`           | Byte array plus an incbin-ready extracted file                             | Exact request `length`, `path`, `mediaType`                                       |
| `uttori.asset.scalar-array`  | Signed or unsigned integer array                                           | `width`, `endian`, `signed`, `count`                                              |
| `uttori.asset.struct-array`  | Repeated named scalar fields and LSB0 bitfields, with raw padding retained | `fields`, `stride`, `count`, default `endian`                                     |
| `uttori.asset.pointer-table` | Qualified logical addresses and raw pointer values                         | `width`, `endian`, `base`, `scale`, `nullValue`, `addressSpace`, `targetAssetIds` |
| `uttori.asset.index-table`   | Semantic indexes and resolved stable target references                     | `width`, `endian`, `baseIndex`, `nullValue`, `targets`                            |
| `uttori.asset.text`          | Text plus a terminator flag and UTF-8 extracted file                       | `ascii`, `table`, `terminator`, `maxLength`, `path`                               |

Array codecs accept either an exact request length or `count`; when both are supplied they must agree. Struct fields are either byte-aligned scalars (`name`, `offset`, optional `width`/`endian`/`signed`) or disjoint bitfields (`name`, `bitOffset`, `bits`, optional `signed`). Struct encoding overlays edits on the retained raw bytes so unnamed bits and record padding remain unchanged.

Text translation tables map byte keys written as decimal, `0xHH`, or `$HH` to unique, prefix-free tokens. Printable ASCII and tab/newline/carriage return are enabled by default and can be disabled with `ascii: false`. Unmapped bytes decode as explicit `\xHH` escapes. Terminator discovery is permitted only with a finite `maxLength`; it never scans an unbounded source range.

`decodePlannedAsset()` and `encodePlannedAsset()` are the edit boundary. Encoding always returns a defensive byte copy and rejects any size change from the inspected extent, so one failed asset edit cannot silently move later ROM regions.

`CompressionCodecRegistry` is deliberately separate from semantic asset codecs. Target and game
plugins register stable, versioned byte-to-byte compressors. `verifyCompressionCodec()` requires
deterministic decode/encode, decoded-data equivalence, and an exact no-op encoding;
`reencodeCompressedRange()` enforces the original capacity and optional half-open bank bounds, then
returns an exact-size replacement that preserves or explicitly fills unused bytes. Recompression
therefore cannot move a following ROM range.

Asset-capable interval annotations persist `codecId`, `codecVersion`, JSON-safe options, and optional
plugin id/version provenance. A separately versioned `compression` reference can record capacity,
bank, and fill constraints. These records contain declarations only—codec implementations remain in
registries composed by the host, and decoded/extracted bytes remain outside the project.

`AssetPreviewRegistry` is a presentation-only extension point. `renderVerifiedAssetPreview()` refuses
to run unless the current source bytes, asset range, codec id/version, and byte-identical encoded hash
match an `AssetVerificationRecord`. Renderers run twice and must return identical safe relative files,
so a preview can never conceal or weaken the binary correctness gate.

For implementation ownership, schema-change steps, transaction invariants, importer rules, and test
gates, read the [architecture guide](https://github.com/uttori/asm/blob/master/packages/disassembler/ARCHITECTURE.md) and repository
[contributor guide](https://github.com/uttori/asm/blob/master/CONTRIBUTING.md).

Instruction trace artifacts can retain execution-time bytes/state and CPU/DMA/HDMA bus observations. See [captured RAM code and trace limits](https://github.com/uttori/asm/blob/master/packages/plugin-snes/ANALYSIS.md).

## Working-index and storage

Native `snes.65816` / `snes.cpu` captures default to `65816-analysis` (`65816-analysis-v2` on disk).
The projection preserves joint PC/bytes and current decoder inputs: normalized P width bits, E, D and
DB, with program bank derived from the instruction address. Unknown/invalid state remains unknown;
emulation mode forces the documented widths. Other processors default to full indexing. Explicit
`full` and `65816-disassembly` projections remain available. The selected profile is retained
with each capture receipt; changing a setting does not rewrite saved observations.

Capture receipts survive source-file removal. Same-profile reimports repair missing facts through stable-ID
checks; a different-profile reimport reuses the retained profile and reports that choice. It never
reintroduces discarded full rows or increments lifetime counts. Pure in-memory batch merging still
rejects incompatible profiles; SQLite receipt handling is the durable import API.

`project-storage` displays budgets, facts/relationships, allocated database/WAL bytes, free pages,
optional cache allocation, and capture receipts. Its controls are `--cache-max-mib` (256) and
`--storage-max-mib` (publication ceiling, disabled at 0). Every invocation runs cache and WAL
maintenance. Explicit database ceilings roll back entire publications; facts are never sampled
or deleted to satisfy a budget.

Imports read source captures without copying them into the project. Keep the original capture if
you need to reproduce ordered events, full register history or derived graphics views. The project
retains compact facts and import receipts independently of the source file's lifetime.

Post-import maintenance evicts stale or over-budget disposable projections and attempts nonblocking WAL
checkpoint/truncation. Active readers can defer truncation; the configured 64 MiB journal size limit
controls recycled allocation, not a hard cap on an active transaction. Core editor/export indexes stay
available. VACUUM remains explicit after large deletions; it does not run after every annotation save.
