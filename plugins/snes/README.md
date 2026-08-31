# The Uttori ASM SNES Manual

`@uttori/asm-plugin-snes` is the first-party Super Nintendo target for Uttori ASM. It brings the WDC 65C816, Sony SPC700, and Super FX under one roof; translates CPU addresses through the familiar SNES cartridge maps; writes `.sfc` images; updates checksums; and understands a practical, deliberately documented slice of Asar syntax.

This manual starts with a tiny working ROM and then opens the hood one system at a time. You can read it front to back, magazine-style, or jump straight to the command and instruction appendices when the linker gremlins are already circling.

> [!IMPORTANT]
> This plugin aims for useful Asar compatibility, not drop-in equivalence with every Asar release. Each feature below is marked by what the current code actually does. Accepted compatibility no-ops and known unsupported families are listed explicitly near the end.

The architecture and hardware links point to the [Super Famicom Development Wiki](https://wiki.superfamicom.org/). The manual's progression takes inspiration from the excellent [Asar Manual](https://r9.pm/asar-artifacts/build/293/docs/intro.html), but its explanations, examples, support notes, and opinions are grounded in this codebase.

## Contents

- [What the plugin contributes](#what-the-plugin-contributes)
- [Install & Assemble](#install--assemble)
- [Hello World for the Super Nintendo (SNES) / Super Famicom (SFC)](#hello-world-for-the-super-nintendo-snes--super-famicom-sfc)
- [How an Assembly Session Works](#how-an-assembly-session-works)
- [Source Formatting & Syntax](#source-formatting--syntax)
- [Architectures](#architectures)
- [Memory Maps & the Program Counter](#memory-maps--the-program-counter)
- [Labels, Namespaces, & Structs](#labels-namespaces--structs)
- [Defines, Expressions, & Functions](#defines-expressions--functions)
- [Macros](#macros)
- [Conditionals & Loops](#conditionals--loops)
- [Binary Data & Character Tables](#binary-data--character-tables)
- [Source & Binary Includes](#source--binary-includes)
- [Fill, pad, and freespace](#fill-pad-and-freespace)
- [Diagnostics & Checks](#diagnostics--checks)
- [Output, Checksums & Patching](#output-checksums--patching)
- [Asar & ca65 Compatibility](#asar--ca65-compatibility)
- [Command Index](#command-index)
- [Troubleshooting](#troubleshooting)
- [Code and Fixture Layout](#code-and-fixture-layout)
- [Instruction Catalogs](#instruction-catalogs)

## What the plugin contributes

Core Uttori ASM has no default SNES mode. This plugin must be activated, after which it contributes the following target-owned pieces:

| Contribution | ID or value | Notes |
| ------------ | ----------- | ---- |
| Target                   | `snes.sfc` | Aliases: `snes`, `sfc`, `snes-65816` |
| Default architecture     | `snes.65816` | Alias: `65816` |
| Audio architecture       | `snes.spc700` | Aliases: `spc700`, `spc700-raw`, `spc700-inline` |
| Coprocessor architecture | `snes.superfx` | Alias: `superfx` |
| Address space            | `snes.address-space` | 24-bit, mapper-aware CPU-to-ROM translation |
| Output format            | `snes.sfc-output` | Headerless `.sfc` bytes with optional checksum finalization |
| Default mapper           | `lorom` | Default logical origin is `$008000` |
| Expression sets          | SNES address and ROM-read functions | Installed only for this target |

The registration lives in [`src/index.ts`](./src/index.ts). Mapper formulas are isolated in [`src/target/address-space.ts`](./src/target/address-space.ts), while Asar-specific policy lives in [`src/asar/compatibility.ts`](./src/asar/compatibility.ts).

## Install & Assemble

The workspace requires Node.js 20 or newer. From a source checkout:

```sh
npm install
```

### Project Configuration

For a repeatable build, place this in `uttori-asm.config.json`:

```json
{
  "$schema": "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
  "plugins": [
    {
      "module": "@uttori/asm-plugin-snes",
      "options": {
        "checksumMode": "asar",
        "checksumEnabled": true,
        "asarSuperFxMoveShortAddress": false
      }
    }
  ],
  "target": "snes.sfc",
  "architecture": "snes.65816",
  "includePaths": ["./", "./include"]
}
```

Paths in `includePaths` are resolved from the configuration directory. The entry source's own directory is also searched by the CLI.

### Programmatic Use

```ts
import fs from "node:fs";
import { Assembler } from "@uttori/asm-core";
import {
  createSnesAssemblerEnvironment,
  SNES_TARGET_ID,
} from "@uttori/asm-plugin-snes";

const environment = await createSnesAssemblerEnvironment();
const assembler = new Assembler({
  environment,
  target: SNES_TARGET_ID,
  targetOptions: {
    checksumMode: "asar",
    checksumEnabled: true,
    asarSuperFxMoveShortAddress: false,
  },
});

try {
  assembler.assembleSource("lorom\norg $008000\nsei", "main.asm");
  fs.writeFileSync("main.sfc", assembler.getBinaryOutput());
} finally {
  assembler.dispose();
}
```

Environment and target are required. See the root [generic core usage](../../README.md#generic-core-usage) for custom hosts and staged analysis.

## Hello World for the Super Nintendo (SNES) / Super Famicom (SFC)

Here is the smallest useful kind of Hello World: a self-contained LoROM that boots and puts `HELLO WORLD` on the screen. It does not rely on a BIOS, operating system, text routine, DMA helper, or external font. In short, we must supply eight tiny letter tiles and tell the PPU where every piece lives. There is no `printf` waiting for us.

Save the complete code block below as `hello-world.asm`:

```asm
; hello-world.asm
; A complete, headerless 32 KiB LoROM that displays HELLO WORLD.

lorom                         ; Map CPU $00:8000-$00:FFFF to this ROM.

org $008000                   ; The reset routine begins at CPU $00:8000.

Reset:
  sei                         ; Mask IRQ while the machine is being prepared.
  cld                         ; Binary arithmetic, please-no decimal surprises.
  clc                         ; Clear carry so XCE will select native mode.
  xce                         ; Leave 6502 emulation mode for 65C816 native mode.
  rep #$30                    ; Make A, X, and Y 16-bit for setup and long loops.

  ldx #$1FFF                  ; Give the stack a quiet corner of low RAM.
  txs
  lda #$0000                  ; Direct page starts at $0000.
  tcd
  phk                         ; Copy the program bank ($00) into the data bank.
  plb                         ; Absolute reads below can now reach our font data.

  sep #$20                    ; PPU registers are byte-wide, so make A 8-bit.
  lda #$80
  sta $2100                   ; INIDISP: force blank while changing VRAM/CGRAM.
  stz $4200                   ; NMITIMEN: disable NMI, IRQ, and auto joypad reads.
  stz $420B                   ; MDMAEN: make sure no general DMA channel is active.
  stz $420C                   ; HDMAEN: make sure no H-DMA channel is active.

  ; Configure one modest background layer. Mode 0 gives BG1 four colors per tile,
  ; which is plenty for white letters on black-very public-access television.
  stz $2105                   ; BGMODE: Mode 0, every background uses 8x8 tiles.
  stz $2107                   ; BG1SC: 32x32 tilemap at VRAM word address $0000.
  lda #$01
  sta $210B                   ; BG12NBA: BG1 tiles begin at VRAM word address $1000.
  stz $210D                   ; BG1HOFS is write-twice; set horizontal scroll to 0.
  stz $210D
  stz $210E                   ; BG1VOFS is write-twice; set vertical scroll to 0.
  stz $210E

  ; Clear all 64 KiB of VRAM. $2115=$80 increments the word address after a
  ; write to $2119. With A in 16-bit mode, STA $2118 writes both $2118 and
  ; $2119, so one loop iteration clears one complete VRAM word.
  lda #$80
  sta $2115                   ; VMAIN: increment after the high-byte write.
  stz $2116                   ; VMADDL: start at VRAM word address $0000.
  stz $2117                   ; VMADDH: high byte of that address.
  rep #$20                    ; Make A 16-bit for paired $2118/$2119 writes.
  lda #$0000                  ; Every VRAM word receives zero.
  ldx #$8000                  ; 32,768 words make the SNES's 64 KiB VRAM.

.clear_vram:
  sta $2118                   ; VMDATAL/VMDATAH: write one zero word.
  dex
  bne .clear_vram
  sep #$20                    ; Return A to 8-bit PPU-register duty.

  ; Install palette 0: color 0 is black and color 1 is white. CGRAM colors are
  ; 15-bit BGR values, written low byte and then high byte through $2122.
  stz $2121                   ; CGADD: begin with CGRAM color 0.
  stz $2122                   ; Color 0 low byte:  $00
  stz $2122                   ; Color 0 high byte: $00 -> black ($0000)
  lda #$FF
  sta $2122                   ; Color 1 low byte:  $FF
  lda #$7F
  sta $2122                   ; Color 1 high byte: $7F -> white ($7FFF)

  ; Upload eight 2-bits-per-pixel tiles to VRAM word address $1000. Each row is
  ; two bitplane bytes. Plane 0 draws color 1; plane 1 stays zero throughout.
  stz $2116                   ; VMADDL: low byte of tile-data address $1000.
  lda #$10
  sta $2117                   ; VMADDH: high byte of tile-data address $1000.
  ldx #$0000                  ; X walks over the ROM-resident font bytes.

.copy_font:
  lda FontTiles,x
  sta $2118                   ; Send the row's plane-0 byte to VMDATAL.
  inx
  lda FontTiles,x
  sta $2119                   ; Send plane 1 to VMDATAH, then advance VRAM.
  inx
  cpx.w #FontTilesEnd-FontTiles ; `.w` matches the 16-bit X register explicitly.
  bne .copy_font

  ; Put eleven tile numbers on row 13, column 10 of the 32x32 BG1 tilemap.
  ; 13 * 32 + 10 = 426 = $01AA. A tilemap entry is a two-byte word: tile
  ; number first, then palette/priority/flip flags. Zero selects palette 0.
  lda #$AA
  sta $2116                   ; VMADDL: low byte of tilemap position $01AA.
  lda #$01
  sta $2117                   ; VMADDH: high byte of tilemap position $01AA.
  ldx #$0000                  ; Begin with the H in MessageTiles.

.copy_message:
  lda MessageTiles,x
  sta $2118                   ; Tile number: H, E, L, L, O, space, and so on.
  stz $2119                   ; Palette 0, normal priority, no flipping.
  inx
  cpx.w #MessageTilesEnd-MessageTiles ; Keep this immediate 16-bit as well.
  bne .copy_message

  lda #$01
  sta $212C                   ; TM: show BG1 on the main screen.
  stz $212D                   ; TS: show nothing on the sub screen.
  lda #$0F
  sta $2100                   ; INIDISP: leave forced blank at full brightness.

Forever:
  bra Forever                 ; The picture is static; the CPU may loiter forever.

EmptyHandler:
  rti                         ; Safe landing for any vector we did not enable.

; The message is expressed as indices into the tiny font below:
;   0=space, 1=H, 2=E, 3=L, 4=O, 5=W, 6=R, 7=D.
MessageTiles:
  db $01,$02,$03,$03,$04,$00,$05,$04,$06,$03,$07
MessageTilesEnd:

; Eight 8x8, 2bpp tiles. Each visual row has a plane-0 byte followed by $00
; for plane 1. In the binary drawings, bit 7 is the leftmost pixel.
FontTiles:
  ; Tile 0: space
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00
  db %00000000,$00

  ; Tile 1: H
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %11111111,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %00000000,$00

  ; Tile 2: E
  db %11111111,$00
  db %10000000,$00
  db %10000000,$00
  db %11111110,$00
  db %10000000,$00
  db %10000000,$00
  db %11111111,$00
  db %00000000,$00

  ; Tile 3: L
  db %10000000,$00
  db %10000000,$00
  db %10000000,$00
  db %10000000,$00
  db %10000000,$00
  db %10000000,$00
  db %11111111,$00
  db %00000000,$00

  ; Tile 4: O
  db %01111110,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %01111110,$00
  db %00000000,$00

  ; Tile 5: W
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10010001,$00
  db %10010001,$00
  db %01101110,$00
  db %00000000,$00

  ; Tile 6: R
  db %11111110,$00
  db %10000001,$00
  db %10000001,$00
  db %11111110,$00
  db %10001000,$00
  db %10000100,$00
  db %10000010,$00
  db %00000000,$00

  ; Tile 7: D
  db %11111100,$00
  db %10000010,$00
  db %10000001,$00
  db %10000001,$00
  db %10000001,$00
  db %10000010,$00
  db %11111100,$00
  db %00000000,$00
FontTilesEnd:

; A LoROM internal header occupies CPU $00:FFC0-$00:FFDF.
org $00FFC0
db "HELLO WORLD          " ; Exactly 21 title bytes.
db $20                     ; Map mode: slow LoROM.
db $00                     ; Cartridge type: ROM only.
db $05                     ; ROM size: 2^(5+10) = 32 KiB.
db $00                     ; SRAM size: none.
db $01                     ; Destination: North America.
db $00                     ; Old-style licensee code.
db $00                     ; Mask ROM version 0.
dw $0000, $0000            ; Complement/checksum; the SNES target fills these.

; Native vectors at $FFE0-$FFEF. Reserved words remain zero; every real
; interrupt points at the harmless RTI above.
org $00FFE0
dw $0000, $0000, EmptyHandler, EmptyHandler ; reserved, reserved, COP, BRK
dw EmptyHandler, EmptyHandler, $0000, EmptyHandler ; ABORT, NMI, reserved, IRQ

; Emulation-mode vectors at $FFF0-$FFFF. RESET is the one that starts the show.
dw $0000, $0000, EmptyHandler, $0000       ; reserved, reserved, COP, reserved
dw EmptyHandler, EmptyHandler, Reset, EmptyHandler ; ABORT, NMI, RESET, IRQ/BRK
```

Assemble it from the repository root:

```sh
npm run cli -- hello-world.asm hello-world.sfc
```

The result is a headerless 32 KiB `.sfc` image. Open it in a SNES emulator and the letters should appear near the center of a black screen. The layout is intentionally plain enough to understand in one sitting:

- BG1's tilemap begins at VRAM word address `$0000`
- the font begins at word address `$1000`
- palette entries 0 and 1 provide black and white
- the message is merely eleven tile indices.

Once this clicks, loading a larger font with `incbin` or DMA feels like an upgrade rather than sorcery.

For the hardware side, check the wiki's [first SNES program](https://wiki.superfamicom.org/writing-your-first-snes-program), [background guide](https://wiki.superfamicom.org/backgrounds), [VRAM tile tutorial](https://wiki.superfamicom.org/working-with-vram-part-2-initializing-tiles-and-tile-maps), [palette notes](https://wiki.superfamicom.org/palettes), and [register reference](https://wiki.superfamicom.org/registers) out. The [header tutorial](https://wiki.superfamicom.org/writing-the-header) explains the final 64 bytes. The checksum writer needs the output to reach that internal header; a three-byte experiment assembles, but it gives the finalizer nowhere to put the checksum.

## How an Assembly Session Works

Uttori ASM builds a typed program model and runs three stages:

1. `collectDefinitions` discovers symbols, macros, and structural shape.
2. `resolveLayout` calculates addresses and instruction sizes.
3. `emitProgram` writes bytes and finalizes the output.

The distinction is why forward labels work and why an instruction must estimate the same width it eventually emits. The SNES plugin creates fresh mapper, checksum, optimization, SPC, and freespace state for every assembler session and resets pass-local state between stages. There is no cross-session cartridge poltergeist.

For patches, `baseImage` becomes the initial output. Reads use it when present, and writes replace or extend it. For fresh builds, unwritten gaps are expanded with the active output fill byte, initially `$00`.

## Source Formatting & Syntax

### Encoding & Case

Source files are read as UTF-8. Mnemonics and directive keywords are case-insensitive. Symbol spelling is preserved and should be treated as intentional. The fixtures favor lowercase directives and uppercase hardware mnemonics, which is pleasantly readable but not mandatory.

### Numbers

| Form | Example | Meaning |
| ---- | ------- | ------- |
| Hexadecimal | `$80FF`, `0x80FF` | Base 16 |
| Binary      | `%10110000`       | Base 2 |
| Decimal     | `33023`, `10.5`   | Base 10; expressions may be fractional |
| Immediate   | `#$20`            | Architecture syntax; `#` is removed before numeric evaluation |

Negative and unary-plus values are accepted. `~value` and Asar-style `!value` perform bitwise NOT when `!` cannot begin a define name. `<:value` shifts a value right by 16 bits; it is retained for compatibility with sources that use the form.

The 65C816 encoder also recognizes bank shorthand such as `$12:3456`; see the Asar example [`bank_shorthand.asm`](../../fixtures/asar/tests/bank_shorthand.asm):

```asm
org $008000
	main:
		lda #<:main
		lda #<:test_label
		lda #bank(other_test)

base $038000
	test_label:

base $028000
	other_test:
```

### Comments, Continuation, & Inline Commands

A semicolon begins a comment unless it appears inside a double-quoted string:

```asm
lda #$0F ; this vanishes before parsing
db "semicolon; retained"
```

End a line with `\` or `,` to continue the command on the next physical line:

```asm
db $01, $02,
   $03, $04

function scale(value) = value * \
  4
```

Whitespace-surrounded colons split multiple statements on one line:

```asm
fillbyte $FF : fill $20
```

Colons inside quoted strings are safe. A label colon directly attached to a name remains a label colon.

### Quotes & Directive Prefixes

Single and double quotes are accepted in several tokenized contexts. String data and expression string arguments should normally use double quotes. `@` may prefix a recognized directive, so `@org $008000` routes to `org`; it does not create a second directive family.

Braces `{` and `}` are accepted compatibility no-ops. They can make nested namespace source easier on human retinas, but they do not create block scope by themselves:

```asm
namespace Graphics
{
  Upload:
    rtl
}
namespace off
```

## Architectures

Switch architecture with `arch name`. The architecture selected by configuration is active before the first source line.

| Source name | Canonical Contribution | Purpose |
| ----------- | ---------------------- | ------- |
| `65816`         | `snes.65816`   | Main SNES CPU; default |
| `spc700`        | `snes.spc700`  | SPC code inside an explicit block |
| `spc700-raw`    | `snes.spc700`  | Standalone, mapper-free SPC payload |
| `spc700-inline` | `snes.spc700`  | Asar-compatible implicit SPC block flow |
| `superfx`       | `snes.superfx` | GSU / Super FX code |

Architecture changes are rejected while an explicit SPC block is active. The live editor-facing catalogs are in [`src/tooling/instruction-catalog.ts`](./src/tooling/instruction-catalog.ts); the complete mnemonic tables appear in [Instruction catalogs](#instruction-catalogs).

### WDC 65C816

The default encoder supports the 92 instruction mnemonics (exercised by the parity fixtures) and the standard 65C816 addressing families. Ninety are exposed through the editor catalog; `TSB` and `TRB` are also encoded and tested. The wiki's [65816 reference](https://wiki.superfamicom.org/65816-reference) is the recommended hardware companion, including registers, flags, cycles, and opcode behavior.

```asm
arch 65816

sep #$20
lda #$80       ; one-byte immediate while M=1
rep #$20
lda #$1234     ; two-byte immediate while M=0

lda [$12],y
sta $7E2000,x
jsl UploadTiles
```

The encoder tracks `SEP` and `REP` changes to the M and X flags so immediate accumulator/index operands receive the expected width. Its pass state resets before each assembly stage.

Append `.b`, `.w`, `.l`, or deprecated `.d` to force byte, word, long, or double-width selection where the instruction supports that size:

```asm
lda.b $12
lda.w $0012
lda.l $7E0012
```

An explicit suffix cannot invent an addressing mode the processor does not possess. Parentheses and brackets still decide indirect forms, and branches still enforce their signed displacement range.

`optimize dp none` disables direct-page optimization. `optimize dp ram` and `optimize dp always` enable it. The initial setting is disabled, making size choice conservative unless the operand spelling or suffix is decisive.

### Sony SPC700

The SPC700 is the SNES audio CPU, living in its own address space and RAM. The wiki has a full [SPC700 reference](https://wiki.superfamicom.org/spc700-reference) and a practical explanation of [transferring data to the APU](https://wiki.superfamicom.org/transferring-data-from-rom-to-the-snes-apu).

For a ROM-embedded Nintendo-style transfer block:

```asm
arch 65816
lorom
org $128000

spcblock $6000
Start:
  mov a,#$7F
  mov $20,a
  bra Start
endspcblock execute Start
```

`spcblock destination [nspc]` writes a 16-bit placeholder size and 16-bit destination to the ROM, switches to SPC700 assembly at the destination, and fills the size during output finalization. `endspcblock` returns to the previous architecture. Either `endspcblock execute address` or a preceding `startpos address` appends a zero-size execute record.

```asm
spcblock $5000 nspc
  nop
startpos $5000
endspcblock
```

Rules worth knowing:

- Destinations and execute addresses are 16-bit.
- Blocks cannot nest.
- `arch`, `org`, `namespace`, mapper directives, and freespace directives are unavailable inside a block.
- Missing `endspcblock` is an error at the end of a pass.
- `custom` block mode is recognized but intentionally not implemented.

`arch spc700-raw` selects 1:1 `norom` addressing for a standalone SPC payload. `arch spc700-inline` makes a later `org` begin an implicit SPC block and automatically closes it at pass end, matching the supported Asar inline fixture.

The encoder accepts the canonical forms listed in the appendix plus numbered bit operations such as `bbs0 dp,label`, `bbc7 dp,label`, and carry/bit spellings exercised by [`arch-spc700.asm`](../../fixtures/asar/tests/arch-spc700.asm).

### Super FX

`arch superfx` selects the GSU encoder. The wiki's [Super FX opcode matrix](https://wiki.superfamicom.org/super-fx-opcode-matrix) is a convenient hardware-level grid, while [`arch-superfx.asm`](../../fixtures/asar/tests/arch-superfx.asm) is the byte-parity language tour.

```asm
arch superfx
org $008000

iwt r1,#$1234
move r2,r1
add #3
stw (r4)
bra .again
.again:
  nop
```

Super FX ALT variants are emitted automatically for mnemonics such as `ADC`, `BIC`, `UMULT`, `STB`, and `LDB`; explicit `ALT1`, `ALT2`, and `ALT3` remain available. Register constraints are checked-for example, jumps use `R8` through `R13`, while increment/decrement top out at `R14`.

One compatibility wrinkle deserves a spotlight. Hardware encodes short `LMS`/`SMS` addresses as a word index (`address >> 1`). Asar writes the raw low byte. The plugin defaults to hardware-correct behavior. Set `asarSuperFxMoveShortAddress: true` only when reproducing Asar bytes is the actual goal.

## Memory Maps & the Program Counter

A SNES CPU address is not a file offset. The cartridge decoder maps portions of the 24-bit bus to ROM, often with mirrors. Read the wiki's [memory mapping overview](https://wiki.superfamicom.org/memory-mapping) for the hardware picture; read [`src/target/address-space.ts`](./src/target/address-space.ts) for the exact formulas used here.

### Mapper Directives

| Directive | Internal Mode | ROM Capacity Represented | Preferred CPU Window | Header File Offset |
| --------- | ------------- | ------------------------ | -------------------- | ------------------ |
| `lorom`      | `lorom`     | Up to 4 MiB | Banks with `$8000-$FFFF` ROM windows | `$7FC0` |
| `hirom`      | `hirom`     | Up to 4 MiB | Full high-bank windows | `$FFC0` |
| `exlorom`    | `exlorom`   | Up to 8 MiB | Extended LoROM windows | `$FFC0` in current checksum policy |
| `exhirom`    | `exhirom`   | Up to 8 MiB | Extended HiROM windows | `$FFC0` |
| `sfxrom`     | `sfxrom`    | Super FX layout | GSU-compatible ROM windows | `$FFC0` |
| `sa1rom`     | `sa1rom`    | Bank-selectable SA-1 layout | LoROM-like and C-F windows | `$7FC0` |
| `fullsa1rom` | `bigsa1rom` | Full 8 MiB SA-1 layout | Mirrored half-bank plus C-F windows | `$7FC0` |
| `norom`      | `norom`     | 16 MiB flat logical space | Address equals output offset | none |

The default is `lorom`. Mapper switches are allowed during a source file and are exercised by [`mappers.asm`](../../fixtures/asar/tests/mappers.asm), although real projects are usually easier to reason about with one map per output.

`fastrom` is currently an accepted no-op. It does not alter mapping, the internal header byte, or any generated timing property. FastROM is a cartridge and CPU timing concern, see the wiki's [FastROM tutorial](https://wiki.superfamicom.org/programming-with-fast-roms-for-lorom-mapping), set the ROM header and runtime registers as your program requires.

`sa1rom` optionally accepts four decimal bank selectors:

```asm
sa1rom 0,1,2,3
```

They configure the four one-megabyte Super MMC regions used by the mapper. Without arguments the same `0,1,2,3` arrangement is installed. The [SA-1 overview](https://wiki.superfamicom.org/sa-1) and [SA-1 registers](https://wiki.superfamicom.org/sa-1-registers) explain the coprocessor hardware; this directive only controls assembler-side ROM translation.

### `org`, `base`, and Address Stacks

`org address` moves the physical/logical write position:

```asm
lorom
org $018000
BankOne:
  nop
```

The address must be within the target's 24-bit range. Writing to an unmapped SNES address advances layout but produces no ROM byte; use `snestopc()` or the map source when in doubt.

`base address` changes the logical address seen by labels and operands without seeking the physical output cursor. `base off` returns to the saved physical/base relationship:

```asm
org $128000
base $7E2000
BufferView:
  db $00
base off
```

`pushpc` / `pullpc` save and restore the full output cursor state. `pushbase` / `pullbase` save and restore the current logical base address. Pulling an empty stack is an error.

### Bank Crossing

The default is `check bankcross full`, also spelled `on`. Multi-byte writes may not cross a 64 KiB bank boundary. Modes are:

| Command | Boundary Enforced |
| ------- | ----------------- |
| `check bankcross off`  | No boundary check; mapper-specific PC wrapping is enabled |
| `check bankcross half` | 32 KiB half-bank boundary |
| `check bankcross full` | 64 KiB bank boundary |
| `check bankcross on`   | Alias of `full` |

This validation runs before multi-byte output. The exact edge cases are captured in [`bankcross.asm`](../../fixtures/asar/tests/bankcross.asm) and [`half_bank_check.asm`](../../fixtures/asar/tests/half_bank_check.asm).

### Address Conversion Functions

```asm
dl snestopc($808000) ; logical SNES address -> file offset
dl pctosnes($000000) ; file offset -> preferred logical mirror
```

An unmapped conversion returns `-1`. The preferred address produced by `pctosnes()` is canonical for this implementation, not a promise that no mirrored CPU address reaches the same ROM byte.

## Labels, Namespaces, & Structs

### Main, Local, and Static Labels

A colon defines a normal label at the current logical PC:

```asm
PlayerUpdate:
  lda PlayerState
  rtl
```

Dot labels are scoped below the current parent:

```asm
PlayerUpdate:
.loop:
  dex
  bne .loop
```

Multiple dots walk deeper hierarchy levels in supported Asar-style source. A plain assignment creates a static numeric label rather than a PC label:

```asm
ScreenWidth = 256
```

Static labels can be used where a resolved numeric symbol is required. `global Label:` marks a label as global in namespace-sensitive source.

### Relative Labels

Runs of `+` and `-` create anonymous forward and backward targets. The number of signs is the depth:

```asm
  beq +
  lda #$01
+:

-:
  dex
  bne -
```

Macro-local labels use `?` or `#` forms and receive unique expansion identities, preventing two invocations from stapling their branches together. See [`macrolabels.asm`](../../fixtures/asar/tests/macrolabels.asm).

### Namespaces

```asm
namespace Audio
Upload:
  rtl
namespace off

jsl Audio_Upload
```

`namespace name` prefixes labels with `name_`. `namespace off` or bare `namespace` returns to the empty namespace. `pushns` and `pullns` preserve and restore the namespace; `pullns` without a matching push is an error.

Nested mode builds a path:

```asm
namespace nested on
namespace UI
namespace Inventory
Draw:
  rtl
namespace off
namespace off
namespace nested off

jsl UI_Inventory_Draw
```

`namespace nested off` also clears the current nesting path. The braces used in [`namespaces.asm`](../../fixtures/asar/tests/namespaces.asm) are visual compatibility no-ops; the namespace directives do the real work.

### Structs

Structs define addressable layouts without emitting bytes:

```asm
struct DMA $4300
  .control:     skip 1
  .destination: skip 1
  .source_low:  skip 1
  .source_high: skip 1
  .source_bank: skip 1
  .size_low:    skip 1
  .size_high:   skip 1
endstruct align $10

stz DMA[2].control
lda #$18
sta DMA[2].destination
```

Syntax:

```text
struct name [base]
  .member: skip size
endstruct [align alignment]
```

The base defaults to zero. `align` rounds the final size up, which also controls array stride. Members can be nested through dot labels. Structs can extend another struct:

```asm
struct Actor $7E2000
  .x: skip 2
  .y: skip 2
endstruct

struct Enemy extends Actor
  .health: skip 2
endstruct
```

The parent reserves enough stride for its largest extension, so `Actor[3].Enemy.health` lands in the correct record. `sizeof(name)` returns the defined struct size; `objectsize(name)` follows the expression host's object-size rules. The regression-rich examples are in [`structs.asm`](../../fixtures/asar/tests/structs.asm) and the implementation is [`struct-engine.ts`](../../packages/core/src/services/struct-engine.ts).

## Defines, Expressions, & Functions

### Defines

Defines are textual values prefixed by `!`:

```asm
!Lives = 3
!Message = "READY"

db !Lives
db "!Message"
```

Supported assignment operators are:

| Operator | Behavior |
| ---- | --- |
| `=`  | Store the value; pure math-looking values may be folded |
| `+=` | Append text to the current value |
| `:=` | Resolve referenced defines before storing |
| `#=` | Resolve and evaluate as a math expression, then store decimal text |
| `?=` | Assign only if the define does not already exist |

Remove a define with `undef Name`, `undef !Name`, or `undef "Name"`.

Nested define names use braces:

```asm
!slot = 2
!value2 = $40
db !{value!slot}
```

In string data, `\!Name` emits a literal `!Name`, while `\\` emits one backslash. Defines can expand to comma-separated data lists and can appear in include filenames.

### Operators

Higher rows bind more tightly:

| Precedence | Operators | Meaning |
| --- | --- | --- |
| 6   | `**`                                  | exponentiation |
| 5   | `*`, `/`, `%`                         | multiply, divide, modulo |
| 4   | `+`, `-`                              | add, subtract |
| 3   | `<<`, `>>`, `&`, `|`, `^`             | shifts and bitwise operations |
| 2   | `<`, `>`, `<=`, `>=`, `==`, `=`, `!=` | comparisons, returning `0` or `1` |
| 1   | `&&`                                  | logical AND |
| 0   | `||`                                  | logical OR |

Operators at the same level are left-associative. Parentheses override precedence. Division or modulo by zero is an assembly error.

### Core Built-In Functions

| Family | Functions |
| --- | --- |
| Numeric             | `sqrt`, `sin`, `cos`, `tan`, `asin`/`arcsin`, `acos`/`arccos`, `atan`/`arctan`, `log`, `log10`, `log2`, `ceil`, `floor`, `round` |
| Selection           | `min`, `max`, `clamp`, `safediv`, `select` |
| Logical comparison  | `not`, `equal`, `notequal`, `less`, `lessequal`, `greater`, `greaterequal`, `and`, `or`, `nand`, `nor`, `xor` |
| Address helpers     | `bank(value)`, `offset(from,to)`, `pc()`, `realbase()` |
| Strings and symbols | `stringsequal`, `stringsequalnocase`, `defined`, `sizeof`, `objectsize`, `datasize` |
| Files               | `filesize`, `getfilestatus`, `canreadfile1`...`canreadfile4`, `canreadfile`, `readfile1`...`readfile4` |

File reads are little-endian. `readfileN(filename, position[, default])` accepts a fallback for an unavailable range. `canreadfile(filename, position, size)` handles an arbitrary byte count. `getfilestatus()` returns the host's status code; the supported fixture treats `0` as present.

### SNES Expression Functions

| Function | Current behavior |
| --- | --- |
| `snestopc(address)`        | Convert a mapped CPU address to a ROM offset |
| `pctosnes(offset)`         | Convert a ROM offset to a preferred mapped CPU address |
| `canread1`...`canread4`    | Test a fixed-size range against the base/output image length |
| `canread(position,size)`   | Test an arbitrary range against the base/output image length |
| `read1`...`read4`          | Map a logical SNES address and read a little-endian value |

`readN(position, default)` returns the fallback when the mapped range is unavailable. Without a fallback, reads are disabled until `check title` appears, matching the plugin's selected compatibility policy:

```asm
check title
assert read1($00FFD5) == $20, "Expected LoROM header"
```

When patching, these functions read `baseImage`; on a fresh build they read the current output buffer. The distinction between `canread*` range positions and mapped `read*` logical addresses is deliberate documentation of the current implementation-do not silently substitute one for the other.

### User Functions

```asm
function lowbyte(value) = value & $FF
function tilebytes(count, bpp) = count * 8 * bpp

db lowbyte($1234)
dw tilebytes(16, 4)
```

Definitions may continue with backslash-newline. Parameters are substituted into the expression, and a later definition with the same name replaces the earlier one. Functions return numeric expression values.

## Macros

Macros emit commands, not values:

```asm
macro SetBrightness(level)
  lda #<level>
  sta $2100
endmacro

%SetBrightness($0F)
```

Headers use `macro Name(arg, arg)` and calls use `%Name(value, value)`. Arguments are comma-split with quoted text preserved. Inside the body, `<parameter>` inserts the supplied source text. `!<parameter>` treats the argument as a define name.

Variadic macros put `...` or the single-character ellipsis `…` last:

```asm
macro EmitBytes(required, ...)
  db <required>
  if sizeof(...) > 0
    db <...[0]>
  endif
endmacro

%EmitBytes($10, $20, $30)
```

`sizeof(...)` is the extra-argument count and `<...[expression]>` selects one extra argument. The expression can use defines. Out-of-range indices are errors. The older `<!a>` form for alphabetic variadic positions is accepted but deprecated.

Macro bodies can contain conditionals, `while`, `for`, define assignments, and macro-local labels. Duplicate macro definitions are rejected. See [`variadic_syntax.asm`](../../fixtures/asar/tests/variadic_syntax.asm), [`macrolabels.asm`](../../fixtures/asar/tests/macrolabels.asm), and [`macro-engine.ts`](../../packages/core/src/services/macro-engine.ts).

## Conditionals & Loops

### `if`, `elseif`, `else`, `endif`

```asm
!Region = 1

if !Region == 0
  db "J"
elseif !Region == 1
  db "U"
else
  error "Unknown region"
endif
```

The first nonzero branch runs. Conditions use the same expression parser as data and assertions. Labels in conditions must resolve statically.

### `while`, `endwhile`

```asm
!i = 0
while !i < 4
  db !i
  !i #= !i + 1
endwhile
```

The engine caps a while loop at 10,000 iterations. Define values modified as loop variables are restored after the loop, matching the assembler's scoped expansion behavior. For Asar compatibility, an `endif` may close an innermost `while` in legacy source; prefer `endwhile` in new work because future-you deserves kindness.

### `for`, `endfor`

```asm
for i = 0..3
  db i
endfor
```

The range is inclusive and may descend:

```asm
for i = 3..0
  db i
endfor
```

The loop variable is exposed through define resolution during the body and restored afterward. See [`forloop.asm`](../../fixtures/asar/tests/forloop.asm).

## Binary Data & Character Tables

### Data Directives

| Directive | Width | Aliases |
| --------- | ----- | ------- |
| `db` | 1 byte                 | `dc.b` |
| `dw` | 2 bytes, little-endian | `dc.w` |
| `dl` | 3 bytes, little-endian | `dc.l` |
| `dd` | 4 bytes, little-endian | none |

```asm
db $12, $34
dw $1234          ; 34 12
dl $123456        ; 56 34 12
dd $12345678      ; 78 56 34 12
db "SUPER FAMICOM"
```

Values are truncated to the selected width. Strings emit one mapped value per Unicode character, truncated to the directive width. Defines may expand to whole lists:

```asm
!Palette = $001F,$03E0,$7C00
dw !Palette
```

### Character Tables

Assign one character directly:

```asm
"A" = $40
db "A"
```

Load an Asar-style table file:

```asm
table "font.tbl",ltr
db "READY"
cleartable
```

LTR lines use `character=hex`; RTL lines use `hex=character`. A leading space can be the mapped character, so table lines are not casually trimmed. Loading a table replaces the active mapping. Unmapped characters fall back to their code point.

`pushtable` saves a copy, `pulltable` restores it, and `cleartable` restores identity fallback. Pulling an empty table stack is an error. See [`data/table.asm`](../../fixtures/asar/tests/data/table.asm) and [`misc.ts`](../../packages/core/src/directives/misc.ts).

## Source & Binary Includes

### `incsrc`, `include`, and `includeonce`

```asm
incsrc "hardware/registers.asm"
include "code/player.asm"
```

Both forms assemble another source file inline through the include service. `incsrc` and `include` preserve distinct host operations for compatibility, but ordinary source can think of both as source inclusion.

Place `includeonce` inside an included file to guard it once per assembly stage:

```asm
includeonce
!PPU_INIDISP = $2100
```

Relative paths resolve against the current source and configured include paths. Quoted paths may contain spaces. Defines expand in filenames; write `\!` inside a quoted path for a literal exclamation mark. Include cycles and missing files are diagnosed.

`includefrom` is only an accepted no-op today; it does not assert or change the include graph.

### `incbin`

Embed a whole file:

```asm
incbin "tiles.bin"
```

Use an inclusive start and exclusive end range:

```asm
incbin "tiles.bin":$100..$180
```

An end of `0` means EOF. The deprecated `start-end` spelling is supported for Asar fixtures, including parenthesized math, but `..` is clearer and less likely to make a minus sign audition for the wrong role.

Seek temporarily with `->` and then restore the original PC:

```asm
incbin "header.bin" -> HeaderLocation
```

The target may be a label, hexadecimal address, or decimal address. Inverted ranges, out-of-file bounds, malformed expressions, and absent targets are errors. The full grammar is tested in [`incbin.asm`](../../fixtures/asar/tests/incbin.asm) and [`include-source.test.ts`](../../tests/directives/include-source.test.ts).

## Fill, pad, and freespace

### Fill Patterns

```asm
fillbyte  $12 : fill 4   ; 12 12 12 12
fillword  $1234 : fill 4 ; 34 12 34 12
filllong  $123456
filldword $12345678
```

`fillbyte`, `fillword`, `filllong`, and `filldword` tile a little-endian value into a 12-byte repeating fill pattern. `fill count` emits exactly `count` bytes from that pattern. Zero is a no-op; negative and malformed counts fail through numeric or write validation.

### Padding

`padbyte`, `padword`, `padlong`, and `paddword` choose a little-endian pad unit. With a target, `pad` fills until that mapped logical address:

```asm
padbyte $FF
pad $018000
```

With no address, `pad` fills to the next 64 KiB boundary. A target at or behind the current output position is a no-op. An unmapped target is an error.

### Freespace & RATS

```asm
freespacebyte $FF
freecode
InjectedRoutine:
  rtl
```

`freecode`, `freedata`, and `freespace` currently share one allocator. It chooses `max($080000, current base/output length)`, expands the output to at least 1 MiB, writes an eight-byte `STAR` RATS header, and places content immediately afterward. During finalization it fills the RATS length and complement from the bytes written in the active block.

This is deterministic append-style allocation, not a general scanner that hunts every island of free bytes in an arbitrary ROM. Multiple sophisticated allocations, shrinking old blocks, alignment settings, and SA-1/Super FX-specific freespace policies remain outside the supported contract.

`freespacebyte value` sets both the expansion fill byte and the active output fill byte. Freespace is unavailable in `norom` and inside `spcblock`.

`prot label[,label...]` emits an Asar-style `PROT` record containing 24-bit label addresses. Unresolved labels are temporarily encoded as zero during early stages and resolved during emission. `autoclean` and `autoclear` are accepted no-ops; they do not reclaim an earlier RATS block.

## Diagnostics & Checks

### Assertions & Explicit Errors

```asm
assert sizeof(DMA) == $10, "DMA layout changed"
error "This configuration is not supported"
warnpc $80FFFF
```

`assert condition[, message...]` continues when the condition is nonzero and fails otherwise. Message pieces are top-level comma-split and concatenated; quoted pieces are dequoted. Print helper functions inside messages are not evaluated yet.

`error [message...]` always fails. `warnpc address` fails only when the current logical PC is strictly greater than the bound. Despite its historical name, `warnpc` is an error gate in this implementation.

### `check`

Implemented forms are:

```asm
check bankcross off|half|full|on
check title
```

`check title` enables `read1`...`read4` without a default value. It does not inspect or validate the ROM title. Any other `check` form is rejected.

### Warnings & Text Output

`warnings`, `print`, and `warn` are currently accepted compatibility no-ops. They produce no user-visible message and do not maintain warning state. `dpbase`, `optimize address ...`, `asar version`, `fastrom`, and several legacy cleanup directives follow the same no-op policy described below.

There is therefore no stable “all warnings” table equivalent to Asar's manual, and no promise that Asar warning identifiers map to Uttori diagnostics. Errors come from the typed parser, directive handlers, encoders, plugin hooks, and file services; preserve the complete error text when reporting a failure.

## Output, Checksums & Patching

### Target Options

| Option | Values | Default | Effect |
| ------ | ------ | ------- | ------ |
| `checksumMode`                | `"asar"`, `"simple"` | `"asar"` | Choose mirrored-tail or direct byte summation |
| `checksumEnabled`             | boolean              | `true`   | Write checksum and complement when a header exists |
| `asarSuperFxMoveShortAddress` | boolean              | `false`  | Reproduce Asar's Super FX short-MOVE operand quirk |

Invalid `checksumMode` values fail during plugin activation. Non-boolean `checksumEnabled` values normalize to `false`; use real JSON booleans rather than strings.

### Checksum Finalization

For mapped ROM modes, the output finalizer locates the header according to the mapper, temporarily sets complement/checksum to `$FFFF/$0000`, computes the 16-bit sum, and writes `~checksum` plus `checksum` at header offsets `$1C` and `$1E`.

`simple` sums every output byte once. `asar` does the same for power-of-two images; for a non-power-of-two image it mirrors the trailing region to the next power-of-two shape before summing. That mirrors common cartridge behavior described by the wiki's [non-power-of-two ROM size](https://wiki.superfamicom.org/non-power-of-two-rom-size) article.

Selecting `norom` disables checksum output. If the image is too short to contain the chosen header plus its checksum fields, finalization leaves it alone.

### Fresh Output versus a Patch

Without `--base-image`, output grows from an empty byte array and gaps use the current fill byte. With a base image, the assembler begins with a copy of those bytes. This makes the following a patch:

```asm
lorom
check title
assert read1($00FFD5) == $20, "Wrong base ROM map"

org $0A8000
db $EA,$EA,$EA
```

```sh
npm run cli -- patch.asm patched.sfc --base-image clean.sfc
```

The CLI writes a new output path; it does not overwrite the base path unless you explicitly choose the same path. Keeping a pristine base ROM is still the civilized move.

## Asar & ca65 Compatibility

The SNES plugin targets _practical_ Asar & ca65 compatibility, including 65816, SPC700/inline SPC, Super FX, mapper and checksum behavior, freespace/RATS allocation, and selected compatibility no-ops. Not every Asar feature is implemented, nor is it planned. Focused fixtures live in `fixtures/external`:

- [Chou Makaimura](https://github.com/FredYeye/Super-Ghouls-n-Ghosts-Disassembly)
- [Super Mario RPG](https://github.com/Yoshifanatic1/Super-Mario-RPG-Disassembly)
- [Teenage Mutant Ninja Turtle](https://github.com/Yoshifanatic1/TMNT-IV---Turtles-In-Time-SNES-Disassembly)
- [Yoshi's Island](https://github.com/Yoshifanatic1/Yoshi-s-Island-Disassembly)
- [Zelda NES](https://github.com/aldonunez/zelda1-disassembly)

These disassembly projects provide extra byte-parity gates once their submodules are initialized. Deferred syntax remains visible under `fixtures/asar/tests/Unsupported`.

Compatibility policy is isolated in `plugins/snes/src/asar/compatibility.ts`.

### Implemented & Parity-Tested Families

- 65C816 instructions, size suffixes, M/X immediate tracking, branches, and major addressing modes.
- SPC700 instructions, explicit NSPC blocks, raw SPC output, and inline SPC compatibility.
- Super FX instructions and explicit hardware-versus-Asar short-address policy.
- LoROM, HiROM, ExLoROM, ExHiROM, Super FX ROM, SA-1, full SA-1, and flat `norom` translation.
- `org`, `base`, address stacks, mapper-aware PC stepping, and bank-cross checks.
- Labels, local/relative/macro labels, namespaces, structs, defines, macros, functions, conditionals, and loops.
- Data directives, strings, character tables, include guards, binary ranges, fill, pad, selected read helpers, and diagnostics.
- Deterministic RATS allocation and `prot` records.
- Mapper-aware checksum finalization and non-power-of-two Asar checksum behavior.

The top-level supported fixtures under [`fixtures/asar/tests`](../../fixtures/asar/tests) are a byte-parity contract. Production fixtures add slideshow, Chou Makaimura, Yoshi's Island, and large disassembly workloads.

### Accepted Compatibility no-ops

| Keyword | What acceptance means today |
| ------- | --- |
| `fastrom`                | Does not alter mapping, speed, or header bytes |
| `dpbase`                 | Does not change direct-page calculation |
| `warnings`               | Does not push, pull, enable, or disable warning state |
| `print`                  | Produces no output |
| `warn`                   | Produces no warning |
| `autoclean`, `autoclear` | Do not locate or erase old freespace |
| `includefrom`            | Does not validate the include parent |
| `asar`                   | Does not enforce a version |
| `reset`                  | Does not reset assembler or mapper state |
| `{`, `}`                 | Visual grouping only |

These are centralized in [`src/asar/compatibility.ts`](./src/asar/compatibility.ts). They are intentionally few: silently swallowing an unknown command is worse than an honest error.

### Known Unsupported or Partial Families

The files in [`fixtures/asar/tests/Unsupported`](../../fixtures/asar/tests/Unsupported) are the living deferral list. Major themes include:

- full `autoclean` lifecycle, repeated cleanup, freespace shrinking, alignment, and large multi-block allocation;
- `segment`, `freespace_settings`, SA-1/Super FX specialized freespace, and `prot` edge cases;
- custom `spcblock` macros, SPC opcode synonyms, and `db` directly in raw/alternate SPC compatibility modes not covered by the supported aliases;
- pseudo-opcodes and optimizer/warning behavior beyond `optimize dp`;
- standard include/define discovery (`std`, built-in defines) and table-file variants beyond the documented `table` loader;
- complete Asar warning controls, warning immediates, warning catalogs, and compatibility error wording;
- `xkas` emulation, protection directives, and several malformed variadic/macro edge cases.

## Command Index

The active SNES target combines core directives with plugin directives. “No-op” below means accepted for source compatibility without the Asar side effect.

| Command | Syntax | Status & Effect |
| ------- | ------ | --------------- |
| `db`, `dc.b`                        | `db value[,value...]` | Emit 8-bit values or mapped string characters |
| `dw`, `dc.w`                        | `dw value[,value...]` | Emit little-endian 16-bit values |
| `dl`, `dc.l`                        | `dl value[,value...]` | Emit little-endian 24-bit values |
| `dd`                                | `dd value[,value...]` | Emit little-endian 32-bit values |
| `fillbyte/word/long/dword`          | `fillbyte value` | Set repeating fill pattern width/value |
| `fill` | `fill count`               | Emit bytes from the current fill pattern |
| `padbyte/word/long/dword`           | `padbyte value` | Set pad unit width/value |
| `pad` | `pad [address]`             | Pad to a mapped address or next 64 KiB boundary |
| `incsrc` | `incsrc "file"`          | Assemble a source file inline |
| `include` | `include "file"`        | Include a source file inline |
| `includeonce` | `includeonce`       | Guard the current file once per stage |
| `incbin`                            | `incbin "file"[:range] [-> target]` | Embed binary bytes, optionally sliced or relocated |
| `base`                              | `base address|off` | Change or restore logical base address |
| `org`                               | `org address` | Set mapped write position |
| `pushbase`, `pullbase`              | no operands | Save/restore logical base address |
| `pushpc`, `pullpc`                  | no operands | Save/restore the full PC state |
| `arch`                              | `arch name` | Select 65816, SPC700 mode, or Super FX |
| `lorom`, `hirom`                    | no operands | Select standard SNES ROM map |
| `exlorom`, `exhirom`                | no operands | Select extended SNES ROM map |
| `sfxrom`                            | no operands | Select Super FX ROM map |
| `norom`                             | no operands | Select flat 1:1 output; disables checksum/freespace |
| `sa1rom`                            | `sa1rom [a,b,c,d]` | Select SA-1 map and optional decimal bank selectors |
| `fullsa1rom`                        | no operands | Select full/big SA-1 map |
| `fastrom`                           | no operands | Accepted no-op |
| `namespace`                         | `namespace [name|off|nested on|nested off]` | Set or configure label namespace |
| `pushns`, `pullns`                  | no operands | Save/restore namespace state |
| `table`                             | `table "file"[,ltr|rtl]` | Replace character mappings from a table file |
| `cleartable`                        | no operands | Restore identity fallback |
| `pushtable`, `pulltable`            | no operands | Save/restore character mapping |
| `freecode`, `freedata`, `freespace` | no operands | Append one RATS-protected allocation |
| `freespacebyte`                     | `freespacebyte value` | Set freespace/output expansion byte |
| `prot`                              | `prot label[,label...]` | Emit a RATS protection record |
| `spcblock`                          | `spcblock destination [nspc]` | Begin ROM-embedded SPC block |
| `endspcblock`                       | `endspcblock [execute address]` | Finish SPC block and optionally emit execute record |
| `startpos`                          | `startpos address` | Save execute address for active SPC block |
| `struct`                            | `struct name [base|extends parent]` | Begin non-emitting layout definition |
| `skip`                              | `.member: skip size` | Advance current struct member offset |
| `endstruct`                         | `endstruct [align value]` | Finalize struct size/stride |
| `undef`                             | `undef [!]name` | Remove a textual define |
| `global`                            | `global Label:` | Define a namespace-independent global label |
| character assignment                | `"A" = value` | Set one active character mapping |
| `if`, `elseif`, `else`, `endif`     | block syntax | Conditional assembly |
| `while`, `endwhile`                 | block syntax | Conditional repeated assembly |
| `for`, `endfor`                     | `for name = start..end` | Inclusive counted assembly loop |
| `macro`, `endmacro`                 | `macro name(args)` | Define a command macro |
| `function`                          | `function name(args) = expression` | Define a numeric expression function |
| `assert`                            | `assert condition[,message...]` | Fail when condition is zero |
| `error`                             | `error [message...]` | Always fail |
| `warnpc`                            | `warnpc address` | Fail when PC exceeds address |
| `check`                             | `check title` or `check bankcross mode` | Enable reads or configure bank boundary policy |
| `optimize`                          | `optimize dp none|ram|always` | Configure direct-page size optimization; other forms ignored |
| `dpbase`                            | any | Accepted no-op |
| `warnings`                          | any | Accepted no-op |
| `print`                             | any | Accepted no-op |
| `warn`                              | any | Accepted no-op |
| `autoclean`, `autoclear`            | any | Accepted no-op |
| `includefrom`                       | any | Accepted no-op |
| `asar`                              | any | Accepted no-op |
| `reset`, `{`, `}`                   | any | Accepted no-op |

## Troubleshooting

### “The output is empty at my `org` address”

The logical address probably does not map to ROM in the current mapper. Check the `snestopc(address)` output, confirm the mapper was selected before `org`, and remember that WRAM banks `$7E-$7F` are not cartridge ROM.

### “My immediate instruction changed size between passes”

Keep `SEP`/`REP` flow deterministic and visible to the assembler. When necessary, force `.b` or `.w`. A forward-dependent status mask is legal-looking source but a lousy size oracle.

### “`read1` says the address is out of bounds”

Supply `--base-image` for a patch, verify the CPU address maps under the selected mapper, and either use a default (`read1(addr,$FF)`) or opt in with `check title`.

### “My SPC bytes went nowhere”

Use an explicit `spcblock` for ROM transfer data, `spc700-raw` for a standalone payload, or the deliberately compatible `spc700-inline` flow. Plain `arch spc700` does not make SNES ROM and SPC RAM share an address space.

### “`print`/`warn`/`warnings` did nothing”

Correct: they are accepted no-ops. Use `assert`, `error`, host diagnostics, or structured trace facilities for behavior that exists today.

### “Freespace overwrote or ignored a hole”

The allocator appends at or beyond 512 KiB; it does not scan arbitrary `$FF` runs. For complex patch allocation, manage explicit `org` locations.

### “Asar accepts this file”

If you think it should be working here, and not in the mentioned compatibility above, please open an issue.

## Code and Fixture Layout

| Topic | Implementation | Executable examples/tests |
| --- | --- | --- |
| Plugin registration and options  | [`src/index.ts`](./src/index.ts) | [`assembler.integration.test.ts`](./tests/assembler.integration.test.ts) |
| 65C816 encoder                   | [`src/architectures/65816.ts`](./src/architectures/65816.ts) | [`arch-65816.asm`](../../fixtures/asar/tests/arch-65816.asm), [`opcodesize.asm`](../../fixtures/asar/tests/opcodesize.asm) |
| SPC700 encoder/runtime           | [`src/architectures/spc700.ts`](./src/architectures/spc700.ts), [`src/services/spc-runtime.ts`](./src/services/spc-runtime.ts) | [`arch-spc700.asm`](../../fixtures/asar/tests/arch-spc700.asm), [`spcblock.asm`](../../fixtures/asar/tests/spcblock.asm) |
| Super FX encoder                 | [`src/architectures/superfx.ts`](./src/architectures/superfx.ts) | [`arch-superfx.asm`](../../fixtures/asar/tests/arch-superfx.asm) |
| Mapper and checksum policy       | [`src/target/address-space.ts`](./src/target/address-space.ts), [`src/asar/compatibility.ts`](./src/asar/compatibility.ts) | [`mappers.asm`](../../fixtures/asar/tests/mappers.asm), [`compatibility-profile.test.ts`](./tests/compatibility-profile.test.ts) |
| Freespace                        | [`src/directives/freespace.ts`](./src/directives/freespace.ts) | [`freespace.test.ts`](./tests/directives/freespace.test.ts) |
| SPC directives                   | [`src/services/spc-runtime.ts`](./src/services/spc-runtime.ts) | [`spc.test.ts`](./tests/directives/spc.test.ts) |
| Defines/macros/structs           | [`define-engine.ts`](../../packages/core/src/services/define-engine.ts), [`macro-engine.ts`](../../packages/core/src/services/macro-engine.ts), [`struct-engine.ts`](../../packages/core/src/services/struct-engine.ts) | [`v140features.asm`](../../fixtures/asar/tests/v140features.asm), [`structs.asm`](../../fixtures/asar/tests/structs.asm) |
| Includes and binary ranges       | [`include-source.ts`](../../packages/core/src/directives/include-source.ts) | [`incbin.asm`](../../fixtures/asar/tests/incbin.asm), [`includeonce.asm`](../../fixtures/asar/tests/includeonce.asm) |
| Character tables and diagnostics | [`misc.ts`](../../packages/core/src/directives/misc.ts) | [`misc.test.ts`](../../tests/directives/misc.test.ts) |
| Deferred compatibility           | [`fixtures/asar/tests/Unsupported`](../../fixtures/asar/tests/Unsupported) | Each filename identifies an uncovered family |

## Instruction Catalogs

These tables come from the same descriptors used by hover and completion. They list canonical accepted operand spellings; the encoders also recognize fixture-backed aliases and size-forced variants described above. For opcode bytes, processor flags, timing, and silicon behavior, use the linked hardware references.

### 65C816 Instruction Catalog

| Mnemonic | What it does | Accepted operand forms |
| --- | --- | --- |
| `ADC` | Add with carry to the accumulator. | `#const`, `dp`, `dp,x`, `(dp)`, `[dp]`, `(dp,x)`, `(dp),y`, `[dp],y`, `addr`, `addr,x`, `addr,y`, `long`, `long,x`, `sr,s`, `(sr,s),y` |
| `AND` | Bitwise AND with the accumulator. | `#const`, `dp`, `dp,x`, `(dp)`, `[dp]`, `(dp,x)`, `(dp),y`, `[dp],y`, `addr`, `addr,x`, `addr,y`, `long`, `long,x`, `sr,s`, `(sr,s),y` |
| `ASL` | Arithmetic shift left. | `a`, `dp`, `dp,x`, `addr`, `addr,x` |
| `BCC` | Branch if carry clear. | `label` |
| `BCS` | Branch if carry set. | `label` |
| `BEQ` | Branch if equal (zero set). | `label` |
| `BIT` | Test bits against the accumulator. | `#const`, `dp`, `dp,x`, `addr`, `addr,x` |
| `BMI` | Branch if minus (negative set). | `label` |
| `BNE` | Branch if not equal (zero clear). | `label` |
| `BPL` | Branch if plus (negative clear). | `label` |
| `BRA` | Branch always. | `label` |
| `BRK` | Software break / interrupt. | `implied` |
| `BRL` | Branch always long (16-bit relative). | `label` |
| `BVC` | Branch if overflow clear. | `label` |
| `BVS` | Branch if overflow set. | `label` |
| `CLC` | Clear carry flag. | `implied` |
| `CLD` | Clear decimal flag. | `implied` |
| `CLI` | Clear interrupt-disable flag. | `implied` |
| `CLV` | Clear overflow flag. | `implied` |
| `CMP` | Compare with the accumulator. | `#const`, `dp`, `dp,x`, `(dp)`, `[dp]`, `(dp,x)`, `(dp),y`, `[dp],y`, `addr`, `addr,x`, `addr,y`, `long`, `long,x`, `sr,s`, `(sr,s),y` |
| `COP` | Coprocessor enable interrupt. | `#const` |
| `CPX` | Compare with the X register. | `#const`, `dp`, `addr` |
| `CPY` | Compare with the Y register. | `#const`, `dp`, `addr` |
| `DEC` | Decrement memory or the accumulator. | `a`, `dp`, `dp,x`, `addr`, `addr,x` |
| `DEX` | Decrement the X register. | `implied` |
| `DEY` | Decrement the Y register. | `implied` |
| `EOR` | Bitwise exclusive-OR with the accumulator. | `#const`, `dp`, `dp,x`, `(dp)`, `[dp]`, `(dp,x)`, `(dp),y`, `[dp],y`, `addr`, `addr,x`, `addr,y`, `long`, `long,x`, `sr,s`, `(sr,s),y` |
| `INC` | Increment memory or the accumulator. | `a`, `dp`, `dp,x`, `addr`, `addr,x` |
| `INX` | Increment the X register. | `implied` |
| `INY` | Increment the Y register. | `implied` |
| `JML` | Jump long (24-bit). | `long`, `[addr]` |
| `JMP` | Jump. | `addr`, `(addr)`, `(addr,x)` |
| `JSL` | Jump to subroutine long. | `long` |
| `JSR` | Jump to subroutine. | `addr`, `(addr,x)` |
| `LDA` | Load the accumulator. | `#const`, `dp`, `dp,x`, `(dp)`, `[dp]`, `(dp,x)`, `(dp),y`, `[dp],y`, `addr`, `addr,x`, `addr,y`, `long`, `long,x`, `sr,s`, `(sr,s),y` |
| `LDX` | Load the X register. | `#const`, `dp`, `dp,y`, `addr`, `addr,y` |
| `LDY` | Load the Y register. | `#const`, `dp`, `dp,x`, `addr`, `addr,x` |
| `LSR` | Logical shift right. | `a`, `dp`, `dp,x`, `addr`, `addr,x` |
| `MVN` | Block move next (ascending). | `destBank,srcBank` |
| `MVP` | Block move previous (descending). | `destBank,srcBank` |
| `NOP` | No operation. | `implied` |
| `ORA` | Bitwise OR with the accumulator. | `#const`, `dp`, `dp,x`, `(dp)`, `[dp]`, `(dp,x)`, `(dp),y`, `[dp],y`, `addr`, `addr,x`, `addr,y`, `long`, `long,x`, `sr,s`, `(sr,s),y` |
| `PEA` | Push effective absolute address. | `addr` |
| `PEI` | Push effective indirect address. | `(dp)` |
| `PER` | Push effective PC-relative address. | `label` |
| `PHA` | Push the accumulator. | `implied` |
| `PHB` | Push the data bank register. | `implied` |
| `PHD` | Push the direct page register. | `implied` |
| `PHK` | Push the program bank register. | `implied` |
| `PHP` | Push the processor status register. | `implied` |
| `PHX` | Push the X register. | `implied` |
| `PHY` | Push the Y register. | `implied` |
| `PLA` | Pull the accumulator. | `implied` |
| `PLB` | Pull the data bank register. | `implied` |
| `PLD` | Pull the direct page register. | `implied` |
| `PLP` | Pull the processor status register. | `implied` |
| `PLX` | Pull the X register. | `implied` |
| `PLY` | Pull the Y register. | `implied` |
| `REP` | Reset status bits. | `#const` |
| `ROL` | Rotate left through carry. | `a`, `dp`, `dp,x`, `addr`, `addr,x` |
| `ROR` | Rotate right through carry. | `a`, `dp`, `dp,x`, `addr`, `addr,x` |
| `RTI` | Return from interrupt. | `implied` |
| `RTL` | Return from subroutine long. | `implied` |
| `RTS` | Return from subroutine. | `implied` |
| `SBC` | Subtract with borrow from the accumulator. | `#const`, `dp`, `dp,x`, `(dp)`, `[dp]`, `(dp,x)`, `(dp),y`, `[dp],y`, `addr`, `addr,x`, `addr,y`, `long`, `long,x`, `sr,s`, `(sr,s),y` |
| `SEC` | Set carry flag. | `implied` |
| `SED` | Set decimal flag. | `implied` |
| `SEI` | Set interrupt-disable flag. | `implied` |
| `SEP` | Set status bits. | `#const` |
| `STA` | Store the accumulator. | `dp`, `dp,x`, `(dp)`, `[dp]`, `(dp,x)`, `(dp),y`, `[dp],y`, `addr`, `addr,x`, `addr,y`, `long`, `long,x`, `sr,s`, `(sr,s),y` |
| `STP` | Stop the processor. | `implied` |
| `STX` | Store the X register. | `dp`, `dp,y`, `addr` |
| `STY` | Store the Y register. | `dp`, `dp,x`, `addr` |
| `STZ` | Store zero to memory. | `dp`, `dp,x`, `addr`, `addr,x` |
| `TRB` | Test accumulator bits and reset them in memory. | `dp`, `addr` |
| `TSB` | Test accumulator bits and set them in memory. | `dp`, `addr` |
| `TAX` | Transfer accumulator to X. | `implied` |
| `TAY` | Transfer accumulator to Y. | `implied` |
| `TCD` | Transfer accumulator to direct page register. | `implied` |
| `TCS` | Transfer accumulator to stack pointer. | `implied` |
| `TDC` | Transfer direct page register to accumulator. | `implied` |
| `TSC` | Transfer stack pointer to accumulator. | `implied` |
| `TSX` | Transfer stack pointer to X. | `implied` |
| `TXA` | Transfer X to accumulator. | `implied` |
| `TXS` | Transfer X to stack pointer. | `implied` |
| `TXY` | Transfer X to Y. | `implied` |
| `TYA` | Transfer Y to accumulator. | `implied` |
| `TYX` | Transfer Y to X. | `implied` |
| `WAI` | Wait for interrupt. | `implied` |
| `WDM` | Reserved (William D. Mensch) opcode. | `#const` |
| `XBA` | Exchange the bytes of the accumulator. | `implied` |
| `XCE` | Exchange carry and emulation flags. | `implied` |

### SPC700 Instruction Catalog

The compact catalog shows representative canonical forms. The encoder additionally covers the register, indexed, bit, carry, and branch variants in the [SPC700 parity fixture](../../fixtures/asar/tests/arch-spc700.asm).

| Mnemonic | What it does | Accepted operand forms |
| --- | --- | --- |
| `MOV` | Move data between registers and memory. | `A,#const`, `A,dp`, `A,!addr`, `dp,A`, `!addr,A`, `A,(X)`, `dp,dp`, `dp,#const` |
| `ADC` | Add with carry. | `A,#const`, `A,dp`, `A,!addr`, `dp,dp` |
| `SBC` | Subtract with borrow. | `A,#const`, `A,dp`, `A,!addr` |
| `CMP` | Compare. | `A,#const`, `A,dp`, `A,!addr` |
| `AND` | Bitwise AND. | `A,#const`, `A,dp` |
| `OR`  | Bitwise OR. | `A,#const`, `A,dp` |
| `EOR` | Bitwise exclusive-OR. | `A,#const`, `A,dp` |
| `INC` | Increment. | `A`, `dp` |
| `DEC` | Decrement. | `A`, `dp` |
| `ASL` | Arithmetic shift left. | `A`, `dp` |
| `LSR` | Logical shift right. | `A`, `dp` |
| `ROL` | Rotate left. | `A`, `dp` |
| `ROR` | Rotate right. | `A`, `dp` |
| `BRA`, `BEQ`, `BNE`, `BCS`, `BCC` | Branch on the named condition. | `label` |
| `BVS`, `BVC`, `BMI`, `BPL` | Branch on the named condition. | `label` |
| `CBNE` | Compare and branch if not equal. | `dp,label` |
| `DBNZ` | Decrement and branch if not zero. | `dp,label` |
| `JMP`  | Jump. | `!addr`, `[!addr+X]` |
| `CALL` | Call subroutine. | `!addr` |
| `RET`, `RETI`, `NOP` | Return or no operation. | `implied` |
| `CLRC`, `SETC`, `CLRP`, `SETP` | Clear/set carry or direct-page flag. | `implied` |
| `EI`, `DI`, `STOP` | Interrupt/processor control. | `implied` |
| `PUSH`, `POP` | Transfer a register to/from the stack. | `A` (other fixture-backed registers are encoder-supported) |

Numbered `BBS0`...`BBS7` and `BBC0`...`BBC7` bit branches are supported even though they are normalized by the encoder rather than stored as 16 separate catalog rows.

The complete fixture-backed SPC700 mnemonic set is:

```text
ADC AND EOR OR SBC ASL LSR ROL ROR
BBC0 BBC1 BBC2 BBC3 BBC4 BBC5 BBC6 BBC7
BBS0 BBS1 BBS2 BBS3 BBS4 BBS5 BBS6 BBS7
BPL BRA BMI BVC BVS BCC BCS BNE BEQ
SET0 SET1 SET2 SET3 SET4 SET5 SET6 SET7
CLR0 CLR1 CLR2 CLR3 CLR4 CLR5 CLR6 CLR7
CMP CBNE DBNZ DAA DAS NOT1 XCN MOV1 DECW INCW CMPW ADDW SUBW MOVW MUL DIV
DEC INC MOV OR1 AND1 EOR1 TCALL TSET TCLR CALL PCALL JMP PUSH POP NOP BRK
RET RETI CLRP SETP CLRC SETC EI DI CLRV NOTC SLEEP STOP
```

### Super FX Instruction Catalog

| Mnemonic group | What it does | Accepted operand forms |
| --- | --- | --- |
| `STOP`, `NOP`, `CACHE`, `LSR`, `ROL`, `LOOP` | Core implied operations | `implied` |
| `ALT1`, `ALT2`, `ALT3` | Select alternate opcode family | `implied` |
| `PLOT`, `SWAP`, `COLOR`, `NOT`, `MERGE`, `SBK` | Pixel/data operations | `implied` |
| `SEX`, `ASR`, `ROR`, `LOB`, `FMULT`, `HIB` | Arithmetic/byte operations | `implied` |
| `GETC`, `GETB`, `RPIX`, `CMODE`, `DIV2`, `LMULT` | ROM/pixel/arithmetic operations | `implied` |
| `GETBH`, `RAMB`, `GETBL`, `ROMB`, `GETBS` | ROM/RAM bank and byte operations | `implied` |
| `BRA`, `BGE`, `BLT`, `BNE`, `BEQ`, `BPL`, `BMI`, `BCC`, `BCS`, `BVC`, `BVS` | Relative branches | `label` |
| `TO`, `WITH`, `FROM` | Select source/destination register | `Rn` |
| `ADD`, `ADC`, `SUB` | Arithmetic on SReg | `Rn`, `#n` |
| `SBC`, `CMP` | Arithmetic/compare on SReg | `Rn` |
| `AND`, `BIC`, `OR`, `XOR`, `MULT`, `UMULT` | Logic and multiply | `Rn`, `#n` |
| `JMP`, `LJMP` | Jump through register | `Rn` (`R8`-`R13`) |
| `INC`, `DEC` | Change register | `Rn` (`R0`-`R14`) |
| `LINK` | Set `R11` to `PBR:PC+n` | `#n` |
| `STW`, `LDW`, `STB`, `LDB` | Word/byte RAM transfer | `(Rn)` |
| `IBT` | Load signed byte | `Rn,#imm` |
| `IWT` | Load word | `Rn,#imm` |
| `LM`, `LMS` | Load register from RAM | `Rn,(addr)`, `Rn,(xx)` |
| `SM`, `SMS` | Store register to RAM | `(addr),Rn`, `(xx),Rn` |
| `LEA` | Load effective address | `Rn,addr` |
| `MOVE` | Move register, immediate, or RAM value | `Rn,Rm`, `Rn,#imm`, `Rn,(addr)`, `(addr),Rn` |
| `MOVES` | Move register and update flags | `Rn,Rm` |
| `MOVEB`, `MOVEW` | Byte/word move through register pointer | `(Rn),Rm`, `Rn,(Rm)` |

The full 77-mnemonic list is:

```text
STOP NOP CACHE LSR ROL LOOP ALT1 ALT2 ALT3 PLOT SWAP COLOR NOT MERGE SBK SEX
ASR ROR LOB FMULT HIB GETC GETB RPIX CMODE DIV2 LMULT GETBH RAMB GETBL ROMB
GETBS BRA BGE BLT BNE BEQ BPL BMI BCC BCS BVC BVS TO WITH FROM ADD ADC SUB SBC
CMP AND BIC OR XOR MULT UMULT JMP LJMP INC DEC LINK STW LDW STB LDB IBT IWT LM
LMS SM SMS LEA MOVE MOVES MOVEB MOVEW
```
