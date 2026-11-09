import type { InstructionResolutionFrame, OperandScalar } from "@uttori/asm-core";
import type { Syntax65816 } from "./65816-syntax.js";
import { type OperandExpansion } from "./operand-values.js";
/** Stage-local classification contains no expanded executable text. */
export interface Resolution65816 extends OperandExpansion {
    /** Encoder addressing mode token derived from delimiter and index register use. */
    mode: string;
    /** Lexical hex digit count retained for direct-page width heuristics. */
    hexDigits: number;
    /** True when a short numeric spelling forces an explicit direct-page width. */
    explicitDp: boolean;
    /** Scalar syntax tied to the operand occurrence that produced this resolution. */
    scalar: OperandScalar;
}
/** Resolve width and bank preference while retaining punctuation from the parsed operand. */
export declare function classify65816(syntax: Syntax65816, frame: InstructionResolutionFrame): Resolution65816;
/** Preserve the preparatory per-part reads before whole-operand classification. */
export declare function prepare65816(syntax: Syntax65816, frame: InstructionResolutionFrame): Resolution65816;
/** Values can be retained from classification only where the established encoder consumed the expansion. */
export declare function read65816(syntax: Syntax65816, resolved: Resolution65816, frame: InstructionResolutionFrame, native?: boolean, whole?: boolean): number;
/** Frame snapshots omit scalar syntax, which remains owned by the parsed occurrence. */
export declare function prepared65816(frame: InstructionResolutionFrame, scalar: OperandScalar): Resolution65816 | undefined;
//# sourceMappingURL=65816-resolution.d.ts.map