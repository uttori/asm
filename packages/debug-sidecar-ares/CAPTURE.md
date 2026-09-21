# ares capture modes and recovery

Capture requires a manifest-matched downstream ares runtime and matching sidecar/editor builds.
Select it through the [runtime setup](RUNTIME.md). Capabilities are negotiated before recording.
Unsupported scopes or sinks fail instead of silently dropping requested evidence. Native candidates
and prepared upstream contributions are separate. These features are not stock ares APIs.

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
requires the matching ROM/build and region/PPU, then restores the pre-action state. Continue
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

Start while paused with **Assembly: Start Runtime Trace Recording**, choose a new destination,
then continue or step. Use **Assembly: Stop Runtime Trace Recording** to drain and finalize it.
An independent debugger pause remains in effect while the capture drains.

ACT2 recording writes a `.partial` archive with durable checkpoints. A complete archive is
published only after sequence/count checks and a synced terminal frame. Instruction recording can
also export JSON for the CLI's `evidence-import --instruction-trace` workflow. Use
**Assembly: Import Runtime Trace and Update Disassembly** for instruction captures, or
**Assembly: Import Bus Capture and Show DMA/HDMA Activity** (`asm.trace.importBus`) for bus archives.

Keep original captures: project storage retains facts, counts, and provenance, while ordered
history and omitted registers remain in the capture. `asm.trace.maxImportSizeMiB` defaults to 2048.
Raise it deliberately for larger files. `asm.trace.indexMode` selects instruction retention.
See the [CLI evidence reference](https://github.com/uttori/asm/blob/master/packages/cli/GUIDE.md#offline-runtime-evidence).
Import validates ROM identity and the entire stream before publication. A failed, cancelled,
oversized, or stale-revision import cannot publish partial evidence. If import succeeds but source
regeneration fails, retry **Assembly: Analyze and Regenerate Disassembly** using the saved evidence.

## Explicit transfer boundaries

One boundary pair describes a DMA channel run or one HDMA payload burst, not an entire table or
frame. Reports distinguish complete, interrupted, and partial windows. A capture may start after
a transfer begins or stop before it ends. Raw bus totals count accesses, not transfers. Boundary
snapshots do not identify the CPU instructions that configured a channel.

Bus-only graphics reconstruction reports register-derived VRAM/CGRAM/OAM destination candidates.
Unknown setup and latch state remain unknown. Actual internal writes, suppression, and latch-only
outcomes require the separately negotiated PPU scope. Reports retain bounded detail and aggregate
totals. The original archive is required to reconstruct ordered transfer history.

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

## Native development

Source pins, patches, and reproduction commands are retained with the
[instruction](native/capture-v2/README.md), [bus](native/capture-bus/README.md),
[transfer](native/capture-transfer/README.md), [PPU](native/capture-ppu/README.md),
[file sink](native/capture-file/README.md), and [realtime](native/capture-realtime/README.md)
packages. The [benchmark audit](native/capture-benchmark-audit/README.md) describes reproducible
coverage. Local measurements do not establish realtime behavior for every game, storage device,
PPU implementation, or platform.
