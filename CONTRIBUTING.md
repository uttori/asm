# Contributing to Uttori ASM

Thanks for improving Uttori ASM. This guide is the starting point for contributors who are new to TypeScript or emulator tooling and for maintainers changing the project format, analysis engine, debugger, or whatever else.

Read this file once from top to bottom before making a structural change. Then use the links in the area-specific table rather than trying to infer ownership from directory names.

## Start Here

You need:

- Node.js 26 or newer (`node --version`)
- npm from that Node installation (`npm --version`)
- git
- macOS, Linux, or Windows for the TypeScript toolchain

Clone and install:

```sh
git clone https://github.com/uttori/asm.git
cd asm
npm install
npm run typecheck
npm test
```

Use `npm ci` instead of `npm install` in a clean CI checkout. Do not initialize external fixture submodules unless your change needs them.

Before opening a pull request, run:

```sh
npm run verify
npm run pack:check
```

The complete gate map, including fixtures and the Extension Host smoke, is in [testing and release gates](TESTING.md).

## Choose the right starting document

| If you are changing…                                               | Read first                                                                           | Primary implementation                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| parser, expressions, symbols, macros, assembly stages, diagnostics | [root README](README.md)                                                             | `packages/core/src/`                                             |
| plugin contracts or a new target                                   | [plugin-author example](packages/plugin-author/README.md)                            | `packages/core/src/plugin/`, then a plugin package               |
| 65816, SPC700, SuperFX, mappers, SNES source output                | [SNES reference](packages/plugin-snes/README.md)                                     | `packages/plugin-snes/src/`                                      |
| NMOS/CMOS/other 65xx targets                                       | [65xx reference](packages/plugin-65xx/README.md)                                     | `packages/plugin-65xx/src/`                                      |
| ROM projects, analysis, evidence, transactions, assets             | [disassembler architecture](packages/disassembler/ARCHITECTURE.md)                   | `packages/disassembler/src/`                                     |
| CLI commands or end-to-end disassembly                             | [CLI reference](packages/cli/README.md)                                              | `packages/cli/src/`                                              |
| LSP diagnostics or editor language features                        | [architecture guide](packages/disassembler/ARCHITECTURE.md#language-and-editor-path) | `packages/language-server/src/`                                  |
| DAP, neutral debug contracts, framing, replay                      | [debug-adapter reference](packages/debug-adapter/README.md)                          | `packages/debug-adapter/src/`                                    |
| ares translation/process hosting                                   | [ares sidecar reference](packages/debug-sidecar-ares/README.md)                      | `packages/debug-sidecar-ares/src/`                               |
| MesenCE translation/process hosting                                | [MesenCE sidecar reference](packages/debug-sidecar-mesence/README.md)                | `packages/debug-sidecar-mesence/src/`                            |
| VS Code commands, trees, annotations, launch settings              | [extension reference](packages/vscode-extension/README.md)                           | `packages/vscode-extension/src/`                                 |
| performance-sensitive analysis/persistence                         | [performance guide](packages/disassembler/PERFORMANCE.md)                            | relevant implementation plus `scripts/benchmark-disassembler.ts` |

The implementation, public package documentation, and executable validation gates are the source of
truth. Update all three together when capability status or validation evidence changes, and keep
unproven claims explicit.

## A small mental model

Uttori ASM has strict ownership boundaries:

- Core is architecture-neutral. It knows assembly concepts, never SNES opcodes or mappers.
- The disassembler is target-neutral. It knows projects, evidence, conservative traversal, and
  reversible edits, never SNES address translation.
- Target plugins own instruction specifications, mapper behavior, target state, importers, and native
  source rendering.
- Hosts—the CLI, language server, and VS Code extension—compose plugins and user interaction.
- The debug adapter owns the emulator-neutral contract and DAP translation.
- Sidecars contain emulator-specific translation. Emulator code and GPL runtime artifacts do not
  enter the MIT packages.

If a proposed import violates that ownership, move the behavior to a callback or contribution
contract instead of creating a dependency shortcut. `npm run check:boundaries` enforces the most
important directions.

The deeper dependency and data-flow description is in
[Disassembler architecture](packages/disassembler/ARCHITECTURE.md).

## Glossary

| Term             | Meaning in this repository                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| architecture     | An instruction set and encoder/decoder identity, such as `snes.65816`.                                           |
| target           | A complete build environment: architecture, address spaces, output format, directives, and options.              |
| address space    | A named coordinate system. Equal numbers in ROM, CPU bus, WRAM, ARAM, and GSU space are not interchangeable.     |
| mapper           | Target-owned conversion between SNES cartridge offsets and CPU addresses. Reverse mapping is never guessed.      |
| analysis project | `analysis.sqlite` plus an `analysis.json` watcher pointer. The source ROM remains external.                      |
| evidence         | Provenance and confidence attached to a fact: manual, imported, detected, static, or runtime.                    |
| conflict         | Persisted contradictory evidence. A conflict is useful data, not an error to discard.                            |
| CFG              | Control-flow graph: decoded instruction nodes and branch/call/return edges.                                      |
| DAP              | Visual Studio Code's Debug Adapter Protocol. Only the adapter/editor layer speaks it.                            |
| sidecar          | A restartable child process translating the neutral debug protocol to one emulator.                              |
| fixture          | A stable input and expected result used by a test. Some are redistributable. ROM-backed fixtures are local only. |
| round trip       | Export native source, reassemble it, and compare the complete rebuilt byte image with the input.                 |

## Make a focused change

1. Establish the current behavior with the narrowest existing test.
2. Add or update a test that fails for the missing behavior.
3. Change the smallest owning package. Avoid moving target knowledge upward.
4. Run the focused test and the package type/lint checks.
5. Regenerate compiled JavaScript and declarations with `npm run make-types` when a public surface changes.
6. Run the repository and package gates appropriate to the risk.
7. Update the relevant public documentation in the same change.

Do not change package versions while the project remains unreleased unless the release owner asks
for a version change. Dependency additions still require a reviewed `package-lock.json` update.

The worktree may contain unrelated work. Do not reset, delete, reformat, or regenerate files outside
your change merely to make `git status` shorter.

## TypeScript and documentation expectations

Public npm exports resolve to compiled ESM in `dist/`. The explicit `uttori-source` condition selects
TypeScript source for repository development. Root scripts, AVA workers, source subprocesses, and
esbuild use that condition. Direct development commands should include `--conditions=uttori-source`
alongside `--import=tsx`. Consumer verification deliberately enables neither. Keep this distinction
so tests cannot pass against stale output or mask an installed-package resolution error.

Builds and standalone tools require Node 26. The extension and its embedded executables target the
Node 24 runtime shipped by the minimum supported VS Code. `npm run vscode:smoke` type-checks against
that editor's own API declarations and checks SQLite in the real Extension Host.

- The repository uses ESM and strict TypeScript. Source imports include the emitted `.js` suffix.
- Prefer explicit immutable types and `readonly` collections at package boundaries.
- Validate `unknown` at every file, network, process, command, project, trace, or plugin boundary.
- Reject unsupported versions and malformed identities. Never silently coerce a newer schema.
- Use half-open ranges (`start` inclusive, `end` exclusive).
- Preserve stable ids and deterministic ordering. Avoid routine timestamps in mergeable artifacts.
- Add or update concise, meaningful JSDoc for public APIs and for types, interfaces, type aliases,
  fields, and internal algorithms with non-obvious semantics. Explain relevant units, defaults,
  valid ranges, ownership, lifecycle, side effects, failure behavior, or invariants. Avoid
  restating obvious names or signatures and adding boilerplate tags without useful information.
- Add short inline comments immediately before complex branches and non-obvious logic. Explain
  why the path exists, which invariant it protects, or why ordering matters, especially around
  validation, fallbacks, state transitions, cancellation/recovery, and compatibility behavior.
  Keep explanations close to the code, usually one or two sentences. Do not narrate each statement.
- Any performance or allocation optimization must have an adjacent inline invariant comment and
  thorough JSDoc where applicable. Explain its complexity, ordering, allocation, determinism, and
  validation constraints so a locally attractive rewrite cannot reintroduce the original problem.
- Comments should explain why a constraint exists. Tests should show the externally observable
  contract. Update or remove stale comments when behavior changes. Tests and final summaries do
  not replace explanations in the source.
- Do not write nested ternaries, including within template interpolations. Use named intermediate
  values, explicit if/else branches, or a small helper to make the decision readable.
- Do not spread input-sized collections into function arguments (`push`, `unshift`, `splice`,
  `Math.min`/`Math.max`, or similar calls). Fitting in memory does not avoid the engine's argument
  limit. Append iteratively, use numeric folds, or use a stack that preserves processing order.
  Array/object spread is unaffected. Call spread is acceptable when a small bound is enforced
  before the call. Test large-input regressions in a normal Node child because AVA workers have
  a larger native stack and can hide this failure.
- Before finishing, review changed code for missing explanations, misleading or redundant
  comments, and nested ternaries. Apply these expectations to all new or substantively modified code.
- Run `npm run fmt` to format owned files. If a new path is not covered by the root scripts, add it to
  the appropriate formatting, lint, and TypeScript scope.

Do not weaken a conservative result to make generated output look cleaner. Unknown, ambiguous,
unreached, conflicting, or unsupported bytes must remain visible and round-trip through raw data.

## Tests

AVA is the test runner. A focused test is the fastest development loop:

Put package behavior tests in `packages/<package>/tests/`, following `src/` paths where practical.
Keep repository structure checks in `tests/project/`, cross-package scenarios in `tests/integration/`,
and script tests in `tests/scripts/`. Shared test harnesses belong in `tests/helpers/`.

```sh
npx ava packages/disassembler/tests/project-store.test.ts
npx ava packages/plugin-snes/tests/65816-decoder.test.ts
npx ava tests/project/vscode-extension/debugger.test.ts
```

Tests should be deterministic, hermetic by default, and safe to run concurrently. Use
`fs.mkdtempSync()`/`fs.mkdtemp()` under `os.tmpdir()` for generated projects and remove the exact
temporary directory in `finally` or test teardown. Never write a user ROM, emulator runtime, or
generated analysis project into a publishable package.

The fuzz suite is deterministic and part of `npm test`:

```sh
npm test -- tests/integration/disassembler-fuzz.test.ts
UTTORI_FUZZ_SEED=123456789 npm test -- tests/integration/disassembler-fuzz.test.ts
```

When a fuzz case fails, report the seed and iteration, add a minimal regression assertion when
practical, fix the owning boundary, then retain the generational property test.

Coverage is a guardrail, not permission to remove semantic tests. `npm run verify` enforces the
repository floors and higher per-file floors for historically fragile core modules.

## Common contribution recipes

### Add or change an instruction

1. Change the declarative specification in the owning architecture package.
2. Keep encoder, decoder, formatter, tooling catalog, and state transfer derived from or aligned with
   that specification.
3. Add a documented golden vector and a truncated-input case when instruction width changes.
4. Preserve decode-format-encode tests across every opcode/state variant.
5. Run the architecture test and `npm test`.

65816 is the primary processor. SPC700 and SuperFX use the same reversible-contract standard.

### Add a project schema field

1. Decide which existing semantic collection/table owns the fact. Keep storage and public record contracts aligned.
2. Add a stable, JSON-safe type and validation at load and write boundaries.
3. Update canonical ordering when the field affects deterministic output.
4. Support the currently declared format and document deliberate future changes. Do not add compatibility for earlier development layouts.
5. Reject future versions. Never downgrade them.
6. Test malformed input, deterministic rewrite, missing evidence/address spaces, and ROM-payload
   exclusion.
7. Document merge and recovery behavior.

SQLite owns the authoritative manifest and revision. Check the expected revision under the writer
lock and commit records and revision atomically. Refresh `analysis.json` after commit. It is a watcher
pointer, not the authority for recovery or conflict detection.

### Add an analysis rule

1. Put generic traversal behavior in `@uttori/asm-disassembler`. Put processor semantics in the
   target plugin adapter.
2. State the evidence required to accept a boundary or target.
3. Stop or emit an explicit conflict/unresolved result when that evidence is absent.
4. Keep work, call depth, and emitted results bounded.
5. Test competing contexts, ambiguous decode, data overlap, indirect flow, and incomplete limits.

### Add an importer

1. Treat input as untrusted and retain an immutable artifact identity.
2. Require the exact ROM content identity and mapper wherever the source format can provide them.
3. Map source address spaces only through explicit caller/target declarations.
4. Produce stable ids, counts, warnings, and a deterministic loss report.
5. Keep import pure until the user explicitly merges/persists evidence.
6. Make identical reimport a no-op and conflicting reused ids an error.

`.dizraw` is import-only. Native project syntax and source output do not target Diz, Asar, ca65, or
another compatibility dialect.

### Add an asset or compression codec

Use a stable id and version, declare bounds and dependencies, and keep implementations in a target
or game plugin unless they are genuinely target-neutral. `inspect`, `decode`, and `encode` are
separate contracts. A no-op encode must reproduce the exact original bytes before an editor preview
or source-export integration may consume it. Recompression may not move following data.

### Add a debug operation

1. Extend the emulator-neutral `DebugBackend` contract and capability negotiation first.
2. Add replay coverage and frozen conformance semantics.
3. Extend the authenticated bounded sidecar protocol and validate decoded `unknown` before dispatch.
4. Translate separately in each emulator sidecar. Do not expose native command names above it.
5. Map the neutral operation to DAP and VS Code only after the backend behavior is proven.
6. Test deadlines, queue/buffer limits, replayed sequences, child loss, reconnect, and reduced
   capabilities.

Never put the session token on a command line or allow an emulator to write protocol stdout.

### Add a VS Code feature

The extension's `src/` and `tests/` directories share feature folders:

- `analysis/`: annotations, navigation, coverage/source/graph trees, and analysis workers.
- `debug/`: debugger sessions, address resolution, source roots, and debug annotations.
- `disassembly/`: annotation editing, maintenance jobs/processes, storage reports, and the panel.
- `runtime/`: trace recording/import, live bus analysis, runtime bindings, and trace ownership.
- `project/`: the project panel, outline, creation wizard, and remembered ROM bindings.

Keep `extension.ts` and the shared `webview-template.ts` helper at the source root. Module filenames
omit the feature prefix supplied by their folder; tests use the corresponding folder and module name.
Worker bundles keep their existing names in `out/`; update source entry points in `esbuild.mjs` when
moving a worker.

Keep data derivation in a target-neutral or target package and presentation in the extension.
Commands that write a project require Workspace Trust and must use the transaction/edit APIs.
Read-only inspection may remain available in a restricted workspace. Source navigation requires an
exact target, ROM identity, and current source hash. Otherwise use explicit virtual disassembly or
persisted records without mapper inference.

Run unit/contract tests, `npm run vscode:typecheck`, `npm run vscode:package`, and
`npm run vscode:smoke`. The last command downloads a pinned VS Code build once and launches a real
isolated Extension Development Host.

### Change a performance-sensitive path

Read [Disassembler performance baselines](packages/disassembler/PERFORMANCE.md) before editing. Preserve
the inline `Performance invariant`, `Security invariant`, and `TOCTOU invariant` comments. Add or
update semantic tests first, then run the focused benchmark and compare the complete distribution,
not one favorable measurement. Only the matching Apple M1 Max host may enforce the checked-in M1
budget. Other machines collect observations without pretending to satisfy that policy.

## Fixtures, licenses, and private material

All repository code is MIT unless a notice says otherwise. Do not copy GPL implementation code into
an MIT package. GPL projects may be used as external executables, separately maintained patches,
read-only oracles, or test fixtures under their own licenses. Reimplement behavior from documented
formats and observed contracts. Preserve notices for distributed native artifacts.

The following never belong in a commit, npm tarball, VSIX, test snapshot, benchmark report, or issue:

- commercial ROM bytes or extracted copyrighted assets.
- files from `Local Only/`.
- session tokens, private runtime manifests, or machine-specific credentials.
- generated analysis/source trees derived from a private ROM. Or
- emulator binaries/libraries unless an explicit distribution review and allow-listed manifest
  authorizes them.

`Local Only/Secret of Mana (USA).sfc` is intentionally authorized only for local testing. Its
byte-identical gate validates the conservative rebuild path, not perfect Diz semantic equivalence.
See [External fixtures](fixtures/external/README.md) for redistributable and ROM-backed setup.

If a test does not need real game content, create the smallest synthetic byte array or use the
redistributable dummy ROM.

## Updating documentation

Change documentation in the same pull request when behavior, a command, a file format, a capability,
or a validation claim changes. Use this ownership order:

- package README or another Markdown file at that package's top level: public API and end-user behavior.
- `packages/disassembler/ARCHITECTURE.md`: system boundaries and invariants.
- `TESTING.md`: commands, CI, fixtures, and release evidence.
- ADR: a durable decision with alternatives and consequences.

## Pull-request checklist

- [ ] The change lives in the package that owns the behavior.
- [ ] Public input is validated from `unknown`, bounded, and version checked.
- [ ] Unknown/conflicting evidence remains explicit and no mapper/instruction boundary is guessed.
- [ ] Stable ids, canonical ordering, and merge-friendly project output are preserved.
- [ ] Focused success, failure, truncation, and identity-mismatch tests pass.
- [ ] Performance changes include explanatory JSDoc/inline invariants and benchmark evidence.
- [ ] `npm run verify`, `npm run pack:check`, and relevant fixture/smoke gates pass.
- [ ] Public declarations and bundles were regenerated by their scripts, not hand-edited.
- [ ] Package/VSIX contents contain no ROM, local-only, GPL, emulator, or secret material.
- [ ] User docs record the result without overclaiming.
- [ ] Package versions are unchanged unless a release change was explicitly requested.

## Troubleshooting

`npm run make-types` should work on all supported shells. If it fails after interrupted output,
rerun it. Its cleanup helper removes only the explicit generated `dist` directories.

If VS Code smoke testing fails before launch, confirm network access and remove only the incomplete
version directory beneath `.vscode-test/`. Do not delete the whole repository or a user VS Code
profile. Linux needs `xvfb-run` in headless environments.

If a project write reports stale or locked state, reload it after the active writer finishes. Do not
delete SQLite WAL/SHM files or replace a database with active clients. Read
[Conflict-safe edits and recovery](packages/disassembler/API.md#conflict-safe-edits-and-recovery)
before recovering interrupted writes.

If an external fixture is skipped, run `npm run fixtures:status`. The output identifies the missing
submodule, local ROM, hash, or tool without requiring every optional fixture.

If a package audit includes an unexpected file, fix its `files`/ignore configuration or generated
path. Do not relax the ROM/native-payload rejection rule to make the audit pass.
