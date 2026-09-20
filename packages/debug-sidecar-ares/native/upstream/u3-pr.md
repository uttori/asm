# sfc: expose 65816 registers to RSP clients

Add a 16-byte, little-endian SNES register layout and target XML for 65816-aware RSP clients. Register writes preserve the processor's E/M/X invariants, including the emulation-mode stack page and truncated X/Y registers. Validate a complete register packet before changing state, and paginate target XML according to the client's requested offset and length.

The existing big-endian numeric write-hook contract remains the default for other cores. This adds no trace protocol. Stock GDB has no 65816 architecture backend. Target XML alone does not provide one.

Validation: `ctest --test-dir build --output-on-failure -R '^gdb-registers$'` passes on macOS arm64, compiling the actual server and WDC65816 register types. Coverage includes `g/G/p/P`, banked PC, malformed-packet atomicity, E/M/X transitions, XML chunks, and the legacy write-hook contract. The downstream desktop integration also passes actual RSP register/XML checks. Linux/Windows and additional client checks remain before runtime promotion.

Configure `ARES_BUILD_OPTIONAL_TARGETS=ON` and build/run these tests with `tests/gdb/run-tests.sh /absolute/path/to/build`. The launcher uses CMake/CTest and ares's existing toolchain. Node is not required.
