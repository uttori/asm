# ares capture modes and recovery

Capture requires a manifest-matched downstream ares runtime and matching sidecar/editor builds.
Select it through the [runtime setup](RUNTIME.md). Capabilities are negotiated before recording;
unsupported scopes or sinks fail instead of silently dropping requested evidence. Native candidates
and prepared upstream contributions are separate; these features are not stock ares APIs.

## Select a scope

Set `asm.debug.traceMode` in VS Code:

| Mode                     | Recorded evidence                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `live`                   | Bounded legacy instruction observations, with explicit loss/truncation counters; `asm.debug.traceDetail` selects PC-only or full detail |
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
history and omitted registers remain in the capture. `asm.trace.maxImportSizeMiB` defaults to 2048;
raise it deliberately for larger files. `asm.trace.indexMode` selects instruction retention;
see the [CLI evidence reference](https://github.com/uttori/asm/blob/master/packages/cli/README.md#offline-runtime-evidence).
Import validates ROM identity and the entire stream before publication. A failed, cancelled,
oversized, or stale-revision import cannot publish partial evidence. If import succeeds but source
regeneration fails, retry **Assembly: Analyze and Regenerate Disassembly** using the saved evidence.

## Explicit transfer boundaries

One boundary pair describes a DMA channel run or one HDMA payload burst, not an entire table or
frame. Reports distinguish complete, interrupted, and partial windows. A capture may start after
a transfer begins or stop before it ends. Raw bus totals count accesses, not transfers; boundary
snapshots do not identify the CPU instructions that configured a channel.

Bus-only graphics reconstruction reports register-derived VRAM/CGRAM/OAM destination candidates.
Unknown setup and latch state remain unknown. Actual internal writes, suppression, and latch-only
outcomes require the separately negotiated PPU scope. Reports retain bounded detail and aggregate
totals; the original archive is required to reconstruct ordered transfer history.

## Native file sink

The default sink streams through the debugger. A capable local runtime can instead write ACT2
directly, avoiding event transport through RSP/DAP:

```json
{
  "asm.debug.traceMode": "lossless-bus-ppu",
  "asm.debug.captureSink": "native-file"
}
```

The verified local process host binds the destination and capture identity to the launch manifest;
native paths are not sent to arbitrary remote servers. The sink supports instruction, bus,
transfer, and PPU scopes without changing their evidence. It preserves existing destinations,
partial files, and symlinks. Stop drains and syncs the writer before no-clobber publication.

On failure, retain the partial artifact. Recovery validates CRCs, sequences, and checkpoints in
order and exposes only a valid prefix; it cannot resume the original session or manufacture
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
recording continues. Only one live worker runs at a time; finish or cancel its catch-up before
starting another live analysis.

The worker reads only synced data, validates the archive, and publishes facts transactionally
after completion. Cancellation, lag overflow, corruption, replacement, worker failure, or a stale
project revision discards provisional analysis. The worker also observes import-size, distinct-fact,
and configured heap limits; native recording remains available for later offline import.
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
