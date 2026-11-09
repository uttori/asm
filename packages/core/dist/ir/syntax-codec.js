import { copySyntaxValue, immutableSyntaxValue, } from "./source-syntax.js";
/** Accepts any string syntax payload field. */
export const syntaxString = (value) => typeof value === "string";
/** Accepts finite numeric syntax payload fields. */
export const syntaxNumber = (value) => typeof value === "number" && Number.isFinite(value);
/** Accepts boolean syntax payload fields. */
export const syntaxBoolean = (value) => typeof value === "boolean";
/** Builds a guard that accepts only one exact literal value. */
export function syntaxLiteral(literal) {
    return (value) => value === literal;
}
/** Builds a guard that validates every array element with an element guard. */
export function syntaxArray(guard) {
    return (value) => Array.isArray(value) && value.every(guard);
}
/** Builds a guard that accepts undefined or a value passing the inner guard. */
export function syntaxOptional(guard) {
    return (value) => value === undefined || guard(value);
}
/** Narrow unknown objects before checking fields; transport validation separately rejects host objects. */
export function syntaxObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Reject unknown fields as well as wrong types, so versioned payloads cannot silently lose meaning. */
export function syntaxRecord(shape) {
    return (value) => {
        if (!syntaxObject(value)) {
            return false;
        }
        const fields = value;
        return (Object.keys(fields).every((key) => Object.hasOwn(shape, key)) &&
            Object.entries(shape).every(([key, guard]) => guard(fields[key])));
    };
}
/** Builds a guard that succeeds when any member guard accepts the value. */
export function syntaxUnion(...guards) {
    return (value) => guards.some((guard) => guard(value));
}
/** UTF-16 offsets are nonnegative; a physical line is optional for detached fragments. */
export const syntaxSpan = syntaxRecord({
    start: syntaxNumber,
    end: syntaxNumber,
    line: syntaxOptional(syntaxNumber),
    columnStart: syntaxOptional(syntaxNumber),
    columnEnd: syntaxOptional(syntaxNumber),
});
/** True when a syntax value is a bare identifier expression node. */
const identifier = (value) => syntaxExpression(value) && value.type === "identifier";
/** True when a syntax value is any reference-shaped expression node. */
const reference = (value) => syntaxExpression(value) &&
    ["identifier", "defineReference", "relativeReference", "member", "index"].includes(value.type);
const outcome = syntaxUnion(syntaxRecord({ kind: syntaxLiteral("native") }), syntaxRecord({
    kind: syntaxLiteral("compatibility"),
    reason: syntaxUnion(syntaxLiteral("relative-label"), syntaxLiteral("macro-argument"), syntaxLiteral("variadic-template")),
}), syntaxRecord({
    kind: syntaxLiteral("invalid"),
    reason: syntaxUnion(...[
        "empty",
        "literal",
        "string",
        "define",
        "operand",
        "delimiter",
        "member",
        "trailing-tokens",
    ].map(syntaxLiteral)),
}), syntaxRecord({
    kind: syntaxLiteral("unsupported"),
    reason: syntaxUnion(syntaxLiteral("token"), syntaxLiteral("postfix"), syntaxLiteral("unclassified")),
}));
/** Validate expression children recursively; raw public adapters are never portable execution syntax. */
export const syntaxExpression = (value) => {
    if (!syntaxObject(value)) {
        return false;
    }
    const node = value;
    if (node.span !== undefined && !syntaxSpan(node.span)) {
        return false;
    }
    if (node.parenthesized !== undefined && !syntaxBoolean(node.parenthesized)) {
        return false;
    }
    switch (node.type) {
        case "literal":
            return (syntaxString(node.value) &&
                (node.numericValue === undefined || syntaxNumber(node.numericValue)));
        case "identifier":
            return syntaxString(node.name);
        case "string":
            return syntaxString(node.value) && (node.quote === '"' || node.quote === "'");
        case "sourceText":
            return syntaxString(node.text) && syntaxString(node.value);
        case "defineReference":
            return syntaxBoolean(node.braced) && (syntaxString(node.name) || syntaxString(node.content));
        case "relativeReference":
            return ((node.direction === 1 || node.direction === -1) &&
                syntaxNumber(node.count) &&
                ["relative", "unnamed", "macro"].includes(String(node.stream)));
        case "member":
            return reference(node.object) && identifier(node.property);
        case "index":
            return reference(node.object) && syntaxExpression(node.index);
        case "call":
            return identifier(node.callee) && syntaxArray(syntaxExpression)(node.arguments);
        case "unary":
            return (["<:", "<", ">", "^", "~", "-", "+"].includes(String(node.operator)) &&
                syntaxExpression(node.argument));
        case "binary":
            return ([
                "**",
                "*",
                "/",
                "%",
                "+",
                "-",
                "<<",
                ">>",
                "&",
                "|",
                "^",
                "<",
                ">",
                "<=",
                ">=",
                "==",
                "=",
                "!=",
                "&&",
                "||",
            ].includes(String(node.operator)) &&
                syntaxExpression(node.left) &&
                syntaxExpression(node.right));
        case "range":
            return syntaxExpression(node.start) && syntaxExpression(node.end);
        case "template":
            return (["parameter", "variadic", "source"].includes(String(node.form)) &&
                syntaxString(node.text) &&
                (node.index === undefined || syntaxExpression(node.index)));
        case "error":
            return syntaxString(node.value) && syntaxString(node.message) && outcome(node.outcome);
        default:
            return false;
    }
};
/** Build the same portable parse/validate contract for core directives and plugin contributions. */
export function syntaxCodec(version, parse, guard) {
    return {
        version,
        parse(input) {
            // Parser output is trusted local data. Drop absent optional fields before the bounded
            // transport validator; deserialized payloads never get this normalization step.
            return copySyntaxValue(JSON.parse(JSON.stringify(parse(input))));
        },
        validate: guard,
        read(payload) {
            if (!guard(payload)) {
                throw new Error("Invalid typed directive payload.");
            }
            return payload;
        },
    };
}
/**
 * Explicit read-only codec for built-ins. Guards must be pure and executors must not mutate payloads.
 * Mutable plugins keep syntaxCodec; transported values still require bounded copying and validation.
 */
export function immutableSyntaxCodec(version, parse, guard) {
    return {
        version,
        parse(input) {
            return immutableSyntaxValue(JSON.parse(JSON.stringify(parse(input))));
        },
        validate: guard,
        read(payload) {
            if (!guard(payload)) {
                throw new Error("Invalid typed directive payload.");
            }
            return payload;
        },
    };
}
//# sourceMappingURL=syntax-codec.js.map