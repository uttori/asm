import type { ArchitectureInstructionSpecification, InstructionDescriptor, InstructionFlow, InstructionStateEffect } from "@uttori/asm-core";
/** ALT selector carried by the GSU status register. */
export type SuperFxAltState = 0 | 1 | 2 | 3;
/**
 * Accepts a GSU ALT value. Hardware ALT is a 2-bit field.
 * @param value Candidate ALT state.
 * @returns True when `value` is 0, 1, 2, or 3.
 */
export declare function isSuperFxAltState(value: number): value is SuperFxAltState;
/** Operand encoding used by one effective SuperFX opcode. */
export type SuperFxOperandEncoding = "implied" | "relative" | "register" | "registerIndirect" | "immediateNibble" | "registerImmediate8" | "registerImmediate16" | "registerRamShort" | "ramShortRegister" | "registerRamAbsolute" | "ramAbsoluteRegister";
/** One effective opcode under one of the four ALT states. */
export interface SuperFxInstructionSpecification extends ArchitectureInstructionSpecification {
    /** Trailing opcode byte after any ALT prefix bytes. */
    readonly opcode: readonly [number];
    /** GSU ALT selector state under which this row is valid. */
    readonly alt: SuperFxAltState;
    /** Canonical operand placeholder spelling for tooling. */
    readonly syntax: string;
    /** Operand layout id shared with the decoder and encoder. */
    readonly operandEncoding: SuperFxOperandEncoding;
    /** Embedded hardware register index when the encoding names Rn. */
    readonly register?: number;
    /** Control-flow kind used by analysis and the linear decoder. */
    readonly flow: InstructionFlow;
    /** Custom GSU state effects such as ALT or register selection. */
    readonly effects: readonly InstructionStateEffect[];
    /** The implicit destination register receives a result from this instruction. */
    readonly writesDestination?: boolean;
    /** True when this ALT-state row differs from the unprefixed opcode. */
    readonly alteredByAlt: boolean;
}
/** Native macro form represented by two or three hardware selector/opcode bytes. */
export interface SuperFxFusedInstructionSpecification extends ArchitectureInstructionSpecification {
    /** Selector and opcode bytes emitted in order for this fused form. */
    readonly opcode: readonly number[];
    /** Canonical operand placeholder spelling for tooling. */
    readonly syntax: string;
    /** Destination register index encoded in the selector bytes. */
    readonly destinationRegister: number;
    /** Source register for register-register fused MOVE forms. */
    readonly sourceRegister?: number;
    /** Pointer register for indirect fused MOVE forms. */
    readonly pointerRegister?: number;
    /** Control-flow kind when the destination is the program counter register. */
    readonly flow: InstructionFlow;
    /** Reserved for future GSU side effects on fused forms. */
    readonly effects: readonly InstructionStateEffect[];
}
/** Complete four-state effective opcode matrix: `[alt][opcode]`. */
export declare const superFxOpcodeMatrix: readonly (readonly SuperFxInstructionSpecification[])[];
/** Unprefixed 256-byte opcode table. */
export declare const superFxBaseSpecifications: readonly SuperFxInstructionSpecification[];
/** Canonical unprefixed and ALT-altered forms accepted by the native encoder. */
export declare const superFxSpecifications: readonly SuperFxInstructionSpecification[];
/** Every canonical selector fusion emitted by MOVE/MOVES/MOVEB/MOVEW. */
export declare const superFxFusedSpecifications: readonly SuperFxFusedInstructionSpecification[];
/**
 * Generates the editor catalog from the effective opcode matrix.
 * @returns Native SuperFX instruction descriptors.
 */
export declare function buildSuperFxCatalog(): InstructionDescriptor[];
//# sourceMappingURL=superfx-spec.d.ts.map