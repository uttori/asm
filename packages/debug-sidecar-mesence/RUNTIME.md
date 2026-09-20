# MesenCE runtime contract

The live backend is experimental and requires a patched MesenCE executable. The npm package
contains the Node host and protocol translator, not the emulator, ROM, firmware, or native licenses.
Stock MesenCE does not implement this debugger protocol.

## Start a session

Use **Assembly: Configure Emulator Runtime** in VS Code, or supply the sidecar's `--manifest`,
`--mesen`, `--rom`, and `--runtime-dir` options as shown in the [README](README.md).
Programmatic `MesenProcessHost` paths must be absolute. The runtime directory is the child process's
working directory and contains the manifest's relative resource paths.

The version-1 manifest pins the upstream Git revision, patch SHA-256, executable SHA-256, whole-ROM
file SHA-256, platform, architecture, build configuration, and resource hashes. Whole-file identity
includes a copier header, unlike an analysis project's headerless ROM content hash. A changed ROM
needs a matching manifest. Hash or platform mismatches fail before launch. Use a manifest produced
with the native build, not edited hashes copied from an unrelated runtime.

The host starts one child without a shell and connects to its private numeric loopback endpoint.
The debugger supplies the framed stdin/stdout session token. Stdout is reserved for protocol
messages. The host shuts down its child when the session terminates and can start a fresh child for
a later session. Retain a connection only through an explicit disconnect with `terminate: false`.

## Capabilities

| Processor      | Safe memory spaces                | Execute breakpoints | Stepping        |
| -------------- | --------------------------------- | ------------------- | --------------- |
| `snes.65816`   | `snes.wram`, `snes.cartridge-rom` | Supported           | instruction, in |
| `snes.spc700`  | `spc.aram`                        | Unsupported         | instruction, in |
| `snes.superfx` | `superfx.rom`, `superfx.ram`      | Unsupported         | instruction, in |

All three expose pause, registers, frames, and disassembly. Instruction tracing and step-over/out
are unsupported. `snes.cpu` is a logical CPU address space and is not a safe memory-read space.
Memory requests are limited to 4,096 bytes by the native profile. Capabilities must match the
installed runtime. Do not infer support from another emulator or processor.

## Timeouts and failures

`MesenProcessHostOptions` defaults to a 10,000 ms startup deadline, 5,000 ms request deadline,
25 ms connection retry delay, and 2,000 ms shutdown wait after SIGTERM before SIGKILL.
The native server lifetime defaults to 86,400 seconds. The host retains a 65,536-byte output tail.
These options accept positive integers. Output observers run synchronously and must not throw.

On a startup failure, check manifest identity, resource paths, and the bounded output tail.
A protocol violation, timeout, or unexpected process exit closes the client and rejects pending
requests. Reconnect through a fresh session after correcting the cause. Portable process and
protocol tests do not establish native emulator support on an untested operating system.

See the [neutral protocol](../debug-adapter/PROTOCOL.md) for lifecycle and request bounds, and
the [editor guide](../vscode-extension/GUIDE.md#live-debugging) for launch configuration.
