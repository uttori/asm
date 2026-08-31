# The Uttori ASM 65xx Manual

`@uttori/asm-plugin-65xx` is the first-party 6502-family target for Uttori ASM. It encodes NMOS, CMOS, Commodore, Hudson, Mitsubishi, and MEGA65 processors from one declarative instruction model; writes headerless raw binaries or iNES images; and understands a practical, deliberately documented slice of ca65 syntax.

This manual starts with a tiny raw program and a complete NES Hello World, then opens the hood one system at a time. You can read it front to back, magazine-style, or jump straight to the command and instruction appendices when the addressing-mode gremlins are already circling.

> [!IMPORTANT]
> This plugin aims for useful ca65 source compatibility, not drop-in equivalence with cc65 object files or ld65. Each feature below is marked by what the current code actually does. Relocatable objects, linker-time imports, and known unsupported families are listed explicitly near the end.

The CPU tables are pinned to ca65 commit [`e11fb5c39371046ebe25485f984f644c5a0d65d3`](https://github.com/cc65/cc65/commit/e11fb5c39371046ebe25485f984f644c5a0d65d3). Hardware companions worth keeping open: [masswerk 6502](https://www.masswerk.at/6502/6502_instruction_set.html), the [NESDev wiki](https://www.nesdev.org/wiki/Nesdev_Wiki), and the [ca65 Users Guide](https://cc65.github.io/doc/ca65.html). Explanations, examples, support notes, and opinions here are grounded in this codebase.

## Contents

- [What the plugin contributes](#what-the-plugin-contributes)
- [Install and assemble](#install--assemble)
- [Your first raw 6502 image](#your-first-raw-6502-image)
- [Hello World for the NES](#hello-world-for-the-nes)
- [How an assembly session works](#how-an-assembly-session-works)
- [Source formatting and syntax](#source-formatting--syntax)
- [Architectures](#architectures)
- [Memory maps and the program counter](#memory-maps--the-program-counter)
- [Labels, scopes, and structs](#labels-scopes--structs)
- [Defines, expressions, and functions](#defines-expressions--functions)
- [Macros](#macros)
- [Conditionals and loops](#conditionals--loops)
- [Binary data and character tables](#binary-data--character-tables)
- [Source and binary includes](#source--binary-includes)
- [Fill, pad, reserve, and alignment](#fill-pad-reserve--alignment)
- [Diagnostics and checks](#diagnostics--checks)
- [Output and patching](#output--patching)
- [ca65 compatibility ledger](#ca65-compatibility-ledger)
- [Command index](#command-index)
- [Troubleshooting](#troubleshooting)
- [Code and fixture tour](#code-and-fixture-layout)
- [Instruction catalogs](#instruction-catalogs)

## What the plugin contributes

Core Uttori ASM has no default 65xx mode. This plugin must be activated, after which it contributes the following target-owned pieces:

| Contribution | ID or value | Notes |
| ------------ | ----------- | ---- |
| Raw target                 | `65xx.raw` | Aliases: `65xx`, `6502-raw`. Native syntax. Default output `.bin` |
| ca65 raw target            | `65xx.ca65-raw` | Alias: `ca65-raw`. Same flat image, ca65 source profile |
| NES target                 | `65xx.nes` | Aliases: `nes`, `ines`, `6502-nes`. iNES image, ca65 source profile. Default output `.nes` |
| Default architecture       | `65xx.6502` | Aliases: `6502`, `6510`, `8502`, `2a03`, `2a07`, `6507` |
| Address space (raw)       | `65xx.flat16` | 16-bit identity map: file offset = address − `origin` |
| Address space (NES)       | `65xx.ines-address-space` | Maps through the current ld65 `MEMORY` load region |
| Output format (raw)       | `65xx.raw-output` | Headerless dump of the output buffer |
| Output format (NES)       | `65xx.ines-output` | 16-byte header plus filled PRG |
| Expression set (ca65)      | `65xx.ca65-expressions` | `lobyte`, `hibyte`, `bankbyte`, `loword`, `hiword` |
| Directive set (ca65)      | `65xx.ca65-directives` | Installed only on `65xx.ca65-raw` and `65xx.nes` |

The registration lives in [`src/index.ts`](./src/index.ts). CPU tables live in [`src/instructions/opcodes.ts`](./src/instructions/opcodes.ts) and [`src/instructions/variants.ts`](./src/instructions/variants.ts). NES layout lives in [`src/target/nes.ts`](./src/target/nes.ts) and [`src/linker-config.ts`](./src/linker-config.ts).

65816-derived CPUs remain [SNES-plugin-owned](../snes/README.md). This plugin will not assemble `JSL` no matter how hopefully you type it.

## Install & Assemble

The workspace requires Node.js 20 or newer. From a source checkout:

```sh
npm install
```

The CLI product defaults to the SNES plugin when no config is present. 65xx builds need an explicit plugin and target.

### Project Configuration

For a repeatable raw build, place this in `uttori-asm.config.json`:

```json
{
  "$schema": "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
  "plugins": [
    {
      "module": "@uttori/asm-plugin-65xx",
      "options": {
        "origin": 32768
      }
    }
  ],
  "target": "65xx.raw",
  "architecture": "65xx.6502",
  "includePaths": ["./", "./include"]
}
```

`origin` is both the initial logical address and output offset zero. `{ "origin": 32768 }` means `org $8000` writes at file offset 0 with no 32 KiB prefix. Omit it and origin is `0`.

For an iNES build:

```json
{
  "$schema": "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
  "plugins": [
    {
      "module": "@uttori/asm-plugin-65xx"
    }
  ],
  "target": "65xx.nes",
  "architecture": "65xx.6502",
  "includePaths": ["./", "./include"]
}
```

NES `header`, `linkerConfig`, and `fillByte` are per-session `targetOptions`, not plugin-activation options. Paths in `includePaths` are resolved from the configuration directory. The entry source's own directory is also searched by the CLI.

### Programmatic Use

Raw target:

```ts
import fs from "node:fs";
import { Assembler } from "@uttori/asm-core";
import {
  create65xxAssemblerEnvironment,
  RAW_65XX_TARGET_ID,
} from "@uttori/asm-plugin-65xx";

const environment = await create65xxAssemblerEnvironment();
const assembler = new Assembler({
  environment,
  target: RAW_65XX_TARGET_ID,
  architecture: "65xx.6502",
  targetOptions: { origin: 0x8000 },
});

try {
  assembler.assembleSource("org $8000\nlda #$12\nsta $34", "main.asm");
  fs.writeFileSync("main.bin", assembler.getBinaryOutput());
} finally {
  assembler.dispose();
}
```

NES target:

```ts
import fs from "node:fs";
import { Assembler } from "@uttori/asm-core";
import {
  create65xxAssemblerEnvironment,
  NES_65XX_TARGET_ID,
} from "@uttori/asm-plugin-65xx";

const environment = await create65xxAssemblerEnvironment();
const assembler = new Assembler({
  environment,
  target: NES_65XX_TARGET_ID,
  architecture: "65xx.6502",
  targetOptions: {
    linkerConfig: `MEMORY {
    ROM: start = $8000, size = $8000, file = %O, fill = yes, fillval = $FF ;
}
SEGMENTS {
    CODE: load = ROM, type = ro ;
}
`,
    fillByte: 0xff,
  },
});

try {
  assembler.assembleSource('.segment "CODE"\nlda #$12', "main.asm");
  fs.writeFileSync("main.nes", assembler.getBinaryOutput());
} finally {
  assembler.dispose();
}
```

Environment and target are required. See the root [generic core usage](../../README.md#generic-core-usage) for custom hosts and staged analysis.

### Command Line

```sh
npm run cli -- main.asm main.bin \
  --plugin @uttori/asm-plugin-65xx \
  --target 65xx.raw \
  --architecture 65xx.6502

npm run cli -- hello-world.asm hello-world.nes \
  --plugin @uttori/asm-plugin-65xx \
  --target 65xx.nes
```

With a project config, the plugin/target flags can drop out:

```sh
npm run cli -- hello-world.asm hello-world.nes
```

## Your First Raw 6502 Image

The smallest useful 65xx program is a few documented NMOS instructions. Save this as `tiny.asm`:

```asm
; tiny.asm
; Headerless 6502 bytes starting at CPU $0000 / file offset 0.

org $0000

Reset:
  lda #$12        ; immediate
  sta $34         ; zero page
  lda $1234       ; absolute
  lda ($20),y     ; indirect indexed
  bne Reset
  brk #$42        ; optional signature byte
```

```sh
npm run cli -- tiny.asm tiny.bin \
  --plugin @uttori/asm-plugin-65xx \
  --target 65xx.raw \
  --architecture 65xx.6502
```

The result is the thirteen-byte sequence `A9 12 85 34 AD 34 12 B1 20 D0 F5 00 42`.

For a program that should load at `$8000` without a 32 KiB prefix, set `"origin": 32768` in plugin options and `org $8000`. `org $8000` with origin `0` really does emit 32,768 prefix bytes.

That is enough to prove the encoder, origin math, and `.b`/`.w` width forcing. A cartridge image still needs a header, vectors, and a picture. That is the next section.

## Hello World for the NES

Here is the smallest useful kind of Hello World: a self-contained iNES NROM that boots and puts `HELLO WORLD` on the screen. It does not rely on a mapper, NMI, DMA helper, or CHR ROM. In short, we must wait for the PPU, upload eight tiny letter tiles into CHR-RAM, and tell the PPU where every piece lives. There is no `printf` waiting for us.

Save the complete code block below as `hello-world.asm`. The default NES layout is a 32 KiB PRG window at `$8000` with CHR-RAM (header byte 5 = 0). `.segment "CODE"` is required; without it the assembler has no load region and writes nowhere.

```asm
; hello-world.asm
; A complete iNES NROM (32 KiB PRG, CHR-RAM) that displays HELLO WORLD.

.segment "CODE"

Reset:
  sei                         ; Mask IRQ during setup.
  cld                         ; Binary arithmetic.
  ldx #$40
  stx $4017                   ; Disable APU frame IRQ.
  ldx #$FF
  txs                         ; Stack at $01FF.
  inx                         ; X = 0.
  stx $2000                   ; PPUCTRL: NMI off, nametable $2000, pattern $0000.
  stx $2001                   ; PPUMASK: rendering off.
  stx $4010                   ; Disable DMC IRQ.

WaitVblank1:
  bit $2002
  bpl WaitVblank1             ; First vblank after reset is not enough.

WaitVblank2:
  bit $2002
  bpl WaitVblank2             ; PPU is now stable.

  bit $2002                   ; Reset the $2006/$2005 address latch.
  lda #$3F
  sta $2006
  lda #$00
  sta $2006                   ; Palette at PPU $3F00.
  lda #$0F
  sta $2007                   ; Color 0: black.
  lda #$30
  sta $2007                   ; Color 1: white.
  lda #$30
  sta $2007
  lda #$30
  sta $2007

  bit $2002
  lda #$00
  sta $2006
  sta $2006                   ; Pattern table 0 at PPU $0000.
  ldx #$00

CopyFont:
  lda FontTiles,x
  sta $2007
  inx
  cpx #FontTilesEnd-FontTiles
  bne CopyFont

  bit $2002
  lda #$20
  sta $2006
  lda #$00
  sta $2006                   ; Nametable 0 at PPU $2000.
  ldx #$00
  lda #$00
  ldy #$04                    ; 4 × 256 = 1024: tiles plus attributes.

ClearName:
  sta $2007
  inx
  bne ClearName
  dey
  bne ClearName

  bit $2002
  lda #$21
  sta $2006
  lda #$CB
  sta $2006                   ; Row 14, column 11 of nametable 0.
  ldx #$00

CopyMessage:
  lda MessageTiles,x
  sta $2007
  inx
  cpx #MessageTilesEnd-MessageTiles
  bne CopyMessage

  lda #$00
  sta $2005
  sta $2005                   ; Scroll 0,0.
  lda #$00
  sta $2000                   ; Keep NMI off; we never need it.
  lda #$0E
  sta $2001                   ; Show background, clip the left 8 pixels.

Forever:
  jmp Forever

EmptyHandler:
  rti

; 0=space, 1=H, 2=E, 3=L, 4=O, 5=W, 6=R, 7=D
MessageTiles:
  .byte $01,$02,$03,$03,$04,$00,$05,$04,$06,$03,$07
MessageTilesEnd:

; NES 2bpp tiles: 8 plane-0 bytes, then 8 plane-1 bytes. Bit 7 is leftmost.
FontTiles:
  ; Tile 0: space
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 1: H
  .byte %10000001,%10000001,%10000001,%11111111
  .byte %10000001,%10000001,%10000001,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 2: E
  .byte %11111111,%10000000,%10000000,%11111110
  .byte %10000000,%10000000,%11111111,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 3: L
  .byte %10000000,%10000000,%10000000,%10000000
  .byte %10000000,%10000000,%11111111,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 4: O
  .byte %01111110,%10000001,%10000001,%10000001
  .byte %10000001,%10000001,%01111110,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 5: W
  .byte %10000001,%10000001,%10000001,%10000001
  .byte %10010001,%10010001,%01101110,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 6: R
  .byte %11111110,%10000001,%10000001,%11111110
  .byte %10001000,%10000100,%10000010,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
  ; Tile 7: D
  .byte %11111100,%10000010,%10000001,%10000001
  .byte %10000001,%10000010,%11111100,%00000000
  .byte $00,$00,$00,$00,$00,$00,$00,$00
FontTilesEnd:

.org $FFFA
.addr EmptyHandler, Reset, EmptyHandler
```

Assemble it from the repository root with the NES target:

```sh
npm run cli -- hello-world.asm hello-world.nes \
  --plugin @uttori/asm-plugin-65xx \
  --target 65xx.nes
```

The result is a 32,784-byte `.nes` file: 16-byte iNES header (`NES\x1A`, 2 PRG banks, 0 CHR banks) plus 32 KiB of PRG. Open it in an NES emulator and the letters should appear near the center of a black screen. The layout is intentionally plain enough to understand in one sitting:

- pattern table 0 lives at PPU `$0000` (CHR-RAM we uploaded ourselves)
- nametable 0 begins at PPU `$2000`
- palette entries 0 and 1 provide black and white
- the message is merely eleven tile indices at `$21CB`

Once this clicks, loading a larger font with `.incbin` or a CHR ROM bank feels like an upgrade rather than sorcery.

For the hardware side, check NESDev's [PPU registers](https://www.nesdev.org/wiki/PPU_registers), [PPU palettes](https://www.nesdev.org/wiki/PPU_palettes), [PPU pattern tables](https://www.nesdev.org/wiki/PPU_pattern_tables), [init code](https://www.nesdev.org/wiki/Init_code), and [iNES header](https://www.nesdev.org/wiki/INES) notes. Vectors must land at `$FFFA`–`$FFFF` inside the `$8000` window; a three-byte experiment assembles, but it gives the CPU nowhere to find `RESET`.

## How an Assembly Session Works

Uttori ASM builds a typed program model and runs three stages:

1. `collectDefinitions` discovers symbols, macros, and structural shape.
2. `resolveLayout` calculates addresses and instruction sizes.
3. `emitProgram` writes bytes and finalizes the output.

The distinction is why forward labels work and why zero-page versus absolute must estimate the same width it eventually emits. The 65xx plugin creates fresh CPU, scope, segment, and NES linker state for every assembler session and resets pass-local state between stages. There is no cross-session cartridge poltergeist.

For patches, `baseImage` becomes the initial output. Reads use it when present, and writes replace or extend it. For fresh raw builds, unwritten gaps are expanded with the active output fill byte, initially `$00`. For NES builds, the lifecycle prefills header plus PRG with `fillByte` (default `$FF`) before the first source line.

## Source Formatting & Syntax

The plugin owns two dialects. `65xx.raw` uses the core native profile. `65xx.ca65-raw` and `65xx.nes` use the ca65 profile.

| Behavior | Native (`65xx.raw`) | ca65 (`65xx.ca65-raw`, `65xx.nes`) |
| -------- | ------------------- | ---------------------------------- |
| Directive prefix | none; `org $8000` | `.` ; `.org $8000` |
| Cheap locals | no | `@name` attached to the current global |
| File-local symbols | no | non-exported labels are per include file |
| Macro call | `%Name(args)` | bare `Name args` after `.macro` |
| Macro parameter | `<arg>` | `\parameter` |
| Assignment | `Name = value` | `Name := value` also accepted |
| Unnamed labels | `+:` / `-:` and `bne +` | `:`, `:+`, `:++`, `:-`, `:--` |
| Octal | no | `@17` (ca65) |
| Address-size prefix | `.b` / `.w` on the mnemonic | `z:`, `a:`, `f:` on the operand |
| Statement chaining | no ` : ` split | no ` : ` split |

### Encoding & Case

Source files are read as UTF-8. Mnemonics and directive keywords are case-insensitive. Symbol spelling is preserved and should be treated as intentional. The fixtures favor lowercase directives and lowercase or mixed-case mnemonics; either works.

### Numbers

| Form | Example | Meaning |
| ---- | ------- | ------- |
| Hexadecimal | `$80FF`, `0x80FF` | Base 16 |
| Binary      | `%10110000`       | Base 2 |
| Decimal     | `33023`, `10.5`   | Base 10; expressions may be fractional |
| Octal       | `@17`             | ca65 only; rewritten to decimal `15` |
| Immediate   | `#$20`            | Architecture syntax; `#` is removed before numeric evaluation |

Negative and unary-plus values are accepted. Immediate `#-1` is legal for an 8-bit immediate (signed); addresses stay unsigned.

ca65 unary byte extracts are `<value`, `>value`, and `^value` for low, high, and bank bytes. Native sources that want the same thing use `lobyte()` / `hibyte()` on a ca65 target, or `& $FF` / `>> 8` anywhere.

### Comments, Continuation, & Quotes

A semicolon begins a comment unless it appears inside a double-quoted string:

```asm
lda #$0F ; this vanishes before parsing
.byte "semicolon; retained"
```

End a line with `\` or `,` to continue the command on the next physical line. String data and expression string arguments should normally use double quotes.

## Architectures

Switch architecture with `arch name` on the native target, or `.setcpu "NAME"` / `.p02` and friends on ca65 targets. The architecture selected by configuration is active before the first source line.

| Source name | Canonical contribution | Purpose |
| ----------- | ---------------------- | ------- |
| `6502`, `6510`, `8502`, `2a03`, `2a07`, `6507` | `65xx.6502` | Documented NMOS 6502; default |
| `6502x` | `65xx.6502x` | NMOS plus unofficial opcodes |
| `6502dtv`, `dtv` | `65xx.6502dtv` | C64DTV |
| `65sc02` | `65xx.65sc02` | 65SC02 CMOS |
| `65c02` | `65xx.65c02` | 65C02 with Rockwell bit ops |
| `w65c02` | `65xx.w65c02` | WDC W65C02 (`WAI`, `STP`) |
| `65ce02` | `65xx.65ce02` | CSG 65CE02 (`AUG`, Z, stack, long branches) |
| `4510` | `65xx.4510` | Commodore 4510 (`MAP` instead of `AUG`) |
| `45gs02` | `65xx.45gs02` | MEGA65 45GS02 (Q prefix `42 42`) |
| `huc6280`, `6280` | `65xx.huc6280` | Hudson HuC6280 |
| `m740`, `740` | `65xx.m740` | Mitsubishi M740 |

Encoding-equivalent chip names `6510`, `8502`, `2A03`, `2A07`, and `6507` are aliases of the documented NMOS set. Their electrical, decimal-mode, and memory-map differences do not change the emitted instruction bytes.

A mnemonic that exists only on another CPU gets a targeted diagnostic (`Instruction 'RMB0' is available on 65xx.65c02, ... not 65xx.6502`) rather than a generic unknown-instruction miss. Unofficial NMOS ops on `65xx.6502` ask you to switch to `65xx.6502x`.

The live editor-facing catalogs are built by [`src/instructions/catalog.ts`](./src/instructions/catalog.ts); the complete mnemonic tables appear in [Instruction catalogs](#instruction-catalogs).

### NMOS 6502

The default encoder accepts the 151 documented NMOS opcodes plus the current-ca65-guide `BRK` signature extension (`BRK`, `BRK #$nn`, `BRK $nn`). Pinned ca65 V2.19 rejects the signature forms; this encoder keeps them for guide compatibility.

```asm
arch 6502
org $8000

lda #$12
sta $34
lda.w $12          ; force absolute: AD 12 00
lda.b $12          ; force zero page: A5 12
jmp ($1234)        ; NMOS: the high-byte fetch wraps in-page when the pointer ends in $FF
bne Reset
```

Append `.b` or `.w` to force zero-page or absolute selection where the instruction has both. An explicit suffix cannot invent an addressing mode the processor does not possess: `lda.w #$12` is an error, and `stx.w $12,y` cannot become `STX abs,y` because that form does not exist. Parentheses still decide indirect forms, and branches still enforce their signed displacement range.

Zero-page versus absolute is otherwise inferred from the operand's resolved width. A symbol equated to `$00`–`$FF` encodes as zero page; `$100` and up encode as absolute. That is deterministic across passes only when the equate is static.

`JMP ($xxFF)` is encoded as the documented `$6C` form. NMOS hardware wraps the high-byte fetch within the same page; CMOS and later chips do not. The encoder emits the byte; it does not rewrite the addressing mode.

### NMOS 6502X

`arch 6502x` also accepts ca65's undocumented mnemonic set. Common alternate spellings such as `ISB`/`ISC`, `KIL`/`JAM`, and `SBX`/`AXS` are source aliases. Duplicate opcode encodings remain visible in the exported 256-entry decode table, while ordinary source assembly chooses one canonical encoding.

Unstable instructions (`ANE` immediate, `LAX` immediate, `SHA`/`SHX`/`SHY`/`TAS` indexed stores) are deliberately accepted and tagged `unstable-undocumented`. The encoder promises a byte value, not stable behavior on every NMOS die revision.

```asm
arch 6502x
slo $20
isb $21
kil
```

### CMOS, Rockwell, and WDC

The 65SC02 adds `(zp)`, `BRA`, `STZ`, `TRB`/`TSB`, accumulator `INC`/`DEC` (`INA`/`DEA`), `PHX`/`PHY`/`PLX`/`PLY`, and `JMP (addr,x)`. Rockwell `65C02` adds `RMB`/`SMB` and `BBR`/`BBS`. WDC `W65C02` adds `WAI` and `STP`.

```asm
arch 65sc02
bra next
lda ($12)
inc a
next:
  jmp ($1234,x)

arch 65c02
bbr0 $12,next
smb7 $34

arch w65c02
wai
stp
```

### C64DTV, 65CE02, 4510, and 45GS02

C64DTV adds `BRA`, `SAC`, `SIR`, and a documented unofficial subset.

65CE02 adds Z, stack-relative `(offset,s),y`, 16-bit relative `BSR`/`LBcc`, word ops, and `AUG`. 4510 replaces `AUG` with `MAP` at the same opcode. 45GS02 adds Q-register forms: prefix `42 42` on `LDQ`/`STQ`/`ADCQ` and friends, plus an `EA` NOP prefix on `[zp],z`.

```asm
arch 65ce02
asr $12
lda ($12),z
lda ($12,s),y
ldz $1234
bsr next
aug

arch 4510
map

arch 45gs02
ldq $1234
aslq q
lda [$12],z
ldq [$34],z
```

### HuC6280 and M740

HuC6280 adds memory-register transfers (`TMA`/`TAM` and numbered `TMA0`–`TMA7`/`TAM0`–`TAM7`), `TST #imm,addr`, and block transfers `TII`/`TDD`/`TIN`/`TIA`/`TAI`. `TMA #imm` requires a power-of-two immediate.

```asm
arch huc6280
tma #$10
tam3
tst #$12,$34
tst #$12,$3456,x
tii $1000,$2000,$0030
```

M740 keeps accumulator and zero-page bit branches distinct, plus `LDM zp,#imm` and special-page `JSR $FFnn`:

```asm
arch m740
bbs0 a,next_a
bbc0 $12,next_zp
ldm $12,#$34
jsr ($12)
jsr $ff34          ; special-page: opcode $22
jsr $1234          ; ordinary absolute: opcode $20
```

### ca65 CPU Selection

On ca65 targets, `.setcpu` / `.cpu`, the `.p*` shorthands, `.pushcpu` / `.popcpu`, and `.ifp*` conditionals all select the same encoders:

```asm
.setcpu "65C02"
rmb0 $12
.pushcpu
.p6280
tma #$10
.ifp6280
  cla
.endif
.popcpu
.ifpc02
  .byte $42
.endif
```

Supported `.setcpu` names: `6502`, `6502X`, `6502DTV`, `65SC02`, `65C02`, `W65C02`, `65CE02`, `4510`, `45GS02`, `HuC6280`, `M740`. Shorthands: `.p02`, `.p02x`, `.pdtv`, `.psc02`, `.pc02`, `.pwc02`, `.pce02`, `.p4510`, `.p45gs02`, `.p6280`, `.pm740`.

## Memory Maps & the Program Counter

A 65xx CPU address is 16-bit. How that address becomes a file offset depends on the target.

### Raw origin (`65xx.raw`, `65xx.ca65-raw`)

The flat address space is an identity map: `offset = address − origin`. Addresses below `origin` or above `$FFFF` are rejected. `org` moves the write position; writing at `$8000` with origin `0` really does emit 32,768 prefix bytes. Set `origin` to the load address you actually want at file offset 0.

```asm
org $8000
BankStart:
  nop
```

`base address` changes the logical address seen by labels and operands without seeking the physical output cursor. `base off` returns to the saved physical/base relationship. `pushpc` / `pullpc` and `pushbase` / `pullbase` save and restore those cursors. Pulling an empty stack is an error.

### NES iNES layout (`65xx.nes`)

Writes follow the current `.segment` load region. The default linker config, used when `linkerConfig` is omitted, is:

```text
MEMORY {
    ROM: start = $8000, size = $8000, file = %O, fill = yes, fillval = $FF ;
}
SEGMENTS {
    CODE: load = ROM, type = ro ;
}
```

A 16-byte iNES header is synthesized from PRG size when `header` is omitted: magic `NES\x1A`, PRG bank count, CHR banks `0` (CHR-RAM). Supply your own 16 (or more) header bytes to set mapper, mirroring, NES 2.0 flags, and CHR ROM size.

Overlay segments (`run` ≠ `load`) use `base` so labels live in RAM while bytes go into PRG:

```asm
.segment "CODE"
  nop
.segment "OVERLAY"
OverlayStart:
  lda #$01
.segment "CODE"
  lda #<__OVERLAY_LOAD__
  lda #>__OVERLAY_RUN__
```

`define = yes` on a segment exports `__NAME_LOAD__`, `__NAME_RUN__`, `__NAME_SIZE__`, and `__NAME_RUN_END__`. The `SYMBOLS` block is evaluated after the last segment closes. `file = ""` MEMORY regions are RAM: they never appear in the image.

This is the selected MEMORY/SEGMENTS load/run/fill model used by the NES integration fixture. It is not a general ld65 linker. `FILES`, `FORMAT`, bank switching objects, and relocatable o65 output are out of scope.

See [`src/linker-config.ts`](./src/linker-config.ts) for the accepted attribute subset (`start`, `size`, `file`, `fill`, `fillval`, `load`, `run`, `define`, `type`, `value`).

## Labels, Scopes, & Structs

### Main, Local, and Static Labels

A colon defines a normal label at the current logical PC:

```asm
PlayerUpdate:
  lda PlayerState
  rts
```

On native sources, dot labels are scoped below the current parent:

```asm
PlayerUpdate:
.loop:
  dex
  bne .loop
```

ca65 cheap locals use `@`:

```asm
DriveAudio:
@Play:
  bne @Play
```

A plain assignment creates a static numeric label rather than a PC label. Native uses `=`; ca65 also accepts `:=`:

```asm
ScreenWidth = 256
Paused := $E0
```

Static labels can be used where a resolved numeric symbol is required. On NES/ca65, `$00`–`$FF` equates encode as zero page and `$100+` as absolute unless you force width with `z:` / `a:` / `.b` / `.w`.

`global Label:` marks a label as global in namespace-sensitive native source.

### Relative Labels

Native runs of `+` and `-` create anonymous forward and backward targets:

```asm
  beq +
  lda #$01
+:

-:
  dex
  bne -
```

ca65 unnamed labels are `:`, referenced as `:+`, `:++`, `:-`, `:--`:

```asm
  bne :+
  lda FirstNoteIndexSongNoise
  sta NoteOffsetSongNoise
  bne :-
:
  nop
```

On ca65 targets, unnamed labels and file-local names do not leak across `.include` files. `.export` / `.import` promote a name to session-global so separately assembled units in one session can share it. That is not a relocatable object record.

### Namespaces and ca65 Scopes

Native namespaces:

```asm
namespace Audio
Upload:
  rts
namespace off

jsr Audio_Upload
```

`namespace nested on` builds a path. `pushns` / `pullns` save and restore it.

ca65 `.scope` / `.proc` flatten into the same file-local symbol keys. `Scope::Name` is rewritten to `Scope_Name`:

```asm
.scope Outer
Value:
  .byte $11
  lda a:Outer::Value
.endscope

.proc Sub
  rts
.endproc
  jsr Sub
```

Scope type declarations, address-size annotations, and object visibility metadata are not modeled. This is flattened source compatibility, not ca65's object-file scope graph.

### Structs

Native structs define addressable layouts without emitting bytes, using the core struct engine. ca65 `.struct` / `.union` / `.tag` are not part of the documented ca65 slice.

```asm
struct Actor $200
  .x: skip 2
  .y: skip 2
endstruct

struct Enemy extends Actor
  .health: skip 2
endstruct
```

See the SNES manual's struct section and [`struct-engine.ts`](../../packages/core/src/services/struct-engine.ts) for the shared implementation.

## Defines, Expressions, & Functions

### Native Defines

On `65xx.raw`, defines are textual values prefixed by `!`:

```asm
!Lives = 3
!Message = "READY"
db !Lives
```

Supported assignment operators are `=`, `+=`, `:=`, `#=`, and `?=`. `undef Name` removes a define. Nested names use `!{value!slot}`. See the [SNES defines section](../snes/README.md#defines) for the shared engine.

### ca65 Symbols

ca65 targets use `:=` / `=` symbol assignment rather than `!` defines for ordinary constants. `.undefine ident` removes a symbol. `.ifdef` / `.ifndef` test whether a name exists.

### Operators

Higher rows bind more tightly:

| Precedence | Operators | Meaning |
| --- | --- | --- |
| 6   | `**`                                  | exponentiation |
| 5   | `*`, `/`, `%`                         | multiply, divide, modulo |
| 4   | `+`, `-`                              | add, subtract |
| 3   | `<<`, `>>`, `&`, `|`, `^`             | shifts and bitwise operations |
| 2   | `<`, `>`, `<=`, `>=`, `==`, `=`, `!=`, `<>` | comparisons, returning `0` or `1`; `<>` is ca65 inequality |
| 1   | `&&`                                  | logical AND |
| 0   | `||`                                  | logical OR |

Operators at the same level are left-associative. Parentheses override precedence. Division or modulo by zero is an assembly error.

### Core Built-In Functions

Native sources have the shared numeric, selection, logical, address, string, and file helpers documented in the [SNES expression section](../snes/README.md#core-built-in-functions): `sqrt`, `min`, `bank`, `defined`, `filesize`, `readfile1`, and so on.

### ca65 Expression Functions

Installed only on ca65-profile targets:

| Function | Current behavior |
| --- | --- |
| `lobyte(value)` / `.lobyte(value)` | `value & $FF` |
| `hibyte(value)` / `.hibyte(value)` | `(value >> 8) & $FF` |
| `bankbyte(value)` / `.bankbyte(value)` | `(value >> 16) & $FF` |
| `loword(value)` / `.loword(value)` | `value & $FFFF` |
| `hiword(value)` / `.hiword(value)` | `(value >> 16) & $FFFF` |
| `.defined(name)` | rewritten to `defined(name)` |

```asm
.byte @17, .lobyte($1234), .hibyte($1234), .bankbyte($123456)
.word .loword($12345678), .hiword($12345678)
lda #<Label
lda #>Label
```

### User Functions

Native `function name(args) = expression` is available on `65xx.raw`. ca65 token-list functions (`.mid`, `.left`, `.match`, `.xmatch`, `.concat`, `.sprintf`, …) are not implemented.

## Macros

Native macros emit commands, not values:

```asm
macro SetByte(addr, value)
  lda #<value>
  sta <addr>
endmacro

%SetByte($10, $42)
```

ca65 macros use dotted headers, `\parameter` substitution, and bare invocation:

```asm
.macro emit value
  .byte \value
.endmacro
emit $22
```

Variadic native macros, `sizeof(...)`, and macro-local `?` labels follow the shared [SNES macro engine](../snes/README.md#macros). ca65 `.local` and `.exitmacro` are rejected with a macro-compatibility diagnostic. Token-list/string macros are not implemented.

## Conditionals & Loops

### Native `if` / `while` / `for`

```asm
!Region = 1
if !Region == 1
  db "U"
endif

!i = 0
while !i < 4
  db !i
  !i #= !i + 1
endwhile

for i = 0..3
  db i
endfor
```

The engine caps a while loop at 10,000 iterations. `for` ranges are inclusive.

### ca65 Dotted Forms

`.if`, `.elseif`, `.else`, `.endif`, `.ifdef`, `.ifndef` lower to the shared conditional engine. CPU predicates `.ifp02` … `.ifpm740` become `if __CA65_CPU_…__`.

`.repeat count[, ident]` / `.endrepeat` rewrite to an inclusive `for` from `0` through `count`:

```asm
.repeat 3, I
  .byte I
.endrepeat
```

That emits `$00 $01 $02`. The optional name is an ordinary expression during the body.

## Binary Data & Character Tables

### Native Data Directives

| Directive | Width | Aliases |
| --------- | ----- | ------- |
| `db` | 1 byte                 | `dc.b` |
| `dw` | 2 bytes, little-endian | `dc.w` |
| `dl` | 3 bytes, little-endian | `dc.l` |
| `dd` | 4 bytes, little-endian | none |

### ca65 Data Directives

| Directive | Width | Notes |
| --------- | ----- | ----- |
| `.byte`, `.byt` | 1 byte | Same emission as `db` |
| `.addr`, `.word` | 2 bytes, little-endian | Same emission as `dw` |
| `.dbyt` | 2 bytes, big-endian | High byte first |
| `.faraddr` | 3 bytes, little-endian | |
| `.dword` | 4 bytes, little-endian | |
| `.lobytes` | 1 byte per expr | Low byte of each expression |
| `.hibytes` | 1 byte per expr | High byte of each expression |

```asm
.addr Target          ; 34 12
.dbyt Target          ; 12 34
.lobytes Target       ; 34
.hibytes Target       ; 12
.dword $12345678      ; 78 56 34 12
.faraddr $123456      ; 56 34 12
```

### Character Tables

Native `table`, `cleartable`, `pushtable`, `pulltable`, and `"A" = $40` character assignment are core features on `65xx.raw`. See the [SNES character-table section](../snes/README.md#character-tables). ca65 `.charmap` / `.wchar` are not implemented.

## Source & Binary Includes

### Source

```asm
incsrc "hardware/registers.asm"     ; native
include "code/player.asm"           ; native
.include "a.asm"                  ; ca65; leading dot is the directive prefix
```

`includeonce` (native) guards a file once per assembly stage. Relative paths resolve against the current source and configured include paths. Include cycles and missing files are diagnosed.

### Binary

Native / Asar-shaped `incbin`:

```asm
incbin "tiles.bin"
incbin "tiles.bin":$100..$180
```

ca65 `.incbin` uses filename, optional offset, optional size:

```asm
.incbin "data.bin", 2, 3     ; three bytes starting at offset 2
```

Do not mix the two grammars. `incbin "file":$100..$180` is native; `.incbin "file", 2, 3` is ca65.

## Fill, Pad, Reserve, & Alignment

### Native Fill and Pad

```asm
fillbyte $12
fill 4                        ; 12 12 12 12
padbyte $FF
pad $9000
```

Native syntax does not split `fillbyte $12 : fill 4` into two statements. Put them on separate lines.

`fill count` emits `count` bytes from the current fill pattern. `pad` with a target fills until that address; with no address it fills to the next 64 KiB boundary (which, on a 16-bit target, is usually not what you wanted — prefer an explicit address or `.res`).

### ca65 `.res` and `.align`

```asm
.res 2, $AA                   ; AA AA
.align 8, $FF                 ; pad to the next multiple of 8
```

`.res count[, fill]` emits `count` bytes of `fill` (default 0). `.align boundary[, fill]` pads with `fill` (default 0) until `PC % boundary == 0`. These write into the current image; they are not BSS in a RAM-only MEMORY region unless that region is the active load window.

### NES Prefill

The NES lifecycle fills the entire PRG with `fillByte` (default `$FF`) before source runs. Unused PRG therefore reads as `$FF` without an explicit pad. `fillByte` also becomes `session.outputFillByte`.

On `65xx.ca65-raw`, `.segment "NAME"` records the name and `.pushseg` / `.popseg` stack it, but bytes remain in source order in one flat image. Segment names are accepted so sources can keep their `.segment` lines; they do not create separate output regions.

## Diagnostics & Checks

```asm
assert sizeof(Actor) == 4, "Actor layout changed"   ; native
error "This configuration is not supported"
.warnpc $80FF

.assert 0, error, "bad layout"                     ; ca65: always stops on false
```

Native `assert condition[, message...]` continues when the condition is nonzero. ca65 `.assert expr[, action[, "message"]]` treats a zero result as a hard stop with the quoted message. Warning and link-time assertion actions are not reproduced.

`warnpc address` fails only when the current logical PC is strictly greater than the bound. Despite its historical name, it is an error gate.

Object-only ca65 directives (`.importzp`, `.exportzp`, `.globalzp`, `.forceimport`, `.autoimport`, `.constructor`, `.destructor`, `.interruptor`, `.reloc`, `.debuginfo`) throw an explicit diagnostic rather than pretending to work.

## Output & Patching

### Raw Target Options

| Option | Values | Default | Effect |
| ------ | ------ | ------- | ------ |
| `origin` | integer `0`–`65535` | `0` | Initial PC and file offset 0 |

Unknown keys fail during plugin activation. Non-integer origins fail. There is no checksum: `getOutput` is a headerless copy of the buffer.

### NES Target Options

| Option | Values | Default | Effect |
| ------ | ------ | ------- | ------ |
| `linkerConfig` | ld65 MEMORY/SEGMENTS/SYMBOLS text | 32 KiB `$8000` ROM + `CODE` | Layout |
| `header` | byte array | synthesized 16-byte iNES | Written at the front of the image |
| `fillByte` | integer | `$FF` | PRG prefill and output fill |

An empty `header` array is an error. Non-array `header` values fail. Omitted `header` synthesizes `NES\x1A` plus PRG bank count from `ceil(imageSize / 0x4000)`.

### Fresh Output versus a Patch

Without `--base-image`, raw output grows from an empty byte array. NES output starts from the prefilled header+PRG. With a base image, the assembler begins with a copy of those bytes:

```sh
npm run cli -- patch.asm patched.nes \
  --plugin @uttori/asm-plugin-65xx \
  --target 65xx.nes \
  --base-image clean.nes
```

The CLI writes a new output path; it does not overwrite the base path unless you explicitly choose the same path.

## ca65 Compatibility Ledger

The 65xx plugin targets _practical_ ca65 source compatibility: every plugin-owned CPU, the dotted directive subset used by the Zelda 1 integration fixture, and selected expression/scope/macro forms. It does not emit cc65 relocatable objects, libraries, relocation records, general ld65 configurations, or debug/listing metadata. Adding those capabilities is a separate target/output project that is not currently planned.

The byte-level CPU differential fixtures are pinned to ca65 commit [`e11fb5c39371046ebe25485f984f644c5a0d65d3`](https://github.com/cc65/cc65/commit/e11fb5c39371046ebe25485f984f644c5a0d65d3).

The real-world integration gate assembles the selected Zelda 1 ca65 disassembly to its golden iNES image.

Status meanings:

- **Supported**: accepted with the documented ca65 source meaning within the target's image model.
- **Partial**: useful source behavior is implemented, but object, linker, or an advanced ca65 semantic is intentionally absent.
- **Unsupported**: rejected rather than silently ignored.

### CPUs & Instructions

| Feature | Status | Notes |
| ------- | ------ | ----- |
| `.setcpu` / `.cpu`, `.pushcpu`, `.popcpu`    | Supported | Selects and stacks the active encoder during assembly. |
| CPU shorthand directives                     | Supported | `.p02`, `.p02x`, `.pdtv`, `.psc02`, `.pc02`, `.pwc02`, `.pce02`, `.p4510`, `.p45gs02`, `.p6280`, and `.pm740`. |
| CPU conditionals                             | Supported | Matching `.ifp*` forms for every plugin-owned CPU. |
| CPU names                                    | Supported | `6502`, `6502X`, `6502DTV`, `65SC02`, `65C02`, `W65C02`, `65CE02`, `4510`, `45GS02`, `HuC6280`, and `M740`. 65816-derived CPUs remain SNES-plugin-owned. |
| Legal, undocumented, and vendor instructions | Supported | Includes 6502X, HuC6280, M740, 65CE02/4510, and 45GS02 forms represented by the declarative catalogs. |

### Expressions & Symbols

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Hex, binary, decimal, and octal literals                             | Supported   | `$`, `%`, decimal, and ca65 `@` octal syntax. |
| Low/high/bank operators                                              | Supported   | Unary `<`, `>`, and `^`. |
| Pseudo-functions                                                     | Supported   | `.defined`, `.lobyte`, `.hibyte`, `.bankbyte`, `.loword`, and `.hiword`. |
| Inequality and symbol assignment                                     | Supported   | `<>`, `=`, and `:=` source forms. |
| Address-size forcing                                                 | Supported   | `z:`, `a:`, and `f:` are carried into architecture-owned operand classification. |
| Global, cheap-local, and unnamed labels                              | Supported   | Includes `@name`, `:`, `:+`, `:++`, `:-`, and `:--`; file-local symbols remain isolated across included assembly units. |
| `.scope` / `.endscope`, `.proc` / `.endproc`, `Scope::Name`          | Partial     | Flattened into file-local symbol keys. Scope type declarations, address-size annotations, and object visibility metadata are not modeled. |
| `.export` / `.import`                                                | Partial     | Resolves symbols across source files assembled in one session. No relocatable external symbol records are emitted. |
| `.exportzp`, `.importzp`, `.globalzp`, `.forceimport`, `.autoimport` | Unsupported | These require relocatable object/linker semantics and produce an explicit diagnostic. |

### Directives & Control Flow

| Feature | Status | Notes |
| ------- | ------ | ----- |
| `.byte` / `.byt`, `.word` / `.addr`, `.dbyt`                          | Supported   | Includes ca65 byte ordering. |
| `.dword`, `.faraddr`, `.lobytes`, `.hibytes`                          | Supported   | Emits 32-bit, 24-bit, or selected-byte values respectively. |
| `.res`, `.align`, `.org`                                              | Supported   | Operates directly on the selected flat or iNES image. |
| `.include`, `.incbin`                                                 | Supported   | `.incbin` uses ca65 `file, offset, size` arguments. |
| `.if`, `.elseif`, `.else`, `.endif`, `.ifdef`, `.ifndef`              | Supported   | Dotted forms lower to the shared conditional engine. |
| `.assert`                                                             | Partial     | A false assertion stops assembly with its message. ca65 warning/link-time assertion actions are not reproduced. |
| `.undefine`                                                           | Supported   | Removes a symbol definition through the shared symbol engine. |
| `.segment`, `.pushseg`, `.popseg` on `65xx.ca65-raw`                  | Partial     | Segment names and stack intent are accepted while bytes remain in source order in one flat image. |
| `.segment` on `65xx.nes`                                              | Partial     | Implements the selected MEMORY/SEGMENTS load/run/fill model used by the NES integration fixture; it is not a general ld65 linker. |
| `.constructor`, `.destructor`, `.interruptor`, `.reloc`, `.debuginfo` | Unsupported | Object/linker/debug directives produce an explicit diagnostic. |

### Macros & Repetition

| Feature | Status | Notes |
| ------- | ------ | ----- |
| `.macro` / `.endmacro` and bare invocation                               | Supported | Comma-separated parameters and ca65 `\parameter` substitution are supported. |
| `.repeat` / `.endrepeat`                                                 | Supported | Optional named repeat counters are available as ordinary expressions. |
| `.local`, `.exitmacro`                                                   | Unsupported | Rejected with a macro-compatibility diagnostic. |
| Token-list/string macros, `.match`, `.xmatch`, `.mid`, `.left`, `.right` | Unsupported | The advanced ca65 token macro language is not implemented. |

The real-world integration gate assembles the selected Zelda 1 ca65 disassembly to its golden iNES image. Byte-level CPU differentials are in `plugins/65xx/tests/fixtures/`.

## Command Index

The active 65xx target combines core directives with plugin directives. Native keywords apply to `65xx.raw`. Dotted forms below are the ca65-profile spelling; the leading `.` is the directive prefix.

| Command | Syntax | Status & Effect |
| ------- | ------ | --------------- |
| `db`, `dc.b` | `db value[,value...]` | Native 8-bit data |
| `dw`, `dc.w` | `dw value[,value...]` | Native little-endian 16-bit |
| `dl`, `dc.l` | `dl value[,value...]` | Native little-endian 24-bit |
| `dd` | `dd value[,value...]` | Native little-endian 32-bit |
| `.byte`, `.byt` | `.byte value[,value...]` | ca65 8-bit data |
| `.addr`, `.word` | `.word value[,value...]` | ca65 little-endian 16-bit |
| `.dbyt` | `.dbyt value[,value...]` | ca65 big-endian 16-bit |
| `.faraddr` | `.faraddr value[,value...]` | 24-bit little-endian |
| `.dword` | `.dword value[,value...]` | 32-bit little-endian |
| `.lobytes`, `.hibytes` | `.lobytes expr[,value...]` | Selected byte of each expression |
| `.res` | `.res count[, fill]` | Reserve/fill bytes |
| `.align` | `.align boundary[, fill]` | Pad to alignment |
| `fillbyte/word/long/dword`, `fill` | `fill count` | Native fill pattern |
| `padbyte/word/long/dword`, `pad` | `pad [address]` | Native pad |
| `incsrc`, `include`, `.include` | `include "file"` | Assemble a source file inline |
| `includeonce` | `includeonce` | Guard the current file once per stage |
| `incbin` | `incbin "file"[:range]` | Native/Asar binary include |
| `.incbin` | `.incbin "file"[, offset[, size]]` | ca65 binary include |
| `org`, `.org` | `org address` | Set write position |
| `base` | `base address\|off` | Change or restore logical base |
| `pushbase`, `pullbase`, `pushpc`, `pullpc` | no operands | Save/restore PC or base |
| `arch` | `arch name` | Native CPU switch |
| `.setcpu`, `.cpu` | `.setcpu "CPU"` | ca65 CPU switch |
| `.pushcpu`, `.popcpu` | no operands | Save/restore CPU |
| `.p02` … `.pm740` | no operands | CPU shorthand |
| `.ifp02` … `.ifpm740` | block syntax | CPU predicate |
| `.segment` | `.segment "NAME"` | NES: open ld65 segment. ca65-raw: record name |
| `.pushseg`, `.popseg` | no operands | Save/restore flat segment name |
| `namespace`, `pushns`, `pullns` | native namespace | Native label prefixing |
| `.scope` / `.endscope`, `.proc` / `.endproc` | `.proc name` | Flattened lexical scope |
| `.export`, `.import` | `.export ident[, ident...]` | Session-global symbol |
| `table`, `cleartable`, `pushtable`, `pulltable` | native | Character mapping |
| `struct`, `skip`, `endstruct` | native | Non-emitting layout |
| `undef`, `.undefine` | `undef name` | Remove a define/symbol |
| `if`, `elseif`, `else`, `endif` | block syntax | Conditional assembly |
| `.if`, `.ifdef`, `.ifndef` | block syntax | ca65 conditionals |
| `while`, `endwhile` | block syntax | Native conditional repeat |
| `for`, `endfor` | `for name = start..end` | Inclusive counted loop |
| `.repeat`, `.endrepeat` | `.repeat count[, ident]` | ca65 counted repeat |
| `macro`, `endmacro` | `macro name(args)` | Native command macro |
| `.macro`, `.endmacro` | `.macro name args` | ca65 command macro |
| `function` | `function name(args) = expression` | Native numeric function |
| `assert`, `.assert` | `assert condition[, message]` | Fail when condition is zero |
| `error` | `error [message...]` | Always fail |
| `warnpc` | `warnpc address` | Fail when PC exceeds address |
| `.local`, `.exitmacro` | any | Rejected |
| `.importzp`, `.exportzp`, `.globalzp`, `.forceimport`, `.autoimport` | any | Rejected (object/linker) |
| `.constructor`, `.destructor`, `.interruptor`, `.reloc`, `.debuginfo` | any | Rejected (object/linker) |

## Troubleshooting

### “The output is empty at my `org` address”

On `65xx.raw`, the address is probably below `origin`. Either `org` to `origin` or later, or set `origin` to the address you actually want at file offset 0.

On `65xx.nes`, you probably forgot `.segment "CODE"` (or whatever segment loads a `file = %O` region). Without a current load MEMORY, `toOutputOffset` returns `-1` and the write is skipped.

### “I got 32 KiB of zeros before my program”

`org $8000` with origin `0` is doing exactly what you asked. Set `"origin": 32768` or assemble at `org $0000`.

### “My zero-page instruction became absolute”

The equate is `$100` or larger, or a forward label that was still 16-bit during sizing. Force `lda.b` / `z:Name` for zero page, or `lda.w` / `a:Name` for absolute. Zelda-style `LDA a:ObjState, Y` exists specifically for this.

### “`Instruction 'SLO' requires architecture '65xx.6502x'`”

Documented NMOS (`65xx.6502`) rejects unofficial ops. Switch with `arch 6502x` or `.setcpu "6502X"`.

### “`Instruction 'RMB0' is available on 65xx.65c02, not 65xx.6502`”

Same idea: the mnemonic is real, just not on this CPU. Use `.setcpu` / `arch` rather than hoping the encoder will pick a cousin chip.

### “`.segment "OVERLAY"` is not defined”

The name must appear in `linkerConfig` `SEGMENTS`. The default config only defines `CODE`.

### “`.incbin` range is outside the file”

ca65 `.incbin "file", offset, size` is offset-plus-length, not an Asar `$start..$end` range. Offsets are from the start of the file. Size omitted means through EOF.

### “`.importzp` / `.local` exploded”

Correct: they are rejected. Use `.import` for session-global names, and ordinary labels instead of `.local`. Relocatable zp imports are not in this profile.

### “ca65 accepts this file”

If you think it should be working here, and it is not in the compatibility ledger above, please open an issue. Relocatable objects and full ld65 are not on the roadmap.

### “My HuC6280 `TMA` failed with power-of-two”

`TMA #imm` encodes a bitmask. `# $03` is illegal; `# $01`, `# $02`, `# $04`, … `# $80` are the legal set. Numbered `TMA3` is the same idea with the bit already chosen.

## Code and Fixture Layout

| Topic | Implementation | Executable examples/tests |
| --- | --- | --- |
| Plugin registration and options | [`src/index.ts`](./src/index.ts) | [`assembler.test.ts`](./tests/assembler.test.ts) |
| NMOS encoder and 256-entry decode table | [`src/instructions/opcodes.ts`](./src/instructions/opcodes.ts) | [`ca65-v2.19-nmos-differential.json`](./tests/fixtures/ca65-v2.19-nmos-differential.json) |
| CMOS / vendor tables | [`src/instructions/variants.ts`](./src/instructions/variants.ts), [`variant-tables.generated.ts`](./src/instructions/variant-tables.generated.ts) | [`ca65-e11fb5c-phase4-5-differential.json`](./tests/fixtures/ca65-e11fb5c-phase4-5-differential.json), [`ca65-e11fb5c-phase6-differential.json`](./tests/fixtures/ca65-e11fb5c-phase6-differential.json) |
| Operand classification | [`src/operands/classifier.ts`](./src/operands/classifier.ts) | [`operand-classifier.test.ts`](./tests/operand-classifier.test.ts) |
| Encoder | [`src/architecture.ts`](./src/architecture.ts) | [`assembler.test.ts`](./tests/assembler.test.ts), [`instruction-model.test.ts`](./tests/instruction-model.test.ts) |
| ca65 rewrite, CPU names, shorthands | [`src/ca65-profile.ts`](./src/ca65-profile.ts) | [`ca65-compat.test.ts`](./tests/ca65-compat.test.ts) |
| ca65 directives | [`src/directives/ca65.ts`](./src/directives/ca65.ts) | [`ca65-compat.test.ts`](./tests/ca65-compat.test.ts) |
| NES target, header, lifecycle | [`src/target/nes.ts`](./src/target/nes.ts) | [`ca65-compat.test.ts`](./tests/ca65-compat.test.ts) |
| ld65 MEMORY/SEGMENTS parser | [`src/linker-config.ts`](./src/linker-config.ts) | [`linker-config.test.ts`](./tests/linker-config.test.ts) |
| Oracle pins | [`tests/fixtures/reference-manifest.json`](./tests/fixtures/reference-manifest.json) | ca65 V2.19 and `e11fb5c` |
| Third-party table notices | [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) | cc65 zlib license for extracted metadata |
| Zelda 1 iNES gate | external fixture harness | `npm run test:external` |

## Instruction Catalogs

These tables come from the same descriptors used by hover and completion. They list canonical accepted operand spellings; the encoders also recognize fixture-backed aliases and size-forced variants described above. For opcode bytes, processor flags, timing, and silicon behavior, use the linked hardware references.

Operand-form abbreviations match the editor catalog: `#value`, `zp`, `zp,x`, `zp,y`, `addr`, `addr,x`, `addr,y`, `(zp)`, `(zp,x)`, `(zp),y`, `(addr)`, `(addr,x)`, `A`, implied.

### NMOS 6502 Instruction Catalog

56 mnemonics, 154 assembly forms. 151 documented opcodes plus `BRK` signature extensions.

| Mnemonic | What it does | Accepted operand forms |
| --- | --- | --- |
| `ADC` | Add memory to the accumulator with carry. | `#value`, `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `AND` | Bitwise AND memory with the accumulator. | `#value`, `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `ASL` | Shift left one bit. | `A`, `zp`, `zp,x`, `addr`, `addr,x` |
| `BCC` | Branch when carry is clear. | `target` |
| `BCS` | Branch when carry is set. | `target` |
| `BEQ` | Branch when equal (zero set). | `target` |
| `BIT` | Test accumulator bits without storing a result. | `zp`, `addr` |
| `BMI` | Branch when negative. | `target` |
| `BNE` | Branch when not equal (zero clear). | `target` |
| `BPL` | Branch when positive. | `target` |
| `BRK` | Trigger a software interrupt. | implied, `#value`, `zp`, `addr` |
| `BVC` | Branch when overflow is clear. | `target` |
| `BVS` | Branch when overflow is set. | `target` |
| `CLC` | Clear carry. | implied |
| `CLD` | Clear decimal. | implied |
| `CLI` | Clear interrupt-disable. | implied |
| `CLV` | Clear overflow. | implied |
| `CMP` | Compare memory with the accumulator. | `#value`, `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `CPX` | Compare memory with X. | `#value`, `zp`, `addr` |
| `CPY` | Compare memory with Y. | `#value`, `zp`, `addr` |
| `DEC` | Decrement memory. | `zp`, `zp,x`, `addr`, `addr,x` |
| `DEX` | Decrement X. | implied |
| `DEY` | Decrement Y. | implied |
| `EOR` | Exclusive-OR memory with the accumulator. | `#value`, `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `INC` | Increment memory. | `zp`, `zp,x`, `addr`, `addr,x` |
| `INX` | Increment X. | implied |
| `INY` | Increment Y. | implied |
| `JMP` | Jump to an address. | `addr`, `(addr)` |
| `JSR` | Call a subroutine. | `addr` |
| `LDA` | Load the accumulator. | `#value`, `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `LDX` | Load X. | `#value`, `zp`, `zp,y`, `addr`, `addr,y` |
| `LDY` | Load Y. | `#value`, `zp`, `zp,x`, `addr`, `addr,x` |
| `LSR` | Logical shift right. | `A`, `zp`, `zp,x`, `addr`, `addr,x` |
| `NOP` | Perform no operation. | implied |
| `ORA` | Bitwise OR memory with the accumulator. | `#value`, `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `PHA` | Push the accumulator. | implied |
| `PHP` | Push the processor status. | implied |
| `PLA` | Pull the accumulator. | implied |
| `PLP` | Pull the processor status. | implied |
| `ROL` | Rotate left through carry. | `A`, `zp`, `zp,x`, `addr`, `addr,x` |
| `ROR` | Rotate right through carry. | `A`, `zp`, `zp,x`, `addr`, `addr,x` |
| `RTI` | Return from interrupt. | implied |
| `RTS` | Return from subroutine. | implied |
| `SBC` | Subtract memory and borrow from the accumulator. | `#value`, `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `SEC` | Set carry. | implied |
| `SED` | Set decimal. | implied |
| `SEI` | Set interrupt-disable. | implied |
| `STA` | Store the accumulator. | `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `STX` | Store X. | `zp`, `zp,y`, `addr` |
| `STY` | Store Y. | `zp`, `zp,x`, `addr` |
| `TAX` | Transfer accumulator to X. | implied |
| `TAY` | Transfer accumulator to Y. | implied |
| `TSX` | Transfer stack pointer to X. | implied |
| `TXA` | Transfer X to accumulator. | implied |
| `TXS` | Transfer X to stack pointer. | implied |
| `TYA` | Transfer Y to accumulator. | implied |

### 6502X Undocumented Catalog

`65xx.6502x` adds these unofficial mnemonics on top of the documented set. `NOP` also gains extra operand forms. Aliases in parentheses are accepted spellings of the same canonical name.

| Mnemonic | What it does | Accepted operand forms |
| --- | --- | --- |
| `ALR` (`ASR`) | AND then LSR. | `#value` |
| `ANC` (`AAC`) | AND; copy N into C. | `#value` |
| `ANE` (`XAA`) | Unstable A AND X AND immediate. | `#value` |
| `ARR` | AND then ROR. | `#value` |
| `AXS` (`SBX`) | X = (A AND X) − immediate. | `#value` |
| `DCP` (`DCM`) | DEC then CMP. | `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `ISC` (`ISB`, `INS`) | INC then SBC. | `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `JAM` (`KIL`, `HLT`) | Halt the processor. | implied |
| `LAS` (`LAR`) | A, X, S = memory AND S. | `addr,y` |
| `LAX` | Load A and X. Immediate form is unstable. | `#value`, `zp`, `zp,y`, `addr`, `addr,y`, `(zp,x)`, `(zp),y` |
| `RLA` | ROL then AND. | `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `RRA` | ROR then ADC. | `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `SAX` (`AAX`) | Store A AND X. | `zp`, `zp,y`, `addr`, `(zp,x)` |
| `SHA` (`AHX`) | Unstable store of A AND X AND (H+1). | `addr,y`, `(zp),y` |
| `SHX` (`SXA`) | Unstable store of X AND (H+1). | `addr,y` |
| `SHY` (`SYA`) | Unstable store of Y AND (H+1). | `addr,x` |
| `SLO` | ASL then ORA. | `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `SRE` (`LSE`) | LSR then EOR. | `zp`, `zp,x`, `addr`, `addr,x`, `addr,y`, `(zp,x)`, `(zp),y` |
| `TAS` (`SHS`) | Unstable S = A AND X; store S AND (H+1). | `addr,y` |

Unstable forms emit a ca65-compatible byte and make no silicon-stability promise.

### 65SC02 / 65C02 / W65C02 Additions

On top of NMOS, 65SC02 (66 mnemonics) adds:

| Group | Mnemonics / forms |
| --- | --- |
| Control | `BRA target` |
| Implied | `INA`, `DEA`, `PHX`, `PHY`, `PLX`, `PLY` |
| Memory | `STZ zp\|addr\|zp,x\|addr,x`, `TRB zp\|addr`, `TSB zp\|addr` |
| Addressing | `(zp)` on ALU/load/store; `BIT` `#value\|zp,x\|addr,x`; `INC`/`DEC` `A`; `JMP (addr,x)` |

65C02 (98 mnemonics) adds Rockwell bit ops: `RMB0`–`RMB7 zp`, `SMB0`–`SMB7 zp`, `BBR0`–`BBR7 zp,target`, `BBS0`–`BBS7 zp,target`.

W65C02 (100 mnemonics) adds `WAI` and `STP`.

### C64DTV Additions

71 mnemonics. On top of a documented unofficial subset: `BRA`, `SAC #value`, `SIR #value`.

### 65CE02 / 4510 Additions

133 mnemonics each. Distinctive forms:

| Group | Mnemonics / forms |
| --- | --- |
| Z register | `LDZ`, `STZ` (extended), `CPZ`, `DEZ`, `INZ`, `TAZ`, `TZA`, `PHZ`, `PLZ` |
| Stack | `(offset,s),y` on `LDA`/`STA` |
| Word | `ASW`, `DEW`, `INW`, `ROW`, `PHW`, `PHD`, `RTN #value` |
| Long relative | `BSR`, `LBRA`, `LBCC`, `LBCS`, `LBEQ`, `LBNE`, `LBMI`, `LBPL`, `LBVC`, `LBVS` |
| Other | `ASR`, `NEG`, `CLE`, `SEE`, `TAB`, `TBA`, `TSY`, `TYS`, `EOM`, `JSR (addr)` / `(addr,x)` |
| 65CE02 only | `AUG` |
| 4510 only | `MAP` (same opcode as `AUG`) |

### 45GS02 Additions

149 mnemonics, 350 forms. Q operations prefix `42 42`; `[zp],z` also prefixes `EA`:

```text
ADCQ ANDQ ASLQ ASRQ BITQ CMPQ DEQ EORQ INQ LDQ LSRQ ORQ ROLQ RORQ SBCQ STQ
```

Plus 32-bit `[zp],z` on the 8-bit ALU/load/store set.

### HuC6280 Additions

135 mnemonics. Distinctive forms:

| Group | Mnemonics / forms |
| --- | --- |
| Clears / swaps | `CLA`, `CLX`, `CLY`, `SAX`, `SAY`, `SXY` |
| Speed | `CSH`, `CSL` |
| VDC | `ST0 #value`, `ST1 #value`, `ST2 #value`, `SET` |
| MPR | `TMA #value` (power of two), `TAM #value`, `TMA0`–`TMA7`, `TAM0`–`TAM7` |
| Test | `TST #value,zp`, `#value,addr`, `#value,zp,x`, `#value,addr,x` |
| Block | `TII`, `TDD`, `TIN`, `TIA`, `TAI` as `source,destination,length` |
| Relative | `BSR`, `BRA`, plus Rockwell `RMB`/`SMB`/`BBR`/`BBS` |

### M740 Additions

106 mnemonics. Distinctive forms:

| Group | Mnemonics / forms |
| --- | --- |
| Accumulator bit branch | `BBS0`–`BBS7 A,target`, `BBC0`–`BBC7 A,target` |
| Zero-page bit branch | `BBS0`–`BBS7 zp,target`, `BBC0`–`BBC7 zp,target` |
| Bit set/clear | `SEB0`–`SEB7`, `CLB0`–`CLB7`, `RMB0`–`RMB7` on `A` or `zp` |
| Immediate store | `LDM zp,#value` |
| Special-page JSR | `JSR $FFnn` (opcode `$22`), `JSR (zp)` (opcode `$02`) |
| Other | `BRA`, `COM zp`, `RRF zp`, `TST zp`, `CLT`, `SET`, `FST`, `SLW`, `STP` |

The complete fixture-backed mnemonic sets are the catalogs dumped from `buildInstructionCatalog` for each CPU in [`src/instructions/catalog.ts`](./src/instructions/catalog.ts).
