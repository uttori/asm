# Write an assembler plugin

Requires Node.js 26+. The [example workspace](https://github.com/uttori/asm/blob/master/packages/plugin-author/README.md) demonstrates
an encoder, decoder, target, directive, and per-session state. Run its documented command before
adapting it.

## Create a standalone package

Copy `packages/plugin-author/src/index.ts` and `main.asm` into a new project. Use a unique package
name and install `@uttori/asm-core` as a runtime dependency, plus TypeScript and Node declarations
as development dependencies. For testing, also install `@uttori/asm-cli` and
`@uttori/asm-plugin-loader-node`.

Use a standalone compiler configuration instead of the repository's relative `extends`:

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"],
    "noEmitOnError": true
  },
  "include": ["src/**/*.ts"]
}
```

Set `"type": "module"`, `"engines": { "node": ">=26" }`, and export
`"types": "./dist/index.d.ts"` plus `"import": "./dist/index.js"` under `exports["."]` in
`package.json`. Add `"build": "tsc -p tsconfig.json"` and `"prepack": "npm run build"` scripts,
and include `dist`, `README.md`, and your license in the package's `files` list.

## Configure and run

Build the plugin, then create `uttori-asm.config.json`:

```json
{
  "$schema": "./node_modules/@uttori/asm-plugin-loader-node/asm-config.schema.json",
  "plugins": [{ "module": "./dist/index.js", "options": { "byte": 66 } }],
  "target": "example.raw",
  "architecture": "example.byte"
}
```

```sh
npm run build
npx uttori-asm main.asm main.bin --config uttori-asm.config.json
```

The unchanged example writes exactly `0x42`. After publishing, consumers replace the local module
path with your package name.

## Contracts to preserve

- Default-export an `AssemblerPlugin` created with `definePlugin()` from `@uttori/asm-core/plugin`.
  Declare a unique manifest ID, version, and `PLUGIN_API_VERSION`.
- Validate options before activation. Name every contribution and alias to avoid collisions.
- Register immutable contributions during activation. Allocate mutable state through session slots.
- Implement a pure versioned `operandGrammar` and `createTypedEncoder`. Select forms with
  `frame.choose`, evaluate expression nodes at the intended cursor, and write only in `encode`.
  Decoder-only architectures still provide a grammar and cannot serve as an assembly target.
- Implement directive `syntax.parse`, `validate`, and `bind`. Parse may read source words; bound
  execution consumes only the portable payload and detached occurrence metadata. Do not reparse
  provenance text. Mutable state belongs in session slots, never in cached syntax.
- Release external resources through the plugin disposal contract. Hosts dispose sessions before
  disposing the manager/environment they own.
- Import public core entry points. Do not import files from another package's internal source tree.

Before publishing, test malformed options, repeated sessions, decoder bounds, encode/decode vectors,
and disposal. Run `npm pack`, install that archive in a separate project, and repeat the one-byte
example using the installed package name. Document requirements, setup, API, limits, and license.

The example targets plugin API v2. API v1 word encoders/handlers are rejected at activation;
update both the manifest and contributions together. Installed browser, CLI and editor consumers
use the same contracts. See the [core API](../core/API.md#typed-plugin-contract-api-v2) for ownership
and cache compatibility details.
