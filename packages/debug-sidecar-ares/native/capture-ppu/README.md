# Native PPU effect capture

This downstream development patch adds the separately negotiated
`snes.cpu-bus-ppu` stream. It includes the existing bus and transfer records and
attaches actual PPU write decisions to graphics data-port writes. See the
[protocol, behavior and performance notes](../../../../docs/ares-ppu-effect-capture.md).

Apply `capture-ppu.patch` after `capture-v2`, `capture-bus`, `capture-transfer`,
and the test-only `capture-graphics/graphics-tests.patch`, on
`be548251b537334f4f2054c7d86171da22fdc6ca`. `source.json` pins the patches and
nine resulting source files. `capture.hpp`, `bus-test.cpp` and `benchmark.cpp`
are exact copies of the native sources, for standalone framing checks and review.

```sh
git apply --check /absolute/path/to/capture-ppu.patch
git apply /absolute/path/to/capture-ppu.patch
sh /absolute/path/to/capture-ppu/run-tests.sh /absolute/path/to/ares/build
sh /absolute/path/to/capture-ppu/check-wire.sh
cmake --build /absolute/path/to/ares/build --target gdb-capture-ppu-benchmark
sh /absolute/path/to/capture-ppu/benchmark.sh /absolute/path/to/ares/build /tmp/ppu-bench /absolute/path/to/baseline-benchmark
```

The tests use the existing CMake/CTest bus-capture target and real CPU/PPU
coroutines. The shell framing check needs only C++17. Native tooling adds no
Node dependency. The benchmark requires the configured ares build; an optional
`PPU_BENCHMARK_EXECUTABLE` overrides the executable path for multi-configuration
builds. Baseline means the same benchmark linked against the parent patches.
It omits the unavailable new scope. Alternating before/after run order provides
ten measured samples per case after discarding each run's first warmup sample.

Rendering tests replay ordered physical writes into an initial memory image and
compare every byte with the actual PPU. Capture-on/off runs start from the same
serialized machine and must finish with identical serialized state. Both PPUs,
64/128 KiB VRAM, CPU/DMA/HDMA, forced blank, active rendering, vblank, mirrored
ports, paired latches and duplicate OAM writes are covered. Existing save/load,
stop/abort/rearm, transfer-boundary and million-event queue checks remain active.
The fixed-table CRC is checked against the independent bitwise reader.

`native-evidence.json` records the tested files and executables. The separate
`Local Only/ares-capture-ppu-desktop-runtime` candidate is signed and manifest
verified; upstream `fixtures/external/ares` and runtime defaults are unchanged.
