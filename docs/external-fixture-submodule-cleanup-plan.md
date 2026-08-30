# External Fixture Submodule Cleanup Plan

## Decisions

- Use normalized paths under `fixtures/external/<name>`.
- Point submodules directly to upstream repositories and pin exact commits.
- Keep the TMNT-compatible SNES framework in `fixtures/assets/`.
- Leave `fixtures/integration/snes-slideshow/` and its entire history unchanged.
- Run external fixtures as a separate local and GitHub CI suite.
- Rewrite only `master`.
- Codex will not create commits, rewrite commits, or force-push.

## Proposed layout

```text
fixtures/
  assets/
    snes-rom-framework-v1.4.0/
      LICENSE
      UPSTREAM.md
      Global/
  external/
    chou/
    smrpg/
    tmnt/
    yoshi/
    zelda/
  integration/
    snes-slideshow/    # unchanged
  fixture-manifest.ts

Local Only/
  fixtures/
    roms/
    worktrees/
```

The framework should be copied, rather than symlinked, into a temporary TMNT workspace. This is more portable across macOS, Linux, Windows, and GitHub runners. Preserve its upstream license and provenance separately from the repository's MIT-licensed production code.

## Current-state findings

| Fixture | Current state | Important complication |
| --- | --- | --- |
| Chou | 474 regular files tracked by the parent repository | The vendored tree does not match the current upstream repository. Its upstream revision must be selected by compatibility testing, not assumed. |
| Yoshi | Git link at `fb79f7994fb19146de35c02fb98fee8af5877372` | There is no `.gitmodules`, so fresh clones cannot initialize it. The ignored `yi.sfc` is only needed for debugging and diffing. |
| SMRPG | Git link at `57cb707669d71bb55817a0f88d28b3018c8bec57` | Requires roughly 1,279 ROM-derived asset files locally. Current extraction dirties the nested repository and writes a temporary `Engine.bin` into it. |
| TMNT | Git link at `b80a727f536acb04062284678e448260cebce90b` | The upstream commit contains only 27 files. The local tree has about 1,099 staged additions, including extracted assets and 65 framework files. A clean upstream checkout cannot run the fixture by itself. |
| Zelda | Untracked nested clone at `50a1c869a8d8e2eb8b5b60acea325f44b4341762` | Requires the original NES ROM to derive omitted `dat` files. The current test uses that ROM as both input and oracle and has no fixed expected SHA-256. |
| Other | `editors/language-65asm` is also an unmapped Git link | The new `.gitmodules` must describe this existing submodule or repository-wide submodule commands will remain broken. |

Parent `.gitignore` rules do not control files generated inside initialized submodules. Hiding dirty submodules with `ignore = dirty` would mask real source changes, so generated assets should instead be produced in temporary or local workspaces.

## Canonical fixture manifest

Create one checked-in TypeScript manifest consumed by tests, benchmarks, extraction scripts, and diagnostics. This removes duplicated constants and golden-file reads.

| Fixture | Expected bytes | Expected SHA-256 |
| --- | ---: | --- |
| Chou | 1,048,576 | `514cfb608ef9107739795623973f18ff3aea48eb6c7509e63f957edd10e52378` |
| Yoshi | 2,097,152 | `9b4957466798bbdb5b43a450bbb60b2591ae81d95b891430f62d53ca62e8bc7b` |
| SMRPG | 4,194,304 | `740646f3535bfb365ca44e70d46ab433467b142bd84010393070bd0b141af853` |
| TMNT | 1,048,576 | `5b82cdd6f2da56f43680d6a5021faebe2e06036d30602c1a7917aa414cf8b5f4` |
| Zelda | 131,088 | `8f72dc2e98572eb4ba7c3a902bca5f69c448fc4391837e5f8f0d4556280440ac` |

The manifest should separately describe:

- Submodule path and required entrypoint.
- Expected output size and SHA-256.
- Required local ROM filename, size, and input hash where applicable.
- Required extracted-asset sentinels.
- Setup instructions and whether a fixture is self-contained.
- Any additional source dependency, such as TMNT's framework revision.

Input ROM hashes must be checked before extraction so the wrong revision cannot create confusing parity failures.

## Implementation phases

### 1. Select and validate source revisions

- Preserve the existing SMRPG, TMNT, and Yoshi Git-link revisions as initial candidates.
- Use Zelda's current `50a1c869a8d8e2eb8b5b60acea325f44b4341762` revision as its initial candidate.
- Test Chou revisions until one reproduces the canonical JP hash. The current vendored `Chou.asm` blob was not found in the inspected upstream history, so there may be no exact historical match.
- Record the chosen upstream URLs and exact commits in review notes in addition to the Git links.

