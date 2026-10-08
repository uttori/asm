# SNES static and captured-code analysis

SNES analysis combines conservative ROM control-flow analysis with captured instruction bytes,
register states, and explicit runtime observations. Manual annotations and provenance survive
reanalysis. Pure source generations verify original-ROM equality before a previewed native Git merge.
Current edited source builds use declared layout/state checks and may intentionally differ from the original.

## Analysis options

`analyzeSnesProject` accepts `entryPoints`, `maxWorkItems` (default 1,000,000), and
`maxCallDepth` (default 16). Entry points use qualified CPU addresses and explicit processor state.
An incomplete pass that would discard known code is rejected before publication. Captured RAM
variants are decoded separately and retain their capture evidence.

Function-role inference and its configure/preview commands have been retired. Existing
`heuristics.json` files are inert. The next successful Analyze removes detector-owned role comments
and unused role evidence; evidence referenced by surviving records remains historical provenance.
Static function candidates, generated `Fn_*` labels, MMIO identification, and the SQL call graph
remain supported.

## Capture and RAM navigation

`asm.debug.traceDetail` defaults to `full`. On a runtime that advertises support, runtime recording requests:

- Actual fetched instruction bytes and the ten 65816 registers before execution.
- Actual CPU, DMA, and HDMA bus operations, with address, value, direction, and DMA channel.
- Explicit instruction overflow, per-instruction memory truncation, and unattributed bus-operation counters.

The maintained ares supplement records these at execution hooks without extra debugger bus reads. Its ring holds 65,536 instructions. Each instruction retains up to 32 bus operations. Responses pack up to 240 instructions within the native packet byte limit. Large DMA transfers can exceed the per-instruction limit. Interrupt/wait-period operations outside a captured instruction are counted as unattributed. Their address/value detail is not saved. Counts of memory operations inside dropped instruction records are also unavailable. This is a bounded observation stream, not a lossless bus log.

For separately negotiated lossless modes, see [ares capture](../debug-sidecar-ares/CAPTURE.md).
The limits above apply to legacy full-detail tracing.

`pc` selects a smaller stream containing instruction addresses. Explicitly requesting full detail
from a runtime without that capability fails. PC-only files identify reachability but lack the
captured bytes/state needed to reconstruct RAM code. Replay remains a PC-only workflow fixture.

Import creates execution counts, captured instruction variants, CPU-state observations, and memory-access records. Fetches supply code bytes and are excluded from data-read facts. Reimporting the same artifact is idempotent. The sidecar, DAP path, disk recorder and import all retain the details.

Captured instructions can be decoded at any 65816 CPU bus location, including WRAM and cartridge RAM. Different bytes or decode states at one address remain separate variants with their original trace evidence. CPU-state differences that decode to identical instruction bytes, length, and specification are compatible observations. Differing instruction encodings remain explicit code conflicts. A ROM file offset is attached only if mapper translation succeeds and the captured bytes match the ROM. RAM nodes do not enter ROM coverage or bank-file export. Static seed limits are spent on ROM PCs. RAM observations are decoded separately.

Trace imports accumulate across captures. An instruction not executed in a later capture retains its earlier evidence and remains an analysis seed. Pure-generation preparation protects accepted code ranges. Intentional withdrawals require explicit reasoned `codeWithdrawals` in the generation recipe; discoveries elsewhere cannot justify silently dropping known code.

Selecting a captured RAM location in Sources opens its saved bytes and annotations before attempting live disassembly. The saved view works offline and does not substitute today's RAM contents for a past capture. Memory annotations distinguish CPU operations from DMA/HDMA activity during an instruction. Bus addresses are retained, including WRAM/SRAM aliases. PPU ports do not yet carry reconstructed internal VRAM/CGRAM/OAM buffer offsets.

The ares supplement also exposes stopped, side-effect-free `snes.sram` and `snes.spc700.aram` reads, alongside WRAM and ROM. These are storage peeks. SPC700 instruction tracing/stepping and SuperFX instruction tracing remain unsupported and are not advertised.
