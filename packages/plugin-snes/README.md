# @uttori/asm-plugin-snes

SNES/SFC assembly and analysis for the 65816, SPC700, and Super FX. Includes cartridge mapping,
SNES directives, asset codecs, evidence importers, and conservative source export.

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
explicitly when source or evidence is ambiguous. Asar compatibility is partial; unsupported syntax
and accepted no-op directives are listed in the manual. ROMs and emulator binaries are not included.

## Documentation and support

[SNES manual](https://github.com/uttori/asm/blob/master/packages/plugin-snes/MANUAL.md) ·
[Analysis heuristics](https://github.com/uttori/asm/blob/master/packages/plugin-snes/ANALYSIS.md) ·
[Instruction structure references](https://github.com/uttori/asm/blob/master/packages/plugin-snes/INSTRUCTION_USES.md) ·
[Analysis workflow](https://github.com/uttori/asm/blob/master/packages/cli/README.md#analysis-projects) ·
[Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
