# Assembler Long-Term Goals

This is the active roadmap after the 2026-07-12 audit and cleanup. Completed
history lives in `ASSEMBLER_REFACTOR_STATUS.md`; this file intentionally lists
only work that still affects the target architecture.

## Target

The assembler should have one explicit pipeline:

1. Parse source into a durable program model.
2. Lower it into typed execution units.
3. Execute commands, loops, and conditionals through one production executor.
4. Delegate directive effects and instruction encoding through narrow
   capability contracts.
5. Emit ROM bytes and analysis artifacts from the same source of truth.

Legacy line/tree drivers may remain temporarily as parity oracles, not as
independent production implementations.

## Non-Negotiables

- Bridge removal is test-first.
- Fixture, slideshow, and CHOU parity remain green.
- Compatibility behavior is explicit and isolated.
- Directive and architecture contracts expose only required capabilities.
- No public plugin API is frozen while those contracts are transitional.
- Performance changes require measurements, not intuition.

## Roadmap

### 1. Close Production Parity

Status: **complete**.

- [x] Fix staged execution of `fixtures/asar/tests/labels_static_pass.asm`.
- [x] Remove `labels_static_pass` from `STAGED_GOLDEN_KNOWN_FAILURES` when it passes.
- Keep the all-fixture staged-vs-golden gate ratcheting: an unexpected pass must
  require deleting its known-failure entry.

Exit criteria:

- All top-level Asar fixtures match goldens through `assembleProgram()`.
- Slideshow and CHOU continue to match through the staged API.

### 2. Finish Focused Lowering Coverage

Status: **complete**.

- [x] Add explicit lowered-tree tests for `for`, `while`, `if`, `elseif`, and
  `else`.
- [x] Add include/incbin metadata and lowering-boundary tests.
- [x] Add per-family dispatch tests proving direct lowered directives do not call
  `processNormalizedCommand()`.
- [x] Document why every retained passthrough category requires preprocessing.

Exit criteria:

- Direct and passthrough behavior is intentional and covered.
- Loop/conditional lowering branches are fully exercised.

### 3. Reduce Passthrough Dispatch

Status: **complete**.

- [x] Lower include/incbin first; their parsed metadata is already durable.
- [x] Evaluate memory/freespace directives next.
- [x] Keep define, label, macro, function, and preprocessing-sensitive forms as
  passthrough until their semantics exist in the front-end model.
- [x] Treat data directives as high risk because a define or macro placeholder can
  represent an entire data list.
- [x] Stop rebuilding cached normalized commands from raw source once all required
  rewrite semantics are represented explicitly.

Retained passthrough nodes carry a typed reason. They are limited to ordered
front-end state (`define`, label, macro body/invocation, function, struct,
static assignment, and character mapping), macro placeholders, and data
directives whose operands can be replaced as a complete list. Cached execution
uses their durable normalized snapshots; raw normalization is reserved for
macro-label rewrites and context-sensitive variadic expansion.

Exit criteria:

- Passthrough categories are rare, named, and justified.
- Stable directives avoid normalized redispatch.
- Steady-state execution does not reparse cached source.

### 4. Collapse Duplicate Executors

Status: **complete**.

- [x] Make tree execution lower completed nodes before dispatch.
- [x] Route includes through the same lowered stream as top-level programs.
- [x] Unify loop and conditional dispatch around existing shared iteration/branch
  helpers.
- [x] Delete tree-specific loop and conditional entry points after parity proves
  equivalence.
- [x] Keep one line-oriented driver only while it provides useful oracle coverage.

Exit criteria:

- Commands, loops, conditionals, and includes use one production executor.
- Behavior fixes require changes in one execution path.

### 5. Narrow Directive Capabilities

Status: **complete**.

- [x] Replace broad handler contexts with family-specific contexts.
- [x] Narrow fill/pad, layout toggles, namespace, compatibility no-ops, table,
  flow-control, include/source, memory, data, and SPC handlers.
- [x] Make include, emission, symbol, expression, compatibility, and runtime
  dependencies explicit.
- [x] Remove `Assembler implements AssemblySession`.

Exit criteria:

- A handler's type shows its actual dependencies.
- Directive modules can be tested without constructing the full assembler when
  practical.

