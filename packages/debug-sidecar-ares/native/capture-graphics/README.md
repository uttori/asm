# Graphics port reconstruction oracle

This test-only supplement checks the consumer's PPU port interpretation against
actual ares memory readback. It does not change the native capture protocol,
production hooks, or the staged capture-transfer runtime.

Apply `graphics-tests.patch` after the instruction, bus and transfer supplements
described in [capture-transfer](../capture-transfer/README.md). It adds the
`gdb-capture-graphics` target to the existing optional C++/CMake capture tests.
The source and parent patch hashes are in [source.json](source.json).

```sh
git apply /path/to/capture-graphics/graphics-tests.patch
# Configure ares with ARES_BUILD_OPTIONAL_TARGETS=ON and the sfc core, then:
sh /path/to/capture-graphics/run-tests.sh /absolute/path/to/ares/build
```

`CONFIGURATION` defaults to `Release`. Set `GRAPHICS_TEST_EXECUTABLE` if a
multi-configuration generator places the executable elsewhere. Use the same
compiler environment as the configured ares build; the local macOS build needs
the Command Line Tools C++ include-path workaround used by the other capture tests.

The runner builds the target, runs both CTest entries, and compares both PPU
outputs byte-for-byte with `ppu-port-oracle.json`. It uses CMake, shell and C++.
The TypeScript consumer test reads this committed fixture; it does not launch
or compile a native test through JavaScript.

The 18 scenarios contain 164 actual captured bus accesses and 63 nonzero final
graphics bytes. Coverage includes all VRAM remappings, increment ports and sizes,
address wrap, CPU mirror banks, read-side pointer changes, CGRAM masks/shared
flip-flops/latch reuse, OAM paired writes/high-table mirrors, and actual DMA uploads
to all three targets. PPU memory is cleared through debugger memory callbacks
before each capture solely to establish a test baseline. Register setup and data
operations run through the real CPU/PPU bus; the oracle decodes the resulting
native ACT2 records. Final memory comes from independent PPU debugger readback.

Both PPUs use standard 64 KiB VRAM for this oracle. Consumer tests apply that
physical mask only when comparing with readback; the public report preserves
17-bit logical byte destinations because production archives omit physical VRAM
size. Scenarios use forced blank. Rendering-time redirection and internal pointer
resets are intentionally outside the reconstructed memory claim; consumer tests
separately verify unknown state, conservative OAM invalidation, chunk boundaries,
bounded summaries, worker import and idempotent SQL publication.

The golden output is an independently generated baseline, not an automatic update.
If PPU behavior changes, inspect the native output and the consumer together before
replacing it. [native-evidence.json](native-evidence.json) pins the checked source,
executable and fixture.
