# Instruction structure references

Use `instructionUses` in `struct-map.json` to name a reviewed instruction operand or record which
structure a captured memory access used. The exporter checks these declarations against the ROM.
It does not infer relationships from matching constants or replay captures automatically.

## Name an operand

Given a zero-base layout `Command` with a two-byte `value` field at offset 2, this entry names the
immediate operand of `LDY.b #$02` at CPU `$808000`:

```json
{
  "address": 8421376,
  "expectedBytes": [160, 2],
  "reason": "The handler selects the command value field.",
  "operand": "Command.value"
}
```

Add the entry to the `instructionUses` array of a complete schema-version-1 struct map containing
the layout. `expectedBytes` must include the whole instruction. The expression must equal the
decoded 8-bit or 16-bit immediate in every accepted decode context. Mapper aliases are allowed,
but two entries cannot refer to the same physical instruction.

For direct memory operands, use `memoryOperand`, for example `"Actors.hp & $FFFF"`. It must equal
the encoded address before indexing, data-bank, or direct-page addition. Direct-page data pointers
also support scoped locals: `"MapCodecWork.history_row"` can emit `LDA.b (MapCodecWork.history_row),y`.
The exporter preserves `(dp)`, `(dp,x)`, `(dp),y`, `[dp]` and `[dp],y` syntax; the expression names
the encoded pointer offset, never its runtime pointee. Calls, jumps and stack operands remain
unsupported. `operand` and `memoryOperand` cannot coexist.
Both preserve the original instruction width and addressing mode.

Expressions accept declared layouts, bindings, fields, bounded indexes, integer arithmetic and
bitwise operators, and `sizeof`, `countof`, `bytesof`, `startof`, `endof`, and `bank`.
`sizeof` describes one record. `bytesof` describes the complete declared array. `startof` and
`endof` locate its physical first and exclusive-end addresses, including a nonzero first index.
These helpers describe declarations, not stored values. Expressions are limited to 1,024 characters
and 128 nodes, require a struct reference, and use safe integers. Arbitrary symbols, macros,
strings, and file-reading expressions are rejected.

## Record a captured access

An entry can instead, or additionally, contain `observations`. Each observation requires:

- `target`, an expression referencing exactly one binding.
- `width`, 1 or 2 bytes, and `access`, one of `read`, `write`, or `read-write`.
- `provenance`, either `observed` for a recorded access or `trace-derived` for a reconstruction.
- `source`, the capture identifier or path, and `detail`, its sequence locator and reasoning.
- `romSha256`, the capture's headerless ROM content hash.

The whole access must fit inside the binding. It can cross adjacent fields, gaps, or records.
Explicit indexes must be in bounds. Gaps stay unnamed in the generated explanation. The exporter
checks bytes, mapping, ROM identity, and span bounds, but cannot independently verify a research
claim. Observations describe CPU memory operands, not DMA, stack traffic, or instruction fetches.

Regeneration adds the explanation and directly observed access summaries above the instruction
while preserving existing project comments. Trace-derived observations remain available in
`struct-map.json` and audits without producing assembly comments. Rendering never turns an
indirect access into a fixed-address load or adds a permanent control-flow edge.

`reason` retains the required research rationale. An optional `comment` overrides its displayed
explanation; `"comment": ""` omits redundant prose while keeping the rationale and observations.
Generated assembly omits local `research/` citations and the old `[struct use]` prefix. Complete
provenance remains in the metadata; observed and trace-derived evidence stay distinct.

## Regenerate safely

Edit the struct map, then regenerate source using the [SNES workflow](MANUAL.md#65816-source-export).
Do not edit generated bank files to retain these relationships. Stale bytes, conflicting decode
contexts, wrong values, or out-of-bounds references fail validation before generated files change.
The map remains a user-owned input covered by source-export hash checks.
