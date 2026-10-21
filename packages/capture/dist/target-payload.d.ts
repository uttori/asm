/** ACT2 instruction profiles are fixed wire contracts. Unknown identities must never be guessed. */
export interface SnesInstructionState {
    readonly a: number;
    readonly x: number;
    readonly y: number;
    readonly s: number;
    readonly d: number;
    readonly db: number;
    readonly pb: number;
    readonly pc: number;
    readonly p: number;
    readonly e: number;
}
/** Mapper registers and physical fetch offsets accompany the 2A03 CPU state. */
export interface NesInstructionState {
    readonly a: number;
    readonly x: number;
    readonly y: number;
    readonly s: number;
    readonly p: number;
    readonly pc: number;
    readonly mapper: number;
    readonly select: number;
    readonly prgMode: number;
    readonly chrMode: number;
    readonly ramEnabled: number;
    readonly ramWritable: number;
    readonly mirroring: number;
    readonly irqLatch: number;
    readonly irqEnabled: number;
    readonly r0: number;
    readonly r1: number;
    readonly r2: number;
    readonly r3: number;
    readonly r4: number;
    readonly r5: number;
    readonly r6: number;
    readonly r7: number;
    readonly prg0: number;
    readonly prg1?: number;
    readonly prg2?: number;
}
export type CaptureTargetPayload = {
    readonly codec: "snes.65816";
    readonly version: 1;
    readonly state: Readonly<SnesInstructionState>;
} | {
    readonly codec: "nes.2a03";
    readonly version: 1;
    readonly state: Readonly<NesInstructionState>;
};
/** Validate and copy at the transport boundary; callers never retain an untrusted mutable input. */
export declare function readCaptureTargetPayload(codec: string, version: number, state: Readonly<Record<string, unknown>>): CaptureTargetPayload;
//# sourceMappingURL=target-payload.d.ts.map