# NES PPU evidence

The maintained ares Famicom profile provides two independent capture scopes:
`nes.2a03.instructions` for code discovery and `nes.cpu-bus-ppu` for graphics and
bus research. Both use ACT2 durable-prefix ownership and bind the complete iNES
file and its payload to the exact runtime producer. Recording adds no emulated
reads. PPU evidence does not supply instruction bytes or seed code analysis.

## VS Code workflow

Open an NES source project, build it, and launch its ares Famicom debug configuration. For graphics,
select `asm.debug.traceMode: lossless-bus-ppu`, pause, start recording, then
continue execution. Stop and import through the usual capture controls. Native
file capture is supported; SNES live bus aggregation is not applied to NES.

`source import` verifies complete NES PPU captures and writes bounded, immutable
reports under `.uttori-local/graphics/reports/<archive-sha256>.json`. Reports retain
register-access/actor counts, fetch/A12/mapper/IRQ counts, the last 1,024 IRQ-pin
transitions, and the last observed value, total writes, physical
PRG origin, CPU PC, event sequence and clock for each physical destination. The
ordered event stream is outside the imported projection. ACT2 and complete context
directories are temporary inputs; remove them yourself after successful import.
Reports, SQLite queries, analysis and regeneration do not require the originals.
Reimporting an explicitly supplied input is idempotent. Wrong
cartridges, changed archives and incomplete tails publish no report. Graphics
reports are separate private artifacts, outside the instruction SQLite/catalog
and regeneration-selection workflow.

While paused, run **Assembly: Inspect NES PPU Snapshot**. The command saves a
binary storage snapshot, ROM/runtime/hash identity and standalone HTML view under
`.uttori-local/graphics/snapshots/`. Its webview displays mapped pattern tables,
four nametables and all 64 OAM tiles with the current palette and mapper windows.
Colors come from the active ares PPU model, including emphasis and grayscale.
These are storage views: they do not reproduce a composited frame or account for
mid-frame scroll/bank changes, sprite priority, sprite evaluation or overflow.

Programmatic consumers use `decodeNesPPUSnapshot`, `renderNesPPUViews`,
`nesPPUHtml`, `summarizeNesPPUCapture` and `importNesPPUCapture` from
`@uttori/asm-plugin-65xx/disassembler`. The pure reader for bus records is exported
by `@uttori/asm-debug-adapter` through `decodeCaptureChunk`.

## Native contract

Only explicitly supported NROM/MMC3 PPU mappings are exposed. TVROM four-screen
storage and outer-bank NESQJ/PALZZ mappings fail closed for this scope. CHR-ROM,
CHR-RAM and CIRAM have different physical address domains. Mapper registers in
bus records describe the state after the access; physical CPU origins and PPU
address translation describe the state before it. The PPU address translation
is a lookup, not proof of a PPU memory fetch.

Every real CPU/DMA bus read or write is recorded. OAM DMA payload, DMC payload
and shared DMA dummy reads have distinct actors. Hardware-suppressed dummy reads
are not invented as bus operations. Interrupt/reset bus accesses have an explicit
context, and instruction ordinal zero denotes an unobserved instruction owner.
Reset or state load terminates active capture as incomplete. Each record commits
before advancing the CPU clock. Queue pressure yields before an access, then
rechecks recording ownership before resuming it. The shared writer retains the
existing SNES queue, CRC, cancellation and durable-file contracts.

PPU effects are observed at actual writes, including both palette alias writes,
OAM attribute masking, rendering-restricted OAM writes and discarded CHR-ROM
writes. Buffered PPUDATA reads and scroll/address-latch transitions retain their
before/after values. RAM, PPU and mapper inspection never calls device read
handlers or toggles mapper A12. The native regression compares serialized
machine state with and without capture and before/after snapshot inspection.

### ACT2 NES bus record

The explicitly negotiated scope has a 128-byte reserve. Records use kind **4**,
version **1**, architecture/address-space dictionary IDs **1/1**. Integers are
little endian. Unused bytes are zero; physical PRG origin `0xffffffff` means the
access or owner is not mapped to ROM. Horizontal position is PPU dots, not the
SNES master-clock horizontal counter. Master clocks use the archive's exact ratio.

