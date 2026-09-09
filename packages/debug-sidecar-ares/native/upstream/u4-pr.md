# sfc: add explicit storage peeks for debugger memory reads

Based on the SNES register contribution, implement RSP memory reads through optional storage-only bus callbacks. WRAM and cartridge storage mappings provide readers; device mappings return unavailable without invoking bus handlers, synchronizing processors, or applying cheats. Invalid ranges and malformed packets fail before storage access. Remap/unmap clears stale readers.

Add a bounded peek to existing physical debugger memory nodes so out-of-range offsets remain unavailable. This prepares safe storage inspection; discoverable memory-space names and new transport commands are deferred to the capture/memory RFC.

Validation on macOS arm64: `ctest --test-dir build --output-on-failure -R '^gdb-memory-packets$'` checks malformed and overflowing requests without storage calls. `ctest --test-dir build --output-on-failure -R '^gdb-storage$'` links the real SFC performance core and checks WRAM aliases, cartridge RAM offsets, device-handler exclusion, remap/unmap, exact ranges, and ROM/RAM/WRAM/ARAM node boundaries. Desktop ROM/MMIO requests also pass. Linux/Windows execution remains before runtime promotion.

Configure `ARES_BUILD_OPTIONAL_TARGETS=ON` and build/run these tests with `tests/gdb/run-tests.sh /absolute/path/to/build`. The launcher uses CMake/CTest and ares's existing toolchain; Node is not required.
