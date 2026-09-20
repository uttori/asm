# Native file capture

Downstream C++ ACT2 writer and private RSP controls. See the
[native file sink workflow and recovery](../../CAPTURE.md#native-file-sink).

Apply `capture-file.patch` after `capture-v2`, `capture-bus`, `capture-transfer`,
`capture-graphics/graphics-tests.patch`, and `capture-ppu`, on base
`be548251b537334f4f2054c7d86171da22fdc6ca`. `source.json` pins all nine resulting
source files. The standalone headers/test and benchmark are exact source copies.
No upstream PR or default-runtime promotion accompanies this patch.

```sh
git apply --check /absolute/path/to/capture-file.patch
git apply /absolute/path/to/capture-file.patch
sh /absolute/path/to/capture-file/run-tests.sh /absolute/path/to/ares/build
sh /absolute/path/to/capture-file/check-wire.sh
cmake --build /absolute/path/to/ares/build --target gdb-capture-ppu-benchmark
sh /absolute/path/to/capture-file/benchmark.sh /absolute/path/to/ares/build /tmp/file-bench /absolute/path/to/previous-ppu-benchmark
```

`check-wire.sh` uses C++17, a temporary directory, threads and an independent
bitwise archive reader. It checks slow/full queues, durable batch release,
failures and no-clobber publication. Its fault-injection controls are compiled
only for that test target. CMake adds the same writer test beside the existing
capture tests. Real CPU/PPU tests compare full serialized states through native
file backpressure for both PPU implementations. Tests and benchmark launchers
use shell/CMake. They do not require Node.

The writer emits existing ACT2/ACK2 pairs and syncs at most four chunks in one
batch before acknowledging their native queue slots. It reports completion only
after syncing END2 and publishing via a no-clobber hard link. No event data is
hex-encoded or sent through the debugger in native-file mode. Header validation,
queue copying, durable acknowledgement and debugger state remain on the producer
owner thread. All filesystem operations belong to the writer thread. The worker
never owns pointers into the emulation queue.

The negotiated capture allocation includes its fixed copied batch within the
existing overhead reserve. It excludes OS stacks, transport/kernel buffers and
filesystem cache. The file sink's lifecycle and memory ownership are documented
in the source. Filesystem calls can delay shutdown while the worker is joined.
The focused capture-off benchmark shows about 3.8% overhead in the performance PPU. This remains
a promotion gate. Add `cpu-only` as the fourth benchmark argument to omit disk-writing cases.
`PPU_BENCHMARK_EXECUTABLE` can select an identically sourced control executable.
Power-loss directory durability, remote paths and session resumption are not
claimed. Linux/Windows execution remains a validation gate.
