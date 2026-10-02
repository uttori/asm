/** Native PPU decision at one completing port write. Physical byte writes retain
 * order, including repeated destinations. No source instruction or A-bus read is inferred.
 * Raster positions stay in the ordered archive instead of multiplying SQL variants.
 */
export interface RuntimePPUEffect {
    readonly target: "vram" | "cgram" | "oam";
    readonly outcome: "written" | "blocked" | "latched";
    readonly forcedBlank: boolean;
    readonly renderingRestricted: boolean;
    readonly implementation: "accurate" | "performance";
    /** Physical capacity for VRAM. Null for CGRAM/OAM. */
    readonly vramBytes: 65536 | 131072 | null;
    readonly bytes: readonly {
        readonly address: number;
        readonly value: number;
    }[];
}
/** Validate a native effect independently of transport framing or stored JSON.
 * @param {unknown} effect Claimed physical writes and decision flags.
 * @param {object} access Completing bus operation.
 * @returns {RuntimePPUEffect} Fresh semantic value with canonical property order, excluding raster.
 */
export declare const normalizeRuntimePPUEffect: (effect: unknown, access: {
    readonly address: unknown;
    readonly direction: unknown;
    readonly value: unknown;
}) => RuntimePPUEffect;
//# sourceMappingURL=runtime-ppu-effect.d.ts.map