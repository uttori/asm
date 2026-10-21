# @uttori/asm-capture

ACT2 framing, payload validation, bounded archive reading and durable-prefix recovery. Offline consumers depend on this package without loading the debugger or DAP. Recording orchestration belongs to `@uttori/asm-debug-adapter`; transport belongs to the emulator sidecar.

Readers preserve scope, sequence, checksum, byte-budget and cancellation checks. Archive identities remain provenance after original import inputs are removed.
