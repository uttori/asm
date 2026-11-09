import type { ArchitectureRegistry } from "../architecture-registry.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { OperandResolver } from "../operand-resolver.js";
import type { IncludeSourceService } from "../services/include-source-service.js";
import type { OutputWriterService } from "../services/output-writer-service.js";
import type { StructEngine } from "../services/struct-engine.js";
import type { SymbolScopeService } from "../services/symbol-scope-service.js";
/** Methods directive handlers actually call on the runtime service. */
export interface DirectiveRuntime {
    /** Emits a parsed numeric data statement (`db`/`dw`/...) at the current write position. */
    executeDataStatement(statement: import("../ir/statement-node.js").NumericDataStatement): void;
    /** Emits data for directive keyword `type` from its raw, still-unparsed parameters. */
    handleDataDirective(type: string, params: string[]): void;
    /** Moves the write position to the single address in `params`. */
    handleOrg(params: string[]): void;
    /** Moves the write position to a parsed address; `spelling` is the source text for diagnostics. */
    executeOrg(address: ExpressionNode, spelling: string): void;
    /** Restores the cursor saved by the most recent {@link DirectiveRuntime.handlePushPC}. */
    handlePullPC(): void;
    /** Saves the logical, physical and start cursors so `pullpc` can restore them. */
    handlePushPC(): void;
}
/** Session cursor state used by layout and include directives. */
export interface DirectiveAddressCapability {
    /** Processor address width in bits; addresses must fit in `2 ** addressWidth - 1`. */
    addressWidth: number;
    /** Maps the current source line to the physical write address. */
    recordCurrentAddress(): void;
    /** Sets logical, physical and both start cursors to `address`, clearing any active `base`. */
    setWritePosition(address: number): void;
    /** Logical address, offset by `base`; labels take this value. */
    currentTargetAddress: number;
    /** Physical write address, unaffected by `base`. */
    currentTargetBaseAddress: number;
    /** Logical start of the current write run; set by `org`/`base` and resynchronized after each step. */
    currentTargetStartAddress: number;
    /** Physical start of the current write run; set by `org` and resynchronized after each step. */
    currentTargetBaseStartAddress: number;
    /** Logical addresses saved by `pushbase`, most recent last. */
    pushBaseStack: number[];
}
/** Expression evaluation and symbol services available to directives. */
export interface DirectiveExpressionCapability {
    /** Evaluates `expression` to a number, resolving label references. */
    evaluateRangeExpression(expression: string | ExpressionNode): number;
    /** Evaluates a conditional (`if`, `while`) expression to its truth value. */
    evaluateExpression(expression: string | ExpressionNode): boolean;
    /** Undefined postpones checks that depend on asset bytes omitted by tooling analysis. */
    evaluateAssertion(expression: string | ExpressionNode): boolean | undefined;
    /** Returns `input` with all define replacements applied. */
    resolvedefines(input: string): string;
    /** Resolves operand text and expressions to numbers. */
    operandResolver: OperandResolver;
    /** Owns `struct` definitions and instances. */
    structEngine: StructEngine;
    /** Owns label, namespace and scope lookups. */
    symbolScope: SymbolScopeService;
}
/** Namespace state mutated by `namespace` directives. */
export interface DirectiveNamespaceCapability {
    /** Entries saved by `pushns`: the namespace, then its JSON nesting path when nesting is enabled. */
    namespaceStack: string[];
    /** Nested namespace components when nesting is enabled; joined with `_` to form the name. */
    namespaceNestingPath: string[];
    /** Whether `namespace` appends to the current path instead of replacing it. */
    namespaceNestingEnabled: boolean;
    /** Active label prefix; empty when no namespace is open. */
    currentNamespace: string;
    /** Records a namespace definition for source navigation and outline metadata. */
    recordSymbolDefinition(kind: "namespace", name: string, options?: {
        containerName?: string;
    }): void;
}
/** Character table state used by `table` and `pushtable`/`pulltable`. */
export interface DirectiveTableCapability {
    /** Character mappings saved by `pushtable`, most recent last. */
    tableStack: Map<string, number>[];
    /** Active character-to-byte mapping applied to string data. */
    characterMappings: Map<string, number>;
    /** Path of the loaded table file, or null when none is loaded. */
    currentTable: string | null;
}
/** Output buffer and byte-writing state used by data, fill and pad directives. */
export interface DirectiveOutputCapability {
    /** Original image the output is patched over. */
    baseImage: Uint8Array;
    /** Assembled output bytes, indexed by output offset. */
    outputBytes: number[] | Uint8Array;
    /** Byte used when expanding a sparse output range. */
    outputFillByte: number;
    /** Repeating 12-byte pattern emitted by `fill`. */
    fillbyte: number[];
    /** Repeating pattern emitted by `pad`; only the first `padUnit` bytes are used. */
    padbyte: number[];
    /** Length of the active `padbyte` pattern in bytes (1-4). */
    padUnit: number;
    /** Logical address, offset by `base`; labels take this value. */
    currentTargetAddress: number;
    /** Physical write address, unaffected by `base`. */
    currentTargetBaseAddress: number;
    /** Logical start of the current write run; set by `org`/`base` and resynchronized after each step. */
    currentTargetStartAddress: number;
    /** Physical start of the current write run; set by `org` and resynchronized after each step. */
    currentTargetBaseStartAddress: number;
    /** Maps addresses to output offsets and performs writes. */
    outputWriter: OutputWriterService;
    /** Logical addresses saved by `pushbase`, most recent last. */
    pushBaseStack: number[];
    /** Grows the output to `size` bytes, filling new bytes with `fillbyte`. */
    expandOutput(size: number, fillbyte: number): void;
    /** Writes the low byte of `value` and advances the cursor. */
    write1(value: number): void;
    /** Writes the low 2 bytes of `value`, little-endian, and advances the cursor. */
    write2(value: number): void;
    /** Writes the low 3 bytes of `value`, little-endian, and advances the cursor. */
    write3(value: number): void;
    /** Writes the low 4 bytes of `value`, little-endian, and advances the cursor. */
    write4(value: number): void;
}
/** Architecture selection state used by `arch`. */
export interface DirectiveArchitectureCapability {
    /** Resolves architecture names and aliases to canonical names. */
    architectureRegistry: ArchitectureRegistry;
    /** Canonical name of the active architecture. */
    arch: string;
    /** Architectures the target permits; undefined permits every registered architecture. */
    availableArchitectures?: ReadonlySet<string>;
    /** Target name shown in unavailable-architecture errors. */
    targetDisplayName?: string;
    /** Target-aware selection; when present it replaces direct `arch` writes and availability checks. */
    selectArchitecture?(architecture: string, sourceAlias?: string): void;
}
/** Assembler-level state shared with directives. */
export interface DirectiveAssemblerCapability {
    /** Define names to their unexpanded replacement text. */
    defines: Map<string, string>;
}
/** Directive context exposing a narrowed assembler session. */
export interface SessionDirectiveContext<Session> {
    /** Session capabilities the directive may read and mutate. */
    session: Session;
}
/** Session context that can also resolve operands. */
export interface OperandDirectiveContext<Session> extends SessionDirectiveContext<Session> {
    /** Resolves directive operands against the current stage. */
    operandResolver: OperandResolver;
}
/** Directive context that delegates to the runtime service. */
export interface RuntimeDirectiveContext {
    /** Runtime operations shared with the assembler's own command handling. */
    runtime: DirectiveRuntime;
}
/**
 * Directive handler bound to one narrowed context.
 * `words` is the tokenized line with the keyword first; `raw` is the original text.
 */
