/** One memory-mapped SPC700 I/O register in direct page zero. */
export interface Spc700HardwareRegister {
    readonly address: number;
    readonly symbol: string;
    readonly description: string;
}
/**
 * Identifies volatile SPC700 I/O mapped at `$00F0`–`$00FF`.
 * @param {number} address SPC700 memory address.
 * @returns {Spc700HardwareRegister | undefined} Register metadata when matched.
 */
export declare const identifySpc700HardwareRegister: (address: number) => Spc700HardwareRegister | undefined;
//# sourceMappingURL=spc700-hardware-registers.d.ts.map