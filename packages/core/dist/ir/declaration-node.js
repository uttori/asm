import { parseStructInitializerEntries, splitInitializerList, } from "../services/struct-initializer.js";
import { parseDirectiveExpression } from "./directive-arguments.js";
import { compileFunctionTemplate } from "./function-template.js";
import { syntaxArray, syntaxExpression, syntaxLiteral, syntaxNumber, syntaxOptional, syntaxRecord, syntaxString, syntaxUnion, } from "./syntax-codec.js";
const expression = (text) => parseDirectiveExpression(text);
/** Parse candidates only. Diagnostics are inert until the declaration is selected for execution. */
export function parseDeclarationNode(text, words) {
    try {
        return parseDeclaration(text, words);
    }
    catch (cause) {
        let context = "struct";
        if (text.toLowerCase().includes("function")) {
            context = "function";
        }
        else if (text.startsWith("'") || text.startsWith('"')) {
            context = "character";
        }
        return {
            kind: "invalid",
            context,
            message: cause instanceof Error ? cause.message : String(cause),
        };
    }
}
/** Grammar recognition belongs here, including context-sensitive struct fields and table rows. */
function parseDeclaration(text, words) {
    const keyword = (words[0] ?? "").toLowerCase();
    if (keyword.startsWith("'") || keyword.startsWith('"')) {
        const match = /^'([\S\s])'\s*=\s*(.+)$/.exec(text) ?? /^"([\S\s])"\s*=\s*(.+)$/.exec(text);
        if (match) {
            return { kind: "character", character: match[1], expression: expression(match[2].trim()) };
        }
        if (words.length === 3 && words[1] === "=") {
            const character = words[0].replace(/["']/g, "");
            if (character.length !== 1) {
                throw new Error("Character mapping requires format: 'char' = value");
            }
            return { kind: "character", character, expression: expression(words[2]) };
        }
    }
    const functionSource = text.includes("function") ? text.replace(/^[\w $.?]+:\s*/, "") : text;
    if (functionSource.toLowerCase().startsWith("function") &&
        !functionSource.trimEnd().endsWith("\\")) {
        // Preserve the existing case-sensitive declaration grammar and optional parameter list.
        // eslint-disable-next-line security/detect-unsafe-regex -- Repeated fields are separated by mandatory delimiters.
        const match = /^function\s+(\w+)(?:\(([\s\w,]*)\))?\s*=\s*(.+)$/.exec(functionSource.replace(/\\\s*\n/g, ""));
        if (!match) {
            throw new Error("Invalid function definition syntax.");
        }
        const parameters = (match[2] ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        return {
            kind: "function",
            name: match[1],
            template: compileFunctionTemplate(match[3].trim(), parameters),
        };
    }
    if (keyword === "struct") {
        if (words.length < 2) {
            throw new Error("Struct definition requires at least two parameters.");
        }
        if (words[2]?.toLowerCase() === "extends") {
            if (words.length < 4) {
                throw new Error("Struct extension must specify a parent struct.");
            }
            return { kind: "struct", name: words[1], parent: words[3] };
        }
        if (words.length > 2) {
            return { kind: "struct", name: words[1], base: expression(words[2]), baseText: words[2] };
        }
        return { kind: "struct", name: words[1] };
    }
    if (keyword === "endstruct") {
        const options = [];
        const seen = new Set();
        for (let index = 1; index < words.length; index += 2) {
            const name = words[index].toLowerCase();
            if ((name !== "align" && name !== "count" && name !== "firstindex") ||
                seen.has(name) ||
                words[index + 1] === undefined) {
                if (words[1]?.toLowerCase() === "align") {
                    throw new Error("endstruct align requires a single alignment parameter.");
                }
                throw new Error("endstruct accepts [align value] [count value] [firstindex value].");
            }
            seen.add(name);
            options.push({ name, expression: expression(words[index + 1]) });
        }
        return { kind: "endStruct", options };
    }
    if (keyword.startsWith(".")) {
        const name = words[0].replace(/:$/, "").slice(1);
        const declaration = words.slice(1).join(" ");
        // eslint-disable-next-line security/detect-unsafe-regex -- Repeated fields are separated by mandatory delimiters.
        const typed = /^(db|dw|dl|dd)(?:\s*\[([^\]]+)])?$/i.exec(declaration);
        if (typed) {
            const storage = {
                width: ["db", "dw", "dl", "dd"].indexOf(typed[1].toLowerCase()) + 1,
                ...(typed[2] === undefined ? {} : { count: expression(typed[2]) }),
            };
            return { kind: "structField", name, storage };
        }
        if (/^(db|dw|dl|dd)\b/i.test(declaration)) {
            return { kind: "structField", name, error: declaration };
        }
        if (words[1]?.toLowerCase() === "skip") {
            if (words.length !== 3) {
                throw new Error(`skip directive in struct requires exactly one parameter: ${words.length}`);
            }
            return { kind: "structField", name, skip: expression(words[2]) };
        }
        return { kind: "structField", name };
    }
    if (keyword === "datastructs") {
        if (words.length !== 2) {
            throw new Error("dataStructs requires one previously defined struct name.");
        }
        return { kind: "dataStructs", name: words[1] };
    }
    if (keyword === "enddatastructs") {
        return { kind: "endDataStructs", argumentCount: words.length - 1 };
    }
    if (keyword === "datastruct") {
        const args = splitInitializerList(words.slice(1).join(" "));
        if (args.length !== 2) {
            throw new Error("dataStruct syntax: dataStruct Record[index], { field = value }.");
        }
        // eslint-disable-next-line security/detect-unsafe-regex -- Repeated fields are separated by mandatory delimiters.
        const reference = /^([A-Z_a-z][\w.]*)(?:\[([^\]]+)])?$/.exec(args[0]);
        if (!reference) {
            throw new Error(`Unknown dataStruct record '${args[0]}'.`);
        }
        return {
            kind: "dataStruct",
            reference: {
                name: reference[1],
                text: args[0],
                ...(reference[2] === undefined ? {} : { index: expression(reference[2]) }),
            },
            fields: parseStructInitializerEntries(args[1]),
        };
    }
    if (keyword.startsWith("[")) {
        const row = /^\[([^\]]+)]\s*=\s*({.*})$/s.exec(text);
        if (row) {
            return {
                kind: "dataStructRow",
                index: expression(row[1]),
                indexText: row[1],
                fields: parseStructInitializerEntries(row[2]),
            };
        }
    }
    return undefined;
}
/** Activate a saved parser diagnostic without reinterpreting a declaration's source text. */
export function checkedDeclaration(node) {
    if (node?.kind === "invalid") {
        throw new Error(node.message);
    }
    return node;
}
const initializerValue = syntaxRecord({ text: syntaxString, expression: syntaxExpression });
const initializerField = syntaxRecord({
    name: syntaxString,
    value: syntaxUnion(initializerValue, syntaxArray(initializerValue)),
    start: syntaxNumber,
    expressions: syntaxArray(syntaxRecord({ text: syntaxString, start: syntaxNumber })),
});
/** Only executable record/declaration variants cross the directive transport boundary. */
export const structDeclarationGuard = syntaxUnion(syntaxRecord({
    kind: syntaxLiteral("struct"),
    name: syntaxString,
    parent: syntaxOptional(syntaxString),
    base: syntaxOptional(syntaxExpression),
    baseText: syntaxOptional(syntaxString),
}), syntaxRecord({
    kind: syntaxLiteral("endStruct"),
    options: syntaxArray(syntaxRecord({
        name: syntaxUnion(syntaxLiteral("align"), syntaxLiteral("count"), syntaxLiteral("firstindex")),
        expression: syntaxExpression,
    })),
}), syntaxRecord({
    kind: syntaxLiteral("dataStruct"),
    reference: syntaxRecord({
        name: syntaxString,
        text: syntaxString,
        index: syntaxOptional(syntaxExpression),
    }),
    fields: syntaxArray(initializerField),
}), syntaxRecord({ kind: syntaxLiteral("dataStructs"), name: syntaxString }), syntaxRecord({ kind: syntaxLiteral("endDataStructs"), argumentCount: syntaxNumber }));
//# sourceMappingURL=declaration-node.js.map