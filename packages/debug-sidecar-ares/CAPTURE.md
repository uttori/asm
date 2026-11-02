# ares capture modes and recovery

Capture requires a manifest-matched downstream ares runtime and matching sidecar/editor builds.
Select it through the [runtime setup](RUNTIME.md). Capabilities are negotiated before recording.
Unsupported scopes or sinks fail instead of silently dropping requested evidence. Native candidates
are separate from stock ares. These features are not stock ares APIs.

## Default research bundle

Recording defaults to `lossless-instructions` with `asm.debug.captureContext: true`.
Both streaming and native-file sinks create `<capture>.act2.context/` beside the archive:

- `wram-start.bin` and `wram-end.bin`: all 131,072 bytes at `$7E0000–$7FFFFF`, copied
  directly from physical WRAM while paused. `boundaries.json` ties them to the ACT2
  session, completed event count, instruction ordinal, PC, and absolute/relative master clocks.
- `start.bst`: a synchronized ares state immediately before recording. Synchronization
  happens before either trace is armed; the starting snapshot follows it at the same CPU
  boundary. The existing ares state format is unchanged. Capture clock epochs are separate.
- `identity.txt`, `machine.json`, and `manifest.json`: exact ROM and emulator build identity,
  region/PPU implementation, artifact sizes, and SHA-256 hashes. The complete manifest is
  published only after the archive and companion files are synced. A directory without that
  manifest is incomplete; keep it for diagnosis but do not treat it as a replayable bundle.
- `inputs.bin`: every pair of controller serial bits actually consumed by CPU or auto-joypad
  reads, with its master clock, instruction ordinal, and controller port. This records console
  inputs rather than host key timing. Gamepad and Rumble Gamepad are supported; other
  peripherals fail setup explicitly.
- `screen-*.png` and `milestones.jsonl`: start/end milestones and a screenshot every 300
  emulated frames (up to 24 automatic milestones). Each image is the last presented viewport;
  its presentation clock/ordinal and the milestone's CPU position are separate. Before the
  first presented frame, the image is explicitly unavailable; zero image markers mean the
  earlier frame predates context recording.
- `graphics.act2`: an independent `snes.cpu-bus-ppu` archive covering the entire capture,
  sharing its start and stop CPU boundaries. It records CPU/DMA/HDMA accesses,
  transfer boundaries and physical PPU effects. For an explicitly selected bus scope, the
  primary archive supplies that scope instead; no second graphics archive is created.
  The writer retains an 8 MiB capture allocation and applies backpressure as it streams to
  disk; archive size grows with the scene. `graphics.windowFrames: null` and the native
  `boundaries.graphicsWindowFrames: null` acknowledge that there is no frame cutoff.

Use **Assembly: Add Capture Milestone** (`asm.trace.mark`) to pause and label a scene such
as payment, refund, or recruitment. Continue resumes from that same position.
**Assembly: Replay Capture Inputs** (`asm.trace.replay`) checks every artifact hash and
requires the matching ROM and region/PPU, then restores the pre-action state. Producer build
revisions remain recording provenance; a different current build may attempt state loading. Continue
replays the recorded console inputs and pauses at the saved endpoint. The native replay
status detects input-clock/port divergence, unconsumed inputs, and a different final WRAM image.
**Assembly: Restore Capture Pre-action State** (`asm.trace.restore`) restores the same starting
state with live controls, allowing a new capture of refusal, insufficient money, or another branch.
These commands select the companion directory. Do not separate it from its original ACT2 file.

Context requires the maintained context-capable local runtime. Unsupported runtimes fail setup;
there is no silent downgrade. `asm.debug.captureContext: false` explicitly selects bare ACT2 for
benchmarks or another producer. Historical captures remain ordinary ACT2; no migration is needed.
WRAM differences alone do not identify a writer. Full graphics coverage requires the current
native runtime; finalization rejects a producer that does not acknowledge the complete window.
Instruction captures with context now include graphics throughout later conversations and room
changes. Select `lossless-bus-ppu` when only bus/graphics evidence is needed.

## Select a scope

Set `asm.debug.traceMode` in VS Code:

