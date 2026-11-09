/**
 * Native PPU decision at one completing port write. Physical byte writes retain
 * order, including repeated destinations. No source instruction or A-bus read is inferred.
 * Raster positions stay in the ordered archive instead of multiplying SQL variants.
 */
export interface RuntimePPUEffect {
    /** Destination memory region selected by the completing PPU port write. */
    readonly target: "vram" | "cgram" | "oam";
    /** Whether bytes landed, were blocked, or only latched a pending transfer. */
    readonly outcome: "written" | "blocked" | "latched";
    /** True when forced blanking prevented visible updates regardless of port data. */
    readonly forcedBlank: boolean;
    /** True when active rendering rules restricted the write even without forced blank. */
    readonly renderingRestricted: boolean;
    /** Emulator fidelity tier that produced the decision flags. */
    readonly implementation: "accurate" | "performance";
    /** Physical capacity for VRAM. Null for CGRAM/OAM. */
    readonly vramBytes: 65536 | 131072 | null;
    /** Physical byte destinations emitted for a written outcome, in port order. */
    readonly bytes: readonly {
        readonly address: number;
        readonly value: number;
    }[];
}
/**
 * Validate a native effect independently of transport framing or stored JSON.
 * @param effect Claimed physical writes and decision flags.
 * @param access Completing bus operation.
 * @returns Fresh semantic value with canonical property order, excluding raster.
 */
export declare const normalizeRuntimePPUEffect: (effect: unknown, access: {
    readonly address: unknown;
    readonly direction: unknown;
    readonly value: unknown;
}) => RuntimePPUEffect;
//# sourceMappingURL=runtime-ppu-effect.d.ts.map