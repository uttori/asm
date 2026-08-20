# Plugin migration behavioral baseline

Recorded on 2026-08-19 before Phase 1 structural changes.

## Verification gates

All required Phase 0 gates passed:

- `npm run verify`: 785 tests passed; coverage, LSP typecheck, and VS Code typecheck passed.
- `npm run fixture:asar`: passed.
- `npm run fixture:slideshow`: passed.
- `npm run fixture:chou`: passed.
- `npm run benchmark:smoke`: passed.

The assembler session-isolation invariant is covered by
`tests/target-profile.test.ts`: build and tooling sessions create distinct
architecture encoder instances.

## Production fixture outputs

These production hashes are enforced by `scripts/benchmark-goldens.json`.

| Fixture | Bytes | SHA-256 |
| --- | ---: | --- |
| Chou Makaimura | 1,048,576 | `514cfb608ef9107739795623973f18ff3aea48eb6c7509e63f957edd10e52378` |
| Slideshow | 284,838 | `c7ea4199d910ac74ba6bcd8f5abc4f7d284c47105d78de50c36fed6322bfc3ee` |
| Macro variadic | 29 | `80f7453995137cd980dac46f9c0378d1338d3c1d8aa163fee6ca505234d1db19` |
| Include once | 7 | `32bbe378a25091502b2baf9f7258c19444e7a43ee4593b08030acd790bd66e6a` |
| Instruction encoding | 614 | `1f76d7bd6d06ab30c090daa6a5f3555c4bdcc8c8084871880b4caa403326b730` |

## SNES subsystem fixture outputs

The complete Asar expected-output directory remains the exhaustive byte-parity
baseline. These focused entries make the extraction-critical subsystems easy to
audit during the migration.

| Subsystem fixture | Bytes | SHA-256 |
| --- | ---: | --- |
| Architecture switching | 9 | `0cff7484ae296fd754d93fe8baf7cca5cc9c8dc19eeb4ced3ad0138d1d846336` |
| Mapper selection | 7 | `1451445a75fb813264797b72ba0d693e92138b1901c407fc049ee0cbc5f23dad` |
| Header/checksum (`fastrom`) | 1,048,576 | `58c9e38c33b7c12b2488c9b62b2dad293ca65b7be5fd8b0d7e30f01fe029c116` |
| SPC block | 25 | `181b6400dae6a8f6f8460f18a89dcf8bab60b559d76413db2d58e2b37389a9f7` |
| Inline SPC | 11 | `a26a7cd0813610f27e45d1d44f36024df0d52bc6ec4a1ce09c9b1de890350f6c` |
| SA-1 freespace/RATS | 1,048,576 | `67cda9808841f7e4f619f75a4d094ed0f1ba72260c5e58936c1d0da216f80dc7` |
| Aligned freespace/RATS | 1,048,576 | `3e31ab3bc56d9568d15f5d16b52d3fc3e80d14008094679d6ead2e0b88add7e9` |
| Autoclean/RATS | 1,048,576 | `f5d05bb2dfb500d25022df609b03c022d01447b5ed3b6153973a02aef16db721` |
| 65816 catalog/encoding | 601 | `c549f82dc1a781859c5c5b73965d056b1c75fa097bc18a49f403d42a14d4ca57` |
| SPC700 catalog/encoding | 519 | `45f04f331b4b111d41f126ba96945e8cfa27be094ceb64c29b08be25b9c08563` |
| Super FX catalog/encoding | 1,106 | `b0734cd1bee2f7355ac2e20175608076c4f89d567bd42c88c8b546b7729d4e9c` |
