# Assembler Refactor Status (Re-baseline)

This document re-baselines `ASSEMBLER_REFACTOR_OPTIONS.md` against the current
state of the codebase.

## Status Summary

The project is past the original extraction plan. It is now in "finish
transition" mode:

- AST/IR foundations are implemented.
- Directive registry extraction is implemented.
- Front-end program modeling and command lowering are implemented.
- Stage-owned execution state exists through `buildProgramModel()`,
  `runStage()`, `assembleProgram()`, and `assembleSource()`.
- Tree/golden and tree/legacy fixture gates exist and are active with no known
  failure lists.
- Remaining work is largely passthrough removal, executor consolidation,
  compatibility isolation, interface narrowing, and optimization cleanup.

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
- Front-end model and lowering pipeline
  - `src/services/assembly-front-end-service.ts`
  - `src/services/program-model-builder.ts`
  - `src/services/command-lowering-service.ts`
- Stage-owned execution API
  - `Assembler.buildProgramModel()`
  - `Assembler.runStage()`
  - `Assembler.assembleProgram()`
  - `Assembler.assembleSource()`
- Tree-first parity and fixture-wide gates
  - `tests/assembler.integration.test.ts`
  - `tests/ir.test.ts`
  - `tests/service-seams.test.ts`

### Partial / transitional

- Canonical execution model
  - Lowered execution exists, but non-opcode commands can still be preserved as
    passthrough command snapshots and routed through normalized command dispatch.
- IR durability
  - Cached nodes are cloned before dispatch, but macro rewrite paths can still
    rebuild normalized commands from raw source.
- Executor consolidation
  - Tree and lowered loop / conditional execution still have parallel
    implementations.
- Compatibility policy
  - A compatibility profile exists, but compatibility-specific behavior still
    surfaces in core execution and directive handlers.

### Cleaned up / no longer applicable

- Parser-era `src-parser` references are no longer present in code.
- `scripts/check-parity.ts` is no longer present.
- `tsconfig.json` no longer excludes `src-parser`.

## Current Architecture Target

The near-term target is to stabilize one canonical execution pipeline:

1. Parse source commands into pass-program nodes.
2. Lower commands into typed directive/instruction units.
3. Dispatch lowered units through directive registry and architecture encoders.
4. Use normalized command dispatch only for command kinds that truly need
   front-end preprocessing.
5. Keep compatibility semantics explicit in one internal boundary.

## Exit Criteria For Transition Phase

- One production execution path, with line-oriented legacy-style driving kept
  only as a compatibility oracle.
- Minimal passthrough commands in lowered programs.
- No cached-node reparse from raw source during steady-state execution.
- ASAR compatibility isolated behind an internal profile / capability boundary.
- Directive handlers depend on smaller internal capabilities instead of a broad
  mutable session interface.
- Integration parity remains green throughout cleanup and optimization work.
