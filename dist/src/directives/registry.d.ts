import type { OperandResolver } from "../operand-resolver.js";
import type { AssemblySession, DirectiveContext, DirectiveHandler } from "./types.js";
export declare class DirectiveRegistry {
    private readonly ctx;
    private readonly handlers;
    constructor(ctx: DirectiveContext);
    register(keyword: string | string[], handler: DirectiveHandler): void;
    dispatch(keyword: string, words: string[], raw: string): boolean;
}
export declare const createDirectiveRegistry: (session: AssemblySession, operandResolver: OperandResolver) => DirectiveRegistry;
//# sourceMappingURL=registry.d.ts.map