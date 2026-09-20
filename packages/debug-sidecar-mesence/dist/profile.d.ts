import type { DebugBackendCapabilities } from "@uttori/asm-debug-adapter";
export declare const MESEN_BACKEND_ID: "mesence-debug-server";
export declare const MESEN_NATIVE_PROTOCOL_VERSION: 1;
export declare const MESEN_65816_ARCHITECTURE: "snes.65816";
export declare const MESEN_SPC700_ARCHITECTURE: "snes.spc700";
export declare const MESEN_SUPERFX_ARCHITECTURE: "snes.superfx";
export declare const MESEN_65816_ADDRESS_SPACE: "snes.cpu";
export declare const MESEN_65816_WRAM_ADDRESS_SPACE: "snes.wram";
export declare const MESEN_65816_ROM_ADDRESS_SPACE: "snes.cartridge-rom";
export declare const MESEN_SPC700_ADDRESS_SPACE: "spc.aram";
export declare const MESEN_SUPERFX_ROM_ADDRESS_SPACE: "superfx.rom";
export declare const MESEN_SUPERFX_RAM_ADDRESS_SPACE: "superfx.ram";
export declare const MESEN_NATIVE_MAX_MEMORY_READ = 4096;
/** Immutable editor/sidecar negotiation profile for the patched MesenCE debugger. */
export declare const MESEN_CAPABILITIES: Readonly<DebugBackendCapabilities>;
//# sourceMappingURL=profile.d.ts.map