| Byte offset | Field                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| 0–31        | Common ACT2 kind/version/length, event sequence, dictionaries and master clock        |
| 32–39       | Owning instruction ordinal, or zero                                                   |
| 40–47       | CPU PC u16, bus address u16, value, direction, actor, context                         |
| 48–55       | Owner physical PRG offset u32, bus physical PRG offset u32                            |
| 56–59       | PPU dot u16, scanline u16                                                             |
| 60–77       | Existing 18-byte NES mapper dictionary                                                |
| 78–87       | Pre-access v/t/PPU-bus addresses (u16), fine X, write latch, read buffer, OAM address |
| 88–97       | Same tuple after access                                                               |
| 98–101      | Effective control, mask, status and cartridge-IRQ/NMI/APU-IRQ line bits               |
| 102–104     | Effect target, outcome, byte count (0–2)                                              |
| 105–107     | Reserved                                                                              |
| 108–117     | Two physical destination u32 offsets, followed by their two byte values               |
| 118–123     | Pre-access PPU mapping kind, reserved byte, physical offset u32                       |
| 124–127     | Reserved                                                                              |

Actors are CPU/OAM-DMA/DMC-DMA/DMA-dummy (0–3). Contexts are unattributed,
instruction and interrupt (0–2). Effect targets are none/CHR-RAM/CIRAM/palette/OAM/
CHR-ROM (0–5); outcomes are written/blocked (0–1). Mapping kinds are
unknown/CHR-ROM/CHR-RAM/CIRAM (0–3). Effective control's nametable bits follow the
temporary scroll register; they are not a historical copy of the last PPUCTRL write.

### NPP1 halted snapshot

`nes.ppu-snapshot` is a named, side-effect-free memory view, available only while
halted. Its 13,056 bytes are copied into an owned buffer by the reader:

| Offset / length | Field                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| 0 / 16          | `NPP1`, u16 version 1, u16 header size 256, u32 total size, reserved             |
| 16 / 16         | CPU master clock u64, PC u16, dot u16, scanline u16, scanline count u16          |
| 32 / 16         | Ten-byte PPU tuple, effective control/mask/status, field, CPU/PPU clock divisors |
| 48 / 16         | Reserved                                                                         |
| 64 / 24         | Mapper dictionary (18), reserved (2), current physical PRG offset u32            |
| 88 / 40         | Reserved (8), clock numerator/denominator u64, reserved (16)                     |
| 128 / 96        | Twelve 1 KiB windows: kind, writable byte, reserved u16, physical offset u32     |
| 224 / 32        | Reserved                                                                         |
| 256 / 8192      | Mapped pattern bytes                                                             |
| 8448 / 4096     | Four mapped nametables including attribute bytes                                 |
| 12544 / 32      | Raw palette storage                                                              |
| 12576 / 256     | Primary OAM                                                                      |
| 12832 / 32      | Secondary OAM                                                                    |
| 12864 / 192     | 64 RGB triplets from the active PPU model                                        |

## PPU fetch and IRQ timeline

The same scope also accepts fixed 128-byte kind **5**, version **1** records.
Kind-4 CPU records are unchanged. Every actual `loadCHR` renderer read retains its
value and physical translation. MMC3 A12 transitions retain the counter/filter
state before and after the native callback, including ignored rising edges.
Mapper IRQ-register writes and the cartridge coroutine driving the CPU IRQ pin
are separate events: board assertion and CPU pin propagation are not simultaneous.

| Byte offset | Field                                                           |
| ----------- | --------------------------------------------------------------- |
| 0–31        | Common ACT2 envelope; clock is the CPU observer epoch           |
| 32–39       | Exact source-device master clock u64                            |
| 40–47       | Active CPU instruction ordinal, or zero                         |
| 48–55       | Observed CPU PC, address, PPU dot and scanline (four u16)       |
| 56–63       | Kind, source, value, physical mapping kind, physical offset u32 |
| 64–71       | Pre-event MMC3 IRQ tuple                                        |
| 72–79       | Post-event MMC3 IRQ tuple                                       |
| 80–97       | Native mapper dictionary                                        |
| 98          | CPU cartridge-IRQ pin after the event                           |
| 99–127      | Reserved zero                                                   |

Kinds are renderer fetch/A12 transition/mapper-register write/CPU IRQ pin (0–3).
Sources are CPU/PPU/cartridge (0–2). The IRQ tuple is counter, latch, enabled,
board output, A12 level, remaining filter cycles (0–6), MC-ACC pulse counter and
MC-ACC flag. Values describe ares's native implementation, including its board
variant filtering, rather than inferring hardware behavior from scanlines.

The event sequence and common clock preserve native coroutine observation order.
The device clock retains the exact master tick using relative scheduler clocks;
scheduler rebasing cancels, and sub-tick thread-ID ordering is removed. Auxiliary
threads can run ahead or behind the CPU. Use `deviceCycle` for device timing;
do not sort all devices by the common CPU observation clock as if it were their
hardware clock. An active CPU ordinal provides context, not causality for a fetch.

## Full context, inputs and replay

