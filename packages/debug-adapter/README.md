# `@uttori/asm-debug-adapter`

Emulator-neutral debugger contracts and deterministic test infrastructure for Uttori ASM.

`DebugBackend` is deliberately independent of any emulator SDK and of VS Code's Debug Adapter
Protocol types. Backends exchange versioned logical addresses, threads, frames, registers, memory,
breakpoints, disassembly, and lifecycle events. `ReplayDebugBackend` implements the contract from a
fixed snapshot timeline so adapter behavior can be tested without launching an emulator.
