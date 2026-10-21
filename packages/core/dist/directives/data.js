import { createNormalizedCommand } from "../ir/normalized-command.js";
import { materializeNumericData, parseNumericDataStatement, } from "../ir/statement-node.js";
import { syntaxArray, syntaxRecord, syntaxNumber, syntaxString, syntaxExpression, syntaxOptional, } from "../ir/syntax-codec.js";
// Registration identity matters: a plugin that replaces `db` owns its execution again.
const nativeDataHandlers = new WeakSet();
/** Check the currently registered handler, including replacements after lowering. */
export function isCoreDataDirective(registry, keyword) {
    const handler = registry.lookup(keyword);
    return handler !== undefined && nativeDataHandlers.has(handler);
}
/** Preserve core ownership through the session's lifecycle-hook wrapper only. */
export function inheritCoreDataHandler(original, wrapped) {
    if (nativeDataHandlers.has(original)) {
        nativeDataHandlers.add(wrapped);
    }
}
/**
 * Routes byte/word/long data directives through the runtime data handler.
 * @param {DataDirectiveContext} ctx The ROM-capable directive context.
 * @param {string[]} words The directive words.
 */
export const handleDataDirective = ({ runtime }, words) => {
    runtime.handleDataDirective(words[0], words.slice(1));
};
export const registerDataDirectives = (registry, context) => {
    const keywords = ["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"];
    registry.registerTyped(keywords, ({ text, words, source }) => {
        const command = createNormalizedCommand(source.raw, text, [...words], source.file, source.line);
        const statement = parseNumericDataStatement(command);
        if (!statement) {
            throw new Error("Expected a data directive.");
        }
        // This registry grammar is also a public source adapter. Keep its portable plugin payload
        // in the ordinary operand form; native source assembly owns compact internal rows directly.
        return materializeNumericData(statement);
    }, syntaxRecord({
        width: (value) => syntaxNumber(value) && [1, 2, 3, 4].includes(value),
        emptyDirective: syntaxOptional(syntaxString),
        operands: syntaxArray(syntaxRecord({ text: syntaxString, expression: syntaxExpression })),
    }), (statement) => context.runtime.executeDataStatement(statement));
    for (const keyword of keywords) {
        nativeDataHandlers.add(registry.lookup(keyword));
    }
};
//# sourceMappingURL=data.js.map