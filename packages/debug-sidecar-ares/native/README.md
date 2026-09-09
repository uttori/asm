# Native ares sources and contributions

New desktop work lives in `fixtures/external/ares`, currently on
`codex/ares-desktop-u6`. The [U1–U6 contribution package](upstream/README.md)
contains separate U3 register, U4 safe-memory, and U5 execution-boundary commits,
the submitted U1/U2 integration layers, the paused save/load follow-up, native
tests, and exact series verification.
See the [evidence guide](../../../docs/ares-upstream-u1-u6-evidence.md) for the
desktop build and reproduction commands, and the [U6 RFC](../../../docs/ares-capture-rfc.md)
for realtime discovery and lossless capture. This prepared debugger build has
not replaced the staged rich-trace runtime.

The active rich-trace runtime received a separate local paused save/load hotfix
on 2026-09-09. It is installed at the existing editor launch path with verified
manifest hashes and a retained rollback app. See the [runtime fix and desktop
validation](../../../docs/ares-paused-state-runtime-fix.md). The original rich
source checkout remains preserved; maintenance lives on
`codex/ares-rich-state-load-fix` in its own checkout.

## Historical execution detail supplement

`rich-instruction-trace.patch` extends the historical SNES debugger/trace hooks. It depends on the archived base series and debugger patch. It was built against the local `Local Only/ares-current-port` working tree based on `0e74a98c72017f2c1aad2319e035f3a223c4196e`, including its existing desktop instruction-boundary support. The [preserved source inventory](upstream/source-inventory.json) records the exact working tree and supplement hashes. Do not apply this patch to the new U3–U5 series; trace infrastructure is the subsequent U7 work.

For reproducing that historical desktop source state only, check first:

```sh
git apply --check /path/to/rich-instruction-trace.patch
git apply /path/to/rich-instruction-trace.patch
cmake --build build_desktop --target desktop-ui -j 8
```

Stage a new runtime directory, retaining its required resources and notices. Copy the newly built executable/app; on macOS, sign the staged app before hashing it. Update `executableSha256` and every changed resource hash in the runtime manifest. Include this supplemental patch as a hashed resource, retaining the original base revision/patch identities and identifying the supplement in `buildConfiguration`. The standard base-patch drift check does not validate this supplement; `git apply --check` and the rich live tests cover it separately.

Protocol additions:

- `qSupported`: `uttoriInstructionDetails+`, `uttoriSramMemory+`, `uttoriAramMemory+`.
- `QUttoriTrace:2`: full capture; `:1` retains PC-only capture; `:0` stops either.
- `qUttoriTraceDetailRead:<hex maximum>`: packet-bounded full pulls (maximum 240).
- Full response: `active:sequence:droppedInstructions:unattributedMemory:rows`.
- Row: `pc,state,bytes,droppedMemory,accesses;`, with hexadecimal fields. State is ten 16-bit values: A/X/Y/S/D/DB/PB/PC/P/E. Each access is a 64-bit address, byte value, direction nibble (read/write/fetch = 0/1/2), actor nibble (CPU/DMA/HDMA = 0/1/2), and channel nibble (CPU = F, DMA = 0–7).
- Named reads add physical `snes.sram` and `snes.spc700.aram` storage.

No extra bus reads are used to acquire instruction bytes or memory events. Events become visible after instruction execution; starting or pausing at a PC does not itself create an execution event. The trace remains bounded and explicitly reports loss. See `docs/snes-function-heuristics-and-runtime-code.md` for limits and remaining processor coverage.

The [lossless capture and upstream contribution plan](../../../docs/ares-lossless-capture-and-upstream-plan.md) defines the next native/protocol milestones and carries forward the older ares contribution backlog. It also requires provenance checks for the complete layered patch series before promoting a new runtime.

Run the real 65816 capture and built-stdio transport tests against an explicitly staged runtime:

```sh
UTTORI_ARES_RICH_LIVE=1 UTTORI_ARES_RICH_RUNTIME=/absolute/runtime \
  UTTORI_ARES_LIVE_ROM=/absolute/game.sfc \
  npx ava packages/debug-sidecar-ares/tests/rich-trace-live.test.ts
```

The tests require a local loopback debugger socket and a supplied ROM; no ROM is bundled. The project code and tests remain under the repository license; the patch applies to ares and must be distributed with the ares license/notices as described in `docs/ares-native-runtime-distribution.md`.

## GDB polling-window correction (U2)

The [U2 integration patch](upstream/0005-u2-polling.patch) corrects `nall/nall/gdb/server.cpp`. After a complete message, reset the polling index to zero so the bounded polling window continues. The existing `maxLoopResets` guard, idle budgets, and immediate return on resume are preserved. This is implemented in the current fixture source and its desktop target builds; it does not implement lossless capture or promote the configured staged runtime. The correction was submitted as [ares PR #2625](https://github.com/ares-emulator/ares/pull/2625).

The [series manifest](upstream/series.json) records its current integration base. The former standalone patch against historical base `7b51c8ab` has been retired. PR #2625 submits the same functional change from head `f4e50174a14442c2075be5b9ab972595e09ac55b` against upstream base `af4cbb04f067682a8a3cf42695ff78bed634b38d`; its single changed file also includes trailing-whitespace cleanup.

From this repository root, configure a normal ares build with `-DARES_BUILD_OPTIONAL_TARGETS=ON`, then run the C++/CTest scheduling regression through its shell launcher:

```sh
fixtures/external/ares/tests/gdb-polling/run-tests.sh /absolute/path/to/build
```

The CMake target compiles the actual `Server::updateLoop()` method against a deterministic transport double. It does not copy the polling algorithm. Five checks fail before U2; all eleven pass afterward, covering queued messages while running/halted, a packet at the idle boundary, continuous traffic reaching the reset guard, idle budgets, resume, and disconnect acknowledgement behavior. Packet parsing and desktop/GDB interoperability require separate integration validation.

On the local Command Line Tools host, the compiler needs the same explicit libc++ header path as the desktop CMake build:

```sh
CPLUS_INCLUDE_PATH=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1 \
  fixtures/external/ares/tests/gdb-polling/run-tests.sh /absolute/path/to/build
```

The independent U2 test follow-up is prepared on `codex/ares-upstream-u2-tests`
and exported as [u2-tests-followup.patch](upstream/u2-tests-followup.patch).
It uses ares's optional CMake targets, CTest, and `run-tests.sh`; it needs no Node
or SNES debugger patches. [Review text](upstream/u2-tests-pr.md) and exact source
identities are in the contribution package. The public PR has not been updated.
