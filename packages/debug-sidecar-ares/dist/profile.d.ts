import type { DebugBackendCapabilities } from "@uttori/asm-debug-adapter";
/** Backend identifier advertised by the ares RSP sidecar during negotiation. */
export declare const ARES_RSP_BACKEND_ID: "ares-rsp";
/** Architecture id of the SNES main CPU. */
export declare const ARES_65816_ARCHITECTURE: "snes.65816";
/** 24-bit CPU bus address space, including mapped I/O; reads may have side effects. */
export declare const ARES_65816_ADDRESS_SPACE: "snes.cpu";
/** Side-effect-free view of the 128 KiB work RAM. */
export declare const ARES_65816_WRAM_ADDRESS_SPACE: "snes.wram";
/** Side-effect-free view of cartridge ROM bytes by file-independent ROM offset. */
export declare const ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE: "snes.cartridge-rom";
/** The only thread id exposed for the 65816; RSP has no multi-thread model here. */
export declare const ARES_65816_THREAD_ID: 1;
/** The only stack frame id exposed for the 65816 stopped location. */
export declare const ARES_65816_FRAME_ID: 1;
/** Maximum execution trace events retained by the native ring buffer. */
export declare const ARES_TRACE_BUFFER_EVENTS = 65536;
/** Maximum execution trace events returned by one native batch request. */
export declare const ARES_TRACE_BATCH_EVENTS = 240;
/** Immutable editor/sidecar negotiation profile for the patched ares RSP interface. */
export declare const ARES_RSP_CAPABILITIES: Readonly<DebugBackendCapabilities>;
/** Famicom exposes only features its native hooks implement; PPU capture is negotiated independently and replay remains unsupported. */
export declare const ARES_NES_CAPABILITIES: Readonly<DebugBackendCapabilities>;
//# sourceMappingURL=profile.d.ts.map