| Mode                     | Recorded evidence                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `live`                   | Bounded legacy instruction observations, with explicit loss/truncation counters. `asm.debug.traceDetail` selects PC-only or full detail |
| `lossless-instructions`  | Executed 65816 instructions, fetched bytes, and decoding/register state                                                                 |
| `lossless-bus`           | Actual CPU/DMA/HDMA bus accesses, including accesses without an instruction owner                                                       |
| `lossless-bus-transfers` | Bus accesses plus DMA/HDMA boundaries and channel snapshots                                                                             |
| `lossless-bus-ppu`       | Bus/transfer evidence plus actual physical PPU writes, blocked writes, and latch-only outcomes                                          |

Lossless capture uses producer backpressure: a slow consumer slows emulation before events can be
overwritten. Lossless does not promise realtime playback. An instruction archive is not a complete
bus history, and bus archives do not establish executed instruction bytes or update disassembly.
SPC700 and Super FX instruction capture are not advertised by these native modes.

## Record and import

Start while paused with **Assembly: Start Capture**, choose a new destination,
then continue or step. Use **Assembly: Stop Capture** to drain and finalize it.
An independent debugger pause remains in effect while the capture drains.

ACT2 recording writes a `.partial` archive with durable checkpoints. A complete archive is
published only after sequence/count checks and a synced terminal frame. Instruction recording can
also export JSON for the CLI's `evidence-import --instruction-trace` workflow. Use
**Assembly: Import Capture into Source Project** (`asm.source.importCapture`) for instruction
or bus captures, or choose **Stop Capture and Import Evidence** during the active recording.

New NES and SNES archives compress each chunk independently with Zstandard level 3,
including instruction streams and graphics companions. Every event byte, ID, clock and
checkpoint is retained. Incompressible chunks remain raw. Existing raw archives require no
migration; current readers accept raw, compressed and mixed chunks. Older readers cannot open
new compressed archives, so update the native runtime and editor/CLI together.

Compression runs in the native file worker after copying raw producer chunks. The writer
acknowledges them only after disk sync succeeds. Each chunk has a bounded decoded size and
an independent frame, so recovery needs no earlier compression history. Corruption or a torn
chunk stops recovery at the last validated checkpoint. Compression reduces storage but adds CPU
work; backpressure still preserves evidence when recording cannot keep up with emulation.

ACT2 version 2 keeps its 64-byte envelope. All integers below are little endian:

| Field offset | Storage contract                                                        |
| ------------ | ----------------------------------------------------------------------- |
| 6, `u16`     | `0` = raw payload; `1` = one Zstandard frame; other values rejected     |
| 48, `u32`    | Stored payload length, excluding the envelope                           |
| 52, `u32`    | Decoded payload length, excluding the envelope                          |
| 56, `u32`    | CRC32C of the entire stored chunk with these four bytes treated as zero |

Both stored and decoded payloads are limited to 262,080 bytes. Compressed payloads must be
nonempty, dictionary-free, single-segment frames with an explicit matching content size;
concatenated, skippable and trailing frames are rejected before decompression. The session
header declares `compression: "zstd"` and permits raw fallback; `"none"` permits raw chunks
only. Session identity, event records, ordering, ACK2 and END2 are unchanged. RSP transport
and producer queues remain raw; only archive storage changes. Native development requests
may append `:none` or `:zstd` before optional `:profile` to compare the two storage modes.

