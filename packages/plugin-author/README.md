# Plugin author example

Private, runnable example of an Uttori ASM plugin. It registers a one-byte architecture and decoder,
a flat address space, raw output, a directive, session state, and the `example.raw` target.

## Run in this repository

Requires Node.js 26 or newer. From the repository root after `npm ci`:

```sh
npm run cli -- packages/plugin-author/main.asm packages/plugin-author/main.bin \
  --config packages/plugin-author/uttori-asm.config.json
```

The output is one byte, `0x42`. `npm run example:typecheck` checks the example's public API usage.

## Use it for your plugin

Copy this directory, give the package and contribution IDs unique names, and install
`@uttori/asm-core` as a runtime dependency. Compile `src/index.ts` to ESM JavaScript and point your
package export and project configuration at that output. Replace the repository-relative schema
path with `./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json` when using the loader.

The included configuration references TypeScript for repository development. It requires the
repository's source loader and is not the configuration to publish. The included `tsconfig.json`
also extends the repository configuration. Replace it when copying the example out.

Validate plugin options before activation, keep mutable state per assembly session, and release
host resources through plugin disposal. A decoder-only architecture can support analysis, but an
assembler target also requires an encoder.

## Documentation and support

[Plugin authoring guide](https://github.com/uttori/asm/blob/master/packages/plugin-author/GUIDE.md) ·
[Core API](https://github.com/uttori/asm/tree/master/packages/core) ·
[Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
