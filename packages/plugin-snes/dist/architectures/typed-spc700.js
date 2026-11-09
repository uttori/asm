import { RelocatableInstruction, linkBinary, linkConstant, isReferenceExpressionNode, } from "@uttori/asm-core";
import { expandOperandPlan, chooseOperandPreparation, generatedValue, preparedParts, } from "./operand-values.js";
import { spc700Modes, spc700Specifications } from "./spc700-spec.js";
import { parseSpcOperands, spcSyntax } from "./spc700-syntax.js";
/** The opcode matrix uses P while accepted source also spells the register PSW. */
const moduleRegister = (name) => (name === "psw" ? "p" : name);
const encodings = new Map();
for (const spec of spc700Specifications) {
    const forms = encodings.get(spec.mnemonic) ?? new Map();
    forms.set(spec.mode, spec.opcode[0]);
    encodings.set(spec.mnemonic, forms);
}
/** True when `value` appears as a whitespace-separated token in `list`. */
const families = (value, list) => list.split(" ").includes(value);
/** Pattern syntax comes from the same opcode matrix as the decoder, with a concrete bit placeholder. */
const modulePatterns = spc700Specifications.map((specification) => ({
    specification,
    parts: parseSpcOperands(specification.mnemonic, specification.syntax.replaceAll("addr.bit", "addr.0")).spc700.parts,
}));
/** All SPC forms execute structural operands; opcode writes retain each family's established ordering. */
export class TypedSpc700 {
    /** Relocatable object emission covers the full opcode matrix. */
    supportsRelocatable = true;
    /** Operand binding failures surface at the final read, not during width collection. */
    deferOperandBindingErrors = true;
    /** Preserve per-slot observations before the whole-fragment width probe. */
    prepare(frame) {
        if (frame.isRelocatable) {
            frame.choose("spc700-module-preparation", 0);
            return;
        }
        const syntax = spcSyntax(frame.instruction.operands).spc700;
        const parts = syntax.parts.map((p) => expandOperandPlan(p.plan, frame));
        // SPC lowering always observes the whole fragment after its separate operand slots.
        expandOperandPlan(syntax.whole, frame);
        chooseOperandPreparation(frame, "spc700-preparation", parts);
    }
    /**
     * Returns the byte size chosen for the current instruction form.
     * @param frame Active resolution frame for the occurrence.
     * @returns Encoded instruction length in bytes.
     */
    estimate(frame) {
        return this.run(frame);
    }
    /**
     * Emits opcode bytes when `context` is supplied; otherwise sizes only.
     * @param frame Active resolution frame for the occurrence.
     * @param context Emission sink and diagnostics for the emit pass.
     * @returns True when a recognized form produced bytes.
     */
    encode(frame, context) {
        return this.run(frame, context) > 0;
    }
    run(frame, context) {
        if (frame.isRelocatable) {
            return this.runModule(frame, context);
        }
        const syntax = spcSyntax(frame.instruction.operands).spc700, op = syntax.mnemonic, emit = !!context;
        if (emit && syntax.suffixError) {
            throw new Error("Error: Invalid opcode length.");
        }
        const state = preparedParts(frame);
        const parts = syntax.parts.map((part, i) => {
            const expanded = state?.[i] ?? expandOperandPlan(part.plan, frame);
            const s = part.shape;
            let mode = "direct", digits = part.hexDigits;
            if (expanded.generated) {
                digits = Math.max(1, Math.ceil(Math.log2(Math.max(1, Math.abs(expanded.value)) + 1) / 4));
            }
            if (s?.kind === "immediate") {
                mode = "immediate";
            }
            else if (s?.kind === "register") {
                mode = "register";
            }
            else if (s?.kind === "memory" && !expanded.flattened) {
                if ("kind" in s.address) {
                    mode = s.postIncrement ? "post" : "indirectRegister";
                }
                else if (s.index?.position === "inside" && s.index.register === "x") {
                    mode = "indirectX";
                }
                else if (s.delimiter === "parentheses" && s.index?.register === "y") {
                    mode = "indirectY";
                }
                else if (s.index?.register === "x") {
                    mode = "indexedX";
                }
                else if (s.index?.register === "y") {
                    mode = "indexedY";
                }
                else if (s.delimiter === "parentheses") {
                    mode = "parentheses";
                }
            }
            const hex = expanded.generated || part.hexDigits > 0;
            const value = expanded.generated ? expanded.value : part.hexPrefix;
            let register = part.register;
            if (s?.kind === "memory" && "kind" in s.address) {
                register = s.address.name;
            }
            return {
                part,
                expanded,
                register,
                mode,
                digits,
                hex,
                value,
                width: hex && digits <= 2 ? 1 : 2,
            };
        });
        const a = parts.at(0), b = parts.at(1), n = parts.length;
        const write = (value, width = 1) => {
            if (width === 2) {
                context?.emission.write2(value);
            }
            else {
                context?.emission.write1(value);
            }
        };
        const choose = (mode, size) => {
            frame.choose(mode, size);
            return size;
        };
        const code = (mode) => encodings
            .get(op)
            ?.get(spc700Modes[mode]?.id ?? mode);
        const output = (mode, values = []) => {
            const byte = code(mode);
            if (byte === undefined) {
                return choose("unknown", emit ? 0 : 1);
            }
            write(byte);
            let size = 1;
            for (const value of values) {
                write(value.value, value.width);
                size += value.width;
            }
            return choose(mode, size);
        };
        const prefix = (p) => p.expanded.generated ? p.expanded.value : p.part.hexPrefix;
        const filtered = (p) => p.expanded.generated ? p.expanded.value : p.part.filteredHex;
        const read = (p, whole = false, catchFailure = false) => {
            try {
                if (p.part.plan.unbound && frame.bindingFailure?.reason === "other") {
                    throw new Error(frame.bindingFailure.message);
                }
                const scalar = whole ? p.part.wholeScalar : p.part.scalar;
                let display = whole ? p.part.wholeDisplay : p.part.display;
                if (p.expanded.generated) {
                    let value;
                    try {
                        value = generatedValue(p.expanded.value);
                    }
                    catch (cause) {
                        if (frame.stageName === "emitProgram") {
                            throw cause;
                        }
                        value = 0;
                    }
                    display = "$" + p.expanded.value.toString(16).toUpperCase();
                    if (whole && p.part.plan.immediate) {
                        display = "#" + display;
                    }
                    frame.observe(scalar, value, "operand", display);
                    return value;
                }
                return frame.evaluate(scalar, "operand", false, "numeric", display).value;
            }
            catch (cause) {
                if (catchFailure) {
                    return prefix(p) & 0xffff;
                }
                throw cause;
            }
        };
        // Collection sizes do not force final numeric diagnostics; emission retains the family read order.
        const numeric = (p, whole = false, catchFailure = false) => emit ? read(p, whole, catchFailure) : 0;
        const literal = (p) => p.hex || p.part.bareHex;
        const plain = (p) => p.mode === "direct" && p.part.bit === undefined;
        const reg = (p, name) => p?.mode === "register" && p.register === name;
        const width = (p) => {
            if (syntax.width === undefined) {
                return p.width;
            }
            return syntax.width === 1 ? 1 : 2;
        };
        const address = (p) => {
            if (p.hex && plain(p)) {
                return prefix(p) >>> 0;
            }
            return numeric(p, false, true) & 0xffff;
        };
        const branchTarget = (p, end) => {
            const expression = p.part.wholeScalar.expression;
            if (expression.type === "relativeReference" && isReferenceExpressionNode(expression)) {
                const r = frame.reference(expression, end);
                if (r.kind === "error" &&
                    (expression.direction === -1 || frame.stageName === "emitProgram")) {
                    throw r.error;
                }
                return r.kind === "resolved" ? r.value : 0;
            }
            return read(p, true);
        };
        const lexicalWidth = (p) => {
            const digits = p?.expanded.generated ? p.digits : (p?.part.leadingHexDigits ?? 0);
            return digits > 0 && digits <= 2 ? 1 : 2;
        };
        const implied = code("imp");
        if (implied !== undefined) {
            write(implied);
            return choose("implied", 1);
        }
        // Early estimates intentionally defer operand validity, matching the collecting pass's placeholders.
        if (!emit) {
            if (families(op, "TCALL PUSH POP MUL DIV")) {
                return choose("fixed", 1);
            }
            if (code("rel") !== undefined || families(syntax.bitFamily ?? "", "SET CLR")) {
                return choose("fixed", 2);
            }
            if (families(syntax.bitFamily ?? "", "BBS BBC OR AND EOR MOV NOT") ||
                families(op, "CALL JMP CBNE TSET TCLR")) {
                return choose("fixed", 3);
            }
            if (op === "DBNZ") {
                return choose("branch", reg(a, "y") ? 2 : 3);
            }
            if (op === "PCALL" || families(op, "INCW DECW CMPW ADDW SUBW MOVW")) {
                return choose("fixed", 2);
            }
            // Collecting sizes retain lexical padding, even for forms whose final encoder narrows by value.
            if (families(op, "ASL LSR ROL ROR INC DEC")) {
                return choose("shift", a?.mode === "register" && families(a.register, "a x y") ? 1 : 1 + lexicalWidth(a));
            }
            if (op === "MOV") {
                const pair = a &&
                    b &&
                    ((a.mode === "register" &&
                        b.mode === "register" &&
                        ["x,a", "a,x", "x,sp", "sp,x", "a,y", "y,a"].includes(a.register + "," + b.register)) ||
                        (a.register === "x" && families(a.mode, "post indirectRegister") && reg(b, "a")) ||
                        (b.register === "x" && families(b.mode, "post indirectRegister") && reg(a, "a")));
                if (pair) {
                    return choose("move", 1);
                }
                if (a &&
                    b &&
                    a.mode === "register" &&
                    families(a.register, "a x y") &&
                    b.mode === "immediate") {
                    return choose("move", 2);
                }
                if ((a && b && literal(a) && literal(b) && plain(a) && plain(b)) ||
                    (a && b && literal(a) && plain(a) && b.mode === "immediate")) {
                    return choose("move", 3);
                }
                if (a && b && a.mode === "parentheses" && b.mode === "parentheses" && a.hex && b.hex) {
                    return choose("move", 3);
                }
                if (a?.part.parenthesizedHex || b?.part.parenthesizedHex) {
                    return choose("move", 2);
                }
                const memory = a && (a.expanded.generated || a.part.containsDollar) ? a : b;
                return choose("move", memory && (memory.expanded.generated || memory.part.containsDollar)
                    ? 1 + lexicalWidth(memory)
                    : 2);
            }
            if (families(op, "ADC SBC AND OR EOR CMP")) {
                if (reg(a, "x") || reg(a, "y")) {
                    return choose("alu", b?.mode === "immediate" ? 2 : 1 + lexicalWidth(b));
                }
                if (a?.mode === "indirectRegister" &&
                    a.register === "x" &&
                    b?.mode === "indirectRegister" &&
                    b.register === "y") {
                    return choose("alu", 1);
                }
                if (a &&
                    b &&
                    literal(a) &&
                    plain(a) &&
                    (b.mode === "immediate" || (literal(b) && plain(b)))) {
                    return choose("alu", 3);
                }
                if (a && b && a.mode === "parentheses" && b.mode === "parentheses" && a.hex && b.hex) {
                    return choose("alu", 3);
                }
                if (!reg(a, "a")) {
                    return choose("alu", 2);
                }
                // Sizing follows the authored address width; explicit opcode suffixes apply at emission.
                if (b?.mode === "indirectRegister" && b.register === "x") {
                    return choose("alu", 1);
                }
                if (b && families(b.mode, "immediate indirectX indirectY")) {
                    return choose("alu", 2);
                }
                return choose("alu", b?.mode === "indexedY" ? 3 : 1 + (b?.hex ? b.width : lexicalWidth(b)));
            }
        }
        if (n === 1 && a) {
            if (code("rel") !== undefined) {
                write(code("rel"));
                const target = branchTarget(a, frame.currentAddress() + 1);
                const offset = target - frame.currentAddress() - 1;
                write(frame.stageName === "emitProgram" ? offset & 255 : 255);
                return choose("relative", 2);
            }
            if (syntax.bitFamily === "SET" || syntax.bitFamily === "CLR") {
                const bit = a.part.bit ?? syntax.bit;
                if (bit === undefined) {
                    return choose("unknown", 0);
                }
                const base = syntax.bitFamily === "SET" ? 2 : 0x12;
                write((bit << 5) | base);
                write((a.part.bitValue ?? prefix(a)) & 255);
                return choose("direct-bit", 2);
            }
            if (op === "TCALL") {
                const value = a.expanded.generated ? NaN : (a.part.decimalPrefix ?? NaN);
                if (!Number.isInteger(value) || value < 0 || value > 15) {
                    return choose("unknown", 0);
                }
                write((value << 4) | 1);
                return choose("tcall", 1);
            }
            if (families(op, "PUSH POP")) {
                return output("reg" + a.register.toUpperCase());
            }
            if (families(op, "CALL PCALL JMP")) {
                let byte = op === "CALL" ? 0x3f : 0x4f;
                if (op === "JMP") {
                    byte = a.mode === "indirectX" ? 0x1f : 0x5f;
                }
                write(byte);
                write(numeric(a, op !== "JMP" || a.mode !== "indirectX", true), op === "PCALL" ? 1 : 2);
                return choose("call", op === "PCALL" ? 2 : 3);
            }
            if (families(op, "ASL LSR ROL ROR INC DEC")) {
                if (reg(a, "a") || ((op === "INC" || op === "DEC") && (reg(a, "x") || reg(a, "y")))) {
                    return output("reg" + a.register.toUpperCase());
                }
                const valueWidth = (prefix(a) & 0xffff) <= 255 ? 1 : 2;
                const w = syntax.width === undefined ? valueWidth : width(a);
                const indexed = a.mode === "indexedX";
                let mode = w === 1 ? "dp" : "abs";
                if (indexed && w === 1) {
                    mode = "dpx";
                }
                return output(mode, [{ value: prefix(a) & 0xffff, width: w }]);
            }
            if (op === "INCW" || op === "DECW") {
                return output("dpWord", [{ value: prefix(a) & 255, width: 1 }]);
            }
            if (families(op, "DAA DAS XCN") && reg(a, "a")) {
                return output("regA");
            }
            if (op === "MUL" && reg(a, "ya")) {
                return output("regYA");
            }
        }
        if (n === 2 && a && b) {
            if (syntax.bitFamily === "BBS" || syntax.bitFamily === "BBC") {
                const bit = a.part.bit ?? syntax.bit;
                if (bit === undefined) {
                    return choose("unknown", 0);
                }
                write((bit << 5) | (syntax.bitFamily === "BBS" ? 3 : 0x13));
                write((a.part.bitValue ?? prefix(a)) & 255);
                let offset = 255;
                if (frame.stageName === "emitProgram") {
                    offset = read(b, true) - frame.currentAddress() - 1;
                }
                write(offset & 255);
                return choose("bit-branch", 3);
            }
            if (op === "DBNZ" || op === "CBNE") {
                const y = op === "DBNZ" && reg(a, "y"), size = y ? 2 : 3;
                // Numeric address arithmetic resolves its symbol before the branch range check.
                const expression = b.part.wholeScalar.expression;
                if (expression.type === "binary" &&
                    (expression.operator === "+" || expression.operator === "-") &&
                    expression.left.type === "literal" &&
                    !expression.parenthesized &&
                    !expression.left.parenthesized &&
                    isReferenceExpressionNode(expression.right)) {
                    const reference = frame.reference(expression.right);
                    if (reference.kind === "error") {
                        throw reference.error;
                    }
                    if (reference.kind === "missing" && expression.right.type === "identifier") {
                        throw new Error(`Error: Label '${expression.right.name}' not found.`);
                    }
                }
                const target = read(b, true), offset = target - frame.currentAddress() - size;
                if (frame.stageName === "emitProgram" && (offset < -128 || offset > 127)) {
                    throw frame.error(`Branch target out of range (${offset})`);
                }
                let byte = op === "DBNZ" ? 0x6e : 0x2e;
                if (y) {
                    byte = 0xfe;
                }
                else if (op === "CBNE" && a.mode === "indexedX") {
                    byte = 0xde;
                }
                write(byte);
                if (!y) {
                    write(prefix(a) & 255);
                }
                write(offset & 255);
                return choose("compare-branch", size);
            }
            if (op === "DIV" && reg(a, "ya") && reg(b, "x")) {
                return output("regYAX");
            }
            if (op === "CMP" && (reg(a, "x") || reg(a, "y"))) {
                const name = a.register;
                if (b.mode === "immediate") {
                    return output(name + "Imm", [{ value: filtered(b) & 255, width: 1 }]);
                }
                const w = width(b);
                return output(name + (w === 1 ? "Dp" : "Abs"), [{ value: prefix(b) & 0xffff, width: w }]);
            }
            if (op === "MOV" && (reg(a, "x") || reg(a, "y")) && b.mode === "immediate") {
                write(code(a.register + "Imm"));
                write(numeric(b) & 255);
                return choose("register-immediate", 2);
            }
            if (families(op, "ADC SBC AND OR EOR CMP") && reg(a, "a")) {
                if (b.mode === "indirectRegister" && b.register === "x") {
                    return output("aIndX");
                }
                let mode = "aAbs", w = 2;
                const value = address(b);
                if (b.mode === "immediate") {
                    mode = "aImm";
                    w = 1;
                }
                else if (b.mode === "indirectX") {
                    mode = "aDpxi";
                    w = 1;
                }
                else if (b.mode === "indirectY") {
                    mode = "aDpiy";
                    w = 1;
                }
                else if (b.mode === "indexedY") {
                    mode = "aAby";
                }
                else if (b.mode === "indexedX") {
                    w = width(b);
                    mode = w === 1 ? "aDpx" : "aAbx";
                }
                else {
                    w = width(b);
                    mode = w === 1 ? "aDp" : "aAbs";
                }
                return output(mode, [{ value, width: w }]);
            }
            if (families(op, "ADC SBC AND OR EOR CMP")) {
                if (a.mode === "indirectRegister" &&
                    a.register === "x" &&
                    b.mode === "indirectRegister" &&
                    b.register === "y") {
                    return output("xy");
                }
                // Memory/immediate forms encode the source byte before the destination address.
                if (literal(a) && plain(a) && b.mode === "immediate") {
                    write(code("dpImm"));
                    write(numeric(b) & 255);
                    write(prefix(a) & 255);
                    return choose("direct-immediate", 3);
                }
                if (literal(a) &&
                    literal(b) &&
                    ((plain(a) && plain(b)) || (a.mode === "parentheses" && b.mode === "parentheses"))) {
                    return output("dpDp", [
                        { value: (b.mode === "parentheses" ? b.part.baseHex : prefix(b)) & 255, width: 1 },
                        { value: (a.mode === "parentheses" ? a.part.baseHex : prefix(a)) & 255, width: 1 },
                    ]);
                }
            }
            if ((op === "TSET" || op === "TCLR") && reg(b, "a")) {
                return output("absA", [{ value: prefix(a) & 0xffff, width: 2 }]);
            }
            if (families(op, "CMPW ADDW SUBW MOVW") &&
                reg(a, "ya") &&
                b.hex &&
                b.digits <= 2 &&
                plain(b)) {
                return output("yaDp", [{ value: prefix(b) & 255, width: 1 }]);
            }
            if (op === "MOVW" && reg(b, "ya") && a.hex && a.digits <= 2 && plain(a)) {
                return output("dpYa", [{ value: prefix(a) & 255, width: 1 }]);
            }
            if (op === "MOV") {
                if (a.mode === "parentheses" && b.mode === "parentheses" && a.hex && b.hex) {
                    return output("dpDp", [
                        { value: b.part.baseHex & 255, width: 1 },
                        { value: a.part.baseHex & 255, width: 1 },
                    ]);
                }
                const pair = {
                    "x,a": "regXA",
                    "a,x": "regAX",
                    "x,sp": "regXSP",
                    "sp,x": "regSPX",
                    "a,y": "regAY",
                    "y,a": "regYA2",
                };
                if (a.mode === "register" && b.mode === "register" && pair[a.register + "," + b.register]) {
                    return output(pair[a.register + "," + b.register]);
                }
                if (a.register === "x" &&
                    (a.mode === "post" || a.mode === "indirectRegister") &&
                    reg(b, "a")) {
                    return output(a.mode === "post" ? "regPostXA" : "indXA");
                }
                if (b.register === "x" &&
                    (b.mode === "post" || b.mode === "indirectRegister") &&
                    reg(a, "a")) {
                    return output(b.mode === "post" ? "regAPostX" : "regAIndX");
                }
                if (reg(a, "a") && b.mode === "immediate") {
                    write(code("aImm"));
                    write(filtered(b) & 255);
                    return choose("immediate", 2);
                }
                if (literal(a) && plain(a) && b.mode === "immediate") {
                    write(code("dpImm"));
                    write(filtered(b) & 255);
                    write(prefix(a) & 255);
                    return choose("direct-immediate", 3);
                }
                if (literal(a) && literal(b) && plain(a) && plain(b)) {
                    return output("dpDp", [
                        { value: (b.mode === "parentheses" ? b.part.baseHex : prefix(b)) & 255, width: 1 },
                        { value: (a.mode === "parentheses" ? a.part.baseHex : prefix(a)) & 255, width: 1 },
                    ]);
                }
                const load = a.mode === "register", memory = load ? b : a, register = load ? a : b;
                if (register.mode === "register" && families(register.register, "a x y")) {
                    const m = memory.mode, r = register.register;
                    let mode = "", w = width(memory), value = (memory.expanded.generated ? memory.expanded.value : memory.part.baseHex) & 0xffff;
                    if (m === "indirectX" && r === "a" && memory.hex) {
                        mode = load ? "aDpxi" : "dpxiA";
                        w = 1;
                    }
                    else if (m === "indirectY" && r === "a" && memory.hex) {
                        mode = load ? "aDpiy" : "dpiyA";
                        w = 1;
                    }
                    else if (m === "indexedX" || m === "indexedY") {
                        if (!(memory.hex && m === "indexedX" && r === "a")) {
                            value = numeric(memory);
                        }
                        w = width(memory);
                        if (r === "a") {
                            if (m === "indexedY") {
                                mode = load ? "aAby" : "abyA";
                            }
                            else {
                                if (load) {
                                    mode = w === 1 ? "aDpx" : "aAbx";
                                }
                                else {
                                    mode = w === 1 ? "dpxA" : "abxA";
                                }
                            }
                        }
                        else if (r === "x" && m === "indexedY") {
                            mode = load ? "xDpy" : "dpyX";
                        }
                        else if (r === "y" && m === "indexedX") {
                            mode = load ? "yDpx" : "dpxY";
                        }
                    }
                    else if (plain(memory) && memory.mode !== "register") {
                        if (!memory.hex) {
                            value = numeric(memory, true);
                            w = memory.width;
                        }
                        if (load) {
                            mode = r + (w === 1 ? "Dp" : "Abs");
                        }
                        else {
                            mode = (w === 1 ? "dp" : "abs") + r.toUpperCase();
                        }
                        if (!load && r === "a" && w === 2) {
                            mode = "absRegA";
                        }
                    }
                    if (mode) {
                        return output(mode, [{ value, width: w }]);
                    }
                }
            }
        }
        if (syntax.bitFamily && families(syntax.bitFamily, "OR AND EOR MOV NOT") && n >= 1 && n <= 3) {
            const family = syntax.bitFamily;
            let mem, toCarry = true, bit = syntax.bit;
            if (family === "MOV") {
                if (reg(a, "c")) {
                    mem = b;
                }
                else if (reg(b, "c")) {
                    mem = a;
                    toCarry = false;
                }
                else if (n === 1) {
                    mem = a;
                }
            }
            else if (family === "NOT") {
                if (n === 1) {
                    mem = a;
                }
                else if (reg(a, "c")) {
                    mem = b;
                }
                else if (reg(b, "c")) {
                    mem = a;
                }
                else {
                    mem = a;
                    bit = b?.part.decimalPrefix;
                }
            }
            else if (reg(a, "c")) {
                mem = b;
            }
            else if (reg(b, "c")) {
                mem = a;
            }
            if (mem) {
                bit = mem.part.bit ?? bit;
                if (n === 3) {
                    bit = parts[2].part.decimalPrefix;
                }
                if (bit !== undefined && Number.isInteger(bit) && bit >= 0 && bit <= 7) {
                    let byte = 0xea;
                    if (family === "OR") {
                        byte = mem.part.invert ? 0x2a : 0x0a;
                    }
                    else if (family === "AND") {
                        byte = mem.part.invert ? 0x6a : 0x4a;
                    }
                    else if (family === "EOR") {
                        byte = 0x8a;
                    }
                    else if (family === "MOV") {
                        byte = toCarry ? 0xaa : 0xca;
                    }
                    const value = mem.part.bitValue ?? (mem.expanded.generated ? mem.expanded.value : numeric(mem, true));
                    write(byte);
                    write(value & 255);
                    write(((value >> 8) & 255) | ((bit & 7) << 5));
                    return choose("memory-bit", 3);
                }
            }
        }
        if (emit && syntax.bitFamily === "MOV" && n === 2 && a) {
            if (frame.bindingFailure?.reason === "other") {
                throw new Error(frame.bindingFailure.message);
            } // The fallback reads the combined bit operand. Only its diagnostic spelling reflects expansion.
            const display = parts
                .map((p) => p.expanded.generated
                ? (p.part.plan.immediate ? "#$" : "$") + p.expanded.value.toString(16).toUpperCase()
                : p.part.wholeDisplay)
                .join(",");
            let compound = a.part.compound;
            if (parts.some((p) => p.expanded.generated)) {
                const expression = compound.expression;
                if (a.expanded.generated && frame.stageName === "emitProgram") {
                    throw new Error("Invalid number: " + display);
                }
                if (expression.type === "error") {
                    compound = {
                        ...compound,
                        expression: {
                            ...expression,
                            value: display,
                            message: "Invalid input: " + display.slice(display.indexOf(",")),
                        },
                    };
                }
            }
            const value = frame.evaluate(compound, "beforeOpcode").value;
            write(0xaa);
            write(value & 255);
            write(((value >> 8) & 255) | ((syntax.bit ?? 0) << 5));
            return choose("compound-bit", 3);
        }
        return choose("unknown", emit ? 0 : 1);
    }
    /** Matrix-driven object emission covers all hardware forms without interpreting provisional values. */
    runModule(frame, context) {
        const syntax = spcSyntax(frame.instruction.operands).spc700;
        if (syntax.suffixError || (syntax.width !== undefined && syntax.width > 2)) {
            throw frame.error("SPC700 address width must be byte or word.");
        }
        const instruction = new RelocatableInstruction(frame, context);
        const parts = syntax.parts;
        const op = syntax.mnemonic;
        if (op === "TCALL") {
            if (parts.length !== 1) {
                throw frame.error("TCALL requires one table index.");
            }
            const index = frame.constant(parts[0].scalar, "TCALL table index");
            if (index < 0 || index > 15) {
                throw frame.error("TCALL index must be 0..15.");
            }
            return instruction.opcode((index << 4) | 1).finish("tableCall");
        }
        if (["SET", "CLR", "BBS", "BBC"].includes(syntax.bitFamily ?? "")) {
            const family = syntax.bitFamily;
            const branch = family === "BBS" || family === "BBC";
            if (parts.length !== (branch ? 2 : 1)) {
                throw frame.error(`${op} has an invalid operand count.`);
            }
            const bit = parts[0].bit ?? syntax.bit;
            if (bit === undefined || bit < 0 || bit > 7) {
                throw frame.error("Direct bit index must be 0..7.");
            }
            let opcode = family === "SET" ? 2 : 0x12;
            if (branch) {
                opcode = family === "BBS" ? 3 : 0x13;
            }
            instruction
                .opcode(opcode | (bit << 5))
                .field(parts[0].scalar, { width: 1, kind: "directPage", addressWidth: 16 });
            if (branch) {
                instruction.field(parts[1].wholeScalar, {
                    width: 1,
                    kind: "relative",
                    signed: true,
                    addressWidth: 16,
                    wrapWidth: 16,
                });
            }
            return instruction.finish(branch ? "directBitRelative" : "directBit");
        }
        const candidates = modulePatterns.filter((pattern) => pattern.specification.mnemonic === op &&
            pattern.parts.length === parts.length &&
            pattern.parts.every((part, index) => moduleOperandsMatch(part, parts[index])));
        const widthScore = (pattern) => {
            let score = 0;
            for (let index = 0; index < parts.length; index++) {
                const expected = pattern.parts[index];
                if (expected.shape?.kind !== "memory" ||
                    "kind" in expected.shape.address ||
                    expected.shape.bit) {
                    continue;
                }
                const name = expected.shape.address.expression;
                if (name.type !== "identifier" || (name.name !== "dp" && name.name !== "addr")) {
                    continue;
                }
                const preferred = syntax.width ?? parts[index].scalar.width.literalBytes ?? 2;
                const width = name.name === "dp" ? 1 : 2;
                if (preferred === width) {
                    score++;
                }
                else if (syntax.width !== undefined) {
                    return -1;
                }
            }
            return score;
        };
        const pattern = candidates
            .filter((candidate) => widthScore(candidate) >= 0)
            .toSorted((a, b) => widthScore(b) - widthScore(a))
            .at(0);
        if (!pattern) {
            throw frame.error(`${op} has no matching relocatable SPC700 operand form.`);
        }
        const spec = pattern.specification;
        instruction.opcode(spec.opcode[0]);
        let fields = parts
            .map((part, index) => ({ part, expected: pattern.parts[index] }))
            .filter(({ part }) => part.shape?.kind === "immediate" ||
            (part.shape?.kind === "memory" && !("kind" in part.shape.address)));
        // SPC encodes source before destination for its two direct/immediate memory fields.
        if (spec.mode === spc700Modes.dpDp.id || spec.mode === spc700Modes.dpImm.id) {
            fields = fields.toReversed();
        }
        for (const { part, expected } of fields) {
            const shape = part.shape;
            if (shape?.kind === "memory" && shape.bit) {
                const address = frame.compileLink(part.scalar);
                const bit = frame.constant(shape.bit.selector, "Memory bit index");
                if (bit < 0 || bit > 7) {
                    throw frame.error("Memory bit index must be 0..7.");
                }
                const packed = linkBinary("|", linkBinary("&", address, linkConstant(0x1fff)), linkConstant(bit << 13));
                instruction.field(packed, {
                    width: 2,
                    minimum: 0,
                    checks: [{ expression: address, minimum: 0, maximum: 0x1fff }],
                });
                continue;
            }
            const expectedShape = expected.shape;
            let name = "const";
            if (expectedShape?.kind === "memory" &&
                !("kind" in expectedShape.address) &&
                expectedShape.address.expression.type === "identifier") {
                name = expectedShape.address.expression.name;
            }
            const width = name === "addr" ? 2 : 1;
            let kind = "absolute";
            if (name === "label") {
                kind = "relative";
            }
            if (name === "dp") {
                kind = "directPage";
            }
            if (name === "upage") {
                kind = "upperPage";
            }
            instruction.field(part.scalar, {
                width,
                kind,
                signed: name === "label",
                addressWidth: 16,
                wrapWidth: 16,
            });
        }
        const size = instruction.finish(spec.mode);
        if (size !== spec.minimumSize) {
            throw frame.error(`Relocatable ${op} disagrees with the shared opcode size.`);
        }
        return size;
    }
}
/** Match addressing syntax before selecting width; symbol values never choose an object opcode. */
function moduleOperandsMatch(expected, actual) {
    const a = actual.shape;
    const e = expected.shape;
    if (!a || !e || a.kind !== e.kind) {
        return false;
    }
    if (a.kind === "register" && e.kind === "register") {
        return moduleRegister(a.name) === moduleRegister(e.name);
    }
    if (a.kind === "immediate") {
        return true;
    }
    if (a.kind !== "memory" || e.kind !== "memory") {
        return false;
    }
    if (a.delimiter !== e.delimiter ||
        a.index?.register !== e.index?.register ||
        a.index?.position !== e.index?.position ||
        !!a.postIncrement !== !!e.postIncrement ||
        !!a.bit !== !!e.bit) {
        return false;
    }
    if (a.bit && e.bit && a.bit.inverted !== e.bit.inverted) {
        return false;
    }
    if ("kind" in a.address || "kind" in e.address) {
        return "kind" in a.address && "kind" in e.address && a.address.name === e.address.name;
    }
    return true;
}
//# sourceMappingURL=typed-spc700.js.map