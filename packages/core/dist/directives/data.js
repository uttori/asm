/**
 * Routes byte/word/long data directives through the runtime data handler.
 * @param {DataDirectiveContext} ctx The ROM-capable directive context.
 * @param {string[]} words The directive words.
 */
export const handleDataDirective = ({ runtime }, words) => {
    runtime.handleDataDirective(words[0], words.slice(1));
};
export const registerDataDirectives = (registry, context) => {
    registry.register(["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"], context, handleDataDirective);
};
//# sourceMappingURL=data.js.map