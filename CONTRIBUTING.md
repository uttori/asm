# Contributing to Uttori ASM

Thank you for improving Uttori ASM. This guide is the starting point for contributors who are new
to TypeScript or emulator tooling and for maintainers changing the project format, analysis engine,
debugger, or release gates.

Read this file once from top to bottom before making a structural change. Then use the links in the
area-specific table rather than trying to infer ownership from directory names.

## Start here

You need:

- Node.js 26 or newer (`node --version`);
- npm from that Node installation (`npm --version`);
- Git; and
- macOS, Linux, or Windows for the TypeScript toolchain. macOS arm64 is the first validated native
  emulator host; checked-in CI is responsible for the portable TypeScript matrix.

Clone and install:

```sh
git clone https://github.com/uttori/asm.git
cd asm
npm install
npm run typecheck
npm test
```

Use `npm ci` instead of `npm install` in a clean CI checkout. Do not initialize external fixture
submodules unless your change needs them.

Before opening a pull request, run:

```sh
npm run verify
npm run pack:check
npm run test:roundtrip
```

The complete gate map, including fixtures and the Extension Host smoke, is in
[Testing and release gates](docs/testing-and-release.md).

## Choose the right starting document

| If you are changing…                                               | Read first                                                                       | Primary implementation                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| parser, expressions, symbols, macros, assembly stages, diagnostics | [root README](README.md)                                                         | `packages/core/src/`                                             |
| plugin contracts or a new target                                   | [plugin-author example](packages/plugin-author/README.md)                        | `packages/core/src/plugin/`, then a plugin package               |
| 65816, SPC700, SuperFX, mappers, SNES source output                | [SNES reference](packages/plugin-snes/README.md)                                 | `packages/plugin-snes/src/`                                      |
| NMOS/CMOS/other 65xx targets                                       | [65xx reference](packages/plugin-65xx/README.md)                                 | `packages/plugin-65xx/src/`                                      |
| ROM projects, analysis, evidence, transactions, assets             | [disassembler architecture](docs/disassembler-architecture.md)                   | `packages/disassembler/src/`                                     |
| CLI commands or end-to-end disassembly                             | [CLI reference](packages/cli/README.md)                                          | `packages/cli/src/`                                              |
| LSP diagnostics or editor language features                        | [architecture guide](docs/disassembler-architecture.md#language-and-editor-path) | `packages/language-server/src/`                                  |
| DAP, neutral debug contracts, framing, replay                      | [debug-adapter reference](packages/debug-adapter/README.md)                      | `packages/debug-adapter/src/`                                    |
| ares translation/process hosting                                   | [ares sidecar reference](packages/debug-sidecar-ares/README.md)                  | `packages/debug-sidecar-ares/src/`                               |
| MesenCE translation/process hosting                                | [MesenCE sidecar reference](packages/debug-sidecar-mesence/README.md)            | `packages/debug-sidecar-mesence/src/`                            |
| VS Code commands, trees, annotations, launch settings              | [extension reference](packages/vscode-extension/README.md)                       | `packages/vscode-extension/src/`                                 |
| performance-sensitive analysis/persistence                         | [performance guide](docs/disassembler-performance.md)                            | relevant implementation plus `scripts/benchmark-disassembler.ts` |

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
[Disassembler architecture](docs/disassembler-architecture.md).

## Glossary

| Term             | Meaning in this repository                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| architecture     | An instruction set and encoder/decoder identity, such as `snes.65816`.                                              |
| target           | A complete build environment: architecture, address spaces, output format, directives, and options.                 |
| address space    | A named coordinate system. Equal numbers in ROM, CPU bus, WRAM, ARAM, and GSU space are not interchangeable.        |
| mapper           | Target-owned conversion between SNES cartridge offsets and CPU addresses. Reverse mapping is never guessed.         |
| analysis project | `analysis.json` plus eight independently hashed, merge-friendly JSON shards. It contains metadata, never ROM bytes. |
| evidence         | Provenance and confidence attached to a fact: manual, imported, detected, static, or runtime.                       |
| conflict         | Persisted contradictory evidence. A conflict is useful data, not an error to discard.                               |
| CFG              | Control-flow graph: decoded instruction nodes and branch/call/return edges.                                         |
| DAP              | Visual Studio Code's Debug Adapter Protocol. Only the adapter/editor layer speaks it.                               |
| sidecar          | A restartable child process translating the neutral debug protocol to one emulator.                                 |
| fixture          | A stable input and expected result used by a test. Some are redistributable; ROM-backed fixtures are local only.    |
| round trip       | Export native source, reassemble it, and compare the complete rebuilt byte image with the input.                    |

## Make a focused change

1. Establish the current behavior with the narrowest existing test.
2. Add or update a test that fails for the missing behavior.
3. Change the smallest owning package; avoid moving target knowledge upward.
4. Run the focused test and the package type/lint checks.
5. Regenerate declarations with `npm run make-types` when a public TypeScript surface changes.
6. Run the repository and package gates appropriate to the risk.
7. Update the relevant public documentation in the same change.

Do not change package versions while the project remains unreleased unless the release owner asks
for a version change. Dependency additions still require a reviewed `package-lock.json` update.

The worktree may contain unrelated work. Do not reset, delete, reformat, or regenerate files outside
your change merely to make `git status` shorter.

## TypeScript and documentation expectations

- The repository uses ESM and strict TypeScript. Source imports include the emitted `.js` suffix.
- Prefer explicit immutable types and `readonly` collections at package boundaries.
- Validate `unknown` at every file, network, process, command, project, trace, or plugin boundary.
- Reject unsupported versions and malformed identities. Never silently coerce a newer schema.
- Use half-open ranges (`start` inclusive, `end` exclusive).
- Preserve stable ids and deterministic ordering. Avoid routine timestamps in mergeable artifacts.
- Public functions, classes, interfaces with non-obvious semantics, and internal algorithms with
  hidden constraints need useful JSDoc—not a restatement of the signature.
- Any performance or allocation optimization must have an adjacent inline invariant comment and
  thorough JSDoc where applicable. Explain its complexity, ordering, allocation, determinism, and
  validation constraints so a locally attractive rewrite cannot reintroduce the original problem.
- Comments should explain why a constraint exists. Tests should show the externally observable
  contract.
- Run `npm run fmt` to format owned files. If a new path is not covered by the root scripts, add it to
  the appropriate formatting, lint, and TypeScript scope.

Do not weaken a conservative result to make generated output look cleaner. Unknown, ambiguous,
unreached, conflicting, or unsupported bytes must remain visible and round-trip through raw data.

## Tests

AVA is the test runner. A focused test is the fastest development loop:

```sh
npx ava packages/disassembler/tests/project-store.test.ts
npx ava packages/plugin-snes/tests/65816-decoder.test.ts
npx ava tests/vscode-debugger.test.ts
```

Tests should be deterministic, hermetic by default, and safe to run concurrently. Use
`fs.mkdtempSync()`/`fs.mkdtemp()` under `os.tmpdir()` for generated projects and remove the exact
temporary directory in `finally` or test teardown. Never write a user ROM, emulator runtime, or
generated analysis project into a publishable package.

The fuzz suite is deterministic:

```sh
npm run test:fuzz
UTTORI_FUZZ_SEED=123456789 npm run test:fuzz
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
5. Run the architecture test, `npm run test:fuzz`, and `npm run test:roundtrip`.

65816 is the primary processor; SPC700 and SuperFX use the same reversible-contract standard.

### Add a project schema field

1. Decide which existing shard owns the fact. Do not add a shard merely for convenience.
2. Add a stable, JSON-safe type and validation at load and write boundaries.
3. Update canonical ordering when the field affects deterministic output.
4. Add an explicit one-way migration if an older persisted schema needs transformation.
5. Reject future versions; never downgrade them.
6. Test malformed input, deterministic rewrite, missing evidence/address spaces, and ROM-payload
   exclusion.
7. Document merge and recovery behavior.

The manifest is the only active commit pointer. Preserve manifest-last publication and immutable
content-addressed generations.

### Add an analysis rule

1. Put generic traversal behavior in `@uttori/asm-disassembler`; put processor semantics in the
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
4. Translate separately in each emulator sidecar; do not expose native command names above it.
5. Map the neutral operation to DAP and VS Code only after the backend behavior is proven.
6. Test deadlines, queue/buffer limits, replayed sequences, child loss, reconnect, and reduced
   capabilities.

Never put the session token on a command line or allow an emulator to write protocol stdout.

### Add a VS Code feature

Keep data derivation in a target-neutral or target package and presentation in the extension.
Commands that write a project require Workspace Trust and must use the transaction/edit APIs.
Read-only inspection may remain available in a restricted workspace. Source navigation requires an
exact target, ROM identity, and current source hash; otherwise use explicit virtual disassembly or
persisted records without mapper inference.

Run unit/contract tests, `npm run vscode:typecheck`, `npm run vscode:package`, and
`npm run vscode:smoke`. The last command downloads a pinned VS Code build once and launches a real
isolated Extension Development Host.

### Change a performance-sensitive path

Read [Disassembler performance baselines](docs/disassembler-performance.md) before editing. Preserve
the inline `Performance invariant`, `Security invariant`, and `TOCTOU invariant` comments. Add or
update semantic tests first, then run the focused benchmark and compare the complete distribution,
not one favorable measurement. Only the matching Apple M1 Max host may enforce the checked-in M1
budget; other machines collect observations without pretending to satisfy that policy.

## Fixtures, licenses, and private material

All repository code is MIT unless a notice says otherwise. Do not copy GPL implementation code into
an MIT package. GPL projects may be used as external executables, separately maintained patches,
read-only oracles, or test fixtures under their own licenses. Reimplement behavior from documented
formats and observed contracts; preserve notices for distributed native artifacts.

The following never belong in a commit, npm tarball, VSIX, test snapshot, benchmark report, or issue:

- commercial ROM bytes or extracted copyrighted assets;
- files from `Local Only/`;
- session tokens, private runtime manifests, or machine-specific credentials;
- generated analysis/source trees derived from a private ROM; or
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

- package README: public API and end-user behavior;
- `docs/disassembler-architecture.md`: system boundaries and invariants;
- `docs/testing-and-release.md`: commands, CI, fixtures, and release evidence;
- ADR: a durable decision with alternatives and consequences.

Say “implemented”, “locally passed on macOS”, and “passed hosted matrix” only when each is true.
Never infer a Windows/Linux, native runtime, semantic completeness, or performance claim from a
TypeScript unit test.

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
rerun it; its cleanup helper removes only the explicit generated `dist` directories.

If VS Code smoke testing fails before launch, confirm network access and remove only the incomplete
version directory beneath `.vscode-test/`; do not delete the whole repository or a user VS Code
profile. Linux needs `xvfb-run` in headless environments.

If a project write reports stale or locked state, reload it. Do not remove a live project lock. Read
[Conflict-safe edits and recovery](packages/disassembler/README.md#conflict-safe-edits-and-recovery)
before recovering interrupted writes.

If an external fixture is skipped, run `npm run fixtures:status`. The output identifies the missing
submodule, local ROM, hash, or tool without requiring every optional fixture.

If a package audit includes an unexpected file, fix its `files`/ignore configuration or generated
path. Do not relax the ROM/native-payload rejection rule to make the audit pass.