### 6. Extract Remaining Directive Effects

Status: **complete**.

Namespace, data, layout, memory/freespace, SPC blocks, table state, and
flow-control labels are complete. Include/source resolution, guard, recursion,
graph, parse/execute, and binary-read behavior now lives in
`IncludeSourceService`; handlers use narrow capabilities and `incbin` uses the
directive runtime for PC stacks.

Exit criteria:

- Directive behavior lives beside registration or in a named focused service.
- `Assembler` exposes no directive trampoline methods.

### 7. Decouple Architecture Encoders

Status: **complete**.

- 65816, SPC700, and SuperFX use operand-resolution, sizing, emission, branch,
  and diagnostic contexts rather than broad assembler references.
- Encoder tests use host-free contexts.
- Operand splitting and unsupported-instruction policy live in architecture
  definitions rather than generic execution code.
- Reconsider a plugin API only after the internal contract survives this
  decoupling.

Exit criteria:

- Architecture code does not depend on broad assembler mutable state.
- Adding a similar architecture mostly means registering a definition and
  tests.

### 8. Isolate Compatibility Policy

Status: **complete**.

- [x] Move checksum calculation, mapper/checksum behavior, freespace
  availability, SPC mapper guards, and remaining ASAR-specific predicates
  behind `src/compatibility/asar-compatibility-profile.ts`.
- [x] Keep intentional no-op directives and deprecated syntax covered.
- [x] Keep unsupported forms distinct from intentionally compatible no-ops.

Exit criteria:

- Core execution does not contain unexplained ASAR conditionals.
- Compatibility choices are discoverable from one boundary.

### 9. Ratchet Coverage

Status: **not started; reporting is complete**.

The verified baseline is 93.27% statements, 88.95% branches, and 93.16%
functions over 722 passing tests.

- Enable thresholds for stable small modules first.
- Restore `strictNullChecks` and narrow legacy nullable state instead of
  relying on the current TypeScript 7 compatibility override.
- Prioritize branch coverage in `directives/memory.ts`,
  `directives/namespace.ts`, `services/macro-engine.ts`, and LSP position/index
  modules.
- Do not set brittle per-file targets on `assembler.ts` until its
  responsibilities shrink.

Exit criteria:

- Stable extracted modules cannot regress silently.
- Thresholds rise as transitional surfaces are removed.

### 10. Benchmark Before Optimizing

Status: **no benchmark infrastructure**.

Create a repeatable benchmark script covering CHOU, slideshow, macro-heavy
fixtures, include-heavy fixtures, and instruction encoding. Record wall time,
peak memory, cache size, and relevant clone/reparse counters.

Only after measurement, evaluate:

- expression parse caching;
- include-file memoization;
- cheaper pass-program cache keys;
- reduced command cloning and macro rewrites;
- incremental LSP re-analysis.

These are speculative opportunities, not committed optimizations.

## Progress Checklist

- [x] Baseline commands are repeatable through npm scripts.
- [x] Tree-vs-golden and tree-vs-line fixture gates are green.
- [x] Staged production parity is gated across every top-level fixture.
- [x] Slideshow and CHOU use the staged API in regression coverage.
- [x] Analysis/LSP artifacts and editor builds are delivered.
- [x] `src/` contains production source only.
- [x] Package declarations and publish contents exclude fixtures/harnesses.
- [x] Namespace duplicate implementations are consolidated.
- [x] Staged production parity has no known failures.
- [x] Focused lowering tests cover loops, conditionals, include, and incbin.
- [x] Passthrough commands are minimized and justified.
- [x] Tree and lowered executors are consolidated.
- [x] Directive handlers use focused capabilities.
- [ ] Remaining directive effects are extracted.
- [ ] Architecture encoders use narrow contexts.
- [x] Compatibility policy is centralized.
- [ ] Production declarations pass with `strictNullChecks`.
- [ ] Stable-module coverage thresholds are enforced.
- [ ] Benchmarks identify worthwhile optimizations.

## Verification Commands

```sh
npm run lint
npm run make-types
npm run test:serial
npm run lsp:typecheck
npm run lsp:build
npm run vscode:typecheck
npm run vscode:build
npm run pack:check
```
