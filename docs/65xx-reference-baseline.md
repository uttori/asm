# 65xx reference baseline

Recorded on 2026-08-25 before the Phase 1 core-boundary implementation.

## Verification baseline

The pre-change `npm run verify` gate passed, including formatting, lint,
boundaries, type checks, builds, tests, coverage, LSP checks, and VS Code checks.
The production byte and hash gates remain defined by
`docs/plugin-migration-baseline.md` and `scripts/benchmark-goldens.json`.

The post-change Phase 1 verification passed:

- `npm run verify`;
- `npm run fixture:asar` (60 passed, 0 failed);
- `npm run fixture:slideshow`;
- `npm run fixture:chou`;
- `npm run benchmark:smoke`.

The slideshow, Chou Makaimura, instruction-encoding, include-once, macro, and
Super Mario RPG outputs matched their expected byte counts and SHA-256 hashes.
Any future changed SNES hash is a regression unless separately reviewed and
recorded.

## Pinned executable references

| Reference | Pin | License | Permitted role |
| --- | --- | --- | --- |
| 6502js | `ab8662b06321dd6281b9f091ee02b57d7494172c` | GPL-3.0-only | Black-box behavioral oracle and independently authored byte fixtures only |
| ca65 | release `V2.19`, commit `555282497c3ecf8b313d87d5973093af19c35bd5` | Zlib | Differential assembly oracle and independently authored byte fixtures |
| ca65 Phase 4/5 snapshot | release `V2.19`, commit `e11fb5c39371046ebe25485f984f644c5a0d65d3`, `instr.c` SHA-256 `bcd36f022a3534355285346d6a4149563a21f17c72b614d91e381d19d68e5a9d` | Zlib | CMOS, Commodore, and MEGA65 declarative tables and 1,680-form differential fixture |
| ca65 Phase 6 snapshot | release `V2.19`, commit `e11fb5c39371046ebe25485f984f644c5a0d65d3`, `instr.c` SHA-256 `bcd36f022a3534355285346d6a4149563a21f17c72b614d91e381d19d68e5a9d` | Zlib | HuC6280 and M740 declarative tables and 500-form differential fixture |

The same values are recorded in
`plugins/65xx/tests/fixtures/reference-manifest.json` so fixture generators
and future differential tests can reject an unpinned tool.

The Phase 6 fixture records 254 HuC6280 forms and 246 M740 forms. Its expected
binary hashes are `22fa7b2e54c7625b457e2320802856eb2e3844a4878648948d1e8a8b3b03903a`
and `556994727ab69e3b16aa0e24a1236004a50357d3d2194c9345a104a93e8324f9`
respectively.

The checked-out `6502js/` directory is reference material, not product source.
Its assembler implementation must not be copied, translated, or linked into
this MIT-licensed repository. Expected bytes and edge cases may be derived by
running it and then expressed as independently authored fixtures with source
provenance. ca65 fixtures must record both the release and full commit because
the V2.19 binary identifies itself using the underlying Git revision.

Easy 6502 and mass:werk are explanatory cross-checks, not executable golden
authorities. Official processor documentation should resolve hardware
ambiguities; ca65 compatibility choices must be identified as compatibility
policy rather than hardware truth.

## Production identity contract

The sole package identity is `@uttori/asm-plugin-65xx`. Contributions use the
`65xx.*` namespace: target `65xx.raw`, address space `65xx.flat16`, output format
`65xx.raw-output`, and the architecture IDs documented in the implementation
plan. Encoding-equivalent chip aliases such as `6510` are CPU names, not
compatibility modes.

## Fixture provenance rule

Every generated reference fixture must record the reference ID, exact pin,
input source, selected CPU, command-line/profile options, expected bytes or
diagnostic, and whether the result was independently cross-checked. A
differential mismatch must be classified as an implementation bug,
intentional syntax difference, known reference behavior, or hardware
ambiguity; expected output must not be silently updated.

One deliberate forward-compatibility difference is recorded for Phase 3: the
current ca65 guide documents optional `BRK` signature operands, while the pinned
V2.19 executable rejects those addressing forms. The 65xx native profile
accepts them declaratively; the 221 canonical opcode-form fixture remains
byte-for-byte V2.19-compatible.
