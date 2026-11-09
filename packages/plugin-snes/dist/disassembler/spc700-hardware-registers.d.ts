/** One memory-mapped SPC700 I/O register in direct page zero. */
export interface Spc700HardwareRegister {
    /** SPC700 address in `$00F0`–`$00FF`. */
    readonly address: number;
    /** Assembler symbol emitted for the register. */
    readonly symbol: string;
    /** Human-readable register purpose. */
    readonly description: string;
}
/**
 * Identifies volatile SPC700 I/O mapped at `$00F0`–`$00FF`.
 * @param address SPC700 memory address.
 * @returns Register metadata when matched.
 */
export declare const identifySpc700HardwareRegister: (address: number) => Spc700HardwareRegister | undefined;
//# sourceMappingURL=spc700-hardware-registers.d.ts.map