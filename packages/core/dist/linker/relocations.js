import { allocationKey } from "./symbols.js";
import { LinkError } from "./types.js";
import { isRecord } from "./value.js";
/** Apply checked typed fields only after every contribution and global binding has a final value. */
export function applyRelocations(output, modules, recipe, symbols) {
    for (const module of modules) {
        for (const instruction of module.instructions) {
            const assumed = assumptionFor(recipe, module.id, instruction.section);
            if (!assumed.state) {
                continue;
            }
            for (const [key, expected] of Object.entries(assumed.state)) {
                if (!isRecord(instruction.state) || instruction.state[key] !== expected) {
                    throw new LinkError("processor-state", `Instruction '${instruction.form}' does not satisfy ${key}=${String(expected)}.`, instruction.source);
                }
            }
        }
        for (const fixup of module.fixups) {
            const allocation = symbols.allocations.get(allocationKey(module.id, fixup.section));
            if (allocation.outputOffset === undefined) {
                throw new LinkError("fixup-storage", "Relocation has no ROM payload.", fixup.source);
            }
            const encoding = fixup.encoding;
            for (const check of encoding.checks ?? []) {
                checkValue(symbols.evaluate(check.expression, fixup.source), check, fixup);
            }
            const original = symbols.evaluate(fixup.expression, fixup.source);
            const assumed = assumptionFor(recipe, module.id, fixup.section);
            const address = allocation.runAddress + fixup.offset;
            let value = original;
            if (encoding.addressWidth !== undefined &&
                (value < 0 || value >= 2 ** encoding.addressWidth) &&
                encoding.kind !== "absolute") {
                throw new LinkError("address-range", `Address $${value.toString(16)} exceeds ${encoding.addressWidth} bits.`, fixup.source);
            }
            let kind = encoding.kind ?? "absolute";
            // Authored low/high/bank extraction and masks intentionally encode raw fields.
            // Their lost bank/page bits must not be reintroduced as inferred addressing assumptions.
            if (["programBank", "dataBank", "directPage"].includes(kind) &&
                explicitlyNarrowed(fixup.expression, encoding.width)) {
                kind = "absolute";
            }
            switch (kind) {
                case "relative": {
                    const basis = encoding.pc;
                    let pc = symbols.section(module.id, basis.section, basis.offset);
                    const wrap = encoding.wrapWidth;
                    if (wrap !== undefined) {
                        const bankSize = 2 ** wrap;
                        // The instruction-end cursor may be one past a bank. The processor wraps its PC
                        // without changing the bank containing this instruction's encoded displacement.
                        pc = Math.floor(address / bankSize) * bankSize + (pc % bankSize);
                        // Authored short numeric targets retain their traditional within-bank interpretation.
                        if (fixup.expression.kind === "constant" && value >= 0 && value < bankSize) {
                            value += Math.floor(pc / bankSize) * bankSize;
                        }
                        if (Math.floor(value / bankSize) !== Math.floor(pc / bankSize)) {
                            throw new LinkError("branch-bank", "PC-relative target is in another processor bank.", fixup.source);
                        }
                        value = (((value - pc) % bankSize) + bankSize) % bankSize;
                        if (value >= bankSize / 2) {
                            value -= bankSize;
                        }
                    }
                    else {
                        value -= pc;
                    }
                    break;
                }
                case "programBank":
                    if (Math.floor(value / 65536) !== Math.floor(address / 65536)) {
                        throw new LinkError("program-bank", "Near control-flow target is in another program bank; an explicit far call/jump is required.", fixup.source);
                    }
                    value %= 65536;
                    break;
                case "dataBank": {
                    let bank = assumed.dataBank;
                    if (isRecord(encoding.state) && typeof encoding.state.dataBank === "number") {
                        bank = encoding.state.dataBank;
                    }
                    if (bank === "program") {
                        bank = Math.floor(address / 65536);
                    }
                    if (bank === undefined) {
                        throw new LinkError("data-bank", "A symbolic near data address requires an explicit dataBank assumption.", fixup.source);
                    }
                    if (Math.floor(value / 65536) !== bank) {
                        throw new LinkError("data-bank", `Data address does not match bank $${bank.toString(16)}.`, fixup.source);
                    }
                    value %= 65536;
                    break;
                }
                case "directPage": {
                    let page = assumed.directPage;
                    if (isRecord(encoding.state) && typeof encoding.state.directPage === "number") {
                        page = encoding.state.directPage;
                    }
                    if (page === undefined) {
                        throw new LinkError("direct-page", "A symbolic direct-page address requires an explicit directPage assumption.", fixup.source);
                    }
                    value -= page;
                    break;
                }
                case "upperPage":
                    if (value < 0xff00 || value > 0xffff) {
                        throw new LinkError("upper-page", "Address is outside $FF00..$FFFF.", fixup.source);
                    }
                    value -= 0xff00;
                    break;
                case "absolute":
                    break;
            }
            if (encoding.constraint === "powerOfTwo" &&
                (original <= 0 || (BigInt(original) & (BigInt(original) - 1n)) !== 0n)) {
                throw new LinkError("field-constraint", "Operand must be a power of two.", fixup.source);
            }
            const capacity = 2 ** (8 * encoding.width);
            const maximum = encoding.signed ? capacity / 2 - 1 : capacity - 1;
            if (!encoding.truncate) {
                checkValue(value, {
                    minimum: encoding.minimum ?? -capacity / 2,
                    maximum: encoding.maximum ?? maximum,
                    alignment: encoding.alignment,
                }, fixup);
            }
            // BigInt preserves every low bit for negative values and 32-bit unsigned fields.
            const bits = BigInt(value);
            for (let index = 0; index < encoding.width; index++) {
                const shift = encoding.endianness === "big" ? encoding.width - index - 1 : index;
                output[allocation.outputOffset + fixup.offset + index] = Number((bits >> BigInt(shift * 8)) & 255n);
            }
        }
    }
}
/** Later matching rules deliberately refine earlier defaults, including module-specific section assumptions. */
function assumptionFor(recipe, module, section) {
    const result = { section };
    for (const assumption of recipe.assumptions ?? []) {
        if (assumption.section === section &&
            (assumption.module === undefined || assumption.module === module)) {
            Object.assign(result, assumption, {
                state: Object.assign({}, result.state, assumption.state),
            });
        }
    }
    return result;
}
function checkValue(value, bounds, fixup) {
    if ((bounds.minimum !== undefined && value < bounds.minimum) ||
        (bounds.maximum !== undefined && value > bounds.maximum) ||
        (bounds.alignment !== undefined && value % bounds.alignment !== 0)) {
        throw new LinkError("field-range", `Relocation value ${value} violates range/alignment ${bounds.minimum ?? "*"}..${bounds.maximum ?? "*"} / ${bounds.alignment ?? 1}.`, fixup.source);
    }
}
/** Recognize explicit source truncation without treating an arbitrary small linked address as a raw operand. */
function explicitlyNarrowed(expression, width) {
    if (width === 1 &&
        expression.kind === "unary" &&
        ["low", "high", "bank"].includes(expression.operator)) {
        return true;
    }
    if (expression.kind !== "binary" || expression.operator !== "&") {
        return false;
    }
    const limit = 2 ** (width * 8) - 1;
    for (const operand of [expression.left, expression.right]) {
        if (operand.kind === "constant" && operand.value >= 0 && operand.value <= limit) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=relocations.js.map