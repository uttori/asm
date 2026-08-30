# 65xx ca65 source compatibility

Updated: 2026-08-29

This matrix describes source compatibility, not cc65 object-file or linker
compatibility. Use target `65xx.ca65-raw` (alias `ca65-raw`) for a headerless
flat image, or `65xx.nes` for the selected iNES/ld65-shaped layout. Both targets
use the same 65xx instruction encoders and ca65 source profile.

Status meanings:

- **Supported**: accepted with the documented ca65 source meaning within the
  target's image model.
- **Partial**: useful source behavior is implemented, but object, linker, or an
  advanced ca65 semantic is intentionally absent.
- **Unsupported**: rejected rather than silently ignored.

## CPUs and instructions

| Feature | Status | Notes |
| --- | --- | --- |
| `.setcpu` / `.cpu`, `.pushcpu`, `.popcpu` | Supported | Selects and stacks the active encoder during assembly. |
| CPU shorthand directives | Supported | `.p02`, `.p02x`, `.pdtv`, `.psc02`, `.pc02`, `.pwc02`, `.pce02`, `.p4510`, `.p45gs02`, `.p6280`, and `.pm740`. |
| CPU conditionals | Supported | Matching `.ifp*` forms for every plugin-owned CPU. |
| CPU names | Supported | `6502`, `6502X`, `6502DTV`, `65SC02`, `65C02`, `W65C02`, `65CE02`, `4510`, `45GS02`, `HuC6280`, and `M740`. 65816-derived CPUs remain SNES-plugin-owned. |
| Legal, undocumented, and vendor instructions | Supported | Includes 6502X, HuC6280, M740, 65CE02/4510, and 45GS02 forms represented by the declarative catalogs. |

## Expressions and symbols

| Feature | Status | Notes |
| --- | --- | --- |
| Hex, binary, decimal, and octal literals | Supported | `$`, `%`, decimal, and ca65 `@` octal syntax. |
| Low/high/bank operators | Supported | Unary `<`, `>`, and `^`. |
| Pseudo-functions | Supported | `.defined`, `.lobyte`, `.hibyte`, `.bankbyte`, `.loword`, and `.hiword`. |
| Inequality and symbol assignment | Supported | `<>`, `=`, and `:=` source forms. |
| Address-size forcing | Supported | `z:`, `a:`, and `f:` are carried into architecture-owned operand classification. |
| Global, cheap-local, and unnamed labels | Supported | Includes `@name`, `:`, `:+`, `:++`, `:-`, and `:--`; file-local symbols remain isolated across included assembly units. |
| `.scope` / `.endscope`, `.proc` / `.endproc`, `Scope::Name` | Partial | Flattened into file-local symbol keys. Scope type declarations, address-size annotations, and object visibility metadata are not modeled. |
| `.export` / `.import` | Partial | Resolves symbols across source files assembled in one session. No relocatable external symbol records are emitted. |
| `.exportzp`, `.importzp`, `.globalzp`, `.forceimport`, `.autoimport` | Unsupported | These require relocatable object/linker semantics and produce an explicit diagnostic. |

## Directives and control flow

| Feature | Status | Notes |
| --- | --- | --- |
| `.byte` / `.byt`, `.word` / `.addr`, `.dbyt` | Supported | Includes ca65 byte ordering. |
| `.dword`, `.faraddr`, `.lobytes`, `.hibytes` | Supported | Emits 32-bit, 24-bit, or selected-byte values respectively. |
| `.res`, `.align`, `.org` | Supported | Operates directly on the selected flat or iNES image. |
| `.include`, `.incbin` | Supported | `.incbin` uses ca65 `file, offset, size` arguments. |
| `.if`, `.elseif`, `.else`, `.endif`, `.ifdef`, `.ifndef` | Supported | Dotted forms lower to the shared conditional engine. |
| `.assert` | Partial | A false assertion stops assembly with its message. ca65 warning/link-time assertion actions are not reproduced. |
| `.undefine` | Supported | Removes a symbol definition through the shared symbol engine. |
| `.segment`, `.pushseg`, `.popseg` on `65xx.ca65-raw` | Partial | Segment names and stack intent are accepted while bytes remain in source order in one flat image. |
| `.segment` on `65xx.nes` | Partial | Implements the selected MEMORY/SEGMENTS load/run/fill model used by the NES integration fixture; it is not a general ld65 linker. |
| `.constructor`, `.destructor`, `.interruptor`, `.reloc`, `.debuginfo` | Unsupported | Object/linker/debug directives produce an explicit diagnostic. |

## Macros and repetition

| Feature | Status | Notes |
| --- | --- | --- |
| `.macro` / `.endmacro` and bare invocation | Supported | Comma-separated parameters and ca65 `\parameter` substitution are supported. |
| `.repeat` / `.endrepeat` | Supported | Optional named repeat counters are available as ordinary expressions. |
| `.local`, `.exitmacro` | Unsupported | Rejected with a macro-compatibility diagnostic. |
| Token-list/string macros, `.match`, `.xmatch`, `.mid`, `.left`, `.right` | Unsupported | The advanced ca65 token macro language is not implemented. |

## Object and linker boundary

The profile does not emit cc65 relocatable objects, libraries, relocation
records, general ld65 configurations, linker-time imports/exports, or full
debug/listing metadata. Adding those capabilities is a separate target/output
project; they are not hidden behind a legacy mode or compatibility switch.

The byte-level CPU differential fixtures are pinned to ca65 commit
`e11fb5c39371046ebe25485f984f644c5a0d65d3`. The real-world integration gate
assembles the selected Zelda 1 ca65 disassembly to its golden iNES image.
