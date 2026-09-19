export interface SnesHardwareDefine {
    /** Conventional assembler symbol. */
    readonly symbol: string;
    /** 16-bit CPU I/O address. */
    readonly address: number;
    /** Human-readable hover documentation emitted as a trailing source comment. */
    readonly description: string;
}
export interface SnesHardwareRegister {
    /** 24-bit CPU address that was queried (bank is preserved). */
    readonly address: number;
    /** Official register name (`INIDISP`, `DMAP0`, …). */
    readonly symbol: string;
    /** Human-readable register purpose used by generated-source hover documentation. */
    readonly description: string;
    /** Always true; MMIO is never treated as ROM or a static effective address. */
    readonly volatile: true;
}
/**
 * Returns a hardware symbol only for CPU I/O banks `$00–$3F` / `$80–$BF`.
 * ROM mirrors of those banks are never classified as I/O. DMA/HDMA channels
 * Documented DMA/HDMA fields in `$4300–$437F` use the SNESdev `DMAPn`…`NLTRn`
 * spelling, including both addresses of the shared unused byte.
 * @param {number} address 24-bit SNES CPU bus address.
 * @returns {SnesHardwareRegister | undefined} Volatile register identity, or `undefined` if not MMIO.
 */
export declare const identifySnesHardwareRegister: (address: number) => SnesHardwareRegister | undefined;
/** Architecture-neutral filename; the SNES exporter supplies the register definitions. */
export declare const SNES_HARDWARE_DEFINES_SOURCE = "defines.asm";
/**
 * Returns the complete documented set of CPU-visible register constants used by generated source.
 * DMA channel registers are expanded so repeated `$43x0` access patterns remain obvious and every
 * emitted symbol has its own hover annotation.
 * @returns {readonly SnesHardwareDefine[]} Register definitions in ascending address order.
 */
export declare const snesHardwareDefineRecords: () => readonly SnesHardwareDefine[];
/**
 * Returns the complete set of CPU-visible register symbol/address pairs used by generated source.
 * @returns {readonly [string, number][]} Symbol/address pairs in ascending address order.
 */
export declare const snesHardwareDefines: () => readonly (readonly [string, number])[];
/**
 * Renders the built-in SNES register and bit-mask vocabulary included by generated source.
 * These are ordinary symbols, not assembler magic, so projects may add their own aliases.
 * @returns {string} Deterministic native assembly source.
 */
export declare const renderSnesHardwareDefines: () => string;
//# sourceMappingURL=hardware-registers.d.ts.map