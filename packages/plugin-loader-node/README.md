# @uttori/asm-plugin-loader-node

Loads `uttori-asm.config.json` and activates installed or local assembler plugins in Node.js.

## Install

Requires Node.js 26 or newer. Exposes ESM JavaScript and TypeScript declarations.

```sh
npm install @uttori/asm-plugin-loader-node @uttori/asm-plugin-snes
```

## Usage

```js
import { loadProjectEnvironment } from "@uttori/asm-plugin-loader-node";

const loaded = await loadProjectEnvironment({
  cwd: process.cwd(),
  pluginModules: [{ module: "@uttori/asm-plugin-snes" }],
  overrides: { target: "snes.sfc" },
});
try {
  console.log(loaded.target, loaded.architecture);
  // Pass environment, target, architecture, and targetOptions to Assembler.
  // Then call assembler.setIncludePaths([...loaded.includePaths]).
} finally {
  await loaded.dispose();
}
```

Discovery checks the supplied `cwd`; it does not search parent directories. `configFile` selects
an explicit file. Module and include paths in configuration resolve from that file's directory.
Overrides take precedence over configuration, then host defaults; explicit plugin modules append
in order. The loader has no built-in target default.

Plugins execute trusted JavaScript with the host's permissions. Validate workspace trust before
loading them. Invalid configuration, plugin options, or registration conflicts reject loading;
dispose a successful environment after its sessions finish.

The JSON Schema is exported at
`@uttori/asm-plugin-loader-node/asm-config.schema.json`.

## Documentation and support

[Configuration reference](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) ·
[API contracts](https://github.com/uttori/asm/blob/master/packages/core/API.md) ·
[Plugin example](https://github.com/uttori/asm/tree/master/packages/plugin-author).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
