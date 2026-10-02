import type { ArchitectureInstructionSpecification, InstructionDescriptor, InstructionFlow, InstructionStateEffect } from "@uttori/asm-core";
/** ALT selector carried by the GSU status register. */
export type SuperFxAltState = 0 | 1 | 2 | 3;
/**
 * Accepts a GSU ALT value. Hardware ALT is a 2-bit field.
 * @param {number} value Candidate ALT state.
 * @returns {boolean} True when `value` is 0, 1, 2, or 3.
 */
export declare function isSuperFxAltState(value: number): value is SuperFxAltState;
/** Operand encoding used by one effective SuperFX opcode. */
export type SuperFxOperandEncoding = "implied" | "relative" | "register" | "registerIndirect" | "immediateNibble" | "registerImmediate8" | "registerImmediate16" | "registerRamShort" | "ramShortRegister" | "registerRamAbsolute" | "ramAbsoluteRegister";
/** One effective opcode under one of the four ALT states. */
export interface SuperFxInstructionSpecification extends ArchitectureInstructionSpecification {
    readonly opcode: readonly [number];
    readonly alt: SuperFxAltState;
    readonly syntax: string;
    readonly operandEncoding: SuperFxOperandEncoding;
    readonly register?: number;
    readonly flow: InstructionFlow;
    readonly effects: readonly InstructionStateEffect[];
    /** The implicit destination register receives a result from this instruction. */
    readonly writesDestination?: boolean;
    /** True when this ALT-state row differs from the unprefixed opcode. */
    readonly alteredByAlt: boolean;
}
/** Native macro form represented by two or three hardware selector/opcode bytes. */
export interface SuperFxFusedInstructionSpecification extends ArchitectureInstructionSpecification {
    readonly opcode: readonly number[];
    readonly syntax: string;
    readonly destinationRegister: number;
    readonly sourceRegister?: number;
    readonly pointerRegister?: number;
    readonly flow: InstructionFlow;
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
 * @returns {InstructionDescriptor[]} Native SuperFX instruction descriptors.
 */
export declare function buildSuperFxCatalog(): InstructionDescriptor[];
//# sourceMappingURL=superfx-spec.d.ts.map