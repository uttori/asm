import { isReferenceExpressionNode, renderExpressionNode, renderReferenceExpressionNode, } from "./ir/expression-node.js";
import { parseOperandSyntax } from "./operand-syntax.js";
export class OperandResolver {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    normalizeNumericBaseMember(operand) {
        // oxlint-disable-next-line security/detect-unsafe-regex -- Anchored alternatives have distinct prefixes.
        const match = operand.trim().match(/^(#?)(-?\d+|\$[\da-f]+|%[01]+)\.base(\s*,\s*[sxy])?$/i);
        if (!match) {
            return operand;
        }
        const [, immediatePrefix, literal, indexSuffix = ""] = match;
        return `${immediatePrefix}${literal}${indexSuffix}`;
    }
    splitMathOperandSuffix(operand) {
        const trimmed = operand.trim();
        const indexedMatch = trimmed.match(/^(.+?)(\s*,\s*[sxy])$/i);
        // `(dp,x)` / `[dp]` end in `)`, so they do not match. `(bank&$FF0000)+$03,x`
        // does, and must drop `,x` before math eval or the leftover comma errors.
        if (!indexedMatch) {
            return { expression: trimmed, suffix: "" };
        }
        return {
            expression: indexedMatch[1].trim(),
            suffix: indexedMatch[2],
        };
    }
    isNumericToken(token) {
        return /^-?\d+$/.test(token) || /^\$[\dA-Fa-f]+$/.test(token) || /^%[01]+$/.test(token);
    }
    resolveArithmeticToken(token) {
        if (this.isNumericToken(token)) {
            return this.getnum(token);
        }
        if (token.includes(".") && this.deps.isStructReference(token)) {
            return this.deps.resolveStructLabel(token);
        }
        return this.deps.resolveLabel(token, false);
    }
    tryResolveSimpleArithmetic(operand) {
        const tokenPattern = "([.A-Z_a-z][\\w.]*|-?\\d+|\\$[\\dA-Fa-f]+|%[01]+)";
        const match = operand.match(new RegExp(`^${tokenPattern}\\s*(<<|>>|[+\\-])\\s*${tokenPattern}$`));
        if (!match) {
            return null;
        }
        const [, leftToken, operator, rightToken] = match;
        if (this.isNumericToken(leftToken) && this.isNumericToken(rightToken)) {
            return null;
        }
        const leftValue = this.resolveArithmeticToken(leftToken);
        const rightValue = this.resolveArithmeticToken(rightToken);
        switch (operator) {
            case "+":
                return leftValue + rightValue;
            case "-":
                return leftValue - rightValue;
            case "<<":
                return leftValue << rightValue;
            case ">>":
                return leftValue >> rightValue;
            default:
                return null;
        }
    }
    determineValueLength(value) {
        if (typeof value !== "string" && typeof value !== "number") {
            throw new Error(`Invalid value type for length determination: ${typeof value}`);
        }
        if (Number.isNaN(value)) {
            throw new Error(`Invalid value for length determination: ${value}`);
        }
        if (typeof value === "string" && value.trim() === "") {
            return 1;
        }
        let hexString;
        if (typeof value === "number") {
            hexString = value.toString(16).toUpperCase();
        }
        else if (value.startsWith("$")) {
            hexString = value.substring(1);
        }
        else {
            hexString = value;
        }
        return Math.max(1, Math.ceil(hexString.length / 2));
    }
    isMathExpression(expression) {
        if (!expression || typeof expression !== "string") {
            return false;
        }
        if (/^[A-Z_a-z]\w*\s*\(/.test(expression.trim())) {
            return true;
        }
        return (expression.includes("+") ||
            expression.includes("-") ||
            expression.includes("*") ||
            expression.includes("/") ||
            expression.includes("&") ||
            expression.includes("|") ||
            expression.includes("^") ||
            expression.includes("<<") ||
            expression.includes(">>"));
    }
    tryResolveLabelInOperand(operand) {
        if (operand.startsWith("#")) {
            const inner = operand.substring(1).trim();
            if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
                const labelValue = this.deps.tryResolveLabel(inner, false);
                if (labelValue !== undefined) {
                    return "#$" + labelValue.toString(16).toUpperCase();
                }
            }
            return operand;
        }
        if (operand.startsWith("[") && operand.endsWith("]")) {
            const inner = operand.substring(1, operand.length - 1).trim();
            if (!inner.match(/^[\d$%(]/) && !inner.includes(",")) {
                const labelValue = this.deps.tryResolveLabel(inner, false);
                if (labelValue !== undefined) {
                    return "[$" + labelValue.toString(16).toUpperCase() + "]";
                }
            }
            return operand;
        }
        if (operand.includes(",")) {
            const lastCommaIndex = operand.lastIndexOf(",");
            const basePart = operand.substring(0, lastCommaIndex).trim();
            const indexPart = operand.substring(lastCommaIndex).trim();
            if (!basePart.match(/^[\d$%(]/)) {
                const labelValue = this.deps.tryResolveLabel(basePart, false);
                if (labelValue !== undefined) {
                    return "$" + labelValue.toString(16).toUpperCase() + indexPart;
                }
            }
            return operand;
        }
        if (!operand.match(/^[\d#$%([]/) && !operand.includes(",")) {
            const labelValue = this.deps.tryResolveLabel(operand, false);
            if (labelValue !== undefined) {
                return "$" + labelValue.toString(16).toUpperCase();
            }
        }
        return operand;
    }
    /**
     * Resolve defines, labels, struct references, and arithmetic under the current assembly stage.
     * Deferred expression failures yield zero during sizing passes and throw during final emission.
     * @param {string | ExpressionNode} operand Source operand or parsed expression, including an optional immediate prefix.
     * @returns {number} Resolved value, or the deferred sizing placeholder.
     */
    getnum(operand) {
        if (typeof operand !== "string") {
            return this.getnumFromNode(operand);
        }
        operand = operand.trim();
        operand = this.normalizeNumericBaseMember(operand);
        if (/^-?\d+$/.test(operand)) {
            return parseInt(operand, 10);
        }
        if (/^\$[\dA-Fa-f]+$/.test(operand)) {
            return parseInt(operand.substring(1), 16);
        }
        if (/^%[01]+$/.test(operand)) {
            return parseInt(operand.substring(1), 2);
        }
        operand = this.deps.resolveDefines(operand);
        if (operand.startsWith("#")) {
            operand = operand.substring(1).trim();
        }
        operand = this.normalizeNumericBaseMember(operand);
        if (/^[A-Z_a-z]\w*\s*\(/.test(operand)) {
            try {
                return this.deps.evaluateMath(operand);
            }
            catch (error) {
                if (this.deps.shouldDeferExpressionEvaluation()) {
                    return 0;
                }
                throw error;
            }
        }
        const simpleArithmetic = this.tryResolveSimpleArithmetic(operand);
        if (simpleArithmetic !== null) {
            return simpleArithmetic;
        }
        if (!operand.match(/^[\d$%]/)) {
            if (operand.indexOf(".") !== -1 || operand.indexOf("[") !== -1) {
                if (this.deps.isStructReference(operand)) {
                    return this.deps.resolveStructLabel(operand);
                }
                // Compound struct references also appear inside arithmetic
                // expressions such as `obj_start+obj[19].base`. Let those fall
                // through to math evaluation instead of treating the whole string as
                // a single unresolved label token.
                if (!this.isMathExpression(operand)) {
                    return this.deps.resolveLabel(operand, false);
                }
            }
            if (/^\w+$/.test(operand) && this.deps.isStructReference(operand)) {
                return this.deps.resolveStructLabel(operand);
            }
            if (/^\w+$/.test(operand)) {
                return this.deps.resolveLabel(operand, false);
            }
        }
        try {
            return this.deps.evaluateMath(operand);
        }
        catch (error) {
            if (this.deps.shouldDeferExpressionEvaluation()) {
                return 0;
            }
            throw error;
        }
    }
    /**
     * Evaluate an already parsed operand with the same deferred-expression policy as getnum.
     * @param {ExpressionNode} operand Numeric expression. Range nodes are rejected.
     * @returns {number} Resolved value, or zero for a deferred expression failure.
     */
    getnumFromNode(operand) {
        if (isReferenceExpressionNode(operand)) {
            if (operand.type === "defineReference") {
                return this.getnum(this.deps.resolveDefines(renderExpressionNode(operand)));
            }
            const reference = renderReferenceExpressionNode(operand, {
                renderIndex: (node) => this.getnum(node).toString(),
            });
            return this.resolveReferenceValue(reference);
        }
        switch (operand.type) {
            case "range":
                throw new Error(`Range expression is not a numeric operand: ${renderExpressionNode(operand)}`);
            default:
                try {
                    return this.deps.evaluateMath(operand);
                }
                catch (error) {
                    if (this.deps.shouldDeferExpressionEvaluation()) {
                        return 0;
                    }
                    throw error;
                }
        }
    }
    resolveReferenceValue(reference) {
        if (reference.indexOf(".") !== -1 || reference.indexOf("[") !== -1) {
            if (this.deps.isStructReference(reference)) {
                return this.deps.resolveStructLabel(reference);
            }
            if (!this.isMathExpression(reference)) {
                return this.deps.resolveLabel(reference, false);
            }
        }
        if (/^\w+$/.test(reference)) {
            return this.deps.resolveLabel(reference, false);
        }
        return this.getnum(reference);
    }
    expandOperand(operand) {
        const raw = operand.trim();
        const syntax = parseOperandSyntax(raw);
        if (!operand) {
            return { raw, expanded: "", length: 2, syntax };
        }
        let expanded = raw;
        let expectedLength = 2;
        if (/^\++$/.test(expanded) ||
            /^-+$/.test(expanded) ||
            expanded === "?+" ||
            expanded === "?-" ||
            /^:(\++|-+)$/.test(expanded)) {
            return { raw, expanded, length: 2, syntax };
        }
        expanded = this.tryResolveLabelInOperand(expanded);
        try {
            expanded = this.deps.resolveDefines(expanded);
        }
        catch (error) { }
        if (this.deps.isStructReference(expanded)) {
            expanded = `$${this.deps.resolveStructLabel(expanded).toString(16).toUpperCase()}`;
        }
        expanded = this.normalizeNumericBaseMember(expanded);
        if (expanded.startsWith("#")) {
            const inner = expanded.substring(1).trim();
            if (this.isMathExpression(inner)) {
                try {
                    const value = this.getnum(inner);
                    expectedLength = this.determineValueLength(value);
                    expanded = "#$" + value.toString(16).toUpperCase();
                }
                catch (error) { }
            }
            else if (inner.startsWith("$")) {
                expectedLength = this.determineValueLength(inner.substring(1));
            }
            else {
                try {
                    const value = this.getnum(inner);
                    expectedLength = this.determineValueLength(value);
                    expanded = "#$" + value.toString(16).toUpperCase();
                }
                catch (error) { }
            }
        }
        else if (expanded.includes(",")) {
            if (expanded.startsWith("$")) {
                const hexPart = expanded.substring(1, expanded.indexOf(","));
                expectedLength = this.determineValueLength(hexPart);
            }
        }
        else if (expanded.startsWith("[") && expanded.endsWith("]")) {
            expectedLength = 2;
        }
        else if (expanded.startsWith("$")) {
            expectedLength = this.determineValueLength(expanded.substring(1));
        }
        else {
            expectedLength = 2;
        }
        const isRelativeLabelPlaceholder = /^\++$/.test(expanded) || /^-+$/.test(expanded) || /^:(\++|-+)$/.test(expanded);
        if (!isRelativeLabelPlaceholder && this.isMathExpression(expanded)) {
            try {
                const { expression, suffix } = this.splitMathOperandSuffix(expanded);
                const resolvedValue = this.deps.resolveDefines(expression);
                const result = this.deps.evaluateMath(resolvedValue);
                if (!Number.isNaN(result)) {
                    expanded = "$" + result.toString(16).toUpperCase() + suffix;
                    expectedLength = this.determineValueLength(result);
                }
            }
            catch (error) { }
        }
        return { raw, expanded, length: expectedLength, syntax };
    }
    lowerOperand(operand) {
        const raw = operand.trim();
        const expandedOperand = this.expandOperand(raw);
        const { expanded, length } = expandedOperand;
        const syntax = expandedOperand.syntax ?? parseOperandSyntax(raw);
        return {
            mode: "unknown",
            baseExpression: expanded,
            raw,
            expanded,
            length,
            indexRegister: syntax.indexRegister,
            immediate: syntax.immediate,
            indirect: syntax.indirect,
        };
    }
    /**
     * Returns the current logical address without applying architecture policy.
     * @returns {number} Current logical address.
     */
    getCurrentAddress() {
        return this.deps.getCurrentAddress();
    }
}
//# sourceMappingURL=operand-resolver.js.map