/**
 * Small, deliberately separate grammar for named records. Expressions remain
 * assembler expressions; this parser only recognizes their outer delimiters.
 * Do not use split(','): arrays and functions both contain their own commas.
 * @param {string} text Comma-separated fields or expressions.
 * @returns {string[]} Complete items with their nested expressions intact.
 */
export function splitInitializerList(text) {
    const entries = [];
    const stack = [];
    let quote = "";
    let start = 0;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (quote) {
            if (char === quote && text[index - 1] !== "\\")
                quote = "";
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if ("([{".includes(char))
            stack.push(char);
        else if (")]}".includes(char)) {
            const expected = { ")": "(", "]": "[", "}": "{" }[char];
            if (stack.pop() !== expected)
                throw new Error("Mismatched initializer delimiters.");
        }
        else if (char === "," && stack.length === 0) {
            const entry = text.slice(start, index).trim();
            if (!entry)
                throw new Error("Empty initializer item.");
            entries.push(entry);
            start = index + 1;
        }
    }
    if (quote || stack.length)
        throw new Error("Unclosed initializer delimiter.");
    const last = text.slice(start).trim();
    if (last)
        entries.push(last); // One trailing comma is allowed.
    return entries;
}
/**
 * Parse field names and scalar/array shapes without evaluating assembler expressions.
 * @param {string} text One brace-delimited record literal.
 * @returns {Map<string, string | string[]>} Unique names and unevaluated values.
 */
export function parseStructInitializer(text) {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
        throw new Error("dataStruct requires a named initializer: { field = value }.");
    }
    const fields = new Map();
    for (const entry of splitInitializerList(trimmed.slice(1, -1))) {
        const match = entry.match(/^([A-Z_a-z][\w.]*)\s*=\s*(.+)$/s);
        if (!match)
            throw new Error(`Expected 'field = value' in initializer: ${entry}`);
        const [, name, value] = match;
        if (fields.has(name))
            throw new Error(`Duplicate initializer field '${name}'.`);
        if (value.startsWith("[")) {
            if (!value.endsWith("]"))
                throw new Error(`Unclosed array initializer '${name}'.`);
            fields.set(name, splitInitializerList(value.slice(1, -1)));
        }
        else
            fields.set(name, value);
    }
    return fields;
}
/**
 * Only named record statements gain implicit brace continuation, not legacy source.
 * @param {string} text Buffered command including the current physical line.
 * @returns {boolean} Whether another physical line is needed to close the literal.
 */
export function isOpenStructInitializer(text) {
    if (!/^(?:datastruct\b|\[)/i.test(text.trimStart()))
        return false;
    let depth = 0;
    let quote = "";
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (quote) {
            if (char === quote && text[index - 1] !== "\\")
                quote = "";
        }
        else if (char === '"' || char === "'")
            quote = char;
        else if (char === "{")
            depth++;
        else if (char === "}")
            depth--;
    }
    return depth > 0;
}
//# sourceMappingURL=struct-initializer.js.map