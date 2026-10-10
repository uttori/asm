# @uttori/asm-plugin-65xx

6502-family encoders with raw-binary, ca65-style raw, and NES iNES targets. Includes NMOS, CMOS,
Commodore, Hudson, Mitsubishi, and MEGA65 variants. The 65816 belongs to the SNES plugin.

## Install

Requires Node.js 26 or newer. Exposes ESM JavaScript and TypeScript declarations.

```sh
npm install @uttori/asm-core @uttori/asm-plugin-65xx
```

## Usage

```js
import { Assembler } from "@uttori/asm-core";
import { create65xxAssemblerEnvironment, RAW_65XX_TARGET_ID } from "@uttori/asm-plugin-65xx";

const assembler = new Assembler({
  environment: await create65xxAssemblerEnvironment(),
  target: RAW_65XX_TARGET_ID,
  architecture: "65xx.6502",
  targetOptions: { origin: 0x8000 },
});
try {
  assembler.assembleSource("org $8000\nlda #$12\nsta $34", "main.asm");
  console.log(assembler.getBinaryOutput()); // Uint8Array [0xa9, 0x12, 0x85, 0x34]
} finally {
  assembler.dispose();
}
```

For CLI use, also install `@uttori/asm-cli` and configure the plugin and target explicitly:

```json
{
  "plugins": [{ "module": "@uttori/asm-plugin-65xx", "options": { "origin": 32768 } }],
  "target": "65xx.raw",
  "architecture": "65xx.6502"
}
```

Save this as `uttori-asm.config.json`, then run `npx uttori-asm main.asm main.bin`.
The raw `origin` maps to output offset zero. Use `65xx.nes` for iNES output or `65xx.ca65-raw`
for ca65-style directives. This is a direct binary assembler. Ca65 object files and general ld65
linking are unsupported. The manual lists exact CPU and syntax limits.

## Documentation and support

