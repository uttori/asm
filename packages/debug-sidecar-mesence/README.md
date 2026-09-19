# @uttori/asm-debug-sidecar-mesence

Node.js process host and protocol translator for MesenCE, used by the Uttori ASM debugger.
Experimental. Requires a separately patched MesenCE runtime matching its manifest; stock MesenCE is not a compatible live-debug runtime.

## Install

Requires Node.js 26 or newer for standalone use. Exposes ESM JavaScript and TypeScript declarations.
The VS Code extension includes its own build for the editor's runtime.

```sh
npm install @uttori/asm-debug-sidecar-mesence
npx uttori-asm-debug-sidecar-mesence --help
```

## Runtime setup

Provide the runtime manifest, matching emulator executable, ROM, and isolated runtime directory.
The host verifies declared hashes and resources before launch. Its private connection is restricted
to numeric loopback addresses.

The debugger host supplies `UTTORI_ASM_DEBUG_SESSION` and starts:

```sh
uttori-asm-debug-sidecar-mesence --manifest runtime.json --mesen /path/to/emulator \
  --rom game.sfc --runtime-dir /path/to/runtime
```

This command serves framed protocol messages on stdin/stdout; it is not an interactive terminal
session. In VS Code, use **Assembly: Configure Emulator Runtime**, then **Debug in Emulator**.

Supports negotiated 65816, SPC700, and Super FX inspection and exact stepping. Instruction tracing and SPC700/Super FX breakpoints are unsupported. Capabilities and runtime
identity must match the host profile. Native platform validation is tracked separately from the
portable JavaScript tests.

Exports: the package root for host/backend APIs, `./profile` for capability data, and
`./runtime-manifest` for manifest parsing and process hosting. Emulator binaries, ROMs, native
resources, and their separate licenses are not included.

## Documentation and support

[VS Code setup](https://github.com/uttori/asm/blob/master/packages/vscode-extension/GUIDE.md#live-debugging) ·
[Protocol reference](https://github.com/uttori/asm/blob/master/packages/debug-adapter/PROTOCOL.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
