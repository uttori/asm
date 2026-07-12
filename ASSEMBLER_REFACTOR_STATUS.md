# Assembler Refactor Status

Verified on 2026-07-12 against the implementation, package configuration, and
the complete serial coverage suite. This is the current-state audit;
`ASSEMBLER_REFACTOR_OPTIONS.md` is historical context and
`ASSEMBLER_LONG_TERM_GOALS.md` is the active roadmap.

## Executive Summary

The extraction phase is complete and the project is in a narrower
finish-transition phase. The IR, directive registry, services, staged assembly
API, analysis pipeline, LSP, and editor integration are real and tested.

The refactor is not finished:

- staged/lowered execution is the production path, with stable directives and
  instructions dispatched directly;
- tree and lowered loop/conditional executors still coexist;
- directive handlers still receive the broad `AssemblySession`;
- architecture encoders still depend on broad assembler state;
- compatibility rules are only partly isolated;
- coverage is measured per file but not enforced by thresholds;
- TypeScript 7 declarations currently require `strictNullChecks: false` because
  legacy nullable state has not been fully narrowed;
- performance work has no benchmark baseline.

## Verified Results

- `npm run lint`: passes with six existing unsafe-regex warnings.
- `npm run make-types`: passes and emits production declarations under `dist/`.
- `npm run test:serial`: 734 tests pass.
- Coverage: 93.24% statements, 88.95% branches, 93.33% functions.
- `npm run lsp:typecheck` and `npm run vscode:typecheck`: pass.
- `npm run lsp:build` and `npm run vscode:build`: pass.
- `npm run pack:check`: passes; fixtures, harnesses, and generated ROMs are not
  published.
- `git diff --check`: passes.

## Goal Status

### Complete

- Directive registry and grouped directive modules.
- Front-end normalization, durable program models, and lowering infrastructure.
- Extracted define, macro, struct, symbol, ROM writer, and file-provider
  services.
- Stage-owned APIs: `buildProgramModel()`, `runStage()`, `assembleProgram()`,
  and `assembleSource()`.
- Tree-vs-golden and tree-vs-line fixture parity with no known failures.
- A production staged-vs-golden gate over every top-level Asar fixture.
- Real-world staged assembly coverage for the slideshow and CHOU projects.
- Analysis-only diagnostics, symbols, references, source spans, and include
  graphs.
- LSP server, VS Code client, build command, and watch command.
- Namespace behavior consolidated in `src/directives/namespace.ts`; duplicate
  runtime and assembler trampolines were removed.
- Staged production parity across every top-level Asar fixture, including
  static labels whose names case-insensitively match directive keywords.
- `ProgramModel` has one canonical type definition.
- `src/` contains production TypeScript only.
- Focused lowered-tree coverage for loops, conditionals, include, and incbin.
- Direct lowered dispatch for stable include/source, memory/freespace, SPC,
  compatibility, and instruction families.
- Typed passthrough reasons limited to preprocessing-sensitive front-end and
  data forms.
- Cached lowered passthrough execution no longer reparses unchanged raw source;
  dynamic macro-label and variadic rewrites retain normalization.

### Partial

- Directive extraction: several modules own behavior, while data, org/layout,
  SPC, include, and pushpc paths still delegate to broad services/session
  methods.
- Architecture separation: a shared registry and encoder contract exist, but
  encoders still hold broad assembler dependencies.
- Compatibility isolation: an ASAR profile exists, but policy remains in core
  execution and handlers.

### Not Complete

- One executor for commands, loops, and conditionals.
- Family-specific directive capability contexts.
- Stable-module coverage thresholds.
- Strict null checking across production source.
- Repeatable performance benchmarks.

## Cleanup Completed

- Moved Asar sources/goldens/base ROMs to `fixtures/asar/`.
- Moved slideshow and CHOU projects to `fixtures/integration/`.
- Moved manual runners to `scripts/` and exposed them through npm scripts.
- Removed duplicate fixture ROM outputs, historical logs, the duplicate CHOU
  archive, screenshots, `.DS_Store` files, and obsolete shell harnesses.
- Removed unreferenced `src/libmisc.ts`.
- Preserved `formatTraceEvent`, `addr2line`, intentional ASAR no-ops,
  deprecated syntax support, and parity execution bridges.
- Fixed declaration layout, package metadata, npm package contents, TypeScript
  7 workspace configs, and stale docs tooling.

## Decision

Do not start another broad extraction rewrite. Continue the test-gated order in
`ASSEMBLER_LONG_TERM_GOALS.md`; the next transition is consolidating tree and
lowered executors while retaining the complete fixture parity gates.
