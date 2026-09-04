import type { DebugBackendCapabilities } from "@uttori/asm-debug-adapter";
export declare const ARES_RSP_BACKEND_ID: "ares-rsp";
export declare const ARES_65816_ARCHITECTURE: "snes.65816";
export declare const ARES_65816_ADDRESS_SPACE: "snes.cpu";
export declare const ARES_65816_WRAM_ADDRESS_SPACE: "snes.wram";
export declare const ARES_65816_CARTRIDGE_ROM_ADDRESS_SPACE: "snes.cartridge-rom";
export declare const ARES_65816_THREAD_ID: 1;
export declare const ARES_65816_FRAME_ID: 1;
export declare const ARES_TRACE_BUFFER_EVENTS = 65536;
export declare const ARES_TRACE_BATCH_EVENTS = 240;
/** Immutable editor/sidecar negotiation profile for the maintained ares RSP seam. */
export declare const ARES_RSP_CAPABILITIES: Readonly<DebugBackendCapabilities>;
//# sourceMappingURL=profile.d.ts.map