export type NarrowDirectiveHandler<Context> = (ctx: Context, words: readonly string[], raw: string, command?: NormalizedCommand) => void;
/** Context for `table`, `cleartable`, `pushtable` and `pulltable`. */
export type TableDirectiveContext = SessionDirectiveContext<DirectiveTableCapability & {
    includeSource: Pick<IncludeSourceService, "readFile">;
}>;
/** Context for `assert`, `error` and `warnpc`. */
export type DiagnosticDirectiveContext = SessionDirectiveContext<Pick<DirectiveExpressionCapability, "evaluateAssertion" | "resolvedefines"> & Pick<DirectiveAddressCapability, "currentTargetAddress"> & {
    operandResolver: Pick<OperandResolver, "getnum">;
}>;
/** Context for `namespace` directives. */
export type NamespaceDirectiveContext = SessionDirectiveContext<DirectiveNamespaceCapability>;
/** Context for `fill`/`pad` and their `fillbyte`/`padbyte`-family pattern directives. */
export type FillPadDirectiveContext = OperandDirectiveContext<Pick<DirectiveOutputCapability, "fillbyte" | "padbyte" | "padUnit" | "currentTargetAddress" | "outputWriter" | "write1"> & Pick<DirectiveExpressionCapability, "resolvedefines">>;
/** Context for `+`/`-` relative label directives. */
export type FlowControlDirectiveContext = SessionDirectiveContext<Pick<DirectiveExpressionCapability, "symbolScope">>;
/** Context for `base`. */
export type BaseLayoutDirectiveContext = OperandDirectiveContext<Pick<DirectiveAddressCapability, "currentTargetAddress" | "currentTargetBaseAddress" | "currentTargetStartAddress" | "currentTargetBaseStartAddress" | "addressWidth">>;
/** Context for `pushbase` and `pullbase`. */
export type AddressStackDirectiveContext = SessionDirectiveContext<Pick<DirectiveAddressCapability, "currentTargetAddress" | "pushBaseStack">>;
/** Context for numeric data directives. */
export type DataDirectiveContext = RuntimeDirectiveContext;
/** Context for `org`. */
export type OrgDirectiveContext = RuntimeDirectiveContext;
/** Context for `arch`. */
export type ArchitectureDirectiveContext = SessionDirectiveContext<DirectiveArchitectureCapability>;
/** Define expansion used on included text. */
export type IncludeDefineEngine = {
    /** Expands defines inside a string literal's content. */
    resolveDefinesInStringLiteral(content: string): string;
    /** Expands regular `!define` references in `content`. */
    resolveRegularDefines(content: string): string;
};
/** Context for `incsrc`, `include`, `includeonce` and `incbin`. */
export type IncludeDirectiveContext = OperandDirectiveContext<Pick<DirectiveExpressionCapability, "evaluateRangeExpression" | "symbolScope"> & Pick<DirectiveAddressCapability, "recordCurrentAddress" | "setWritePosition"> & Pick<DirectiveOutputCapability, "write1">> & RuntimeDirectiveContext & {
    defineEngine?: IncludeDefineEngine;
    includeSource: Pick<IncludeSourceService, "assembleFile" | "guardCurrentFile" | "includeFile" | "readFile"> & Partial<Pick<IncludeSourceService, "recordBinarySlice">>;
};
/** Context for `struct`/`endstruct` and `datastruct` directives. */
export type StructDirectiveContext = SessionDirectiveContext<Pick<DirectiveExpressionCapability, "structEngine">>;
//# sourceMappingURL=types.d.ts.map