import { expandOperandPlan, generatedValue, isOperandExpansion, } from "./operand-values.js";
/** Resolve width and bank preference while retaining punctuation from the parsed operand. */
export function classify65816(syntax, frame) {
    const p = syntax.cpu65816, expanded = expandOperandPlan(p.whole, frame);
    let length = expanded.length;
    let hexDigits = p.hexDigits ?? 0;
    if (expanded.generated) {
        hexDigits = Math.max(1, Math.ceil(Math.log2(Math.max(1, Math.abs(expanded.value)) + 1) / 4));
    }
    const numeric = hexDigits > 0;
    if (p.bankWord) {
        length = 2;
    }
    else if (expanded.generated) {
        const same = ((frame.currentAddress() >>> 16) & 255) === ((expanded.value >>> 16) & 255);
        if (length === 3 && !p.explicitLong && same) {
            length = 2;
        }
        if (p.indexedLabel) {
            length = same ? 2 : 3;
        }
    }
    let mode = "unknown";
    const s = p.shape;
    if (s?.kind === "register") {
        mode = "register";
    }
    else if (p.whole.immediate) {
        mode = "immediate";
    }
    else if (s?.kind === "memory") {
        const delimiter = expanded.flattened ? "none" : s.delimiter;
        const index = s.index?.register;
        if (delimiter === "brackets") {
            mode = index === "y" ? "dily" : "dil";
        }
        else if (delimiter === "parentheses") {
            if (s.innerIndex === "s") {
                mode = "sriy";
            }
            else if (s.index?.position === "inside" && index === "x") {
                mode = "dix";
            }
            else if (index === "y") {
                mode = "diy";
            }
            else {
                mode = "dpi";
            }
        }
        else if (index === "s") {
            mode = "sr";
        }
        else if (index === "x") {
            mode = "dpx";
            if (length === 2) {
                mode = "abx";
            }
            else if (length >= 3) {
                mode = "longx";
            }
        }
        else if (index === "y") {
            mode = "aby";
        }
        else if (numeric && length >= 3) {
            mode = "long";
        }
        else if (numeric && length === 2) {
            mode = "abs";
        }
    }
    return {
        ...expanded,
        length,
        mode,
        hexDigits,
        explicitDp: numeric && hexDigits <= 2 && (p.numericSpelling || !expanded.generated),
        scalar: p.scalar,
    };
}
/** Preserve the preparatory per-part reads before whole-operand classification. */
export function prepare65816(syntax, frame) {
    const p = syntax.cpu65816;
    if (p.parts.length === 1) {
        const first = classify65816(syntax, frame);
        if (p.whole.native &&
            !(first.generated && (first.value < 0 || !Number.isInteger(first.value)))) {
            return first;
        }
    }
    else {
        for (const part of p.parts) {
            expandOperandPlan(part, frame);
        }
    }
    return classify65816(syntax, frame);
}
/** Values can be retained from classification only where the established encoder consumed the expansion. */
export function read65816(syntax, resolved, frame, native = false, whole = false) {
    const p = syntax.cpu65816;
    if (p.whole.unbound && frame.bindingFailure?.reason === "other") {
        throw new Error(frame.bindingFailure.message);
    }
    const scalar = whole ? p.wholeScalar : resolved.scalar;
    let display = whole ? p.original : p.display;
    if (resolved.generated) {
        display = "$" + resolved.value.toString(16).toUpperCase();
        if ((whole || native) && p.whole.immediate) {
            display = "#" + display;
        }
    }
    else if (native && p.whole.immediate) {
        display = p.original;
    }
    if (resolved.generated &&
        !(native && p.whole.native && resolved.value >= 0 && Number.isInteger(resolved.value))) {
        let value;
        try {
            value = generatedValue(resolved.value);
        }
        catch (cause) {
            if (frame.stageName === "emitProgram") {
                throw cause;
            }
            value = 0;
        }
        frame.observe(scalar, value, "operand", display);
        return value;
    }
    try {
        return frame.evaluate(scalar, "operand", false, scalar.expression.parenthesized ? "math" : "numeric", display).value;
    }
    catch (cause) {
        if (scalar.expression.parenthesized && frame.stageName !== "emitProgram") {
            return 0;
        }
        throw cause;
    }
}
/** Frame snapshots omit scalar syntax, which remains owned by the parsed occurrence. */
export function prepared65816(frame, scalar) {
    const state = frame.preparation?.state;
    if (state === undefined) {
        return undefined;
    }
    if (Array.isArray(state)) {
        const tuple = state;
        const [length, value, generated, flattened, mode, hexDigits, explicitDp] = tuple;
        if (state.length !== 7 ||
            typeof length !== "number" ||
            typeof value !== "number" ||
            typeof generated !== "boolean" ||
            typeof flattened !== "boolean" ||
            typeof mode !== "string" ||
            typeof hexDigits !== "number" ||
            typeof explicitDp !== "boolean") {
            throw new Error("Invalid prepared 65816 snapshot.");
        }
        return { length, value, generated, flattened, mode, hexDigits, explicitDp, scalar };
    }
    if (!isOperandExpansion(state) ||
        !("mode" in state) ||
        typeof state.mode !== "string" ||
        !("hexDigits" in state) ||
        typeof state.hexDigits !== "number" ||
        !("explicitDp" in state) ||
        typeof state.explicitDp !== "boolean") {
        throw new Error("Invalid prepared 65816 snapshot.");
    }
    return {
        ...state,
        mode: state.mode,
        hexDigits: state.hexDigits,
        explicitDp: state.explicitDp,
        scalar,
    };
}
//# sourceMappingURL=65816-resolution.js.map