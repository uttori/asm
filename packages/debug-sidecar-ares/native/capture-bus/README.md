# Native CPU / DMA / HDMA capture

First native increment of the [DMA/HDMA capture work](../../../../docs/ares-dma-hdma-capture.md).
This source supplement extends the existing downstream capture-v2 producer with
a separately negotiated bus scope. No emulator executable or editor default is
replaced, and the prepared upstream series is unaffected.

Apply `capture-bus.patch` after `../capture-v2/capture-v2.patch` on rich maintenance
revision `be548251b537334f4f2054c7d86171da22fdc6ca`. `source.json` pins both input
patches and every changed source file. The maintained checkout is
`Local Only/ares-rich-state-load-fix`. The current checkout additionally contains
the separately pinned [transfer-boundary supplement](../capture-transfer/README.md);
this bus-only package and its original wire fixture remain reproducible with the
two patches above.
The original instruction-only source package and staged runtime remain pinned to
their original identities.

```sh
git apply --check /absolute/path/to/capture-bus.patch
git apply /absolute/path/to/capture-bus.patch
tests/gdb-capture/run-tests.sh /absolute/path/to/configured/ares/build
```

The shell launcher uses the existing ares CMake/CTest build. It builds both native
capture targets and the paused-state target, then runs their tests. Set
`CONFIGURATION` for a multi-configuration generator. On the local Command Line
Tools host, use
`CPLUS_INCLUDE_PATH=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1`.
No Node or JavaScript harness is introduced.

`bus-test.cpp` is a reviewable copy of the actual-core test in the patch. It
validates ACT2 framing, CRC, event order, timestamp order, byte values, actor and
channel identity, retry-stable reads and acknowledgements. The small buffer gate
forces a million-event DMA transfer to suspend and drain repeatedly. Existing
instruction capture and save/load tests remain enabled, with assertions active
after nall's build-mode headers.

`check-wire.sh` compiles and runs the standalone C++17 `wire-test.cpp`. Its stdout
contains native capability/start replies, one full bus chunk, a stopped tail and
the terminal position, consumed by the TypeScript adapter's interoperability test.
This fixture supplements the actual-core CMake tests without requiring Node to
build or run native checks. It does not change the pinned source patch.

The scoped archive reader/writer, sidecar and editor mode are now implemented.
`sidecar-evidence.json` records the synthetic desktop integration check through
the actual bundled sidecar and DAP recorder, including a long DMA instruction step
and direct/indirect HDMA. `sidecar-slow-evidence.json` adds a deliberately delayed
consumer; `instruction-compatibility-evidence.json` verifies the existing instruction
archive and JSON workflow on the same executable. A separately staged development runtime lives at
`Local Only/ares-capture-bus-desktop-runtime`; it carries both capture patches and
verified binary/resource hashes. Existing launch defaults are unchanged.

The private bus wire dictionary, reserve argument, save/stop semantics and
remaining import/performance work are documented in the linked design note. These
changes are distributed with the ares/nall source and notices; this supplement
does not relicense emulator code.
