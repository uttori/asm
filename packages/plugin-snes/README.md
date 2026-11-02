# @uttori/asm-plugin-snes

SNES/SFC assembly and analysis for the 65816, SPC700, and Super FX. Includes cartridge mapping,
SNES directives, thin asset-format registration, evidence importers, and conservative source export.

## Install

Requires Node.js 26 or newer. Exposes ESM JavaScript and TypeScript declarations.

```sh
npm install @uttori/asm-core @uttori/asm-plugin-snes
```

## Usage

```js
import { Assembler } from "@uttori/asm-core";
import { createSnesAssemblerEnvironment, SNES_TARGET_ID } from "@uttori/asm-plugin-snes";

const assembler = new Assembler({
  environment: await createSnesAssemblerEnvironment(),
  target: SNES_TARGET_ID,
});
try {
  assembler.assembleSource("lorom\norg $008000\nsei", "main.asm");
  console.log(assembler.getBinaryOutput()); // Uint8Array [0x78]
} finally {
  assembler.dispose();
}
```

The `@uttori/asm-cli` package uses this plugin by default. To configure it explicitly, put this in
`uttori-asm.config.json`:

```json
{
  "plugins": [{ "module": "@uttori/asm-plugin-snes" }],
  "target": "snes.sfc",
  "architecture": "snes.65816"
}
```

`targetOptions` controls checksums and target behavior. Choose mapper and instruction widths
explicitly when source or evidence is ambiguous. Asar compatibility is partial. Unsupported syntax
and accepted no-op directives are listed in the manual. ROMs and emulator binaries are not included.

## Asset includes in exported source

An exported source project can keep its converted assets through reanalysis and
source export by placing `asset-includes.json` beside `main.asm`. Each entry owns
an exact half-open ROM file-offset span and the bank directive emitted there:

```json
{
  "version": 1,
  "entries": [
    {
      "start": 532224,
      "end": 532254,
      "directive": "includeAsset(\"../assets/palettes/rom-palettes.json\", \"som.palette.bgr555\", palette: \"C81F00\")"
    }
  ]
}
```

The optional `requirements` array makes codec admission mandatory for ROM bindings
of a declared structure. For example:

```json
"requirements": [
  { "structure": "BossPaletteWord", "format": "som.palette.bgr555" },
  { "structure": "RoomTriggerWord", "format": "som.room", "options": { "section": "triggers" } }
]
```

Prepare checks the complete physical range of every matching binding before
emitting source. Missing bytes, a different codec, or a different literal section
option fail with the owner name and missing ROM offset. Adjacent includes and
larger shared owners remain valid. RAM bindings are excluded. This validation runs
in both the CLI and the editor regeneration process; successful ROM equality alone
does not satisfy the codec requirement.

The exporter splits raw spans at these bounds and replaces complete non-code
spans. It rejects overlaps, code, typed-header splits and interior source labels.
The asset source path is relative to the generated bank file. Pure generation snapshots
the map as a tracked recipe and preserves an existing
`uttori-asm.config.json`, including custom asset plugin registrations. The build configuration is
also a tracked input. Recipe edits produce a new generation for native Git merging. Keep each
entry's end offset aligned with the bytes the asset plugin emits; verify the full
ROM after editing an asset or its map entry.

Keep asset descriptions in native analysis `comments` records anchored to the
entry's `start` in `rom.file`, and asset symbols in native `labels` records with
`analysisEntryPoint: false`. The exporter renders these before the asset include
on every regeneration. Comments or labels added only to generated bank assembly
are not generating inputs and will be lost when that source is replaced.

## Documentation and support

[SNES manual](https://github.com/uttori/asm/blob/master/packages/plugin-snes/MANUAL.md) ·
[Analysis heuristics](https://github.com/uttori/asm/blob/master/packages/plugin-snes/ANALYSIS.md) ·
[Instruction structure references](https://github.com/uttori/asm/blob/master/packages/plugin-snes/INSTRUCTION_USES.md) ·
[Analysis workflow](https://github.com/uttori/asm/blob/master/packages/cli/GUIDE.md#analysis-projects) ·
[Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).

Generated `dataStruct` declarations and `dataStructs` rows place each field value on its own line. Field descriptions stay on the authoritative declarations in `structs.asm`, where editor hover can surface them without repeating the prose for every ROM record. Binding-specific entry descriptions stay above their declaration or table row. Long numeric arrays wrap at 100 columns by default. Pure-renderer integrations may set `structLineWidth` on `exportSnes65816Source` to choose a different width (integer, at least 40).

Generated assembly comments wrap at whitespace by default, at **100 columns including indentation and `; `**. Set `commentLineWidth` (integer, at least 20) or CLI `--comment-line-width 80` to change the width; set `wrapComments: false` or CLI `--no-wrap-comments` to disable comment wrapping. Oversized inline comments move above their code. Existing paragraph boundaries, quoted semicolons, and complete words/URLs are preserved; indivisible tokens can exceed the preferred width. Formatting changes source layout and debug-map line numbers without changing emitted ROM bytes.

Reviewed scalar constants can be declared in `struct-map.json` alongside layouts:

```json
"constants": [
  { "name": "LZ_COPY_TOKEN_FLAG", "value": 128,
    "description": "Token bit 7 selects a backward reference." }
]
```

Values are exact unsigned 24-bit integers; names share the layout/binding namespace.
`structs.asm` emits each declaration with its description. An `instructionUses` entry
can select the constant through `operand` or combine it with layout expressions.
Substitution remains instruction-specific and byte/value guarded; equal literals at
other instructions are unaffected. `REP`/`SEP` status masks are supported; other
signature opcodes are not. Constants have no size, fields, or storage ownership.

## Typed assembly entry points

The shipped 65816, SPC700 and SuperFX encoders consume target-owned operand trees for sizing and emission. Public `Arch65816`, `ArchSPC700` and `ArchSuperFX` word-array entries parse the same grammar and call those typed implementations. Old private word encoders, operand classifiers and string-expansion helpers have been removed. Plugin API v2 requires `operandGrammar` and `createTypedEncoder`; directive contributions require parsed, validated payloads. Numeric and reference values stay in stage-owned resolution frames.
