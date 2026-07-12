# Assembler Refactor Options (Historical)

This document records the evaluated transition options. It is not the active
task list. See `ASSEMBLER_REFACTOR_STATUS.md` for verified state and
`ASSEMBLER_LONG_TERM_GOALS.md` for the remaining roadmap.

## Option 1: Finish Lowered Dispatch

Reduce `LoweredPassthroughCommand` usage one directive family at a time.

Status: **recommended and in progress**.

- Mapper/layout toggles, namespace, fill/pad, and several simple directives
  lower directly.
- Data directives must not be treated as low risk: define expansion and macro
  placeholders can represent complete data lists.
- Include/incbin are better next candidates because normalized metadata already
  carries their operands.
- Every family needs shape tests and a dispatch test proving it avoids
  `processNormalizedCommand()`.

## Option 2: Consolidate Executors

Route completed runtime nodes through the lowered executor and remove the
parallel tree loop/conditional paths.

Status: **recommended after Option 1 coverage**.

The production staged API and fixture gate now exist, but consolidation should
wait until the remaining staged `labels_static_pass` failure is fixed and loop,
conditional, include, and incbin lowering shapes have focused tests.

## Option 3: Narrow Session Capabilities

Replace broad directive-facing `AssemblySession` access with family-specific
contexts.

Status: **recommended incrementally**.

Capability slices already exist in `src/directives/types.ts`, but
`AssemblySession` still combines them. Narrow each family while extracting or
changing it; avoid a standalone type-only rewrite.

## Option 4: Extract Remaining Directive Effects

Move assembler-owned directive bodies into directive modules or named runtime
services.

Status: **partially complete**.

Namespace is now consolidated in its directive module. Data, org/layout, SPC,
include, and pushpc paths still contain trampolines or broad runtime
dependencies. Extract them after their capability contexts and direct-lowering
tests are in place.

## Option 5: Public Plugin API

Expose directive, architecture, or pass registration publicly.

Status: **deferred**.

The internal session and architecture contracts are still too broad to freeze.
Reconsider only after one executor remains and architecture code no longer
depends on broad assembler state.

## Chosen Sequence

1. Fix the remaining staged fixture parity failure.
2. Add focused lowering tests for loops, conditionals, include, and incbin.
3. Lower include/incbin and other low-risk families directly.
4. Consolidate tree and lowered executors.
5. Narrow directive capabilities while extracting remaining effects.
6. Decouple architecture encoders from the full assembler.
7. Add stable-module coverage thresholds.
8. Measure before pursuing performance optimizations.
