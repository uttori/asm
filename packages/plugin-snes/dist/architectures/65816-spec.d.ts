import type { ArchitectureInstructionSpecification, InstructionDescriptor, InstructionFlow, InstructionStateEffect } from "@uttori/asm-core";
/** Processor flag consulted when an addressing mode depends on accumulator or index width. */
export type Cpu65816WidthFlag = "m" | "x";
/** One 65816 addressing mode entry in the shared opcode matrix. */
export interface Cpu65816ModeDefinition {
    /** Stable mode id referenced by opcode rows and encoders. */
    readonly id: string;
    /** Canonical operand placeholder spelling for tooling and decode. */
    readonly syntax: string;
    /** Smallest encoded instruction size for this mode in bytes. */
    readonly minimumSize: number;
    /** Largest encoded instruction size for this mode in bytes. */
    readonly maximumSize: number;
    /** M or X flag affecting immediate width when this mode is immediate. */
    readonly widthFlag?: Cpu65816WidthFlag;
}
/** Declarative specification for one 65816 opcode byte and addressing mode. */
export interface Cpu65816InstructionSpecification extends ArchitectureInstructionSpecification {
    /** Primary opcode byte selecting this matrix row. */
    readonly opcode: readonly [number];
    /** M or X flag affecting immediate forms of this mnemonic. */
    readonly widthFlag?: Cpu65816WidthFlag;
    /** Canonical operand placeholder spelling shown in disassembly tooling. */
    readonly syntax: string;
    /** Control-flow kind used by analysis and the linear decoder. */
    readonly flow: InstructionFlow;
    /** PSW or register effects attributed to this instruction form. */
    readonly effects: readonly InstructionStateEffect[];
    /** REP/SEP style status bit mutation when this opcode embeds a mask byte. */
    readonly operandStatusEffect?: "clearBits" | "setBits";
}
/** Frozen 65816 addressing mode catalog keyed by encoder-internal mode ids. */
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
 * @returns Generated editor instruction descriptors.
 */
export declare function buildCpu65816Catalog(): InstructionDescriptor[];
//# sourceMappingURL=65816-spec.d.ts.map