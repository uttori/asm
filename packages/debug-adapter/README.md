# `@uttori/asm-debug-adapter`

Emulator-neutral debugger contracts and deterministic test infrastructure for Uttori ASM.

`DebugBackend` is deliberately independent of any emulator SDK and of VS Code's Debug Adapter
Protocol types. Backends exchange versioned logical addresses, threads, frames, registers, memory,
breakpoints, disassembly, and lifecycle events. `ReplayDebugBackend` implements the contract from a
fixed snapshot timeline so adapter behavior can be tested without launching an emulator.

The DAP bridge evaluates watches against registers from the selected stopped frame. Its bounded, side-effect-free integer grammar accepts native `$` hexadecimal and `%` binary literals plus decimal/`0x`/`0b`, parentheses, arithmetic, comparisons, logical operators, bitwise operators, shifts, and the native low/high/bank unary selectors. Register names are case-insensitive when unambiguous, values remain `bigint` through evaluation, and results are capped at 256 bits. Expressions cannot call host JavaScript, read files or emulator memory, or invoke a backend-specific expression engine.

Hosts may provide `DebugAdapterSessionOptions.instructionAnnotation` to append compact native
analysis text to DAP disassembly and virtual-source rows. The callback receives the fully qualified
architecture/address-space/address identity plus any explicit output offset. It is presentation-only:
the adapter never passes the result to a backend, never changes instruction bytes or length, and
catches callback failures so optional analysis cannot interrupt debugging.

## Backend conformance

`runDebugBackendConformance()` is the versioned acceptance harness shared by replay and live emulator adapters. It creates a fresh backend for each frozen scenario and verifies protocol/capability negotiation, architecture-specific address spaces, stopped-state inspection, exact instruction stepping, continue-to-breakpoint behavior, reconnect without reset, and request bounds. Live ares and MesenCE adapters must run this harness unchanged; backend-private tests may add timing and emulator-specific coverage but cannot replace it.

Architecture capabilities are explicit. A backend may declare reduced SPC700 or SuperFX support, but it must preserve their architecture and address-space identities rather than folding them into the 65816 view. Each readable memory space is declared separately with a `sideEffectFree` guarantee; `readMemory` rejects address spaces omitted from that list even when they remain valid for program counters, breakpoints, or disassembly.

Instruction tracing is explicit and pull-based. `startTrace()` selects one negotiated architecture/address space, `readTrace()` destructively returns a bounded batch with sequence and cumulative producer-loss metadata, and `stopTrace()` retains unread events. `DebugTraceBuffer` defines the fixed-capacity oldest-first-loss reference behavior. Trace data is never emitted as an unbounded asynchronous event stream and this package does not write analysis projects.

## Native sidecar protocol

The version-1 `uttori-asm-debug-sidecar` wire format is independent of DAP and emulator APIs. Messages use a four-byte big-endian length followed by UTF-8 JSON, making the same codec usable over inherited stdio or a loopback socket. Every message carries a single-session 256-bit token and a strictly increasing sequence number. The parser rejects unknown protocol versions, malformed or oversized frames, sequence replay, unsafe memory/disassembly/breakpoint counts, and invalid tokens before dispatch.

Outgoing traffic uses a bounded byte/message FIFO. Exceeding its configured backpressure limit fails explicitly instead of retaining an unbounded trace/event backlog or silently losing control events. Session tokens should be passed to a spawned sidecar through its environment or an inherited pipe, not a command-line argument.

`DebugSidecarClient` adds transport-neutral request/response pairing over that codec. It serializes writes, caps pending requests, applies per-request deadlines, validates the session on every response and event, and rejects all pending work when the native process or connection closes. Protocol violations and timeouts fail closed so a late response cannot be mistaken for a later debugging session.

`SidecarDebugBackend` is the typed bridge from this untrusted wire data back to `DebugBackend`. It negotiates the backend protocol and exact revision-manifest capability matrix before connecting, validates every returned address/id/register/byte/event shape, uses canonical base64 for memory, preserves a live sidecar for reconnect-without-reset, and creates a fresh client after a crash. An unexpected sidecar close emits a restartable termination event and stderr output without terminating the debug adapter.

`DebugSidecarServer` is the matching emulator-neutral server dispatcher. It serializes overlapping input, validates command arguments before calling a backend, queues bounded output, sends each response before events produced by that command, forwards later asynchronous events in sequence, and treats authentication or channel-direction violations as terminal. Backend command failures are returned without corrupting the connection. This lets emulator-specific sidecars concentrate on their native control transport instead of reimplementing the security and lifecycle contract.

`NodeStdioSidecarTransport` provides the initial cross-platform process host. It spawns an explicit executable without a shell, transfers the session token only through `UTTORI_ASM_DEBUG_SESSION`, serializes pipe writes through the client, retains only a bounded token-redacted stderr tail, and uses bounded stdin-close → `SIGTERM` → `SIGKILL` cleanup. The conformance tests exercise the complete stack through real child processes and prove crash isolation plus restart on macOS; emulator binaries still remain separate from this MIT package.

Read the [architecture guide](../../docs/disassembler-architecture.md#debug-architecture) before
changing the neutral contract, and use the [testing guide](../../docs/testing-and-release.md) for
conformance, protocol, process, and hosted-matrix expectations.
