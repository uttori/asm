import type { AddressToLineMapping } from "@uttori/asm-core";
import { type SnesMovableObject, type SnesRelocationReference } from "./relocate.js";
/** A source-linked build failure. Offsets refer to headerless ROM bytes. */
export interface SnesLayoutDiagnostic {
    /** Stable category for grouping related layout failures. */
    readonly code: "overlap" | "output-size" | "bank-crossing" | "instruction-width" | "unknown-cpu-state" | "control-flow" | "expansion" | "missing-size" | "fixed-extent" | "raw-consumption" | "placement" | "reference";
    /** Human-readable explanation tied to the failing contract. */
    readonly message: string;
    /** Source file path when the failure maps to authored text. */
    readonly file?: string;
    /** One-based source line when available. */
    readonly line?: number;
    /** Headerless ROM byte index when the failure is image-local. */
    readonly offset?: number;
}
/** Explicit CPU entry assumptions are research inputs, not inferred from operand suffixes. */
export interface SnesInstructionStateContract {
    /** Headerless ROM offset of the instruction requiring known widths. */
    readonly offset: number;
    /** Emulation mode flag when explicitly declared. */
    readonly e?: boolean;
    /** Memory-width flag when explicitly declared. */
    readonly m?: boolean;
    /** Index-width flag when explicitly declared. */
    readonly x?: boolean;
}
/** A declared object is anchored by symbols so ordinary line edits do not change its identity. */
export interface SnesFixedExtent {
    /** Stable extent id referenced by layout checks. */
    readonly id: string;
    /** Label marking the inclusive start of the fixed span. */
    readonly startSymbol: string;
    /** Label marking the exclusive end of the fixed span. */
    readonly endSymbol: string;
    /** Declared byte length between the symbols. */
    readonly size: number;
}
/** Saved placements remain build contracts after the relocation preview has been applied. */
export interface SnesPlacementContract {
    /** Saved objects anchored by source symbols for post-relocation builds. */
    readonly objects: readonly (SnesMovableObject & {
        readonly startSymbol: string;
        readonly endSymbol: string;
    })[];
    /** Encoded pointer and length fields that must still target declared objects. */
    readonly references: readonly SnesRelocationReference[];
    /** Mapper identity is included in the caller's configuration hash. */
    readonly logicalAddress: (offset: number) => number;
}
/** Validate current source ownership and encoded references without invoking the allocation planner. */
export declare function checkSnesPlacements(output: Uint8Array, symbols: ReadonlyMap<string, number>, contract: SnesPlacementContract): SnesLayoutDiagnostic[];
/** Minimal target checks shared by pure and modified builds. Larger output requires explicit allocation policy. */
export interface SnesLayoutCheckOptions {
    /** Built headerless ROM image under test. */
    readonly output: Uint8Array;
    /** Address-to-source map for attributing diagnostics. */
    readonly mapping: AddressToLineMapping;
    /** Declared cartridge capacity from project configuration. */
    readonly expectedSize: number;
    /** Optional explicit CPU width assumptions keyed by ROM offset. */
    readonly states?: readonly SnesInstructionStateContract[];
    /** Symbol-anchored fixed spans that must not drift. */
    readonly extents?: readonly SnesFixedExtent[];
    /** Resolved label values for extent and placement checks. */
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