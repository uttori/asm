# @uttori/asm-disassembler

Architecture-neutral ROM identity, persistent analysis-project primitives, and conservative control-flow traversal for Uttori ASM.

The package intentionally stores hashes and annotations, never ROM bytes. Target plugins own platform-specific mapper detection and import formats.

## Project Layout

An analysis directory contains the SQLite working store and a small watcher pointer:

```text
analysis.json       project identity, db: "analysis.sqlite", and revision
analysis.sqlite     metadata and columnar runtime tables (WAL mode)
```

SQLite owns the authoritative manifest and monotonic revision. `analysis.json` is refreshed by atomic
rename after commit so existing file watchers fire; readers use the database revision even if that
refresh was interrupted. SchemaVersion remains 3. Legacy JSON arrays, gzip shards, generation
folders, lock files, and manifest migrations are no longer supported. User configuration, debug maps,
source-export manifests, and capture/trace interchange formats remain JSON.

Physical SQLite storage format 1 is recorded in `PRAGMA user_version`, independently of semantic
schema version 3 and the logical revision. Runtime prefixes and evidence sets are stored once,
canonical hash suffixes use binary storage, and large metadata records use rowid tables. One
versioned, checksummed DEFLATE codec compresses payloads of at least 256 bytes only when it saves
at least 32 bytes and one eighth of the input. Smaller values remain TEXT. Decoded payloads are
limited to 16 MiB per record; unknown codecs, invalid UTF-8, oversized output, and corrupt checksums
are rejected. Complete runtime arrays are sorted by ID; streaming projections use storage order.

The semantic collections retain the in-memory `AnalysisProjectShards` shape. Database reads use
stable ordering; rewrites preserve logical records rather than promising identical SQLite bytes.
Address ranges are half-open, every address must fit its declared space, evidence references must
exist, and region parents must be acyclic and contain their same-space children. ROM bytes are
forbidden in project records.

## Conflict-safe edits and recovery

`loadAnalysisProjectSnapshot()` reads validated records and their revision in one SQLite read
transaction. `commitAnalysisProjectTransaction()` acquires `BEGIN IMMEDIATE`, checks that revision
under the writer lock, and commits rows, provenance, manifest and revision together.
`prepareAnalysisProjectTransaction()` only validates an in-memory replacement; it creates no files.
A failed write or interrupted process leaves the previous commit readable. If SQLite automatically
rolls back, cleanup preserves the original failure instead of hiding it behind a rollback error.

`loadAnalysisProjectViewSnapshot()` loads metadata only by default. An explicit reducer streams and
validates runtime rows in the same snapshot without retaining the full history. Use
`commitAnalysisProjectViewUpdate()` for these views: it replaces only supplied metadata tables and
preserves runtime history. Complete-project writers deliberately replace runtime too. Unchanged
rows are retained, and removal of evidence checks references from retained runtime facts.

`compactAnalysisProject()` and `uttori-asm project-compact` checkpoint and VACUUM SQLite during
explicit maintenance, pruning unused runtime dictionary entries after replacements. They check for
temporary disk space and do not run after no-op imports. `migrateAnalysisProjectStorage()` and
`uttori-asm project-migrate` explicitly upgrade the earlier SQLite layout with bounded record batches,
semantic validation, content digests, crash recovery, and a retained original backup. Migration requires
exclusive database access; a temporary process gate prevents new project work during publication.
Cached clients must reopen after the database inode changes. See the [storage audit](../../docs/performance/sqlite-som-storage-audit.md).

For backups, use SQLite's backup
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

`explainProjectEvidence()` resolves any shard record by stable id, expands its direct evidence,
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

The generic static-analysis engine accepts target-provided decode, state-transfer, join, and address-entry callbacks. It deterministically emits CFG nodes and edges, function candidates, coverage, unresolved control flow, boundary conflicts, evidence paths, and explicit incomplete results when a work or call-context limit is reached. It never guesses through an ambiguous decode.

## Function and Call Graph

`buildAnalysisCallGraph()` projects validated native analysis shards into deterministic function,
call/interrupt, and unresolved-flow records. It derives function ownership only from persisted CFG
evidence paths and exact function-entry addresses; missing callers, callees, or unresolved-site
owners remain explicit orphan ids. Every location retains its named address space and known file
offsets, so presentation layers can navigate without guessing a mapper or conflating CPU, RAM, and
ROM identities. The projection is read-only and does not invent functions or decode ROM bytes.

## Instruction Annotations

`buildInstructionAnalysisAnnotations()` projects validated native shards into deterministic,
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
the model suitable for large runtime-coverage shards without an annotation-by-instruction scan.

## Runtime Evidence

The runtime shard is emulator-neutral. Its discriminated records describe aggregated instruction execution, memory reads/writes, CPU state at an instruction address, half-open executed/operand/read/written coverage, and observed control targets. Emulator-specific formats stop at target-plugin importers.

Runtime `EvidenceRecord` entries can pin an artifact's format/version, SHA-256, ROM content SHA-256, and mapper. Project validation rejects malformed identities, foreign ROM hashes, foreign mappers, invalid counts or widths, and out-of-range addresses before publishing records.

`mergeRuntimeEvidence()` only adds stable-id facts. Exact reimport is a no-op; a reused id with different content is rejected. Runtime-derived indirect target overrides are the one compositional exception: later captures union their targets and provenance without discarding earlier observations. `inspectRuntimeEvidence()` reports differing CPU-state, opcode, and instruction-size observations and explains the runtime provenance behind derived annotations and target overrides.

`uttori-asm-instruction-trace` is the native versioned artifact for explicit live instruction recordings. It stores a ROM content identity, producer revision, architecture/address-space identity, and ordered bounded-pull chunks with cumulative loss metadata. `importRuntimeInstructionTrace()` verifies that identity and ordering, applies only caller-declared recorder-to-project address-space aliases, aggregates addresses into stable execution records, and returns a `RuntimeEvidenceBatch`; its source identity always hashes the unchanged artifact and it never mutates or persists a project. Callers must separately invoke `mergeRuntimeEvidence()` as an explicit user action or configured recording workflow.

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
gates, read the [architecture guide](../../docs/disassembler-architecture.md) and repository
[contributor guide](../../CONTRIBUTING.md).

Instruction trace artifacts can retain execution-time bytes/state and CPU/DMA/HDMA bus observations. See [captured RAM code and trace limits](../../docs/snes-function-heuristics-and-runtime-code.md).
