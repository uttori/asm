# @uttori/asm-core

Architecture-neutral assembly, symbols, macros, includes, diagnostics, and plugin contracts.
The core requires an explicit plugin environment and target; it has no default processor.

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

Pass `fileProvider` and call `setIncludePaths()` for host-managed includes; use `baseImage` for patching.
`analyzeSource()` provides recovery-oriented diagnostics; assembly errors throw.
Dispose each assembler session and any `PluginManager` your host creates.

## Entry points

- `@uttori/asm-core`: assembler, analysis, and tooling APIs.
- `@uttori/asm-core/plugin`: plugin registration and lifecycle contracts.
- `@uttori/asm-core/debug-map`: source mapping and binary identity helpers.

Processor rules, mapping, output formats, and target-specific options belong to plugins.

## Documentation and support

[Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) ·
[API contracts](https://github.com/uttori/asm/blob/master/packages/core/API.md) ·
[Typed structures](https://github.com/uttori/asm/blob/master/packages/core/STRUCTS.md) ·
[Plugin example](https://github.com/uttori/asm/tree/master/packages/plugin-author) ·
[Contributing](https://github.com/uttori/asm/blob/master/CONTRIBUTING.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
