# Typed structs and named ROM data

Typed fields let one struct definition describe both member addresses and how to encode
record values. `dataStruct` emits one complete named record; `dataStructs` emits a sequence
of explicitly indexed records. These are Uttori extensions. Existing Asar `struct`,
`skip`, `extends`, `endstruct align`, member expressions, `sizeof()` and `objectsize()`
remain available and keep their existing address/stride behavior.

## Start with a complete example

```asm
hirom

; Definitions reserve offsets only. They do not emit bytes or move the ROM cursor.
struct MapOffsets $CD0004
  .offset: dw
endstruct count 1023 firstindex 1

org $CD0006
MapOffsetData:
  dataStructs MapOffsets
    [1] = { offset = $0804 }
    [2] = { offset = $080B }
    [3] = { offset = $085C }
    [4] = { offset = $0864 }
  endDataStructs
```

The example emits eight bytes: `04 08 0B 08 5C 08 64 08`. `[1]` is a logical map ID,
not the zero-based position of a row in the source. Its address is `$CD0004 + 1 * 2`,
or `$CD0006`. Each initializer checks its expected address before writing. Do not change
the biased struct base to the physical first entry; that would move every indexed reference.

The example initializes a subset of the declared 1023 records. Bounds describe which IDs
are valid; they do not require a block to initialize the entire binding. A block may start
at any valid index, but subsequent rows must increase by exactly one.

## Declare fields

| Declaration inside a struct | Meaning                         | Initializer value       |
| --------------------------- | ------------------------------- | ----------------------- |
| `.flags: db`                | One unsigned 8-bit integer      | `$80`                   |
| `.hp: dw`                   | One unsigned 16-bit integer     | `$1234`                 |
| `.address: dl`              | One unsigned 24-bit integer     | `$C08000`               |
| `.mask: dd`                 | One unsigned 32-bit integer     | `$FFFFFFFF`             |
| `.palette: dw[3]`           | Three 16-bit integers           | `[$001F, $03E0, $7C00]` |
| `.unknown: db[2]`           | Two explicit bytes              | `[$AB, $CD]`            |
| `.legacy: skip 2`           | Existing opaque two-byte member | `[$AB, $CD]`            |

All scalar encodings are little-endian. Arrays are contiguous and use their element width.
`db[1]` is still an array and requires `[value]`, not a scalar. Field names retain their
case-sensitive struct spelling; directive and type keywords are case-insensitive.

Array lengths must be positive integers known when the definition is processed. A typed
field and an initialized record are limited to 65536 bytes. Initializers accept unsigned
integers only: for all-one bits, use `$FF`, `$FFFF`, etc., rather than `-1`. Values are not
silently truncated. Ordinary Asar `db`/`dw` directives retain their existing behavior.

Do not put default values after field types: `.hp: dw $1234` is invalid. Declare the width
in the struct and supply the value at the emission site. `skip 2` does not imply `dw`:
it remains an opaque byte array for initialization. Plain labels may alias field addresses,
but aliases are not additional storage and must not appear as initializer keys.

## Emit a named record

```asm
struct Stats $D04210
  .hp: dw
  .mp: db
  .unknown: db[2]
endstruct

org $D04210
dataStruct Stats, {
  unknown = [$AB, $CD],
  mp = 8,
  hp = 50,
}
```

This emits `32 00 08 AB CD`. Values can appear in any order; the assembler writes fields
in layout order. A trailing comma is allowed. Multiline brace literals do not need `\`
continuations. Semicolon comments work normally. Braces only gain automatic continuation
in `dataStruct` statements and indexed table rows; the legacy continuation rules remain.

Values are normal assembler expressions, including defines, function calls and forward
label references. Array elements may also contain expressions and function calls with commas.
The target struct must already be defined; record indexes and layout sizes must be resolvable
during layout. The emitter supports addressed records: even a zero-base struct is interpreted
as an address, not as a request to instantiate a new object at the current cursor.

`dataStruct Stats[2], { ... }` writes the third record at `Stats[2]`. It does not insert an
`org`, seek, patch another address, or allocate RAM. An incorrect current address is an error.

Every storage field must be provided exactly once. Unknown names, duplicate names, missing
fields, scalar/array mismatches, wrong array lengths and out-of-range values are errors.
The whole record is validated before any of its bytes are written. There are no implicit
zero defaults and no partial-record initializer semantics.

## Tables, bounds and alignment

```asm
endstruct [align N] [count N] [firstindex N]
```

`align` retains Asar's size/stride rounding. `count` adds optional bounds for named
initializers. `firstindex` defaults to zero and requires `count`; it does not adjust the
struct base. Bounds do not restrict existing address expressions, so existing assembler
operands can still use biased bases or compute an address beyond the initialized range.

`dataStructs Name` / `endDataStructs` is a non-empty data-only block. Each row is
`[index] = { field = value, ... }`. Duplicate, decreasing or skipped indexes fail. Labels,
`org`, includes, conditionals, macros and nested tables cannot appear _inside_ the block.
Put a complete block inside a macro or conditional instead. To label a record boundary,
close the block, put the label at the current position, then start the next block.

Alignment bytes must also be explicit:

```asm
struct Aligned $808000
  .value: db
endstruct align 4

org $808000
dataStruct Aligned, { value = 1, __padding = [$AB, $CD, $EF] }
```

`__padding` is the reserved initializer name for trailing alignment bytes, only when
alignment actually adds bytes. It is not an additional address symbol. For ordinary unknown
regions, use named `db[N]` fields. The emitter rejects overlapping or incomplete storage
layouts rather than inventing bytes.

This first version initializes flat records and scalar arrays. It does not initialize
Asar extension/overlay layouts, nested record values, bitfields, strings, or signed types.
Asar extensions remain usable for address calculations and ordinary raw data emission.
Named initialization reports an explicit error for a layout with a parent or extensions.

## SNES source export

For typed `struct-map.json` fields and generated ROM bindings, see the
[SNES exporter](https://github.com/uttori/asm/blob/master/packages/plugin-snes/MANUAL.md#snes-exporter-and-struct-mapjson).
