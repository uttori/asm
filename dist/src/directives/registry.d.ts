import type { OperandResolver } from "../operand-resolver.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { AssemblySession, DirectiveContext, DirectiveHandler } from "./types.js";
export declare class DirectiveRegistry {
    readonly ctx: DirectiveContext;
    readonly handlers: Map<string, DirectiveHandler>;
    constructor(ctx: DirectiveContext);
    register(keyword: string | string[], handler: DirectiveHandler): void;
    has(keyword: string): boolean;
    dispatch(keyword: string, words: string[], raw: string, command?: NormalizedCommand): boolean;
    dispatchCommand(command: NormalizedCommand): boolean;
}
export declare const createDirectiveRegistry: (session: AssemblySession, operandResolver: OperandResolver) => DirectiveRegistry;
//# sourceMappingURL=registry.d.ts.map