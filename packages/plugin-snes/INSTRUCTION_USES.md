# Instruction uses and captured data references

Struct names and members already work in address expressions. For example,
`SomWaterSeedCeremonyTint` is `$C98F4B`, and
`SomWaterSeedCeremonyTint.target_rgb_flags` is `$C98F4D`. The member expression
identifies the location of the stored `$7669`; it does not evaluate to that stored value.
Use a define when you need a reusable literal value.

A zero-base layout supplies field offsets and record sizes to shared consumers:

```asm
LDY.b #SomScriptPaletteTintCommand.target_rgb_flags ; offset 2
LDA [$D1],y
; ... retain the intervening instructions ...
ADC.w #sizeof(SomScriptPaletteTintCommand)          ; stride 4
```

The indirect read consumes whichever script command the pointer currently selects.
During the Water Seed ceremony it reads the named instance above. Keeping the field
offset symbolic explains the handler without giving it an exclusive dependency on that instance.

## Metadata

An optional `instructionUses` array in `struct-map.json` (schema version 1) records established
relationships at particular instructions. This is curated research metadata: the exporter
does not infer relationships by matching numeric constants or automatically replay capture
files. Missing `instructionUses` preserves the existing export behavior.

Each entry requires a CPU `address`, the **complete** `expectedBytes` encoding, and a
non-empty `reason`. It must contain either an `operand` or non-empty `observations`.
For example, these entries name the tint handler's offset and its captured read:

```json
{
  "schemaVersion": 1,
  "instructionUses": [
    {
      "address": 12709269,
      "expectedBytes": [160, 2],
      "reason": "Screen-effect subcommands 5 and 6 read the target word at offset 2.",
      "operand": "SomScriptPaletteTintCommand.target_rgb_flags"
    },
    {
      "address": 12709271,
      "expectedBytes": [183, 209],
      "reason": "Shared handler reads the current script command through [$D1],Y.",
      "observations": [
        {
          "target": "SomWaterSeedCeremonyTint.target_rgb_flags",
          "width": 2,
          "access": "read",
          "provenance": "trace-derived",
          "source": "captures/unlock-first-seed.act2",
          "detail": "Instruction 16430208: reconstructed pointer $C98F4B plus Y=2; next A=$7669.",
          "romSha256": "4c15013131351e694e05f22e38bb1b3e4031dedac77ec75abecebe8520d82d5f"
        }
      ]
    }
  ]
}
```

Merge that property into a complete struct map containing the named structures and bindings.
Addresses in JSON are decimal CPU addresses; mapper aliases are accepted, but two entries
cannot name the same physical instruction. `operand` is a symbolic expression string. It must
resolve exactly to the decoded 8- or 16-bit immediate in every accepted decode context.
The exporter preserves the instruction width and refuses truncation.

| Expression                                     | Meaning                                      |
| ---------------------------------------------- | -------------------------------------------- |
| `SomScriptPaletteTintCommand.target_rgb_flags` | Offset within a reusable layout              |
| `SomLzDecodeStubTemplate & $FFFF`              | Low word of a bound address                  |
| `bank(SomLzDecodeStubTemplate)`                | Address bank byte                            |
| `sizeof(SomLzDecodeStub) - 1`                  | Block-move count for one complete record     |
| `bytesof(SomBoyLevels)`                        | Complete declared array extent: 99 × 8 bytes |
| `countof(SomBoyLevels)`                        | Declared record count: 99                    |
| `startof(SomMapLayoutOffsets)`                 | Physical first record, $CD0006               |
| `endof(SomMapLayoutOffsets)`                   | Exclusive physical end of the array          |

These are native assembly expressions, so generated source keeps its names. `sizeof` remains
the size of **one record**. The new `countof`, `bytesof`, `startof` and `endof` functions also work
in ordinary assembly. They use declared bounds, defaulting to one record at index zero when
bounds are absent. Physical start/end undo the biased base used by one-based arrays;
`SomMapLayoutOffsets` itself still denotes $CD0004 for native index arithmetic.
All helpers describe declarations, never stored record contents.

Expressions support declared layout/binding names, fields, bounded record indexes, decimal
and hexadecimal integers, parentheses, `+ - * / %`, `& | ^ << >>`, unary `+ - < > ^ <:`,
and the reflection/bank functions above. Every intermediate must be a safe integer; input is
limited to 1,024 characters and 128 expression nodes. There must be a declared struct reference.
Arbitrary symbols, defines, strings, macros and file-dependent functions are rejected.
Grouping is preserved when rendering; repeated expressions are cached within one map load.

An observation requires a `target` expression, a `width` of 1 or 2 CPU-access bytes,
`access` (`read`, `write`, or `read-write`), `provenance`, `source`, `detail`, and the capture's
headerless `romSha256`. The target must reference exactly one binding, and the complete span
must stay within its physical extent. Explicit indexes must be in bounds. Use `startof(Name)`
or `Name[firstIndex]` to select the physical start of a one-based array.

The span may cross adjacent fields, opaque gaps or records. Exported comments list the touched
parts, marking gaps as opaque rather than inventing field types. For example,
`"target": "SomScriptSound0782.parameter_2", "width": 2` covers both `parameter_2` and
`parameter_3`. A word read is never reduced to a one-byte observation just because its first
field is a byte. Observations cover explicit CPU memory operands; DMA, stack traffic and
instruction fetches require different evidence models.

Use `observed` for a directly recorded memory access and `trace-derived` for a reconstruction
from instruction/register traces and supporting research. Supply the capture sequence or other
locator and the reasoning in `detail`. The exporter checks the ROM hash, instruction bytes,
mapping and span bounds; it does **not** independently certify the curator's capture claim.
Multiple observations retain their individual target names and provenance in source comments.
They never rewrite an indirect load into a fixed-address load or become permanent CFG edges.

Regeneration places a `[struct use]` explanation and any `[observed read]` or
`[trace-derived read]` references immediately above the accepted instruction. Existing project
comments remain present. Search the instance/member name to find both its data and recorded
consumers. Dynamic debugger overlays and automatic capture-to-struct inference are outside
this source-export feature.

## Failure and performance contracts

All use validation finishes before generated files are written. Stale bytes, a different
capture ROM, an unresolved/conflicting instruction, a wrong immediate or an invalid reference
aborts export while preserving the previous generated files. The struct-map input hash participates
in normal source drift checks. Edit this metadata, then regenerate; do not hand-edit generated banks.

Uses are indexed once by ROM offset and field names are indexed once per layout. Export never
scans every use for each instruction or allocates a per-byte capture-reference map. Projects
without uses skip the new index entirely. In-memory and SQL-streamed instruction groups share
the same implementation and preflight checks.

The implementation lives in `packages/plugin-snes/src/disassembler/struct-instruction-uses.ts`.
`struct-map.ts` resolves the optional metadata after validating layouts/bindings;
`source-export.ts` checks every decode variant and renders comments only after accepting the
instruction. The core adds the four declaration-reflection helpers; the analysis database schema is unchanged.
