import type { ArchitectureInstructionSpecification, InstructionDescriptor, InstructionFlow, InstructionStateEffect } from "@uttori/asm-core";
/** One fixed-width SPC700 addressing form. */
export interface Spc700ModeDefinition {
    /** Stable mode id referenced by opcode rows and encoders. */
    readonly id: string;
    /** Canonical operand placeholder spelling for tooling and decode. */
    readonly syntax: string;
    /** Fixed encoded instruction size for this mode in bytes. */
    readonly size: 1 | 2 | 3;
}
/** Declarative specification for one of the SPC700's 256 opcode bytes. */
export interface Spc700InstructionSpecification extends ArchitectureInstructionSpecification {
    /** Primary opcode byte indexing the 256-entry matrix. */
    readonly opcode: readonly [number];
    /** Canonical operand placeholder spelling shown in disassembly tooling. */
    readonly syntax: string;
    /** Control-flow kind used by analysis and the linear decoder. */
    readonly flow: InstructionFlow;
    /** PSW or register effects attributed to this instruction form. */
    readonly effects: readonly InstructionStateEffect[];
}
/**
 * Native-source operand forms used by the opcode matrix. Names describe both
 * operand order and encoded width so decoding never guesses direct vs absolute.
 */
export declare const spc700Modes: Readonly<{
    imp: Spc700ModeDefinition;
    tc: Spc700ModeDefinition;
    dpBit: Spc700ModeDefinition;
    dpBitRel: Spc700ModeDefinition;
    aDp: Spc700ModeDefinition;
    aAbs: Spc700ModeDefinition;
    aIndX: Spc700ModeDefinition;
    aDpxi: Spc700ModeDefinition;
    aImm: Spc700ModeDefinition;
    dpDp: Spc700ModeDefinition;
    cBit: Spc700ModeDefinition;
    cBitInv: Spc700ModeDefinition;
    bitC: Spc700ModeDefinition;
    bit: Spc700ModeDefinition;
    dp: Spc700ModeDefinition;
    dpx: Spc700ModeDefinition;
    abs: Spc700ModeDefinition;
    rel: Spc700ModeDefinition;
    absA: Spc700ModeDefinition;
    aDpx: Spc700ModeDefinition;
    aAbx: Spc700ModeDefinition;
    aAby: Spc700ModeDefinition;
    aDpiy: Spc700ModeDefinition;
    dpImm: Spc700ModeDefinition;
    xy: Spc700ModeDefinition;
    dpWord: Spc700ModeDefinition;
    regA: Spc700ModeDefinition;
    regX: Spc700ModeDefinition;
    regY: Spc700ModeDefinition;
    regP: Spc700ModeDefinition;
    regYA: Spc700ModeDefinition;
    regYAX: Spc700ModeDefinition;
    regXA: Spc700ModeDefinition;
    regAX: Spc700ModeDefinition;
    regXSP: Spc700ModeDefinition;
    regSPX: Spc700ModeDefinition;
    regAY: Spc700ModeDefinition;
    regYA2: Spc700ModeDefinition;
    regPostXA: Spc700ModeDefinition;
    regAPostX: Spc700ModeDefinition;
    regIndXA: Spc700ModeDefinition;
    regAIndX: Spc700ModeDefinition;
    xAbs: Spc700ModeDefinition;
    xDp: Spc700ModeDefinition;
    xDpy: Spc700ModeDefinition;
    yAbs: Spc700ModeDefinition;
    yDp: Spc700ModeDefinition;
    yDpx: Spc700ModeDefinition;
    xImm: Spc700ModeDefinition;
    yImm: Spc700ModeDefinition;
    jmpAbx: Spc700ModeDefinition;
    dpRel: Spc700ModeDefinition;
    dpxRel: Spc700ModeDefinition;
    yRel: Spc700ModeDefinition;
    yaDp: Spc700ModeDefinition;
    dpYa: Spc700ModeDefinition;
    pcall: Spc700ModeDefinition;
    dpA: Spc700ModeDefinition;
    absRegA: Spc700ModeDefinition;
    indXA: Spc700ModeDefinition;
    dpxiA: Spc700ModeDefinition;
    dpxA: Spc700ModeDefinition;
    abxA: Spc700ModeDefinition;
    abyA: Spc700ModeDefinition;
    dpiyA: Spc700ModeDefinition;
    dpX: Spc700ModeDefinition;
    dpyX: Spc700ModeDefinition;
    absX: Spc700ModeDefinition;
    dpY: Spc700ModeDefinition;
    dpxY: Spc700ModeDefinition;
    absY: Spc700ModeDefinition;
}>;
/** Conditional branch mnemonics whose opcode does not encode a bit number. */
export declare const spc700ConditionalBranches: ReadonlySet<string>;
/** Complete fixed-width SPC700 opcode specification, indexed by opcode byte. */
export declare const spc700Specifications: readonly Spc700InstructionSpecification[];
/**
 * Generates editor hover/completion data from the decoder's opcode authority.
 * @returns Alphabetized SPC700 instruction descriptors.
 */
export declare function buildSpc700Catalog(): InstructionDescriptor[];
//# sourceMappingURL=spc700-spec.d.ts.map