[65xx manual](https://github.com/uttori/asm/blob/master/packages/plugin-65xx/MANUAL.md) ·
[Third-party notices](https://github.com/uttori/asm/blob/master/packages/plugin-65xx/THIRD_PARTY_NOTICES.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).

## NES disassembly projects

`@uttori/asm-plugin-65xx/disassembler` provides Node-side iNES cartridge analysis,
NROM/MMC3 mapping and fixed-layout editable source generation. `65xx.2a03` is the
Ricoh profile; NMOS decoding shares the encoder tables and preserves all opcode
encodings, including noncanonical unofficial forms.

The shared CLI recognizes iNES files by magic:

```sh
uttori-asm source init ./nes-project ./game.nes
uttori-asm source build ./nes-project
uttori-asm source import ./nes-project ./capture.act2
uttori-asm source analyze ./nes-project
uttori-asm source prepare ./nes-project
```

Use the common preview/apply/finish Git workflow for the prepared generation.
Initialization can add a project beside original inputs in an existing folder,
but never overwrites a Git/source project. Imported cartridge headers, trainers,
CHR and trailing data are preserved; edited builds retain the original layout.
NES 2.0 and unsupported mappers are rejected before publication.

The maintained ares fork supports `nes.2a03.instructions` ACT2 capture with mapper
and physical-fetch provenance, plus the separate `nes.cpu-bus-ppu` scope for
CPU/OAM/DMC accesses, actual graphics writes, render fetches and MMC3 IRQ timing. The Node API also
reads passive PPU snapshots, renders mapped patterns/nametables/OAM tiles and
imports bounded graphics reports. See [NES PPU evidence](../../docs/nes-ppu-evidence.md)
for the editor workflow and schemas. The maintained runtime also records full
machine context, controller inputs and screenshots, and verifies deterministic
replay against CPU/APU/PPU/mapper/controller state.
See [the implementation plan](../../docs/nes-disassembly-plan-2026-10-06.md) for
verified gates, conservative analysis boundaries and remaining work.

### Bank-qualified research and hardware names

Tracked labels, comments, ranges and indirect-target decisions accept a generic
`mapping` selector. For example, an MMC3 indirect jump in physical PRG bank 2:

```json
{
  "id": "manual.dispatch.bank2",
  "kind": "target-override",
  "addressSpace": "nes.cpu",
  "address": 32768,
  "mapping": { "fileOffset": 16384, "state": { "prgMode": 0, "r6": 2, "r7": 3 } },
  "targets": [33024, 33280],
  "evidence": ["manual.dispatch-proof"]
}
```

Place this value in an `analysis` decision with its matching ID and cited manual
evidence in an ordinary research document. `fileOffset` is an original headerless
payload offset, including a trainer when present; ranges anchor it at `start`.
Mapper state supports `select`, `prgMode`, `chrMode`, `r0`–`r7`, `ramEnabled`,
`ramWritable`, `mirroring`, `irqLatch` and `irqEnabled`. Boolean registers use JSON
booleans. Omitted selector fields are unconstrained; when creating an analysis
seed, omitted mapper registers stay unknown. A seed must prove its PRG location.
Banked MMC3 CPU declarations require a qualifier; `nes.file` is available for
physical-only labels, comments and classifications. Non-code classifications block
all overlapping instructions, including overlaps with operand bytes. Indirect
targets inherit the source mapper state; an override cannot invent a bank write.
Overlapping matching overrides fail instead of choosing one by order.

The VS Code analysis research editor prompts for NES mapper selectors and uses
`65xx.2a03`; it does not offer 65816 width assumptions for NES declarations.
Generation consumes selected research and emits editable `defines.asm` and
`ram-defines.asm`, loaded by `incsrc` in `main.asm`. Hardware and necessary CPU
alias equates live in the former, RAM identities in the latter. Generated projects
select `sourceStyle: "asar"`, with shared include scope, physical headerless `org`
offsets and logical CPU/PPU `base` addresses. The target defaults to `"ca65"` for
existing hand-written projects. Asar banks use `db`/`dw`, native `incbin` slices and
`assert`, without `.segment` or `.export`. Labels have a blank line before them;
instructions, directives and comments under labels are indented two spaces.
Opaque raw `incbin` ranges are standalone, unindented directives with a blank line
before them, including after a scoped text table's indented `pulltable`.
Instructions, registers and numeric hex use uppercase; build debug maps carry CPU/file coordinates instead of per-opcode source
comments. Complete ROM-matched captures establish instruction boundaries over
overlapping speculative paths; conflicting captured boundaries remain raw bytes.
Research routines and physical data receive actual labels. Noncanonical mappings
retain original CPU alias values as equates with separate physical labels. Operands
use research names only when every observed mapping of that physical instruction
agrees. Hardware names distinguish read/write aliases and retain mirror address
deltas. Immediate, indexed, indirect and ambiguous RMW hardware operands remain
numeric. Duplicate unofficial opcode encodings retain explicit byte directives.

CHR-ROM banks emit indexed PNGs with `includeAsset(..., "nes.chr.2bpp")`.
The registered codec preserves indexes 0..3 as row-major 8×8 tiles with separate
low/high bitplanes; diagnostic colors do not assert a gameplay palette. Verified
`graphics` annotations can split named assets at complete 16-byte tile boundaries.
Anonymous ranges use neutral filenames without redundant source labels; bank
start/end labels and verified semantic labels remain. The editor previews this
codec through the same native conversion, including its exact encoded byte count.
`nes.text.tiles` annotations require a versioned explicit `characters` map and
emit readable strings with scoped character tables; unknown controls remain raw.
Identical complete glyph maps share one `assets/text/alphabet_*.tbl` file across
strings and banks, independently of declaration order and annotation IDs. Maps
with different tile codes remain separate even if they spell the same words.
`data8`, `data16` and `pointer16` annotations emit typed directives, naming pointer
targets only when their mappings agree. Pure-generation builds verify every
representation against the complete original cartridge.
