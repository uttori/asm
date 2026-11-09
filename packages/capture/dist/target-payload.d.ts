/** ACT2 instruction profiles are fixed wire contracts. Unknown identities must never be guessed. */
export interface SnesInstructionState {
    /** Accumulator at the instruction boundary. */
    readonly a: number;
    /** Index X at the instruction boundary. */
    readonly x: number;
    /** Index Y at the instruction boundary. */
    readonly y: number;
    /** Stack pointer at the instruction boundary. */
    readonly s: number;
    /** Direct-page base at the instruction boundary. */
    readonly d: number;
    /** Data bank at the instruction boundary. */
    readonly db: number;
    /** Program bank at the instruction boundary. */
    readonly pb: number;
    /** Program counter at the instruction boundary. */
    readonly pc: number;
    /** Processor status byte at the instruction boundary. */
    readonly p: number;
    /** Emulation mode flag; only 0 or 1 is accepted on the wire. */
    readonly e: number;
}
/** Mapper registers and physical fetch offsets accompany the 2A03 CPU state. */
export interface NesInstructionState {
    /** Accumulator at the instruction boundary. */
    readonly a: number;
    /** Index X at the instruction boundary. */
    readonly x: number;
    /** Index Y at the instruction boundary. */
    readonly y: number;
    /** Stack pointer at the instruction boundary. */
    readonly s: number;
    /** Processor status byte at the instruction boundary. */
    readonly p: number;
    /** Program counter at the instruction boundary. */
    readonly pc: number;
    /** iNES mapper number captured with the instruction. */
    readonly mapper: number;
    /** MMC3 register-select latch when mapper 4 is active. */
    readonly select: number;
    /** MMC3 PRG banking mode when mapper 4 is active. */
    readonly prgMode: number;
    /** MMC3 CHR banking mode when mapper 4 is active. */
    readonly chrMode: number;
    /** MMC3 WRAM enable flag when mapper 4 is active. */
    readonly ramEnabled: number;
    /** MMC3 WRAM write-protect flag when mapper 4 is active. */
    readonly ramWritable: number;
    /** Nametable mirroring selector when mapper 4 is active. */
    readonly mirroring: number;
    /** MMC3 IRQ reload latch when mapper 4 is active. */
    readonly irqLatch: number;
    /** MMC3 IRQ enable flag when mapper 4 is active. */
    readonly irqEnabled: number;
    /** MMC3 bank register r0..r7 when mapper 4 is active. */
    readonly r0: number;
    /** MMC3 bank register r0..r7 when mapper 4 is active. */
    readonly r1: number;
    /** MMC3 bank register r0..r7 when mapper 4 is active. */
    readonly r2: number;
    /** MMC3 bank register r0..r7 when mapper 4 is active. */
    readonly r3: number;
    /** MMC3 bank register r0..r7 when mapper 4 is active. */
    readonly r4: number;
    /** MMC3 bank register r0..r7 when mapper 4 is active. */
    readonly r5: number;
    /** MMC3 bank register r0..r7 when mapper 4 is active. */
    readonly r6: number;
    /** MMC3 bank register r0..r7 when mapper 4 is active. */
    readonly r7: number;
    /** Physical PRG-ROM offset of the instruction fetch window base. */
    readonly prg0: number;
    /** Optional upper PRG window anchor when the mapper exposes it. */
    readonly prg1?: number;
    /** Optional fixed PRG window anchor when the mapper exposes it. */
    readonly prg2?: number;
}
/** Frozen instruction-state envelope keyed by target codec. */
export type CaptureTargetPayload = {
    /** SNES 65816 ACT2 profile identifier. */
    readonly codec: "snes.65816";
    /** Wire version; only 1 is accepted. */
    readonly version: 1;
    /** Validated register snapshot for the SNES profile. */
    readonly state: Readonly<SnesInstructionState>;
} | {
    /** NES 2A03 ACT2 profile identifier. */
    readonly codec: "nes.2a03";
    /** Wire version; only 1 is accepted. */
    readonly version: 1;
    /** Validated CPU and mapper snapshot for the NES profile. */
    readonly state: Readonly<NesInstructionState>;
};
/** Validate and copy at the transport boundary; callers never retain an untrusted mutable input. */
export declare function readCaptureTargetPayload(codec: string, version: number, state: Readonly<Record<string, unknown>>): CaptureTargetPayload;
//# sourceMappingURL=target-payload.d.ts.map