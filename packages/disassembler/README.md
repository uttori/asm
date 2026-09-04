# @uttori/asm-disassembler

Architecture-neutral ROM identity, persistent analysis-project primitives, and conservative control-flow traversal for Uttori ASM.

The package intentionally stores hashes and annotations, never ROM bytes. Target plugins own platform-specific mapper detection and import formats.

## Project Layout

An analysis directory contains a canonical `analysis.json` manifest and independently hash-checked JSON shards under `analysis/`:

```text
analysis.json
analysis/control-flow.json
analysis/annotations.json
analysis/comments.json
analysis/evidence.json
analysis/imports.json
analysis/labels.json
analysis/regions.json
analysis/runtime.json
```

The direct writer uses those fixed shard paths for initial project creation. Conflict-safe edits use
immutable content-addressed generations under `analysis/generations/<sha256>/` and publish the new
generation by replacing only `analysis.json` after every shard has been written, hash-checked, and
synced. Older generations remain valid inputs for the previous manifest rather than being rewritten
in place.

The manifest records the format and schema versions, full-file and headerless SHA-256 identities, copier-header size, mapping decision and scored candidates, named address spaces, and the SHA-256 and record count for every shard. ROM bytes are forbidden in all shards.

All JSON objects use sorted keys, record arrays have stable semantic ordering, ranges are half-open, and paths are project-relative. Address-space ids are unique, and every addressed record must name a declared space and fit its width. Regions can name a `parentRegion`; same-address-space children must be contained by their parent, while cross-address-space children represent a mapped projection such as ROM payload bytes loaded into a CPU-owned memory space. Missing parents and cycles are rejected. Rewriting a valid project is byte-stable. Readers migrate older schemas only through explicit forward migrations and reject newer schemas rather than silently downgrading them.

## Conflict-safe edits and recovery

`loadAnalysisProjectSnapshot()` returns a validated project plus a versioned optimistic revision that
contains the exact manifest hash and observed shard hashes. `prepareAnalysisProjectTransaction()`
writes an immutable generation without changing the active project;
`commitPreparedAnalysisProjectTransaction()` then acquires the cooperative project lock, reloads the
active revision, rejects stale callers, revalidates the prepared shards, and atomically replaces the
manifest last. `commitAnalysisProjectTransaction()` is the one-call form. A live lock is never
stolen. A lock older than five minutes is recovered only when its recorded process is no longer
alive, with at most three recovery attempts by default; hosts can supply a stricter policy.

An interrupted preparation can leave an unreferenced directory under `analysis/generations/` or
`analysis/.transactions/`, and an interrupted manifest replacement can leave a hidden
`.analysis.json.*.tmp` file. None is loaded because `analysis.json` remains the sole commit pointer.
After all writers are closed, first verify that `loadAnalysisProject()` succeeds; unreferenced
generations and temporary files may then be archived or removed. Never delete the generation named
by the active manifest. For backups, copy `analysis.json` and every shard path it names as one set;
the hashes and record counts make an incomplete backup fail closed. Do not manually remove the lock
unless the owner process is known to be gone.

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

Runtime `EvidenceRecord` entries can pin an artifact's format/version, SHA-256, ROM content SHA-256, and mapper. Project validation rejects malformed identities, foreign ROM hashes, foreign mappers, invalid counts or widths, and out-of-range addresses before writing any shard.

`mergeRuntimeEvidence()` only adds stable-id facts. Exact reimport is a no-op; a reused id with different content is rejected. Runtime-derived indirect target overrides are the one compositional exception: later captures union their targets and provenance without discarding earlier observations. `inspectRuntimeEvidence()` reports differing CPU-state, opcode, and instruction-size observations and explains the runtime provenance behind derived annotations and target overrides.

`uttori-asm-instruction-trace` is the native versioned artifact for explicit live instruction recordings. It stores a ROM content identity, producer revision, architecture/address-space identity, and ordered bounded-pull chunks with cumulative loss metadata. `importRuntimeInstructionTrace()` verifies that identity and ordering, applies only caller-declared recorder-to-project address-space aliases, aggregates addresses into stable execution records, and returns a `RuntimeEvidenceBatch`; its source identity always hashes the unchanged artifact and it never mutates or persists a project. Callers must separately invoke `mergeRuntimeEvidence()` as an explicit user action or configured recording workflow.

The package also owns the architecture-neutral `uttori-asm-source-export` manifest contract. It
records generated file hashes, source/asset roles, half-open byte-ownership spans, source-project
and ROM identities, build entry points, outputs, and checksum policy. Helpers load and validate
generated trees and compare rebuilds by length, SHA-256, and first differing offset; target plugins
remain responsible for rendering their native source syntax.

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
