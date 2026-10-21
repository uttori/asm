/** Known 65816 assumptions. M/X true means 8-bit; addresses are hardware register values. */
export type Cpu65816Assumptions = Readonly<{
    e?: boolean;
    m?: boolean;
    x?: boolean;
    carry?: boolean;
    programBank?: number;
    dataBank?: number;
    directPage?: number;
    stackPointer?: number;
}>;
/** Target identity supplies the discriminator for the compact persisted state map. */
export type AnalysisTargetState = {
    readonly codec: "snes.65816";
    readonly version: 1;
    readonly state: Cpu65816Assumptions;
} | {
    readonly codec: "snes.spc700";
    readonly version: 1;
    readonly state: Readonly<{
        directPage?: 0 | 256;
    }>;
} | {
    readonly codec: "65xx.2a03";
    readonly version: 1;
    readonly state: Readonly<{
        carry?: boolean;
    }>;
};
/**
 * Interpret an owned, versioned target payload from the architecture-tagged storage representation.
 * Storage remains compact and existing evidence keeps its identity; unknown/nonmatching fields fail
 * before target analysis. The returned state is copied and frozen, never a borrowed mutable map.
 */
export declare function readAnalysisTargetState(architecture: string, value: unknown): AnalysisTargetState | undefined;
//# sourceMappingURL=target-state.d.ts.map