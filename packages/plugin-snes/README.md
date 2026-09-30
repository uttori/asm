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

The exporter splits raw spans at these bounds and replaces complete non-code
spans. It rejects overlaps, code, typed-header splits and interior source labels.
The asset source path is relative to the generated bank file. The exporter records
the map as an input in `generated-files.json` and preserves an existing
`uttori-asm.config.json`, including custom asset plugin registrations. The build configuration is
also recorded as a user-owned input. Edits make the export stale and are preserved by normal
regeneration. Keep each
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

Generated `dataStruct` declarations and `dataStructs` rows place each field value on its own line. Field descriptions stay on the authoritative declarations in `structs.asm`, where editor hover can surface them without repeating the prose for every ROM record. Binding-specific entry descriptions stay above their declaration or table row. Long numeric arrays wrap at 100 columns by default. Set `structLineWidth` on `exportSnesProject` or `exportSnes65816Source`, or pass `--struct-line-width` to CLI export, to choose a different width (integer, at least 40).

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
