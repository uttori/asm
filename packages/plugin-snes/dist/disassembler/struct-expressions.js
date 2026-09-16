import { getStructMetadata, parseExpressionNode } from "@uttori/asm-core";
/**
 * Resolve a bounded subset of native assembly expressions, caching repeated expressions per map.
 * No defines, arbitrary calls, file reads or record contents participate in instruction identity.
 */
export class SnesStructExpressionResolver {
    layouts;
    bindings;
    fields;
    cache = new Map();
    constructor(layouts, bindings) {
        this.layouts = new Map(layouts.map((layout) => [layout.id, layout]));
        this.bindings = new Map(bindings.map((binding) => [binding.name, binding]));
        this.fields = new Map(layouts.map((layout) => [
            layout.id,
            new Map(layout.fields.map((field) => [field.name, field])),
        ]));
    }
    /**
     * Check every intermediate value and preserve explicit grouping in the generated assembly.
     * @param {unknown} input Single-line expression, at most 1,024 characters and 128 AST nodes.
     * @returns {SnesStructExpression} Native source and exact integer value with referenced owners.
     */
    resolve(input) {
        if (typeof input !== "string" || !input.trim() || input.length > 1024 || /[\n\r#;]/.test(input))
            throw new Error("Struct expressions require a single expression of at most 1024 characters.");
        const cached = this.cache.get(input);
        if (cached)
            return cached;
        const owners = new Set();
        let references = 0;
        let nodes = 0;
        /**
         * Reject imprecise intermediates even if later masking would make them fit an operand.
         * @param {number} value Computed intermediate before any truncation.
         * @param {string} expression Parenthesized native source for this subtree.
         * @returns {object} Exact value and source, or throws on lost precision.
         */
        const checked = (value, expression) => {
            if (!Number.isSafeInteger(value))
                throw new Error("Struct expression must evaluate to exact safe integers.");
            return { value, expression };
        };
        /**
         * Resolve only named layouts/bindings; inherited and arbitrary symbol paths are outside this map.
         * @param {ExpressionNode} node Optional record index and field under one declared root.
         * @returns {object} Address or offset and native reference; records its binding owner.
         */
        const reference = (node) => {
            let root = node;
            let fieldName;
            if (root.type === "member") {
                fieldName = root.property.name;
                root = root.object;
            }
            let index;
            if (root.type === "index") {
                index = visit(root.index).value;
                root = root.object;
            }
            if (root.type !== "identifier")
                throw new Error("Unsupported struct reference.");
            const binding = this.bindings.get(root.name);
            const layout = binding?.structure ?? this.layouts.get(root.name);
            if (!layout)
                throw new Error(`Unknown struct reference '${root.name}'.`);
            if (index !== undefined &&
                (!binding || index < binding.firstIndex || index >= binding.firstIndex + binding.count))
                throw new Error(`Struct reference index is out of bounds for '${root.name}'.`);
            references++;
            if (binding)
                owners.add(binding);
            let value = 0;
            if (binding)
                value = binding.address + ((index ?? 0) - binding.firstIndex) * layout.size;
            let expression = root.name;
            if (index !== undefined)
                expression += `[${index}]`;
            if (fieldName !== undefined) {
                const field = this.fields.get(layout.id)?.get(fieldName);
                if (!field)
                    throw new Error(`Unknown struct field '${fieldName}'.`);
                value += field.offset;
                expression += `.${fieldName}`;
            }
            return checked(value, expression);
        };
        /**
         * The AST whitelist excludes macros and host-dependent functions.
         * @param {ExpressionNode} node Subtree counted against the per-expression complexity limit.
         * @returns {object} Checked integer value and source preserving operator grouping.
         */
        const visit = (node) => {
            if (++nodes > 128)
                throw new Error("Struct expression exceeds 128 nodes.");
            switch (node.type) {
                case "literal": {
                    const value = node.value.startsWith("$")
                        ? Number.parseInt(node.value.slice(1), 16)
                        : Number(node.value);
                    return checked(value, node.value);
                }
                case "identifier":
                case "member":
                case "index":
                    return reference(node);
                case "call": {
                    const name = node.callee.name;
                    const arg = node.arguments[0];
                    if (node.arguments.length !== 1 || !arg)
                        throw new Error(`Struct expression ${name}() requires one argument.`);
                    if (name === "bank") {
                        const resolved = visit(arg);
                        return checked((resolved.value >> 16) & 0xff, `bank(${resolved.expression})`);
                    }
                    if (arg.type !== "identifier")
                        throw new Error("Struct reflection requires a layout or binding name.");
                    if (name !== "sizeof" &&
                        name !== "countof" &&
                        name !== "bytesof" &&
                        name !== "startof" &&
                        name !== "endof")
                        throw new Error(`Unsupported struct expression function '${name}'.`);
                    reference(arg);
                    const binding = this.bindings.get(arg.name);
                    const layout = binding?.structure ?? this.layouts.get(arg.name);
                    const definition = {
                        base: binding ? binding.address - binding.firstIndex * layout.size : 0,
                        size: layout.size,
                        indexRange: { first: binding?.firstIndex ?? 0, count: binding?.count ?? 1 },
                    };
                    const value = name === "sizeof" ? layout.size : getStructMetadata(definition, name);
                    return checked(value, `${name}(${arg.name})`);
                }
                case "unary": {
                    const arg = visit(node.argument);
                    let value;
                    switch (node.operator) {
                        case "<:":
                            value = arg.value >>> 16;
                            break;
                        case "<":
                            value = arg.value & 0xff;
                            break;
                        case ">":
                            value = (arg.value >> 8) & 0xff;
                            break;
                        case "^":
                            value = (arg.value >> 16) & 0xff;
                            break;
                        case "~":
                            value = ~arg.value;
                            break;
                        case "-":
                            value = -arg.value;
                            break;
                        case "+":
                            value = arg.value;
                            break;
                    }
                    return checked(value, `(${node.operator}${arg.expression})`);
                }
                case "binary": {
                    const left = visit(node.left);
                    const right = visit(node.right);
                    let value;
                    switch (node.operator) {
                        case "+":
                            value = left.value + right.value;
                            break;
                        case "-":
                            value = left.value - right.value;
                            break;
                        case "*":
                            value = left.value * right.value;
                            break;
                        case "/":
                            value = left.value / right.value;
                            break;
                        case "%":
                            value = left.value % right.value;
                            break;
                        case "&":
                            value = left.value & right.value;
                            break;
                        case "|":
                            value = left.value | right.value;
                            break;
                        case "^":
                            value = left.value ^ right.value;
                            break;
                        case "<<":
                            value = left.value << right.value;
                            break;
                        case ">>":
                            value = left.value >> right.value;
                            break;
                        default:
                            throw new Error(`Unsupported struct expression operator '${node.operator}'.`);
                    }
                    return checked(value, `(${left.expression} ${node.operator} ${right.expression})`);
                }
                default:
                    throw new Error("Unsupported struct expression syntax.");
            }
        };
        const resolved = visit(parseExpressionNode(input));
        if (!references)
            throw new Error("Struct expressions must reference a layout or binding.");
        const result = { ...resolved, bindings: [...owners] };
        this.cache.set(input, result);
        return result;
    }
}
/**
 * Split a CPU access across fields, opaque gaps and adjacent records of one physical binding.
 * @param {SnesStructBinding} binding Sole owner referenced by the target expression.
 * @param {number} address Resolved CPU start address; biased index-zero bases are not physical data.
 * @param {number} width CPU access width in bytes (one or two).
 * @returns {readonly SnesStructAccessPart[]} Ordered parts covering every byte exactly once.
 */
export function describeSnesStructAccess(binding, address, width) {
    const { structure } = binding;
    if (address < binding.address ||
        address + width > binding.address + binding.count * structure.size)
        throw new Error(`Struct observation leaves binding '${binding.name}'.`);
    const parts = [];
    for (let cursor = address; cursor < address + width;) {
        const relative = cursor - binding.address;
        const index = binding.firstIndex + Math.floor(relative / structure.size);
        const offset = relative % structure.size;
        // Binary search avoids per-byte field scans in large layouts. A hole is never assigned to its neighbor.
        let low = 0;
        let high = structure.fields.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (structure.fields[middle].offset <= offset)
                low = middle + 1;
            else
                high = middle;
        }
        const candidate = structure.fields[low - 1];
        const field = candidate && offset < candidate.offset + candidate.size ? candidate : undefined;
        const record = `${binding.name}${index === 0 ? "" : `[${index}]`}`;
        let expression = record;
        let partOffset = offset;
        let end = structure.fields[low]?.offset ?? structure.size;
        if (field) {
            expression += `.${field.name}`;
            partOffset -= field.offset;
            end = field.offset + field.size;
        }
        if (partOffset)
            expression = `(${expression} + $${partOffset.toString(16).toUpperCase()})`;
        const partWidth = Math.min(end - offset, address + width - cursor);
        parts.push({
            expression,
            address: cursor,
            width: partWidth,
            ...(field ? { field: field.name } : {}),
        });
        cursor += partWidth;
    }
    return parts;
}
//# sourceMappingURL=struct-expressions.js.map