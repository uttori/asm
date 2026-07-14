import type { DirectiveRegistry } from "./registry.js";
import type { FillPadDirectiveContext } from "./types.js";
export declare const handleFillPattern: ({ session, operandResolver }: FillPadDirectiveContext, words: string[]) => void;
export declare const handleFill: ({ session, operandResolver }: FillPadDirectiveContext, words: string[]) => void;
export declare const handlePadPattern: ({ session, operandResolver }: FillPadDirectiveContext, words: string[]) => void;
export declare const handlePad: ({ session, operandResolver }: FillPadDirectiveContext, words: string[]) => void;
export declare const registerFillPadDirectives: (registry: DirectiveRegistry, context: FillPadDirectiveContext) => void;
//# sourceMappingURL=fill-pad.d.ts.map