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
`uttori-asm.config.json`, including custom asset plugin registrations. Keep each
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
