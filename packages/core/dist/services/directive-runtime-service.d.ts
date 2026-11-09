import type { ExpressionNode } from "../ir/expression-node.js";
import { type NumericDataStatement } from "../ir/statement-node.js";
import type { OperandResolver } from "../operand-resolver.js";
import type { DefineEngine } from "./define-engine.js";
import type { StructEngine } from "./struct-engine.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";
/** Saved logical and base cursors while a pushpc directive nests address contexts. */
export type PushPcStackEntry = {
    /** Logical write cursor before the nested pushpc block. */
    currentTargetAddress: number;
    /** Section start logical address paired with the saved cursor. */
    currentTargetStartAddress: number;
    /** Base address used for metadata and output mapping at push time. */
    currentTargetBaseAddress: number;
    /** Section start base address paired with the saved base cursor. */
    currentTargetBaseStartAddress: number;
};
/** Assembler surface required to execute data, org, and character-mapping directives. */
export interface DirectiveRuntimeHost {
    /** Present when directives run in section-relative module assembly. */
    readonly moduleIdentity?: string;
    /** Active target address width in bits for range checks. */
    addressWidth: number;
    /** Character literal to numeric value mappings from `.char` directives. */
    characterMappings: Map<string, number>;
    /** Current logical assembly address for emission and org. */
    currentTargetAddress: number;
    /** Base address paired with the logical cursor for metadata. */
    currentTargetBaseAddress: number;
    /** Section start base address for relative metadata recording. */
    currentTargetBaseStartAddress: number;
    /** Section start logical address for relative cursor math. */
    currentTargetStartAddress: number;
    /** Define expansion engine used when resolving directive text. */
    defineEngine: DefineEngine;
    /** Whether the pass collects sizes without writing final output bytes. */
    isDefinitionCollectionStage: boolean;
    /** Whether ca65-style nested namespace segments are active. */
    namespaceNestingEnabled: boolean;
    /** Flattened namespace path segments for nested namespace directives. */
    namespaceNestingPath: string[];
    /** Stack of entered namespace names for push/pop semantics. */
    namespaceStack: string[];
    /** Operand resolver supplying math evaluation and numeric reads. */
    operandResolver: OperandResolver;
    /** Stack of pushpc-saved cursor tuples. */
    pushpcStack: PushPcStackEntry[];
    /** Repeat count for the innermost active pushpc block. */
    pushpcnum: number;
    /** Struct layout engine consulted by data directives. */
    structEngine: StructEngine;
    /** Label and namespace qualification service for directive side effects. */
    symbolScope: SymbolScopeService;
    /** Whether address-to-line metadata should be recorded for emissions. */
    collectSourceMetadata: boolean;
    /** Record a source line mapping at the normalized base address. */
    addAddressToLine(address: number): void;
    /** Expand define references in directive parameter text. */
    resolvedefines(input: string): string;
    /** Move the logical and output write cursors to an absolute address. */
    setWritePosition(address: number): void;
    /** Advance the logical cursor without writing bytes during sizing passes. */
    step(count: number): void;
    /** Emit one byte at the current write cursor. */
    write1(value: number): void;
    /** Emit a little-endian 16-bit value at the current cursor. */
    write2(value: number): void;
    /** Emit a 24-bit value at the current cursor. */
    write3(value: number): void;
    /** Emit a 32-bit value at the current cursor. */
    write4(value: number): void;
    /** Module-aware scalar path; structural embedding hosts may retain their numeric-only contract. */
    writeExpression?(expression: ExpressionNode, width: 1 | 2 | 3 | 4): void;
}
/** Shared directive handlers for org, data, and character mapping commands. */
export declare class DirectiveRuntimeService {
    readonly host: DirectiveRuntimeHost;
    constructor(host: DirectiveRuntimeHost);
    /**
     * Handles character mapping like `"A" = 0x42` and assigns the value to the character in `characterMappings`.
     * @param words The character mapping command words.
     * @throws {Error} If the format is incorrect.
     */
    handleCharacterMapping(words: readonly string[]): void;
    /**
     * Processes a string and maps characters to their corresponding values in `characterMappings`.
     * If a character is not found in `characterMappings`, its charCode is used instead.
     * @param input The string to process.
     * @returns An array of numbers representing the mapped characters.
     */
    processStringWithMapping(input: string): number[];
    /**
     * Handles `org`.
     * @param params The directive parameters.
     */
    handleOrg(params: string[]): void;
    /** ORG uses mathematical evaluation, including grouped fractions, before checking the target range. */
    executeOrg(expression: ExpressionNode, spelling: string): void;
    /**
     * Handles data directives.
     * @param type The data directive keyword.
     * @param params The directive parameters.
     */
    handleDataDirective(type: string, params: string[], numeric?: NumericDataStatement): void;
    /** Resolve each element at its write cursor; sizing binds lists but never evaluates numeric values. */
    executeDataStatement(statement: NumericDataStatement, estimateOnly?: boolean): void;
    /**
     * Writes a value using the data directive byte width.
     * @param len The byte width.
     * @param value The value to write.
     */
    writeDataByLength(len: number, value: number): void;
    /** Keep expression ownership until the writer can decide between an immediate scalar and a fixup. */
    private writeDataExpression;
    /**
     * Estimates data size with the same expansion order as emission, without resolving final values.
     * @param len Bytes per numeric item (1–4). String characters each occupy one item.
     * @param params Source operands, including defines that may expand to data lists.
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