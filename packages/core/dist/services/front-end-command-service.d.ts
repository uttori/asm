import { type LabelStatement, type AssignmentStatement } from "../ir/statement-node.js";
import type { MathCore } from "../mathcore.js";
import type { SourceSpan } from "../source-location.js";
import type { SymbolScopeService } from "./symbol-scope-service.js";
export type FrontEndCommandHost = {
    readonly moduleIdentity?: string;
    assignModuleSymbol?(name: string, expression: import("../ir/expression-node.js").ExpressionNode): void;
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    currentGlobalParentLabel: string;
    currentNamespace: string;
    mathCore: MathCore;
    symbolScope: SymbolScopeService;
    parseFunctionDefinition(defLine: string): void;
    processCommand(command: string): void;
    resolvedefines(input: string): string;
    recordCurrentAddress(): void;
    recordSymbolDefinition(kind: "label" | "function", name: string, options?: {
        span?: SourceSpan;
        value?: number | string;
        containerName?: string;
    }): void;
    isNamedLabelToken(token: string): boolean;
};
export declare class FrontEndCommandService {
    readonly host: FrontEndCommandHost;
    constructor(host: FrontEndCommandHost);
    /** Apply declarations directly; callers execute the following typed statement afterward. */
    executeLabelStatement(statement: LabelStatement): void;
    /** Resolve each assignment in the current scope; the parsed expression never stores its value. */
    executeAssignmentStatement(statement: AssignmentStatement): string;
}
//# sourceMappingURL=front-end-command-service.d.ts.map