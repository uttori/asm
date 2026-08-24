import type { OperandResolver } from "../operand-resolver.js";
import type { LegacySpcBlockData } from "../plugin/legacy-session-state.js";
import type { OutputWriterService } from "./output-writer-service.js";
export interface LegacySpcRuntimeHost {
    canFinalize: boolean;
    currentNamespace: string;
    currentTargetAddress: number;
    currentTargetBaseAddress: number;
    currentTargetStartAddress: number;
    inTargetBlock: boolean;
    operandResolver: OperandResolver;
    outputWriter: OutputWriterService;
    targetBlockInlineCompatibility: boolean;
    targetBlockData: LegacySpcBlockData | null;
    resolvedefines(input: string): string;
    write2(value: number): void;
    writeOutputBytes(start: number, value: number, length?: number): void;
}
/** Transitional SNES-plugin runtime for SPC block directives and pass cleanup. */
export declare class LegacySpcRuntimeService {
    readonly host: LegacySpcRuntimeHost;
    constructor(host: LegacySpcRuntimeHost);
    finishPass(): void;
    handleSpcblock(words: readonly string[]): void;
    handleEndSpcblock(words: readonly string[]): void;
}
//# sourceMappingURL=legacy-spc-runtime-service.d.ts.map