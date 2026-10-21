import { parseInstructionOperands } from "@uttori/asm-core/plugin";
import { expansionPlan, operandParts, operandScalarSyntax, } from "./operand-plans.js";
/** Preserve leading-zero register aliases while rejecting values beyond the hardware register file. */
function register(text) {
    const match = /^r(\d{1,2})$/i.exec(text);
    if (!match) {
        return null;
    }
    const value = Number(match[1]);
    return value <= 15 ? value : null;
}
/** Compile register, address-unit and branch-spelling distinctions once at the source boundary. */
export function parseSuperFxOperands(mnemonic, text) {
    const common = parseInstructionOperands(mnemonic, text, {
        registers: Array.from({ length: 16 }, (_, i) => `r${i}`),
        indexRegisters: [],
        commaIndex: false,
    });
    const parts = operandParts(text).map((part) => {
        const immediate = part.text.startsWith("#");
        const indirect = part.text.startsWith("(") && part.text.endsWith(")");
        let body = part.text;
        if (immediate) {
            body = body.slice(1).trim();
        }
        else if (indirect) {
            body = body.slice(1, -1).trim();
        }
        return {
            register: register(part.text),
            indirectRegister: indirect ? register(body) : null,
            immediate,
            indirect,
            rawOffset: /^\$[\da-f]{2}$/i.test(part.text),
            scalar: operandScalarSyntax(body, part.start + part.text.indexOf(body)),
            display: body,
            expansion: expansionPlan(part.text, part.start),
        };
    });
    return {
        ...common,
        superfx: {
            kind: "superfx-v2",
            mnemonic: mnemonic.toUpperCase(),
            parts,
            whole: expansionPlan(text, 0),
        },
    };
}
/** Syntax tags are checked at the public typed boundary, including after portable copies. */
export function superFxSyntax(value) {
    if (!hasPolicy(value)) {
        throw new Error("SuperFX encoder requires its registered operand grammar.");
    }
    return value;
}
/** Identify this parser's portable payload before entering the execution boundary. */
function hasPolicy(value) {
    return ("superfx" in value &&
        typeof value.superfx === "object" &&
        value.superfx !== null &&
        "kind" in value.superfx &&
        value.superfx.kind === "superfx-v2");
}
//# sourceMappingURL=superfx-syntax.js.map