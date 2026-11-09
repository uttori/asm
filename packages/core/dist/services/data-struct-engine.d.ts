import { type DeclarationNode } from "../ir/declaration-node.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import type { OutputWriterService } from "./output-writer-service.js";
import type { StructDefinition, StructEngine } from "./struct-engine.js";
/** Session hooks and services required to emit data struct tables and relocations. */
export interface DataStructHost {
    /** Optional module id stamped into link expressions for struct bases. */
    readonly moduleIdentity?: string;
    /** Lowers field expressions to link-time trees when relocations are emitted. */
    compileLinkExpression?(expression: ExpressionNode): import("../ir/link-expression.js").LinkExpression;
    /** Records a fixup for a field expression at the current output cursor. */
    writeRelocation?(expression: import("../ir/link-expression.js").LinkExpression, encoding: import("../relocatable.js").RelocationEncoding): void;
    /** Publishes the runtime base address of a module-local struct symbol. */
    recordModuleStructBase?(name: string, base: number): void;
    /** Parsed struct layouts available for indexed data struct rows. */
    structs: Map<string, StructDefinition>;
    /** Active org/base address used when resolving field offsets. */
    currentTargetBaseAddress: number;
    /** False during analysis passes that must not mutate output bytes. */
    canEmitBytes: boolean;
    /** Operand evaluator shared with directive and struct emission paths. */
    operandResolver: {
        getnum(input: string | ExpressionNode): number;
    };
    /** Output cursor used to reserve and write struct field bytes. */
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
    /** True while a dataStructs table block is open. */
    get inTable(): boolean;
    /** Clears table sequencing state without validating row counts. */
    reset(): void;
    /** Ensures no dataStructs table remains open at session end. */
    finish(): void;
    /** Bind a row's table name while retaining its parsed field values and source ranges. */
    bindRow(node: Extract<DeclarationNode, {
        kind: "dataStructRow";
    }>): Extract<DeclarationNode, {
        kind: "dataStruct";
    }>;
    /** Parses and opens a dataStructs table from directive words. */
    begin(words: readonly string[]): void;
    /** Enter a record table only after the referenced layout exists. */
    executeBegin(node: Exclude<DeclarationNode, {
        kind: "invalid";
    }> | undefined): void;
    /** Closes the active table using the parsed end directive argument count. */
    end(words: readonly string[]): void;
    /** Closing a table checks its row invariant before releasing sequencing state. */
    executeEnd(argumentCount: number): void;
    /**
     * Resolve an addressed record, keeping the established Asar index/stride rules.
     * @param reference Previously declared name with an unevaluated logical index.
     * @returns Layout and checked index.
     */
    private resolveRecord;
    private fieldsFor;
    /** Emits one indexed struct row from parsed declaration words. */
    emit(words: readonly string[]): void;
    /** Validate the entire typed record before committing bytes or field ownership. */
    executeRecord(node: Extract<DeclarationNode, {
        kind: "dataStruct";
    }>): void;
}
//# sourceMappingURL=data-struct-engine.d.ts.map