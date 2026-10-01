import type { AddressToLineMapping } from "@uttori/asm-core";
import type { SnesInstructionStateContract, SnesLayoutDiagnostic, SnesPlacementContract } from "./check.js";
/**
 * Prove contiguous, single-entry 65816 leaf blocks from emitted bytes, not a declaration alone.
 * Internal branches/jumps and REP/SEP are supported. Every join and declared state must agree;
 * indirect transfers, calls, interrupts, stack-restored modes and external jumps fail closed.
 * Returned states are derived build facts, not additional Git authoring declarations.
 */
export declare function checkSnesCodeFlow(output: Uint8Array, mapping: AddressToLineMapping, contract: SnesPlacementContract, declared?: readonly SnesInstructionStateContract[]): {
    readonly diagnostics: SnesLayoutDiagnostic[];
    readonly states: readonly SnesInstructionStateContract[];
};
//# sourceMappingURL=code-flow.d.ts.map