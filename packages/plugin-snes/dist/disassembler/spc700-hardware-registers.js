const registers = [
    { address: 0x00f0, symbol: "TEST", description: "APU test register" },
    { address: 0x00f1, symbol: "CONTROL", description: "APU control register" },
    { address: 0x00f2, symbol: "DSPADDR", description: "DSP register address" },
    { address: 0x00f3, symbol: "DSPDATA", description: "DSP register data" },
    ...Array.from({ length: 4 }, (_, index) => ({
        address: 0x00f4 + index,
        symbol: `CPUIO${index}`,
        description: `CPU/APU communication port ${index}`,
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
        address: 0x00f8 + index,
        symbol: `AUXIO${index + 4}`,
        description: `Auxiliary I/O register ${index + 4}`,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
        address: 0x00fa + index,
        symbol: `TIMER${index}_TARGET`,
        description: `Timer ${index} target`,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
        address: 0x00fd + index,
        symbol: `TIMER${index}_COUNTER`,
        description: `Timer ${index} output counter`,
    })),
];
const byAddress = new Map(registers.map((register) => [register.address, register]));
/**
 * Identifies volatile SPC700 I/O mapped at `$00F0`–`$00FF`.
 * @param address SPC700 memory address.
 * @returns Register metadata when matched.
 */
export const identifySpc700HardwareRegister = (address) => byAddress.get(address);
//# sourceMappingURL=spc700-hardware-registers.js.map