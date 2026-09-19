# Native DMA / HDMA boundaries

This downstream supplement adds the explicitly negotiated `snes.cpu-bus-transfers`
scope. It preserves the instruction and bus-only protocols. Apply
`capture-transfer.patch` after `../capture-v2/capture-v2.patch` and
`../capture-bus/capture-bus.patch` on revision
`be548251b537334f4f2054c7d86171da22fdc6ca`.

`source.json` pins all three patches and the four modified source files. The
maintained checkout is `Local Only/ares-rich-state-load-fix`; `GDB_SNES` is unchanged.
`capture.hpp` and `bus-test.cpp` are exact reviewable copies of the patched sources.

```sh
git apply --check /absolute/path/to/capture-transfer.patch
git apply /absolute/path/to/capture-transfer.patch
sh /absolute/path/to/capture-transfer/run-tests.sh /absolute/path/to/ares/build
sh /absolute/path/to/capture-transfer/check-wire.sh
```

The launcher uses the existing CMake/CTest targets. The native tests remain C++
and shell, including the standalone C++17 wire fixture. On the local Command Line
Tools host set
`CPLUS_INCLUDE_PATH=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1`.

`native-evidence.json` records the tested source and executable hashes. Coverage
includes all DMA modes/directions/address policies, HDMA table/indirect/repeat
behavior, nested HDMA preemption, 1,048,576 accesses plus sixteen markers through
two slots, exact capture-on/off state equality, stopping during a transfer and
rearming with an unpaired end instead of a stale session ID. Existing instruction
and paused-state tests also pass with both PPU implementations.

`sidecar-evidence.json` and `sidecar-slow-evidence.json` exercise the isolated
desktop runtime through the bundled sidecar, DAP recorder, archive decoder and
neutral transfer importer. The delayed run adds 15 ms before each capture read.
The original synthetic ROM uses DMA channel 0 and direct/indirect HDMA channels
1/2; no user ROM or launch settings are changed.

The separately staged development candidate is
`Local Only/ares-capture-transfer-desktop-runtime`. Select
`asm.debug.traceMode: "lossless-bus-transfers"` with that runtime and import the
saved ACT2 archive using **Import Bus Capture and Show DMA/HDMA Activity**.

See [the capture guide](../../CAPTURE.md#explicit-transfer-boundaries)
for partial-window rules and retention limits. This
increment establishes transfer evidence, not realtime throughput or internal
VRAM/CGRAM/OAM destination reconstruction. Linux and Windows remain unverified.
