import type { ArchitectureEncoder } from "../architecture-types.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import type { LabelEntry } from "../services/symbol-scope-service.js";
/**
 * Borrowed synchronous target capabilities. Valid only while a directive factory, handler,
 * or lifecycle hook runs; retaining the object does not extend its lifetime.
 * Addresses are target logical byte addresses; output offsets are zero-based image bytes.
 * Host-owned services, assembly entry points, registries and disposal are intentionally absent.
 */
export interface PluginSessionCapabilities {
    readonly targetOptions: Readonly<Record<string, unknown>>;
    readonly arch: string;
    readonly currentLine: number;
    readonly canFinalize: boolean;
    readonly isDefinitionCollectionStage: boolean;
    /** Independent copy of the base image; edits cannot change host input. */
    readonly baseImage: Uint8Array;
    currentNamespace: string;
    currentTargetAddress: number;
    currentTargetBaseAddress: number;
    currentTargetStartAddress: number;
    currentTargetBaseStartAddress: number;
    /** Number of bytes emitted in the current stage. */
    bytes: number;
    outputFillByte: number;
    /**
     * Live output during the borrowed callback. Reacquire typed views after growing writes.
     * A replacement is copied into session ownership and retains its array/fixed-view behavior.
     */
    outputBytes: number[] | Uint8Array;
    readonly globalSymbols: {
        add(name: string): void;
    };
    readonly labelTable: {
        get(name: string): LabelEntry | undefined;
        set(name: string, value: LabelEntry): void;
    };
    readonly operandResolver: {
        getnum(expression: string | ExpressionNode): number;
    };
    readonly outputWriter: {
        toOutputOffset(address: number): number;
        fromOutputOffset(offset: number): number;
    };
    readonly directiveRuntime: {
        handleDataDirective(type: string, values: string[]): void;
        /** Execute already parsed data with the session's current character table and stage policy. */
        executeDataStatement(statement: import("../ir/statement-node.js").NumericDataStatement): void;
    };
    readonly includeSource: {
        readFile(path: string, encoding?: BufferEncoding): Uint8Array | string;
    };
    readonly symbolScope: {
        getLabelValue(name: string, requireStatic: boolean): number;
        qualifySymbolName(name: string): string;
        setLabel(name: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
    };
    /** Encoder is target-owned mutable state, never a host service. */
    resolveActiveArchitecture(): {
        name: string;
        definition?: {
            encoder: ArchitectureEncoder;
        };
    };
    selectArchitecture(architecture: string, sourceAlias?: string): void;
    resolvedefines(expression: string): string;
    evaluateAssertion(expression: string | ExpressionNode): boolean | undefined;
    setWritePosition(address: number): void;
    step(bytes: number): void;
    write1(value: number): void;
    write2(value: number): void;
    write3(value: number): void;
    /** Patch an output byte interval without advancing the logical cursor. */
    writeOutputBytes(offset: number, value: number, length?: number): void;
    expandOutput(size: number, fillByte: number): void;
}
//# sourceMappingURL=session-capabilities.d.ts.map