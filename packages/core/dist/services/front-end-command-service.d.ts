import { type LabelStatement, type AssignmentStatement } from "../ir/statement-node.js";
import type { MathCore } from "../mathcore.js";
import type { SourceSpan } from "../source-location.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";
/** Session callbacks for label, assignment, and function front-end commands. */
export type FrontEndCommandHost = {
    /** Optional module id used when binding module-level symbols. */
    readonly moduleIdentity?: string;
    /** Optional hook binding module symbols from assignment expressions. */
    assignModuleSymbol?(name: string, expression: import("../ir/expression-node.js").ExpressionNode): void;
    /** Innermost enclosing label used for cheap/local qualification. */
    currentParentLabel: string;
    /** Whether the current parent label is a global export. */
    currentParentIsGlobal: boolean;
    /** Outermost global label anchoring nested locals. */
    currentGlobalParentLabel: string;
    /** Active namespace prefix for recorded symbols. */
    currentNamespace: string;
    /** Shared expression evaluator for assignment right-hand sides. */
    mathCore: MathCore;
    /** Label and namespace scope service for symbol declarations. */
    symbolScope: SymbolScopeService;
    /** Parses and registers a function definition line. */
    parseFunctionDefinition(defLine: string): void;
    /** Executes a normalized command after front-end handling. */
    processCommand(command: string): void;
    /** Resolves define references in command text before execution. */
    resolvedefines(input: string): string;
    /** Records the program counter for the current emission site. */
    recordCurrentAddress(): void;
    /** Records label and function symbols for tooling and later passes. */
    recordSymbolDefinition(kind: "label" | "function", name: string, options?: {
        span?: SourceSpan;
        value?: number | string;
        containerName?: string;
    }): void;
    /** Dialect-specific check for tokens that may introduce named labels. */
    isNamedLabelToken(token: string): boolean;
};
/** Applies label and assignment statement semantics before command execution. */
export declare class FrontEndCommandService {
    readonly host: FrontEndCommandHost;
    constructor(host: FrontEndCommandHost);
    /** Apply declarations directly; callers execute the following typed statement afterward. */
    executeLabelStatement(statement: LabelStatement): void;
    /** Resolve each assignment in the current scope; the parsed expression never stores its value. */
    executeAssignmentStatement(statement: AssignmentStatement): string;
}
//# sourceMappingURL=front-end-command-service.d.ts.map