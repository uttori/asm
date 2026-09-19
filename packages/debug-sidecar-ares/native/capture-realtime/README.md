# Realtime capture and native stage profiling

Apply `capture-realtime.patch` after the six layers documented by
[capture-file](../capture-file/README.md), on base
`be548251b537334f4f2054c7d86171da22fdc6ca`. `source.json` pins the resulting five
files and parent patch. Four standalone copies match those sources exactly.

The producer uses ARM CRC32C or x86-64 SSE4.2 intrinsics only when the compiler
target promises those instructions. Other targets retain the portable
Castagnoli implementation. Both paths emit the same ACT2 bytes; the independent
bitwise test reader checks full chunks and all fetched-length tails.

Native `start` accepts an optional final `:profile` field. File status then includes
`fileProfile` with decimal nanosecond counters: `sealNs`, `copyNs`, `writeNs`, and
`syncNs`. Sealing includes envelope generation and CRC; copying includes ACK2
encoding and excludes nested sealing. Writer timings cover data batches, excluding
header/footer setup. Writer spans overlap emulation and cannot be added as wall
percentages. Profiling reads clocks per chunk/batch, never per bus access. Its
thread-local producer counters preserve the Capture/Server object layout.

The four-chunk batch, durable acknowledgement, publication and memory budget are
unchanged. Live analysis is implemented in the consumer, not in emulator hooks.

```sh
sh packages/debug-sidecar-ares/native/capture-realtime/check-wire.sh
sh packages/debug-sidecar-ares/native/capture-realtime/run-tests.sh /path/to/ares/build
cmake --build /path/to/ares/build --target gdb-capture-ppu-benchmark
sh packages/debug-sidecar-ares/native/capture-realtime/benchmark.sh /path/to/ares/build /tmp/realtime-bench
```

Tests and native benchmark runners use C++/CMake/shell. The shell wire check
compiles target-native and forced-portable variants; CTest adds a portable case
beside the existing ownership, failure, paused-state and both-PPU tests.

See [validation evidence](native-evidence.json) and
[live analysis and its limits](../../CAPTURE.md#live-bus-analysis).
This is an opt-in development runtime; no default promotion or upstream PR is included.
