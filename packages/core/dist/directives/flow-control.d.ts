import type { DirectiveRegistry } from "./registry.js";
import type { FlowControlDirectiveContext } from "./types.js";
/** Forwards raw relative label text to the session symbol scope handler. */
export declare const handleRelativeLabel: ({ session }: FlowControlDirectiveContext, _words: readonly string[], raw: string) => void;
/** Registers relative branch label directives and their typed syntax hooks. */
export declare const registerFlowControlDirectives: (registry: DirectiveRegistry, context: FlowControlDirectiveContext) => void;
//# sourceMappingURL=flow-control.d.ts.map