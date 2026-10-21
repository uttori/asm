import type { ArchitectureEncoderContext } from "./architecture-types.js";
import { type ParsedInstruction, type TypedArchitectureEncoder } from "./ir/resolved-instruction.js";
export declare function runTypedEncoderEntry(context: ArchitectureEncoderContext, encoder: TypedArchitectureEncoder, instruction: ParsedInstruction, emit: true): boolean;
export declare function runTypedEncoderEntry(context: ArchitectureEncoderContext, encoder: TypedArchitectureEncoder, instruction: ParsedInstruction, emit: false): number;
//# sourceMappingURL=typed-encoder-entry.d.ts.map