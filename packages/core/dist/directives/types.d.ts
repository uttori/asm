import type { ArchitectureRegistry } from "../architecture-registry.js";
import type { OperandResolver } from "../operand-resolver.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { IncludeSourceService } from "../services/include-source-service.js";
import type { OutputWriterService } from "../services/output-writer-service.js";
import type { StructEngine } from "../services/struct-engine.js";
import type { SymbolScopeService } from "../services/symbol-scope-service.js";
/** Methods directive handlers actually call on the runtime service. */
export interface DirectiveRuntime {
    handleDataDirective(type: string, params: string[]): void;
    handleOrg(params: string[]): void;
    handlePullPC(): void;
    handlePushPC(): void;
}
export interface DirectiveAddressCapability {
    addressWidth: number;
    recordCurrentAddress(): void;
    setWritePosition(address: number): void;
    currentTargetAddress: number;
    currentTargetBaseAddress: number;
    currentTargetStartAddress: number;
    currentTargetBaseStartAddress: number;
    pushBaseStack: number[];
}
export interface DirectiveExpressionCapability {
    evaluateRangeExpression(expression: string | ExpressionNode): number;
    evaluateExpression(expression: string | ExpressionNode): boolean;
    resolvedefines(input: string): string;
    operandResolver: OperandResolver;
    structEngine: StructEngine;
    symbolScope: SymbolScopeService;
}
export interface DirectiveNamespaceCapability {
    namespaceStack: string[];
    namespaceNestingPath: string[];
    namespaceNestingEnabled: boolean;
    currentNamespace: string;
}
export interface DirectiveTableCapability {
    tableStack: Map<string, number>[];
    characterMappings: Map<string, number>;
    currentTable: string | null;
}
export interface DirectiveOutputCapability {
    baseImage: Uint8Array;
    outputBytes: number[] | Uint8Array;
    outputFillByte: number;
    fillbyte: number[];
    padbyte: number[];
    padUnit: number;
    currentTargetAddress: number;
    currentTargetBaseAddress: number;
    currentTargetStartAddress: number;
    currentTargetBaseStartAddress: number;
    outputWriter: OutputWriterService;
    pushBaseStack: number[];
    expandOutput(size: number, fillbyte: number): void;
    write1(value: number): void;
    write2(value: number): void;
    write3(value: number): void;
    write4(value: number): void;
}
export interface DirectiveArchitectureCapability {
    architectureRegistry: ArchitectureRegistry;
    arch: string;
    availableArchitectures?: ReadonlySet<string>;
    targetDisplayName?: string;
    selectArchitecture?(architecture: string, sourceAlias?: string): void;
}
export interface DirectiveAssemblerCapability {
    defines: Map<string, string>;
}
export interface SessionDirectiveContext<Session> {
    session: Session;
}
export interface OperandDirectiveContext<Session> extends SessionDirectiveContext<Session> {
    operandResolver: OperandResolver;
}
export interface RuntimeDirectiveContext {
    runtime: DirectiveRuntime;
}
export type NarrowDirectiveHandler<Context> = (ctx: Context, words: readonly string[], raw: string, command?: NormalizedCommand) => void;
export type TableDirectiveContext = SessionDirectiveContext<DirectiveTableCapability & {
    includeSource: Pick<IncludeSourceService, "readFile">;
}>;
export type DiagnosticDirectiveContext = SessionDirectiveContext<Pick<DirectiveExpressionCapability, "evaluateExpression" | "resolvedefines"> & Pick<DirectiveAddressCapability, "currentTargetAddress"> & {
    operandResolver: Pick<OperandResolver, "getnum">;
}>;
export type NamespaceDirectiveContext = SessionDirectiveContext<DirectiveNamespaceCapability>;
export type FillPadDirectiveContext = OperandDirectiveContext<Pick<DirectiveOutputCapability, "fillbyte" | "padbyte" | "padUnit" | "currentTargetAddress" | "outputWriter" | "write1"> & Pick<DirectiveExpressionCapability, "resolvedefines">>;
export type FlowControlDirectiveContext = SessionDirectiveContext<Pick<DirectiveExpressionCapability, "symbolScope">>;
export type BaseLayoutDirectiveContext = OperandDirectiveContext<Pick<DirectiveAddressCapability, "currentTargetAddress" | "currentTargetBaseAddress" | "currentTargetStartAddress" | "currentTargetBaseStartAddress" | "addressWidth">>;
export type AddressStackDirectiveContext = SessionDirectiveContext<Pick<DirectiveAddressCapability, "currentTargetAddress" | "pushBaseStack">>;
export type DataDirectiveContext = RuntimeDirectiveContext;
export type OrgDirectiveContext = RuntimeDirectiveContext;
export type ArchitectureDirectiveContext = SessionDirectiveContext<DirectiveArchitectureCapability>;
export type IncludeDefineEngine = {
    resolveDefinesInStringLiteral(content: string): string;
    resolveRegularDefines(content: string): string;
};
export type IncludeDirectiveContext = OperandDirectiveContext<Pick<DirectiveExpressionCapability, "evaluateRangeExpression" | "symbolScope"> & Pick<DirectiveAddressCapability, "recordCurrentAddress" | "setWritePosition"> & Pick<DirectiveOutputCapability, "write1">> & RuntimeDirectiveContext & {
    defineEngine?: IncludeDefineEngine;
    includeSource: Pick<IncludeSourceService, "assembleFile" | "guardCurrentFile" | "includeFile" | "readFile">;
};
export type StructDirectiveContext = SessionDirectiveContext<Pick<DirectiveExpressionCapability, "structEngine">>;
//# sourceMappingURL=types.d.ts.map