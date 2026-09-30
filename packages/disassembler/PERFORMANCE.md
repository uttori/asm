# Disassembler performance checks

Run benchmark commands from the repository root. The default suite creates deterministic
512 KiB, 2 MiB, and 4 MiB LoROM fixtures in memory. No game data is required.

```sh
npm run benchmark:disassembler -- --fast
npm run benchmark:disassembler -- --json /tmp/disassembler-local.json
```

The full suite defaults to one warmup and five measured repetitions. Use `--warmups`,
`--repetitions`, `--fixture`, and `--operation` to isolate a comparison. Fixture and operation
lists are comma-separated.

## Measured operations

- Conservative 65816 analysis and native-source export.
- Canonical project serialization and hash-validated loading.
- Coverage and instruction-annotation projection.
- Transaction preparation, atomic commit, and exact edit undo.
- Instruction-trace validation, aggregation, and evidence merge.
- Backend-event translation through the Debug Adapter Protocol session.

Each repetition runs in a fresh Node process with `--expose-gc`. Fixture preparation happens
outside the timed boundary, followed by one requested garbage collection. Reports retain
baseline/end RSS and heap measurements, signed deltas, and the larger boundary sample.
`boundaryMax*` measures retained memory at those boundaries, not an in-operation peak.

## Release budgets

```sh
npm run benchmark:disassembler -- --warmups 0 --repetitions 3 --budgets docs/performance/disassembler-budgets-macos-arm64.json --summary-only
```

The release gate uses a versioned policy and three measured repetitions. It rejects a different
platform, architecture, Node major, or CPU model instead of applying one host's observations to
another. A new supported benchmark host needs its own retained report and reviewed policy.

After reviewing and accepting a new baseline, regenerate the policy with:

```sh
node --conditions=uttori-source --import=tsx scripts/derive-disassembler-budgets.ts docs/performance/disassembler-macos-arm64-2026-09-03.json docs/performance/disassembler-budgets-macos-arm64.json
```

Wall-time budgets use the greater of baseline p95 plus 50% or p95 plus 20 ms, rounded up to a
millisecond. RSS budgets use the greater of baseline maximum plus 15% or plus 64 MiB, rounded up
to 16 MiB. The policy records the report path and SHA-256. Measured reports record the policy and
source-report hashes. Ad hoc command-line thresholds cannot silently redefine the gate.

Compare like with like: Node version, OS, architecture, CPU, fixture, operation, warmup count,
repetition count, and memory-sampling mode. Retained benchmark observations are internal research,
not universal latency promises. Preserve canonical bytes and analysis meaning when optimizing.
Use isolated comparisons and the [testing guide](https://github.com/uttori/asm/blob/master/TESTING.md#performance-gates)
for correctness and release expectations.

## Optional local ROM probe

`npm run benchmark:disassembler -- --fast --fixture secret-of-mana` uses the locally supplied Secret of Mana ROM and `.dizraw`
fixtures. It validates expected size/hash, creates temporary project/source data under the OS
temporary directory, and removes it after each operation. Reports exclude the private inputs,
their paths, and content hashes. This probe is separate from redistributable release fixtures.
