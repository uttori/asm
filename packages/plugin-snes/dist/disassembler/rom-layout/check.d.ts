import type { AddressToLineMapping } from "@uttori/asm-core";
import { type SnesMovableObject, type SnesRelocationReference } from "./relocate.js";
/** A source-linked build failure. Offsets refer to headerless ROM bytes. */
export interface SnesLayoutDiagnostic {
    readonly code: "overlap" | "output-size" | "bank-crossing" | "instruction-width" | "unknown-cpu-state" | "control-flow" | "expansion" | "missing-size" | "fixed-extent" | "raw-consumption" | "placement" | "reference";
    readonly message: string;
    readonly file?: string;
    readonly line?: number;
    readonly offset?: number;
}
/** Explicit CPU entry assumptions are research inputs, not inferred from operand suffixes. */
export interface SnesInstructionStateContract {
    readonly offset: number;
    readonly e?: boolean;
    readonly m?: boolean;
    readonly x?: boolean;
}
/** A declared object is anchored by symbols so ordinary line edits do not change its identity. */
export interface SnesFixedExtent {
    readonly id: string;
    readonly startSymbol: string;
    readonly endSymbol: string;
    readonly size: number;
}
/** Saved placements remain build contracts after the relocation preview has been applied. */
export interface SnesPlacementContract {
    readonly objects: readonly (SnesMovableObject & {
        readonly startSymbol: string;
        readonly endSymbol: string;
    })[];
    readonly references: readonly SnesRelocationReference[];
    /** Mapper identity is included in the caller's configuration hash. */
    readonly logicalAddress: (offset: number) => number;
}
/** Validate current source ownership and encoded references without invoking the allocation planner. */
export declare function checkSnesPlacements(output: Uint8Array, symbols: ReadonlyMap<string, number>, contract: SnesPlacementContract): SnesLayoutDiagnostic[];
/** Minimal target checks shared by pure and modified builds. Larger output requires explicit allocation policy. */
export interface SnesLayoutCheckOptions {
    readonly output: Uint8Array;
    readonly mapping: AddressToLineMapping;
    readonly expectedSize: number;
    readonly states?: readonly SnesInstructionStateContract[];
    readonly extents?: readonly SnesFixedExtent[];
    readonly symbols?: ReadonlyMap<string, number>;
    /** Movable code requires explicit width proof for every dynamic-width instruction in these ranges. */
    readonly requiredCpuStateRanges?: readonly {
        readonly start: number;
        readonly end: number;
    }[];
}
/**
 * Inspect emission ranges before accepting output. Final binary length alone hides writes later
 * overwritten by org/include emission; explicit ranges retain those overlaps and bank crossings.
 */
export declare function checkSnesSourceLayout(options: SnesLayoutCheckOptions): SnesLayoutDiagnostic[];
//# sourceMappingURL=check.d.ts.map