Original ACT2 captures and complete context directories are temporary import inputs. Project
storage persists facts, counts, bounded reports and provenance independently of them. Remove
the originals yourself after successful import; later project operations do not require them.
Ordered history and capture replay are not part of the imported projection. Replay or restore
requires an explicitly selected temporary input while it is available. `asm.trace.maxImportSizeMiB` defaults to 2048.
Raise it deliberately for larger files. `asm.trace.indexMode` supports full instruction indexing only.
See the [CLI evidence reference](https://github.com/uttori/asm/blob/master/packages/cli/GUIDE.md#offline-runtime-evidence).
Import validates ROM identity and the entire stream before publication. A failed, cancelled,
oversized, or stale-revision import cannot publish partial evidence. If import succeeds but source
generation preparation fails, inspect **Uttori Analysis** and retry **Analyze Source Project Evidence**
and **Prepare Regeneration** using the saved evidence. Preview and merge source separately.

## Explicit transfer boundaries

One boundary pair describes a DMA channel run or one HDMA payload burst, not an entire table or
frame. Reports distinguish complete, interrupted, and partial windows. A capture may start after
a transfer begins or stop before it ends. Raw bus totals count accesses, not transfers. Boundary
snapshots do not identify the CPU instructions that configured a channel.

Bus-only graphics reconstruction reports register-derived VRAM/CGRAM/OAM destination candidates.
Unknown setup and latch state remain unknown. Actual internal writes, suppression, and latch-only
outcomes require the separately negotiated PPU scope. Reports retain bounded detail and aggregate
totals. Ordered transfer history is outside the imported projection.

## Native file sink

The default sink streams through the debugger. A capable local runtime can instead write ACT2
directly, avoiding event transport through RSP/DAP:

```json
{
  "asm.debug.traceMode": "lossless-bus-ppu",
  "asm.debug.captureSink": "native-file"
}
```

The verified local process host binds the destination and capture identity to the launch manifest.
Native paths are not sent to arbitrary remote servers. The sink supports instruction, bus,
transfer, and PPU scopes without changing their evidence. It preserves existing destinations,
partial files, and symlinks. Stop drains and syncs the writer before no-clobber publication.

On failure, retain the partial artifact. Recovery validates CRCs, sequences, and checkpoints in
order and exposes only a valid prefix. It cannot resume the original session or manufacture
completion. Restart debugging to recover ordinary control, or use the failed-session `file-release`
protocol operation once the writer stops. Reset, unload, and disconnect invalidate active capture.
Directory and hardware power-loss guarantees beyond the platform sync operation are not promised.

## Live bus analysis

Live analysis is opt-in for native-file bus, transfer, and PPU scopes:

```json
{
  "asm.debug.traceMode": "lossless-bus-ppu",
  "asm.debug.captureSink": "native-file",
  "asm.debug.liveBusAnalysis": true,
  "asm.debug.liveBusMaxLagMiB": 256
}
```

Select a matching analysis project when recording starts. The status bar reports provisional
counts and unread durable bytes. **Assembly: Stop Live Bus Analysis** cancels analysis while
recording continues. Only one live worker runs at a time. Finish or cancel its catch-up before
starting another live analysis.

The worker reads only synced data, validates the archive, and publishes facts transactionally
after completion. Cancellation, lag overflow, corruption, replacement, worker failure, or a stale
project revision discards provisional analysis. The worker also observes import-size, distinct-fact,
and configured heap limits. Native recording remains available for later offline import.
Dense captures can outpace analysis indefinitely, so the backlog limit stops analysis instead of
allowing unbounded growth. Native allocation and filesystem buffers are outside the JavaScript heap.

## Native tests

Native capture producers live in `fixtures/external/ares`. Run `gdb-capture`, `gdb-polling`,
`gdb-states`, and `gdb-famicom` CTest from that checkout after configuring with
`-DARES_BUILD_OPTIONAL_TARGETS=ON`. Local measurements do not establish realtime behavior for
every game, storage device, PPU implementation, or platform.

## Famicom PPU scope

`nes.cpu-bus-ppu` negotiates its own 128-byte NES record dictionary and reuses the
same durable transport. It records CPU, OAM DMA, DMC DMA and dummy bus reads,
actual PPU memory effects, render fetches, A12/mapper IRQ events and scroll/latch transitions. The
`nes.ppu-snapshot` named memory space exposes a halted NPP1 graphics view through
passive storage reads. NES context uses physical 2 KiB RAM images, a synchronized
state plus a capture-only supplement, controller polling samples, screenshots and
a canonical CPU/APU/PPU/mapper/controller endpoint. Instruction captures include a
full-window graphics companion. Replay requires full iNES and payload hashes plus
the matching machine profile. State loading and endpoint checks determine compatibility with
the current build. SNES context and serial-input schemas are unchanged. See [NES PPU evidence](./NES.md)
for the wire layout, supported boards, reader APIs and limits.
