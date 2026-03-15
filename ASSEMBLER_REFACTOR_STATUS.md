# Assembler Refactor Status (Re-baseline)

This document re-baselines `ASSEMBLER_REFACTOR_OPTIONS.md` against the current
state of the codebase.

## Status Summary

The project is no longer in "start refactor" mode. It is in "finish transition"
mode:

- AST/IR foundations are implemented.
- Directive registry and service extraction are implemented.
- Tree parity gates exist and are active.
- Remaining work is largely bridge removal, compatibility isolation, and
  optimization-focused cleanup.

## Mapping: Original Plan -> Current State

### Completed / materially complete

- Directive registry extraction
  - `src/directives/registry.ts`
  - `src/directives/*.ts`
- Service extraction around assembler coordination
  - `src/services/*`
  - `src/assembler.ts` service host/facade creation
- Typed expression and command infrastructure
  - `src/ir/expression-node.ts`
  - `src/ir/normalized-command.ts`
  - `src/ir/assembly-tree.ts`
- Tree-first parity and fixture-wide gates
  - `tests/assembler.integration.test.ts`
  - `tests/ir.test.ts`
  - `tests/service-seams.test.ts`

### Partial / transitional

- Canonical execution model
  - Tree execution exists, but legacy-style paths still exist for line-oriented
    flow and parity comparison behavior.
- IR durability
  - Cached nodes still re-normalize from raw source before dispatch in some
    runtime paths, indicating mutable/transitional behavior.
- Compatibility policy
  - ASAR-specific behavior is still distributed across core execution and
    directive handlers instead of isolated behind a dedicated profile/layer.

### Stale artifacts

- Parser-era parity script still references `src-parser`:
  - `scripts/check-parity.ts`
- `tsconfig.json` still excludes `src-parser`.

## Current Architecture Target

The near-term target is to stabilize one canonical execution pipeline:

1. Parse source commands into pass-program nodes.
2. Execute nodes through normalized command dispatch.
3. Lower commands into typed directive/instruction units.
4. Dispatch through directive registry and architecture encoders.
5. Keep compatibility semantics explicit in one internal boundary.

## Exit Criteria For Transition Phase

- One production execution path (legacy path kept only as temporary test oracle,
  then removed when confidence is sufficient).
- No cached-node reparse from raw source during execution.
- ASAR compatibility isolated in an internal compatibility layer/profile.
- Integration parity remains green throughout cleanup and optimization work.
