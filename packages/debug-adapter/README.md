# @uttori/asm-debug-adapter

Emulator-neutral debugger contracts, a Debug Adapter Protocol bridge, deterministic replay, and the authenticated sidecar protocol used by Uttori ASM.

## Install

Requires Node.js 26 or newer. Exposes ESM JavaScript and TypeScript declarations.

```sh
npm install @uttori/asm-debug-adapter
```

## Replay example

```js
import { ReplayDebugBackend } from "@uttori/asm-debug-adapter";

const backend = new ReplayDebugBackend({
  snapshots: [
    {
      threads: [{ id: 1, name: "CPU", architecture: "snes.65816" }],
      frames: [
        {
          id: 1,
          threadId: 1,
          name: "Reset",
          pc: { architecture: "snes.65816", addressSpace: "snes.cpu", address: 0x8000 },
        },
      ],
      registers: { 1: [] },
      memory: [],
    },
  ],
});
try {
  await backend.connect();
  console.log(await backend.stackFrames(1));
} finally {
  await backend.disconnect();
}
```

Hosts connect `DebugAdapterSession` to a backend. `SidecarDebugBackend` and
`NodeStdioSidecarTransport` support external emulator translators. `runDebugBackendConformance()`
checks an implementation's declared behavior.

Replay advances recorded snapshots. It does not emulate a CPU. Live operations depend on negotiated
capabilities. Addresses require architecture and address-space identities. Session tokens travel
through the child environment, and request/frame/trace queues are bounded. Disconnect backends and
dispose host-owned sessions and transports when finished. No emulator executable is included.

## Documentation and support

[Debugger and protocol reference](https://github.com/uttori/asm/blob/master/packages/debug-adapter/PROTOCOL.md) ·
[VS Code debugging](https://github.com/uttori/asm/blob/master/packages/vscode-extension/GUIDE.md#live-debugging).

[Report an issue](https://github.com/uttori/asm/issues). Licensed under
[MIT](https://github.com/uttori/asm/blob/master/LICENSE).
