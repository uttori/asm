import { type InstructionResolutionFrame, type OperandScalar } from "@uttori/asm-core";
import { type Syntax65xx } from "./syntax.js";
/** Per-occurrence values are never retained in a parsed operand or reused across passes. */
export interface Classification65xx {
    mode: string;
    length: number;
    generated: boolean;
    value: number;
    native: boolean;
    specialPage: boolean;
}
/** Keep the original per-component then whole-operand observation order, without retaining source strings. */
export declare function prepare65xx(syntax: Syntax65xx, frame: InstructionResolutionFrame): Classification65xx;
/** The final reader diagnoses noncanonical generated values without executing generated hexadecimal text. */
export declare function generatedValue(value: number): number;
/** Select the numeric component after addressing punctuation has already been parsed. */
export declare function selectedScalar(syntax: Syntax65xx): OperandScalar;
//# sourceMappingURL=resolution.d.ts.map