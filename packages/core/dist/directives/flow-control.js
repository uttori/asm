import { syntaxBoolean, syntaxNumber, syntaxRecord, syntaxString, syntaxUnion, syntaxLiteral, } from "../ir/syntax-codec.js";
/** Forwards raw relative label text to the session symbol scope handler. */
export const handleRelativeLabel = ({ session }, _words, raw) => {
    session.symbolScope.handleRelativeLabel(raw);
};
/** Registers relative branch label directives and their typed syntax hooks. */
export const registerFlowControlDirectives = (registry, context) => {
    registry.registerImmutableTyped(["+", "-"], ({ source }) => {
        const spelling = source.raw;
        const direction = spelling.includes("+") ? 1 : -1;
        const depth = (spelling.match(direction === 1 ? /\+/g : /-/g) ?? []).length;
        return { direction, depth, macroLocal: spelling.startsWith("?"), spelling };
    }, syntaxRecord({
        direction: syntaxUnion(syntaxLiteral(1), syntaxLiteral(-1)),
        depth: syntaxNumber,
        macroLocal: syntaxBoolean,
        spelling: syntaxString,
    }), (node) => {
        context.session.symbolScope.declareRelativeLabel(node);
    });
};
//# sourceMappingURL=flow-control.js.map