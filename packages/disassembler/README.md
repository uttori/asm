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

The manifest records the format and schema versions, full-file and headerless SHA-256 identities, copier-header size, mapping decision and scored candidates, named address spaces, and the SHA-256 and record count for every shard. ROM bytes are forbidden in all shards.

All JSON objects use sorted keys, record arrays have stable semantic ordering, ranges are half-open, and paths are project-relative. Address-space ids are unique, and every addressed record must name a declared space and fit its width. Regions can name a `parentRegion`; same-address-space children must be contained by their parent, while cross-address-space children represent a mapped projection such as ROM payload bytes loaded into a CPU-owned memory space. Missing parents and cycles are rejected. Rewriting a valid project is byte-stable. Readers migrate older schemas only through explicit forward migrations and reject newer schemas rather than silently downgrading them.

The generic static-analysis engine accepts target-provided decode, state-transfer, join, and address-entry callbacks. It deterministically emits CFG nodes and edges, function candidates, coverage, unresolved control flow, boundary conflicts, evidence paths, and explicit incomplete results when a work or call-context limit is reached. It never guesses through an ambiguous decode.

## Runtime Evidence

The runtime shard is emulator-neutral. Its discriminated records describe aggregated instruction execution, memory reads/writes, CPU state at an instruction address, half-open executed/operand/read/written coverage, and observed control targets. Emulator-specific formats stop at target-plugin importers.

Runtime `EvidenceRecord` entries can pin an artifact's format/version, SHA-256, ROM content SHA-256, and mapper. Project validation rejects malformed identities, foreign ROM hashes, foreign mappers, invalid counts or widths, and out-of-range addresses before writing any shard.

`mergeRuntimeEvidence()` only adds stable-id facts. Exact reimport is a no-op; a reused id with different content is rejected. Runtime-derived indirect target overrides are the one compositional exception: later captures union their targets and provenance without discarding earlier observations. `inspectRuntimeEvidence()` reports differing CPU-state, opcode, and instruction-size observations and explains the runtime provenance behind derived annotations and target overrides.

The package also owns the architecture-neutral `uttori-asm-source-export` manifest contract. It
records generated file hashes, source/asset roles, half-open byte-ownership spans, source-project
and ROM identities, build entry points, outputs, and checksum policy. Helpers load and validate
generated trees and compare rebuilds by length, SHA-256, and first differing offset; target plugins
remain responsible for rendering their native source syntax.

## Asset Codecs

`AssetCodec` is the target-neutral Phase 7 boundary for binary assets. A codec declares a stable id, implementation version, byte-size/alignment bounds, and stable-id dependencies, then implements three separate operations:

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
