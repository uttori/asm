import type { ArchitectureInstructionSpecification, InstructionDescriptor, InstructionFlow, InstructionStateEffect } from "@uttori/asm-core";
export type Cpu65816WidthFlag = "m" | "x";
export interface Cpu65816ModeDefinition {
    readonly id: string;
    readonly syntax: string;
    readonly minimumSize: number;
    readonly maximumSize: number;
    readonly widthFlag?: Cpu65816WidthFlag;
}
export interface Cpu65816InstructionSpecification extends ArchitectureInstructionSpecification {
    readonly opcode: readonly [number];
    readonly widthFlag?: Cpu65816WidthFlag;
    readonly syntax: string;
    readonly flow: InstructionFlow;
    readonly effects: readonly InstructionStateEffect[];
    readonly operandStatusEffect?: "clearBits" | "setBits";
}
export declare const cpu65816Modes: Readonly<{
    imp: Cpu65816ModeDefinition;
    acc: Cpu65816ModeDefinition;
    sig: Cpu65816ModeDefinition;
    immM: Cpu65816ModeDefinition;
    immX: Cpu65816ModeDefinition;
    imm16: Cpu65816ModeDefinition;
    dp: Cpu65816ModeDefinition;
    dpx: Cpu65816ModeDefinition;
    dpy: Cpu65816ModeDefinition;
    dpi: Cpu65816ModeDefinition;
    dil: Cpu65816ModeDefinition;
    dix: Cpu65816ModeDefinition;
    diy: Cpu65816ModeDefinition;
    dily: Cpu65816ModeDefinition;
    sr: Cpu65816ModeDefinition;
    sriy: Cpu65816ModeDefinition;
    abs: Cpu65816ModeDefinition;
    abx: Cpu65816ModeDefinition;
    aby: Cpu65816ModeDefinition;
    long: Cpu65816ModeDefinition;
    longx: Cpu65816ModeDefinition;
    rel8: Cpu65816ModeDefinition;
    rel16: Cpu65816ModeDefinition;
    ind: Cpu65816ModeDefinition;
    indx: Cpu65816ModeDefinition;
    indlong: Cpu65816ModeDefinition;
    block: Cpu65816ModeDefinition;
}>;
/**
 * Rel8 flag-conditioned branches. `BRA`/`BRL` are unconditional and excluded.
 */
export declare const conditionalBranches: ReadonlySet<string>;
/**
 * The specifications for the 65816 instructions.
 */
export declare const cpu65816Specifications: readonly Cpu65816InstructionSpecification[];
/**
 * Generates editor hover/completion data from the same 256-entry table used to decode.
 * @returns {InstructionDescriptor[]} Generated editor instruction descriptors.
 */
export declare function buildCpu65816Catalog(): InstructionDescriptor[];
//# sourceMappingURL=65816-spec.d.ts.map