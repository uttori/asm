import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { OutputWriterService } from "./output-writer-service.js";
import type { StructDefinition, StructEngine } from "./struct-engine.js";
export interface DataStructHost {
    structs: Map<string, StructDefinition>;
    currentTargetBaseAddress: number;
    canEmitBytes: boolean;
    operandResolver: {
        getnum(input: string): number;
    };
    outputWriter: Pick<OutputWriterService, "step" | "writeBytes">;
}
/**
 * Emits complete records through the normal writer (mapper, trace and debug
 * ownership included). The layout stage reserves the same width as emission;
 * values and placement are checked at emission, once forward labels are known.
 * Array blocks own only sequencing state, never an independent write cursor.
 */
export declare class DataStructEngine {
    readonly host: DataStructHost;
    readonly structs: StructEngine;
    private table?;
    constructor(host: DataStructHost, structs: StructEngine);
    get inTable(): boolean;
    reset(): void;
    finish(): void;
    /**
     * Rewrite a row into a normal directive so it retains source/trace ownership.
     * @param {NormalizedCommand} command Per-dispatch mutable command, never the cached node.
     */
    prepareRow(command: NormalizedCommand): void;
    begin(words: readonly string[]): void;
    end(words: readonly string[]): void;
    /**
     * Resolve an addressed record, keeping the established Asar index/stride rules.
     * @param {string} reference Previously declared name with an optional logical index.
     * @returns {{ definition: StructDefinition; index: number }} Layout and checked index.
     */
    private resolveRecord;
    private fieldsFor;
    emit(words: readonly string[]): void;
}
//# sourceMappingURL=data-struct-engine.d.ts.map