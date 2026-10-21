import { type DeclarationNode } from "../ir/declaration-node.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import type { OutputWriterService } from "./output-writer-service.js";
import type { StructDefinition, StructEngine } from "./struct-engine.js";
export interface DataStructHost {
    structs: Map<string, StructDefinition>;
    currentTargetBaseAddress: number;
    canEmitBytes: boolean;
    operandResolver: {
        getnum(input: string | ExpressionNode): number;
    };
    outputWriter: Pick<OutputWriterService, "step" | "writeBytes">;
    /** Final scalar attribution before record bytes are written; offsets are relative to the record. */
    recordStructField?(reference: string, expression: string, offset: number, width: number): void;
}
/**
 * Emits complete records through the normal writer (mapper, trace and debug
 * ownership included). The layout stage reserves the same width as emission.
 * Values and placement are checked at emission, once forward labels are known.
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
    /** Bind a row's table name while retaining its parsed field values and source ranges. */
    bindRow(node: Extract<DeclarationNode, {
        kind: "dataStructRow";
    }>): Extract<DeclarationNode, {
        kind: "dataStruct";
    }>;
    begin(words: readonly string[]): void;
    /** Enter a record table only after the referenced layout exists. */
    executeBegin(node: Exclude<DeclarationNode, {
        kind: "invalid";
    }> | undefined): void;
    end(words: readonly string[]): void;
    /** Closing a table checks its row invariant before releasing sequencing state. */
    executeEnd(argumentCount: number): void;
    /**
     * Resolve an addressed record, keeping the established Asar index/stride rules.
     * @param {RecordReference} reference Previously declared name with an unevaluated logical index.
     * @returns {{ definition: StructDefinition; index: number }} Layout and checked index.
     */
    private resolveRecord;
    private fieldsFor;
    emit(words: readonly string[]): void;
    /** Validate the entire typed record before committing bytes or field ownership. */
    executeRecord(node: Extract<DeclarationNode, {
        kind: "dataStruct";
    }>): void;
}
//# sourceMappingURL=data-struct-engine.d.ts.map