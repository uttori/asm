# Native capture path benchmarks

`run.sh` builds standalone C++17 benchmarks against the source-pinned
[realtime producer and file sink](../capture-realtime/source.json). It does not
edit the emulator checkout or install a runtime.

```sh
sh packages/debug-sidecar-ares/native/capture-benchmark-audit/run.sh /tmp/ares-native-audit
```

`producer.cpp` measures all fetched instruction lengths, five bus phases,
DMA/HDMA/interrupted boundary encoding and PPU effect branches. Each is measured
with a direct native-memory drain and the hex command path, in both target-native
and forced portable CRC builds. It excludes emulator execution, disk and TCP;
boundary-only streams deliberately isolate marker encoding without payloads.

`writer.cpp` measures normal file I/O, held sync, sync failure and cancellation
using existing test-only hooks. It verifies bounded occupied memory, no premature
acknowledgement, incomplete publication on failure and the release handshake.
The synthetic 100 ms hold models an in-progress blocking operation, not a
particular storage device's latency distribution.

Each configuration has one in-process warmup and three measured samples.
Assertions stay enabled. Output includes raw runs, stage timings, source hashes
and compiler identity. Sources are compiled with `-O2 -march=native`; no shell
runner or native test depends on JavaScript. On macOS SDK setups requiring an
explicit standard-library include path, set `CPLUS_INCLUDE_PATH` to the SDK's
`usr/include/c++/v1` directory before invoking the runner.

See [capture workflows and limits](../../CAPTURE.md). Local benchmark results do not
establish realtime behavior for other workloads or platforms.
