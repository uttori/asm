import type { ExpressionNode } from "../ir/expression-node.js";
import { type NumericDataStatement } from "../ir/statement-node.js";
import type { OperandResolver } from "../operand-resolver.js";
import type { DefineEngine } from "./define-engine.js";
import type { StructEngine } from "./struct-engine.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";
export type PushPcStackEntry = {
    currentTargetAddress: number;
    currentTargetStartAddress: number;
    currentTargetBaseAddress: number;
    currentTargetBaseStartAddress: number;
};
export interface DirectiveRuntimeHost {
    readonly moduleIdentity?: string;
    addressWidth: number;
    characterMappings: Map<string, number>;
    currentTargetAddress: number;
    currentTargetBaseAddress: number;
    currentTargetBaseStartAddress: number;
    currentTargetStartAddress: number;
    defineEngine: DefineEngine;
    isDefinitionCollectionStage: boolean;
    namespaceNestingEnabled: boolean;
    namespaceNestingPath: string[];
    namespaceStack: string[];
    operandResolver: OperandResolver;
    pushpcStack: PushPcStackEntry[];
    pushpcnum: number;
    structEngine: StructEngine;
    symbolScope: SymbolScopeService;
    collectSourceMetadata: boolean;
    addAddressToLine(address: number): void;
    resolvedefines(input: string): string;
    setWritePosition(address: number): void;
    step(count: number): void;
    write1(value: number): void;
    write2(value: number): void;
    write3(value: number): void;
    write4(value: number): void;
    /** Module-aware scalar path; structural embedding hosts may retain their numeric-only contract. */
    writeExpression?(expression: ExpressionNode, width: 1 | 2 | 3 | 4): void;
}
export declare class DirectiveRuntimeService {
    readonly host: DirectiveRuntimeHost;
    constructor(host: DirectiveRuntimeHost);
    /**
     * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
     * @param {string[]} words The character mapping command words.
     * @throws {Error} If the format is incorrect.
     */
    handleCharacterMapping(words: readonly string[]): void;
    /**
     * Processes a string and maps characters to their corresponding values in `characterMappings`.
     * If a character is not found in `characterMappings`, its charCode is used instead.
     * @param {string} input The string to process.
     * @returns {number[]} An array of numbers representing the mapped characters.
     */
    processStringWithMapping(input: string): number[];
    /**
     * Handles `org`.
     * @param {string[]} params The directive parameters.
     */
    handleOrg(params: string[]): void;
    /** ORG uses mathematical evaluation, including grouped fractions, before checking the target range. */
    executeOrg(expression: ExpressionNode, spelling: string): void;
    /**
     * Handles data directives.
     * @param {string} type The data directive keyword.
     * @param {string[]} params The directive parameters.
     */
    handleDataDirective(type: string, params: string[], numeric?: NumericDataStatement): void;
    /** Resolve each element at its write cursor; sizing binds lists but never evaluates numeric values. */
    executeDataStatement(statement: NumericDataStatement, estimateOnly?: boolean): void;
    /**
     * Writes a value using the data directive byte width.
     * @param {number} len The byte width.
     * @param {number} value The value to write.
     */
    writeDataByLength(len: number, value: number): void;
    /** Keep expression ownership until the writer can decide between an immediate scalar and a fixup. */
    private writeDataExpression;
    /**
     * Estimates data size with the same expansion order as emission, without resolving final values.
     * @param {number} len Bytes per numeric item (1–4). String characters each occupy one item.
     * @param {string[]} params Source operands, including defines that may expand to data lists.
     */
    estimateDataDirectiveSize(len: number, params: string[]): void;
    /**
     * Pushes the current PC state.
     */
    handlePushPC(): void;
    /**
     * Restores the previous PC state.
     */
    handlePullPC(): void;
}
//# sourceMappingURL=directive-runtime-service.d.ts.map