# `@uttori/asm-plugin-65xx`

This plugin provides a native-syntax, flat 16-bit raw target for 6502-derived
NMOS, CMOS, Commodore, and MEGA65 processors. Select target `65xx.raw` and one
of these architectures:

- `65xx.6502`, `65xx.6502x`, or `65xx.6502dtv`;
- `65xx.65sc02`, `65xx.65c02`, or `65xx.w65c02`;
- `65xx.65ce02`, `65xx.4510`, or `65xx.45gs02`.

`65xx.6502` accepts the 151 documented NMOS opcodes. Encoding-equivalent chip
names `6510`, `8502`, `2A03`, `2A07`, and `6507` are aliases of that instruction
set; their electrical, decimal-mode, and memory-map differences do not change
the emitted instruction bytes.

`65xx.6502x` also accepts ca65's undocumented mnemonic set. Common alternate
spellings such as `ISB`/`ISC`, `KIL`/`JAM`, and `SBX`/`AXS` are source aliases.
Duplicate opcode encodings remain visible in the exported 256-entry decode
table, while ordinary source assembly chooses one canonical encoding. Unstable
instructions are deliberately accepted and tagged `unstable-undocumented`; the
encoder promises a byte value, not stable behavior on every NMOS die revision.

The raw target accepts an optional numeric `origin` from 0 through 65535. The
origin is both the initial logical address and output offset zero, so an image
configured with `{ "origin": 32768 }` can use `org $8000` without a 32 KiB
prefix.

Target `65xx.nes` (aliases `nes`, `ines`, `6502-nes`) is a ca65/ld65-shaped iNES
image: pass `linkerConfig` (ld65 MEMORY/SEGMENTS text) and a 16-byte `header` as
`targetOptions`. Writes follow the current `.segment` load region; overlay
segments (`run` ≠ `load`) use `base` so labels live in RAM while bytes go into
PRG. Fill unused PRG with `$FF`. Native syntax remains the default for
`65xx.raw`; the NES target selects the ca65 syntax profile (dotted directives,
`:=`, cheap locals `@name`, unary `<`/`>`/`^`).

Native syntax supports conventional `$` hexadecimal and `%` binary literals,
`#` immediates, `A`/`Q`, parentheses and brackets, `,x`/`,y`/`,z`/`,s`, bit
branches, 8-bit and 16-bit relative branches, and `.b`/`.w` mnemonic suffixes
for explicit zero-page/absolute selection. The 45GS02 compound forms emit their
fixed `42 42` and `EA` prefixes from the same declarative instruction model.
ca65's larger source-language profile is a later phase and is not claimed here.
