# Downstream instruction capture v2

This package implements the instruction-only scope described in
[the implementation guide](../../../../docs/ares-capture-v2-implementation.md).
It is independent of the unpublished U3–U6 contribution series. The prototype
uses private `qUttoriCapture` packets; no upstream namespace is claimed.

`capture-v2.patch` applies to the clean rich maintenance revision
`be548251b537334f4f2054c7d86171da22fdc6ca`. It contains the generic bounded producer,
CPU fetched-byte/clock/boundary hooks, lifecycle failure handling, RSP control,
partial TCP send handling, and CMake/CTest integration. `source.json` records the
base and patch/file SHA-256 values. Reconstruction is checked byte-for-byte
against the built checkout, `Local Only/ares-rich-state-load-fix`, on its new
`codex/ares-capture-v2` branch. The previous branch remains available.

`capture.hpp`, `send-all.hpp`, and `core-test.cpp` here are reviewable copies of
the corresponding patch files. `queue-test.cpp` tests producer ownership,
bounded reservation and send progress without ares. The outer TypeScript tests
decode its native ACT2 output for CRC/framing interoperability. Native additions
are distributed with the ares/nall source and notices; this package does not
relicense existing emulator code.

```sh
git apply --check /absolute/path/to/capture-v2.patch
git apply /absolute/path/to/capture-v2.patch
cmake --build build --target desktop-ui gdb-capture gdb-states -j 8
ctest --test-dir build -R 'gdb-(capture|states)' --output-on-failure
```

Use a build configured with the existing rich maintenance CMake options and the
SNES core. On the tested CLT host, prefix the build command with
`CPLUS_INCLUDE_PATH=/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1`.

`runtime.json` identifies the signed local runtime. `desktop-evidence.json` and
`desktop-normal-evidence.json` record direct TCP checks; `sidecar-evidence.json`
records the editor's bundled sidecar and DAP capture path with a verified runtime
launch. All use an original synthetic ROM and isolated settings/saves.

Wire requests use colon-separated fields:

- `qUttoriCapture:capabilities`
- `qUttoriCapture:start:<decimal total-byte-budget>`
- `qUttoriCapture:status:<session>`
- `qUttoriCapture:read:<session>:<decimal chunk>`
- `qUttoriCapture:ack:<session>:<decimal chunk>:<decimal event>`
- `qUttoriCapture:stop:<session>`
- `qUttoriCapture:abort:<session>`
- `qUttoriCapture:release:<session>` (explicitly release an incomplete capture's hold)

Capability/status replies are `J` plus hex UTF-8 JSON, reads return hex ACT2 or
empty while no whole chunk is available, and errors return `E..`. Start fixes
lossless 65816 instruction history, all CPU addresses, no triggers, no bus events,
uncompressed chunks and durable-prefix ownership. Unsupported scope/options
must be rejected by the neutral TypeScript request validator. Both legacy trace
capture and capture v2 cannot record simultaneously.