Enable `asm.debug.captureContext` for full context and replay. Both sinks produce a
hash-bound `.act2.context` directory. NES instruction captures also produce a
full-window `graphics.act2` companion in the PPU scope. Importing the instruction
capture verifies the companion and publishes its graphics report automatically.
The regular capture milestone, restore and replay commands work for Famicom.
These commands consume explicitly selected temporary recordings while available;
imported project evidence does not depend on retaining the full context or replay data.

The bundle contains the synchronized `start.bst`, `start-extra.bin`, physical
2 KiB `ram-start.bin`/`ram-end.bin`, canonical `end-state.bin`, `inputs.bin`,
clock/boundary/identity files and sparse PNG screenshots. Screenshots retain the
last presented frame's own clock and ordinal; an unavailable initial frame is
explicit. The end-state comparison includes CPU registers/RAM, cartridge RAM and
mapper, APU, PPU memory/latches, controllers, RNG and relative device clocks.
It excludes frontend audio/video buffers and nonportable coroutine stacks.

The 38-byte start supplement retains the upstream v156 save format's omitted
PPU rendering-read/main-OAM-overflow fields, RNG state and gamepad button values.
Existing ares save files and serialization versions are unchanged. This is a
build-pinned debugger companion, not a new generic emulator save format.

Controller rows are 18 bytes: little-endian u64 master clock, u64 instruction
ordinal, u8 sample slot, u8 boolean value. Slots 0–15 mean port × 8 plus
A/B/Select/Start/Up/Down/Left/Right; slot 16 is the microphone button. Replay feeds
these samples before opposing-direction and serial-shift logic. It checks every
sample's clock/slot, complete consumption and the canonical endpoint at the exact
CPU clock. Changed host input therefore does not change a replay. Reset, input
timing mismatch or final-state mismatch stops replay without reporting success.

Paused Famicom experiments can use the native debugger packet
`qUttoriContext:buttons:PORT:MASK`, with port `0` or `1` and exactly two lowercase
hex digits. Bits are A=$80, B=$40, Select=$20, Start=$10, Up=$08, Down=$04,
Left=$02 and Right=$01. `host` in place of the mask restores host ownership.
Only connected Gamepads accept overrides. Replay rejects them; reset, unload,
context abort and context preparation clear them. The supplied values pass through
the normal gamepad latch, opposing-direction handling and serial reads, and are
recorded in `inputs.bin`. They are controlled experimental inputs, not physical
keyboard/controller observations.

Replay requires the exact full iNES hash, payload hash, producer revision,
machine configuration, board and controller configuration. The supported profile
is Famicom with Gamepads or disconnected ports, supported NROM/MMC3 PPU mappings,
no expansion device and no FDS/Vs system. Unsupported profiles fail before recording.

## Retained graphics evidence and CPU joins

Source import publishes PPU port reads/writes as `runtime-graphics-access` facts
in the shared SQLite store, with the `nes-graphics-v1` import profile. Facts keep
the actor, instruction/interrupt/unattributed context, CPU port/value, observed
physical PRG PC, and actual storage effects (including blocked writes). Equal
facts aggregate counts within each archive. They never seed instruction analysis.
The immutable JSON summary and SQLite facts persist after input removal; fetch/A12/IRQ
counts appear in the import receipt. There is no framebuffer reconstruction.

`store.graphicsEvidence({ architecture: "65xx.2a03", addressSpace: "nes.cpu",
captureSha256, pc?, physicalOffset?, limit? })` returns at most 500 rows by default
(maximum 2,000). It joins instruction evidence inside SQLite by architecture,
CPU PC and the `prg0` physical fetch identity. `physicalOffset` excludes the header
and trainer. Unknown mappings, interrupt context and unattributed accesses do
not join. Variant counts and instruction observation counts are independent of
the graphics counts: this proves that the same physical code was observed, not
that two separate captures recorded the same instruction event. Full chronology is
outside this compact projection; queries must not reopen raw streams or context files.

Both standalone PPU archives and instruction graphics companions enter the Git
capture catalog by SHA-256. Archive names are discovery hints; no host paths or
capture bytes enter Git. A failed catalog update leaves committed evidence intact
and can be retried. Exact re-imports preserve facts, counts and evidence revision.
Old report-only imports gain the SQLite projection and catalog binding on re-import;
their original immutable JSON reports are retained.

Use **Assembly: Inspect NES Graphics Evidence** (also under Source Project →
Capture) to choose a catalog identity and open its bounded CPU-join report.
The command accepts an optional capture SHA-256 for automation. CLI equivalents:

```sh
uttori-asm source graphics ./my-nes-project
uttori-asm source graphics ./my-nes-project <capture-sha256>
uttori-asm source graphics ./my-nes-project <capture-sha256> 0xc123 0x1c123
```

The first command lists portable graphics selections; the last filters by both
CPU PC and physical PRG offset. The report exposes its row limit explicitly.