### 2. Repair submodule metadata and normalize paths

Add `.gitmodules` entries for:

- `fixtures/external/chou`
- `fixtures/external/smrpg`
- `fixtures/external/tmnt`
- `fixtures/external/yoshi`
- `fixtures/external/zelda`
- Existing `editors/language-65asm`

Use these upstream repositories:

- Chou: `https://github.com/FredYeye/Super-Ghouls-n-Ghosts-Disassembly.git`
- SMRPG: `https://github.com/Yoshifanatic1/Super-Mario-RPG-Disassembly.git`
- TMNT: `https://github.com/Yoshifanatic1/TMNT-IV---Turtles-In-Time-SNES-Disassembly.git`
- Yoshi: `https://github.com/brunovalads/yoshisisland-disassembly.git`
- Zelda: `https://github.com/aldonunez/zelda1-disassembly.git`
- Existing editor submodule: `https://github.com/MatthewCallis/language-65asm`

Use HTTPS URLs, exact Git-link commits, and no branch tracking or dirty-state suppression.

- Remove the old mixed-case and long fixture Git-link paths and add normalized links.
- Do not initialize submodules automatically during `npm install`.
- Document targeted initialization for individual fixtures.
- Add a read-only `fixtures:status` command that reports:
  - uninitialized submodule;
  - wrong pinned commit;
  - missing local ROM;
  - wrong ROM hash;
  - missing extracted assets;
  - dirty submodule.

### 3. Add the framework asset

- Add the compatible SNES framework source under `fixtures/assets/snes-rom-framework-v1.4.0/`.
- Include its upstream license and an `UPSTREAM.md` containing the source URL, revision, version, and imported-file scope.
- Retain only the framework files required by the TMNT fixture.
- Do not include ROM-derived assets or unnecessary executables.
- Copy the framework into the temporary TMNT workspace during preparation rather than modifying the TMNT submodule.

### 4. Introduce a shared fixture runner

Implement a shared helper used by integration suites and benchmark scripts.

Its behavior should be:

- Detect whether the requested submodule and prerequisites are present.
- Fail with actionable setup instructions when a fixture-specific command is invoked.
- Compare assembled output directly against manifest size and hash, never against a checked-in ROM.
- Use `os.tmpdir()` for generated files and clean up in `finally` or `after.always`.
- Support a debugging flag that preserves the prepared tree under `Local Only/fixtures/worktrees/`.
- Validate that parent and submodule worktrees remain clean after execution.

Normal `npm test` should not discover the external-fixture suite. The external tests should use a separate AVA profile or filename pattern rather than silently skipping within the ordinary suite.

Proposed commands:

```text
npm run fixtures:status
npm run test:external
npm run ci:external
```

`ci:external` should run strict preflight, all requested external tests serially, and a final clean-worktree check.

### 5. Migrate each fixture

#### Chou

- Delete the parent-tracked vendored tree and replace it with the selected upstream submodule.
- Remove all reads of `chou.sfc`, `Chou.sfc`, and the zero-byte `test.sfc`.
- Compare assembled output to the manifest hash.
- Move `uttori-asm.config.json` outside the submodule and materialize or reference it for local debugging.
- Remove the current macOS-only case-insensitive reliance on `chou.sfc` versus `Chou.sfc`.

#### Yoshi

- Relocate the existing Git link to `fixtures/external/yoshi`.
- Remove the `yi.sfc` dependency from normal tests and diff defaults.
- Keep optional diff support by accepting a ROM path from `Local Only/` or an explicit CLI argument.

#### SMRPG

- Keep the submodule checkout read-only.
- Validate the local SMRPG ROM before extraction.
- Copy the tracked source tree to a temporary prepared workspace.
- Extract assets and generate `Engine.bin` in that workspace.
- Assemble and compare the result to the manifest hash.
- Never leave derived files in the submodule checkout.

#### TMNT

- Keep the upstream TMNT submodule read-only.
- Copy its source and the local framework asset into a temporary workspace.
- Validate the local TMNT ROM before extraction.
- Extract assets and generate transient SPC files in the temporary workspace.
- Assemble and compare the result to the manifest hash.
- Do not preserve or reproduce the current staged files inside the submodule.

#### Zelda

