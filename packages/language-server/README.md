# @uttori/asm-language-server

Private Language Server Protocol workspace bundled with the VS Code extension. Provides diagnostics, completion, hover, symbols, definitions, references, rename, semantic tokens, and build requests. It is not published as a standalone npm package.

## Build & Run

Requires Node.js 26 or newer for standalone development. From the repository root:

```sh
npm ci
npm run lsp:build
node packages/language-server/out/server.mjs --stdio
```

An LSP client must send initialization and document messages over stdio. Protocol output owns stdout.

The extension builds a separate bundle for VS Code's embedded runtime.

## Configuration

The client supplies workspace roots and initialization options, then updates the `asm` configuration. Settings include `configFile`, `plugins`, `target`, `architecture`, `entryPoints`, `includePaths`, `buildOutput`, `baseImage`, `linkProject`, and `workspaceTrusted`. The server uses the shared project loader and bundled SNES/65xx plugins. Workspace configuration and external plugins are disabled without trust. Builds with the bundled SNES target remain available. A selected link manifest routes builds through the native composed build instead of absolute assembly.

A connection owns its project environment and index, using the first workspace root for configuration. Send `shutdown`, then `exit`, to release it. Cancellation cannot preempt synchronous assembly/indexing. Asset path analysis is lightweight; `asm/assetPreview` runs bounded conversion in a cancellable worker and returns a result only for the current document version. Use a separate connection per project root when independent configurations are needed. This server uses Node filesystem access and does not provide a browser or virtual-filesystem host.

The worker is bundled as `out/asset-preview-worker.mjs` beside `server.mjs`. SNES PNG/WAVE and Secret of Mana BRR previews accept up to 2 MiB per input and 3 MiB combined, time out after five seconds, and reuse a bounded content-and-converter-version cache. SoM BRR segment playback uses the verified complete stream while reporting the selected bank slice's encoded size. Complex numeric expressions, custom formats without a portable preview contract, and final compressed emission sizes remain build-only. Binary and resource inputs invalidate root analysis without being parsed as source text.

Document formatting is unsupported in v1.0.0.

## Verify

From the repository root, run `npm run lsp:typecheck` and `npm run lsp:smoke` after building.

Licensed under [MIT](https://github.com/uttori/asm/blob/master/LICENSE).
