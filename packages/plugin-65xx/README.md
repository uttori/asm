# @uttori/asm-plugin-65xx

6502-family encoders with raw-binary, ca65-style raw, and NES iNES targets. Includes NMOS, CMOS,
Commodore, Hudson, Mitsubishi, and MEGA65 variants. The 65816 belongs to the SNES plugin.

## Install

Requires Node.js 26 or newer. Exposes ESM JavaScript and TypeScript declarations.

```sh
npm install @uttori/asm-core @uttori/asm-plugin-65xx
```

## Usage

```js
import { Assembler } from "@uttori/asm-core";
import { create65xxAssemblerEnvironment, RAW_65XX_TARGET_ID } from "@uttori/asm-plugin-65xx";

const assembler = new Assembler({
  environment: await create65xxAssemblerEnvironment(),
  target: RAW_65XX_TARGET_ID,
  architecture: "65xx.6502",
  targetOptions: { origin: 0x8000 },
});
try {
  assembler.assembleSource("org $8000\nlda #$12\nsta $34", "main.asm");
  console.log(assembler.getBinaryOutput()); // Uint8Array [0xa9, 0x12, 0x85, 0x34]
} finally {
  assembler.dispose();
}
```

For CLI use, also install `@uttori/asm-cli` and configure the plugin and target explicitly:

```json
{
  "plugins": [{ "module": "@uttori/asm-plugin-65xx", "options": { "origin": 32768 } }],
  "target": "65xx.raw",
  "architecture": "65xx.6502"
}
```

Save this as `uttori-asm.config.json`, then run `npx uttori-asm main.asm main.bin`.
The raw `origin` maps to output offset zero. Use `65xx.nes` for iNES output or `65xx.ca65-raw`
for ca65-style directives. This is a direct binary assembler; ca65 object files and general ld65
linking are unsupported. The manual lists exact CPU and syntax limits.

## Documentation and support

[65xx manual](https://github.com/uttori/asm/blob/master/packages/plugin-65xx/MANUAL.md) ·
[Third-party notices](https://github.com/uttori/asm/blob/master/packages/plugin-65xx/THIRD_PARTY_NOTICES.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
