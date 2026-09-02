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
```

The manifest records the format and schema versions, full-file and headerless SHA-256 identities, copier-header size, mapping decision and scored candidates, named address spaces, and the SHA-256 and record count for every shard. ROM bytes are forbidden in all shards.

All JSON objects use sorted keys, record arrays have stable semantic ordering, ranges are half-open, and paths are project-relative. Regions can name a `parentRegion`; same-address-space children must be contained by their parent, while cross-address-space children represent a mapped projection such as ROM payload bytes loaded into a CPU-owned memory space. Missing parents and cycles are rejected. Rewriting a valid project is byte-stable. Readers migrate older schemas only through explicit forward migrations and reject newer schemas rather than silently downgrading them.

The generic static-analysis engine accepts target-provided decode, state-transfer, join, and address-entry callbacks. It deterministically emits CFG nodes and edges, function candidates, coverage, unresolved control flow, boundary conflicts, evidence paths, and explicit incomplete results when a work or call-context limit is reached. It never guesses through an ambiguous decode.

The package also owns the architecture-neutral `uttori-asm-source-export` manifest contract. It
records generated file hashes, source/asset roles, half-open byte-ownership spans, source-project
and ROM identities, build entry points, outputs, and checksum policy. Helpers load and validate
generated trees and compare rebuilds by length, SHA-256, and first differing offset; target plugins
remain responsible for rendering their native source syntax.
