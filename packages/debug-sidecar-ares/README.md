# @uttori/asm-debug-sidecar-ares

Node.js process host and protocol translator for ares, used by the Uttori ASM debugger.
Requires a separately built ares runtime matching its manifest. Stock ares is not a compatible debugger runtime.

## Install

Requires Node.js 26 or newer for standalone use. Exposes ESM JavaScript and TypeScript declarations.
The VS Code extension includes its own build for the editor's runtime.

```sh
npm install @uttori/asm-debug-sidecar-ares
npx uttori-asm-debug-sidecar-ares --help
```

## Runtime setup

Provide the runtime manifest, matching emulator executable, ROM, and isolated runtime directory.
The host verifies declared hashes and resources before launch. Its private connection is restricted
to numeric loopback addresses.

The debugger host supplies `UTTORI_ASM_DEBUG_SESSION` and starts:

```sh
uttori-asm-debug-sidecar-ares --manifest runtime.json --ares /path/to/emulator \
  --rom game.sfc --runtime-dir /path/to/runtime
```

This command serves framed protocol messages on stdin/stdout. It is not an interactive terminal
session. In VS Code, use **Assembly: Configure Emulator Runtime**, then **Debug in Emulator**.

The base profile exposes 65816 control. Additional trace and capture features require matching native capabilities. SPC700/Super FX emulation alone does not imply debugger support. Capabilities and runtime
identity must match the host profile. Native platform validation is tracked separately from the
portable JavaScript tests.

Exports: the package root for host/backend APIs, `./profile` for capability data, and
`./runtime-manifest` for manifest parsing and process hosting. Emulator binaries, ROMs, native
resources, and their separate licenses are not included.

## Documentation and support

[Native runtime setup](https://github.com/uttori/asm/blob/master/packages/debug-sidecar-ares/RUNTIME.md) ·
[Capture modes and recovery](https://github.com/uttori/asm/blob/master/packages/debug-sidecar-ares/CAPTURE.md) ·
[VS Code setup](https://github.com/uttori/asm/blob/master/packages/vscode-extension/GUIDE.md#live-debugging) ·
[Protocol reference](https://github.com/uttori/asm/blob/master/packages/debug-adapter/PROTOCOL.md).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
