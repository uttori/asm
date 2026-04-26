# Assembler Refactor Options

This document is the current cleanup guide for the assembler refactor. The
original "start with service extraction and a directive registry" work is now
largely complete, so the useful options are about finishing the transition
without destabilizing the fixture suite.

## Current Responsibility Map

`src/assembler.ts` is still the session and orchestration hub. It owns mutable
assembly state, stage snapshots, expression host wiring, diagnostics, tracing,
and high-level entrypoints such as `assembleblock()`, `buildProgramModel()`,
`runStage()`, `assembleProgram()`, and `assembleSource()`.

The extracted pieces now include:

- `src/directives/registry.ts` and grouped `src/directives/*.ts` handlers.
- `src/services/assembly-front-end-service.ts` for command buffering and
  normalization.
- `src/services/program-model-builder.ts` for executable tree construction and
  pass-program caching.
- `src/services/command-lowering-service.ts` for lowered directive /
  instruction work units.
- `src/services/macro-engine.ts`, `define-engine.ts`, `struct-engine.ts`,
  `symbol-scope-service.ts`, and `rom-writer-service.ts`.
- `src/file-provider.ts` for filesystem and in-memory include / read support.

The remaining pressure points are:

- lowered programs still preserve broad categories of commands as passthrough
  snapshots;
- tree execution and lowered execution have parallel loop / conditional
  implementations;
- directive handlers still depend on a large mutable `AssemblySession`;
- some directive effects still live in `Assembler`;
- ASAR compatibility is partly centralized but still visible in core execution
  and directive handlers.

## Updated Option Comparison

### Option 1: Finish Lowered Dispatch

Reduce passthrough commands in `CommandLoweringService` so stable directive
families lower directly to `LoweredDirective` and dispatch through the registry.

Pros:

- removes repeated cloning, rewrite checks, and normalized redispatch;
- makes `runStage()` closer to the canonical execution path;
- creates a measurable way to retire bridge behavior.

Cons:

- commands that depend on front-end preprocessing still need passthrough escape
  hatches;
- lowering tests need to be more explicit before changing behavior.

Verdict:

- best next move.

### Option 2: Consolidate Executors

Keep the lowered executor as the target and route legacy tree execution through
lowered nodes where practical.

Pros:

- loop and conditional semantics live in one place;
- future behavior fixes stop needing dual updates;
- supports removing the line-oriented parity bridge later.

Cons:

- should happen after enough directives lower directly;
- macro and define control flow still need careful parity checks.

Verdict:

- second move, after low-risk direct lowering lands.

### Option 3: Narrow Internal Session Capabilities

Replace the broad directive-facing `AssemblySession` shape with smaller internal
capabilities such as state, emission, layout, include, namespace, and symbol
services.

Pros:

- makes handler dependencies visible;
- limits accidental mutable-state coupling;
- prepares remaining directive effects for extraction.

Cons:

- mainly a type-safety and maintainability improvement;
- too much splitting before handler movement can create noise.

Verdict:

- do incrementally as handlers are touched.

### Option 4: Extract Remaining Directive Effects

Move remaining assembler-owned directive bodies, especially data, org/layout,
SPC block, include, namespace, and pushpc helpers, into directive modules or
focused services.

Pros:

- shrinks `Assembler`;
- keeps directive behavior beside directive registration;
- improves focused testing.

Cons:

- many handlers still require broad state access;
- extraction is safest after capability interfaces are narrower.

Verdict:

- do after options 1 and 3 provide cleaner boundaries.

### Option 5: Public Plugin API

Expose public directive / architecture / pass registration.

Verdict:

- still not recommended. Internal seams are not stable enough to freeze as a
  public extension API.

## Recommended Sequence

1. Add focused `CommandLoweringService` tests.
2. Lower low-risk directive families directly: data, mapper/layout toggles,
   namespace, fill/pad, misc no-ops, and simple include/source directives where
   normalized command metadata already carries the required operands.
3. Route tree execution through lowered execution for completed nodes, keeping
   compatibility behavior covered by the existing tree/legacy fixture gates.
4. Split directive-facing session types into small capability interfaces.
5. Move remaining directive bodies out of `Assembler` as the required
   capabilities become explicit.
6. Keep ASAR compatibility behind `src/compatibility/asar-compatibility-profile.ts`
   and move scattered compatibility predicates there when touched.

## Testing Strategy

The current fixture gates are strong and should stay green throughout:

- tree-vs-golden fixture coverage in `tests/assembler.integration.test.ts`;
- tree-vs-legacy driver parity in `tests/assembler.integration.test.ts`;
- IR / normalized command coverage in `tests/ir.test.ts`;
- service seam coverage in `tests/service-seams.test.ts`.

The main missing coverage is focused lowering behavior. Add tests that assert
lowered node shapes and dispatch results for directive, include/incbin, and
architecture instruction paths before each bridge-removal slice.

## Bottom Line

The project no longer needs another broad refactor plan. It needs a narrow
finish-transition plan:

- make lowered dispatch canonical;
- delete duplicate execution paths when parity proves it;
- reduce session surface area;
- extract remaining directive bodies only as the boundaries get cleaner;
- avoid a public plugin API until the internal model settles.