- Add the current nested clone as a proper optional submodule.
- Read the original ROM from `Local Only/`, validate its fixed hash, and extract omitted data into a temporary workspace.
- Compare the assembled image against the fixed manifest hash.
- Remove the pattern where the supplied ROM acts as both input and sole expected result.

### 6. Update commands, tests, and documentation

- Move both assembler external integration suites into the separate external-test profile.
- Change benchmarks so ordinary smoke benchmarks do not require external submodules.
- Preserve explicit Chou and SMRPG benchmark commands, but make missing prerequisites a clear error.
- Update `scripts/diff.ts`, `run-chou.ts`, extraction scripts, and the LSP indexing benchmark to use normalized paths.
- Remove duplicated fixture correctness hashes from `scripts/benchmark-goldens.json` or derive them from the central manifest.
- Replace the hard-coded `/Users/matthew/.../fixtures/integration/chou` path in `tests/language-server-build.test.ts` with a portable synthetic or project-relative path.
- Separate core verification gates from external-fixture verification in the README.
- Document legal ROM provisioning without download links.
- Leave `fixtures/integration/snes-slideshow/`, its files, tests, path, and history unchanged.

## GitHub CI design

Create `.github/workflows/external-fixtures.yml` with two jobs.

### Portable external fixtures

Run Chou and Yoshi on GitHub-hosted runners:

- Trigger on pull requests, pushes to `master`, and manual dispatch.
- Initialize only the Chou and Yoshi submodules.
- Run their correctness tests without local ROMs.

### ROM-dependent external fixtures

Run SMRPG, TMNT, and Zelda, and preferably the full five-fixture suite, on a dedicated self-hosted runner:

- Trigger on pushes to protected `master`.
- Allow manually approved `workflow_dispatch` runs for reviewed branches.
- Never trigger automatically from fork pull requests.
- Mount the local ROM directory read-only.
- Give `GITHUB_TOKEN` only `contents: read`.
- Do not cache or upload ROMs, extracted assets, or prepared workspaces.
- Use a dedicated and isolated runner with no unrelated credentials or network access.

GitHub warns that untrusted pull-request code can compromise persistent self-hosted runners, especially for public repositories. The ROM-backed job therefore must not execute arbitrary pull-request code automatically.

## Master-only history rewrite

Only purge the old parent-tracked Chou tree from `master`. Slideshow and every other branch and tag remain untouched.

This must be an owner-run operation because it creates rewritten commits and requires force-pushing. Codex should only prepare a reviewed runbook and verification commands.

Owner-run outline:

1. Create a private backup bundle or mirror.
2. Use `git filter-repo` with `--refs refs/heads/master` and remove the historical `fixtures/integration/chou/**` path.
3. Verify `git rev-list --objects master` no longer contains that path.
4. Apply the new `.gitmodules`, normalized Git links, fixture runner, tests, and documentation.
5. Run the complete validation matrix.
6. Have the owner create and sign the migration commit.
7. Force-push only `master`.

Important limitations and consequences:

- Other branches and tags continue to retain the old Chou objects.
- Repository-wide `git rev-list --objects --all` will still find those objects.
- The rewrite does not provide repository-wide removal or meaningful object-size reduction.
- Old branches have divergent ancestry and must be rebased or cherry-picked before merging into rewritten `master`.
- Existing tags and releases remain unchanged.
- Open pull requests based on old `master` must be recreated or rebased.
- Branch protection may need a temporary force-push exception.
- Old objects can remain in forks, caches, local clones, and hosting retention systems.

The acceptance criterion is that the files are absent from rewritten `master` history, not from every Git object or reference.

## Validation gates

- An ordinary clone without submodules passes normal tests and verification.
- `.gitmodules` resolves all six Git links.
- Portable external CI passes Chou and Yoshi on GitHub-hosted Linux.
- Full external CI passes all five fixtures on the trusted self-hosted runner.
- ROM-dependent tests reject missing or incorrectly hashed ROMs.
- Fixture runs leave the parent repository and every submodule clean.
- No external golden ROM is read from an external submodule directory.
- Chou, Yoshi, SMRPG, TMNT, and Zelda output hashes match the central manifest.
- Slideshow files, paths, tests, and history remain unchanged.
- `git rev-list --objects master` contains no former vendored Chou files.
- Fresh case-sensitive Linux clones do not rely on filename-case behavior.
- Workspace package tarballs do not contain external fixture sources or ROMs.
- No commits, history rewrites, or force-pushes are performed by Codex.
