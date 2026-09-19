# @uttori/asm-language-server

Private Language Server Protocol workspace bundled with the VS Code extension. Provides diagnostics,
completion, hover, symbols, definitions, references, rename, semantic tokens, and build requests.
It is not published as a standalone npm package.

## Build and run

Requires Node.js 26 or newer for standalone development. From the repository root:

```sh
npm ci
npm run lsp:build
node packages/language-server/out/server.mjs --stdio
```

An LSP client must send initialization and document messages over stdio. Protocol output owns stdout.
The extension builds a separate bundle for VS Code's embedded runtime.

## Configuration

The client supplies workspace roots and initialization options, then updates the `asm` configuration.
Settings include `configFile`, `plugins`, `target`, `architecture`, `entryPoints`, `includePaths`,
`buildOutput`, `baseImage`, and `workspaceTrusted`. The server uses the shared project loader and
bundled SNES/65xx plugins. Workspace configuration and external plugins are disabled without trust.

A connection owns its project environment and index, using the first workspace root for configuration.
Send `shutdown`, then `exit`, to release it. Cancellation cannot preempt synchronous assembly/indexing.
Use a separate connection per project root when independent configurations are needed. This server
uses Node filesystem access and does not provide a browser or virtual-filesystem host.

## Verify

From the repository root, run `npm run lsp:typecheck` and `npm run lsp:smoke` after building.

## Documentation and support

[Configuration](https://github.com/uttori/asm/blob/master/packages/plugin-loader-node/CONFIGURATION.md) ·
[Contributor guide](https://github.com/uttori/asm/blob/master/CONTRIBUTING.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
