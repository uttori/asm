export interface SnesHardwareRegister {
    /** 24-bit CPU address that was queried (bank is preserved). */
    readonly address: number;
    /** Official register name (`INIDISP`, `DMAP0`, …). */
    readonly symbol: string;
    /** Always true; MMIO is never treated as ROM or a static effective address. */
    readonly volatile: true;
}
/**
 * Returns a hardware symbol only for CPU I/O banks `$00–$3F` / `$80–$BF`.
 * ROM mirrors of those banks are never classified as I/O. DMA/HDMA channels
 * `$4300–$437F` become `DMAP0`…`NTRL7`.
 * @param {number} address 24-bit SNES CPU bus address.
 * @returns {SnesHardwareRegister | undefined} Volatile register identity, or `undefined` if not MMIO.
 */
export declare const identifySnesHardwareRegister: (address: number) => SnesHardwareRegister | undefined;
/** 16-bit PPU/CPU/APU/joypad register names keyed by `$2100`–`$421F` offsets. */
export declare const snesHardwareRegisterSymbols: Readonly<{
    [x: number]: string;
}>;
//# sourceMappingURL=hardware-registers.d.ts.map