import { syntaxBoolean, syntaxNumber, syntaxRecord, syntaxString, syntaxUnion, syntaxLiteral, } from "../ir/syntax-codec.js";
export const handleRelativeLabel = ({ session }, _words, raw) => {
    session.symbolScope.handleRelativeLabel(raw);
};
export const registerFlowControlDirectives = (registry, context) => {
    registry.registerTyped(["+", "-"], ({ source }) => {
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