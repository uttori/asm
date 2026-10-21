/** Store each physical range once: columnStart/End duplicate start/end for these occurrences. */
export function compactExpressionSpans(node, relocate) {
    if (node.span) {
        const span = relocate?.(node.span) ?? node.span;
        node.span = { start: span.start, end: span.end, line: span.line };
    }
    switch (node.type) {
        case "binary":
            compactExpressionSpans(node.left, relocate);
            compactExpressionSpans(node.right, relocate);
            break;
        case "unary":
            compactExpressionSpans(node.argument, relocate);
            break;
        case "call":
            compactExpressionSpans(node.callee, relocate);
            node.arguments.forEach((argument) => compactExpressionSpans(argument, relocate));
            break;
        case "member":
            compactExpressionSpans(node.object, relocate);
            compactExpressionSpans(node.property, relocate);
            break;
        case "index":
            compactExpressionSpans(node.object, relocate);
            compactExpressionSpans(node.index, relocate);
            break;
        case "range":
            compactExpressionSpans(node.start, relocate);
            compactExpressionSpans(node.end, relocate);
            break;
        case "defineReference":
        case "identifier":
        case "literal":
        case "error":
        case "relativeReference":
        case "sourceText":
        case "template":
        case "raw":
        case "string":
            break;
    }
}
/**
 * Continuations remove comments, whitespace and a trailing backslash. Map lexical characters
 * back to the physical extent without evaluating or guessing across a profile rewrite.
 */
export function locateContinuedExpression(text, physical, start) {
    const positions = [];
    let at = start;
    let quote = "";
    let escaped = false;
    while (physical[at] === "," || /\s/.test(physical[at] ?? "")) {
        at++;
    }
    // Source spans use UTF-16 offsets, including both halves of a supplementary character.
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (!quote && /\s/.test(char)) {
            positions[index] = at;
            continue;
        }
        if (!quote) {
            while (at < physical.length) {
                if (/\s/.test(physical[at])) {
                    at++;
                    continue;
                }
                if (physical[at] === ";") {
                    const end = physical.indexOf("\n", at);
                    if (end < 0) {
                        return undefined;
                    }
                    at = end + 1;
                    continue;
                }
                if (physical[at] === "\\" && /^\\[\t ]*\r?\n/.test(physical.slice(at))) {
                    at++;
                    continue;
                }
                break;
            }
        }
        if (physical[at] !== char) {
            return undefined;
        }
        positions[index] = at++;
        if ((char === '"' || char === "'") && !escaped) {
            if (quote === char) {
                quote = "";
            }
            else if (!quote) {
                quote = char;
            }
        }
        escaped = char === "\\" && !escaped;
    }
    return positions;
}
//# sourceMappingURL=expression-occurrence.js.map