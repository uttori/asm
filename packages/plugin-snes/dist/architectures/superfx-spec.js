/**
 * Accepts a GSU ALT value. Hardware ALT is a 2-bit field.
 * @param value Candidate ALT state.
 * @returns True when `value` is 0, 1, 2, or 3.
 */
export function isSuperFxAltState(value) {
    return value === 0 || value === 1 || value === 2 || value === 3;
}
/**
 * Maps an operand encoding id to its canonical placeholder syntax string.
 * @param encoding Operand layout id for one GSU effective opcode.
 * @returns Placeholder spelling used in specification summaries.
 */
const syntaxFor = (encoding) => {
    switch (encoding) {
        case "implied":
            return "";
        case "relative":
            return "label";
        case "register":
            return "Rn";
        case "registerIndirect":
            return "(Rn)";
        case "immediateNibble":
            return "#n";
        case "registerImmediate8":
        case "registerImmediate16":
            return "Rn,#imm";
        case "registerRamShort":
            return "Rn,(addr)";
        case "ramShortRegister":
            return "(addr),Rn";
        case "registerRamAbsolute":
            return "Rn,(addr)";
        case "ramAbsoluteRegister":
            return "(addr),Rn";
    }
    throw new Error("Unsupported SuperFX operand encoding.");
};
/** Builds a one-byte implied GSU definition row. */
const implied = (mnemonic, writesDestination = false) => ({
    mnemonic,
    encoding: "implied",
    size: 1,
    ...(writesDestination ? { writesDestination: true } : {}),
});
/** Builds a register-indexed one-byte GSU definition row. */
const register = (mnemonic, value, writesDestination = false) => ({
    mnemonic,
    encoding: "register",
    size: 1,
    register: value,
    ...(writesDestination ? { writesDestination: true } : {}),
});
/** Builds a register-indirect one-byte GSU definition row. */
const registerIndirect = (mnemonic, value, writesDestination = false) => ({
    mnemonic,
    encoding: "registerIndirect",
    size: 1,
    register: value,
    ...(writesDestination ? { writesDestination: true } : {}),
});
/** Builds an immediate-nibble one-byte GSU definition row. */
const nibble = (mnemonic, value, writesDestination = false) => ({
    mnemonic,
    encoding: "immediateNibble",
    size: 1,
    register: value,
    ...(writesDestination ? { writesDestination: true } : {}),
});
/** Resolves the unprefixed GSU mnemonic and operand layout for one opcode byte. */
const baseDefinition = (opcode) => {
    if (opcode === 0x00) {
        return implied("STOP");
    }
    if (opcode === 0x01) {
        return implied("NOP");
    }
    if (opcode === 0x02) {
        return implied("CACHE");
    }
    if (opcode === 0x03) {
        return implied("LSR", true);
    }
    if (opcode === 0x04) {
        return implied("ROL", true);
    }
    const branches = ["BRA", "BGE", "BLT", "BNE", "BEQ", "BPL", "BMI", "BCC", "BCS", "BVC", "BVS"];
    if (opcode >= 0x05 && opcode <= 0x0f) {
        return { mnemonic: branches[opcode - 0x05], encoding: "relative", size: 2 };
    }
    if (opcode >= 0x10 && opcode <= 0x1f) {
        return register("TO", opcode & 0x0f);
    }
    if (opcode >= 0x20 && opcode <= 0x2f) {
        return register("WITH", opcode & 0x0f);
    }
    if (opcode >= 0x30 && opcode <= 0x3b) {
        return registerIndirect("STW", opcode & 0x0f);
    }
    if (opcode === 0x3c) {
        return implied("LOOP");
    }
    if (opcode === 0x3d) {
        return implied("ALT1");
    }
    if (opcode === 0x3e) {
        return implied("ALT2");
    }
    if (opcode === 0x3f) {
        return implied("ALT3");
    }
    if (opcode >= 0x40 && opcode <= 0x4b) {
        return registerIndirect("LDW", opcode & 0x0f, true);
    }
    if (opcode === 0x4c) {
        return implied("PLOT");
    }
    if (opcode === 0x4d) {
        return implied("SWAP", true);
    }
    if (opcode === 0x4e) {
        return implied("COLOR");
    }
    if (opcode === 0x4f) {
        return implied("NOT", true);
    }
    if (opcode >= 0x50 && opcode <= 0x5f) {
        return register("ADD", opcode & 0x0f, true);
    }
    if (opcode >= 0x60 && opcode <= 0x6f) {
        return register("SUB", opcode & 0x0f, true);
    }
    if (opcode === 0x70) {
        return implied("MERGE", true);
    }
    if (opcode >= 0x71 && opcode <= 0x7f) {
        return register("AND", opcode & 0x0f, true);
    }
    if (opcode >= 0x80 && opcode <= 0x8f) {
        return register("MULT", opcode & 0x0f, true);
    }
    if (opcode === 0x90) {
        return implied("SBK");
    }
    if (opcode >= 0x91 && opcode <= 0x94) {
        return nibble("LINK", opcode & 0x0f);
    }
    if (opcode === 0x95) {
        return implied("SEX", true);
    }
    if (opcode === 0x96) {
        return implied("ASR", true);
    }
    if (opcode === 0x97) {
        return implied("ROR", true);
    }
    if (opcode >= 0x98 && opcode <= 0x9d) {
        return register("JMP", opcode & 0x0f);
    }
    if (opcode === 0x9e) {
        return implied("LOB", true);
    }
    if (opcode === 0x9f) {
        return implied("FMULT", true);
    }
    if (opcode >= 0xa0 && opcode <= 0xaf) {
        return {
            mnemonic: "IBT",
            encoding: "registerImmediate8",
            size: 2,
            register: opcode & 0x0f,
        };
    }
    if (opcode >= 0xb0 && opcode <= 0xbf) {
        return register("FROM", opcode & 0x0f);
    }
    if (opcode === 0xc0) {
        return implied("HIB", true);
    }
    if (opcode >= 0xc1 && opcode <= 0xcf) {
        return register("OR", opcode & 0x0f, true);
    }
    if (opcode >= 0xd0 && opcode <= 0xde) {
        return register("INC", opcode & 0x0f);
    }
    if (opcode === 0xdf) {
        return implied("GETC");
    }
    if (opcode >= 0xe0 && opcode <= 0xee) {
        return register("DEC", opcode & 0x0f);
    }
    if (opcode === 0xef) {
        return implied("GETB", true);
    }
    return {
        mnemonic: "IWT",
        encoding: "registerImmediate16",
        size: 3,
        register: opcode & 0x0f,
    };
};
/** Applies ALT1–ALT3 remapping on top of the unprefixed opcode interpretation. */
const altDefinition = (alt, opcode) => {
    if (alt === 0) {
        return baseDefinition(opcode);
    }
    const low = opcode & 0x0f;
    if (alt === 1) {
        if (opcode >= 0x30 && opcode <= 0x3b) {
            return registerIndirect("STB", low);
        }
        if (opcode >= 0x40 && opcode <= 0x4b) {
            return registerIndirect("LDB", low, true);
        }
        if (opcode === 0x4c) {
            return implied("RPIX", true);
        }
        if (opcode === 0x4e) {
            return implied("CMODE");
        }
        if (opcode >= 0x50 && opcode <= 0x5f) {
            return register("ADC", low, true);
        }
        if (opcode >= 0x60 && opcode <= 0x6f) {
            return register("SBC", low, true);
        }
        if (opcode >= 0x71 && opcode <= 0x7f) {
            return register("BIC", low, true);
        }
        if (opcode >= 0x80 && opcode <= 0x8f) {
            return register("UMULT", low, true);
        }
        if (opcode === 0x96) {
            return implied("DIV2", true);
        }
        if (opcode >= 0x98 && opcode <= 0x9d) {
            return register("LJMP", low);
        }
        if (opcode === 0x9f) {
            return implied("LMULT", true);
        }
        if (opcode >= 0xa0 && opcode <= 0xaf) {
            return {
                mnemonic: "LMS",
                encoding: "registerRamShort",
                size: 2,
                register: low,
            };
        }
        if (opcode >= 0xc1 && opcode <= 0xcf) {
            return register("XOR", low, true);
        }
        if (opcode === 0xef) {
            return implied("GETBH", true);
        }
        if (opcode >= 0xf0) {
            return {
                mnemonic: "LM",
                encoding: "registerRamAbsolute",
                size: 3,
                register: low,
            };
        }
    }
    if (alt === 2) {
        if (opcode >= 0x50 && opcode <= 0x5f) {
            return nibble("ADD", low, true);
        }
        if (opcode >= 0x60 && opcode <= 0x6f) {
            return nibble("SUB", low, true);
        }
        if (opcode >= 0x71 && opcode <= 0x7f) {
            return nibble("AND", low, true);
        }
        if (opcode >= 0x80 && opcode <= 0x8f) {
            return nibble("MULT", low, true);
        }
        if (opcode >= 0xa0 && opcode <= 0xaf) {
            return {
                mnemonic: "SMS",
                encoding: "ramShortRegister",
                size: 2,
                register: low,
            };
        }
        if (opcode >= 0xc1 && opcode <= 0xcf) {
            return nibble("OR", low, true);
        }
        if (opcode === 0xdf) {
            return implied("RAMB");
        }
        if (opcode === 0xef) {
            return implied("GETBL", true);
        }
        if (opcode >= 0xf0) {
            return {
                mnemonic: "SM",
                encoding: "ramAbsoluteRegister",
                size: 3,
                register: low,
            };
        }
    }
    if (alt === 3) {
        if (opcode >= 0x50 && opcode <= 0x5f) {
            return nibble("ADC", low, true);
        }
        if (opcode >= 0x60 && opcode <= 0x6f) {
            return register("CMP", low);
        }
        if (opcode >= 0x71 && opcode <= 0x7f) {
            return nibble("BIC", low, true);
        }
        if (opcode >= 0x80 && opcode <= 0x8f) {
            return nibble("UMULT", low, true);
        }
        if (opcode >= 0xc1 && opcode <= 0xcf) {
            return nibble("XOR", low, true);
        }
        if (opcode === 0xdf) {
            return implied("ROMB");
        }
        if (opcode === 0xef) {
            return implied("GETBS", true);
        }
    }
    return baseDefinition(opcode);
};
/** Derives control-flow metadata from a resolved GSU definition row. */
const flowFor = (definition, opcode) => {
    if (definition.mnemonic === "STOP") {
        return { kind: "stop", fallthrough: false };
    }
    if (definition.mnemonic === "BRA") {
        return { kind: "jump", fallthrough: false };
    }
    if (opcode >= 0x06 && opcode <= 0x0f) {
        return { kind: "conditionalBranch", fallthrough: true };
    }
    if (definition.mnemonic === "LOOP") {
        return { kind: "conditionalBranch", fallthrough: true, indirect: true };
    }
    if (definition.mnemonic === "JMP" || definition.mnemonic === "LJMP") {
        return { kind: "jump", fallthrough: false, indirect: true };
    }
    return { kind: "fallthrough", fallthrough: true };
};
/** Lists custom GSU state transitions such as ALT selection and register binding. */
const effectsFor = (definition) => {
    if (definition.mnemonic === "ALT1" ||
        definition.mnemonic === "ALT2" ||
        definition.mnemonic === "ALT3") {
        return [
            {
                kind: "custom",
                name: "set-superfx-alt",
                details: { alt: Number(definition.mnemonic.at(-1)) },
            },
        ];
    }
    if (definition.mnemonic === "TO") {
        return [
            {
                kind: "custom",
                name: "select-superfx-destination",
                details: { register: definition.register },
            },
        ];
    }
    if (definition.mnemonic === "WITH") {
        return [
            {
                kind: "custom",
                name: "select-superfx-source-destination",
                details: { register: definition.register },
            },
        ];
    }
    if (definition.mnemonic === "FROM") {
        return [
            { kind: "custom", name: "select-superfx-source", details: { register: definition.register } },
        ];
    }
    return [];
};
/** Human-readable summary line for hover and catalog tooling. */
const summaryFor = (mnemonic) => {
    const summaries = {
        STOP: "Stop the GSU.",
        NOP: "No operation.",
        CACHE: "Set the cache base register.",
        BRA: "Branch always.",
        BGE: "Branch if greater or equal.",
        BLT: "Branch if less than.",
        BNE: "Branch if not equal.",
        BEQ: "Branch if equal.",
        BPL: "Branch if plus.",
        BMI: "Branch if minus.",
        BCC: "Branch if carry clear.",
        BCS: "Branch if carry set.",
        BVC: "Branch if overflow clear.",
        BVS: "Branch if overflow set.",
        JMP: "Jump through a register.",
        LJMP: "Long jump through a register.",
        IWT: "Load a register with a word.",
        IBT: "Load a register with a signed byte.",
        LM: "Load a register from RAM.",
        LMS: "Load a register from short RAM.",
        SM: "Store a register to RAM.",
        SMS: "Store a register to short RAM.",
    };
    return summaries[mnemonic] ?? `${mnemonic} instruction.`;
};
/** Materializes one frozen architecture specification for an ALT state and opcode byte. */
const specification = (alt, opcode) => {
    const definition = altDefinition(alt, opcode);
    const base = baseDefinition(opcode);
    const alteredByAlt = alt !== 0 && (definition.mnemonic !== base.mnemonic || definition.encoding !== base.encoding);
    return Object.freeze({
        id: `snes.superfx.alt${alt}.${opcode.toString(16).padStart(2, "0")}`,
        architecture: "snes.superfx",
        opcode: [opcode],
        mnemonic: definition.mnemonic,
        mode: definition.encoding,
        syntax: syntaxFor(definition.encoding),
        operandEncoding: definition.encoding,
        minimumSize: definition.size,
        maximumSize: definition.size,
        alt,
        ...(definition.register === undefined ? {} : { register: definition.register }),
        summary: summaryFor(definition.mnemonic),
        flow: flowFor(definition, opcode),
        effects: effectsFor(definition),
        ...(definition.writesDestination ? { writesDestination: true } : {}),
        alteredByAlt,
    });
};
/** Complete four-state effective opcode matrix: `[alt][opcode]`. */
export const superFxOpcodeMatrix = Object.freeze([0, 1, 2, 3].map((alt) => Object.freeze(Array.from({ length: 256 }, (_, opcode) => specification(alt, opcode)))));
/** Unprefixed 256-byte opcode table. */
export const superFxBaseSpecifications = superFxOpcodeMatrix[0];
/** Canonical unprefixed and ALT-altered forms accepted by the native encoder. */
export const superFxSpecifications = Object.freeze([
    ...superFxBaseSpecifications,
    ...superFxOpcodeMatrix.slice(1).flatMap((row) => row.filter((entry) => entry.alteredByAlt)),
]);
/** Control flow when a fused MOVE targets the program counter register R15. */
const fusedFlow = (destinationRegister) => destinationRegister === 15
    ? { kind: "jump", fallthrough: false, indirect: true }
    : { kind: "fallthrough", fallthrough: true };
/** Placeholder operand spelling for a fused MOVE addressing mode. */
const fusedSyntax = (mode) => {
    if (mode === "registerRegister") {
        return "Rn,Rm";
    }
    if (mode === "registerRegisterIndirect") {
        return "Rn,(Rm)";
    }
    return "(Rn),Rm";
};
/** Builds one frozen fused-instruction specification for the opcode matrix export. */
const fused = (mnemonic, opcode, mode, destinationRegister, sourceRegister, pointerRegister) => Object.freeze({
    id: `snes.superfx.fused.${opcode.map((value) => value.toString(16).padStart(2, "0")).join("-")}`,
    architecture: "snes.superfx",
    opcode,
    mnemonic,
    mode,
    syntax: fusedSyntax(mode),
    minimumSize: opcode.length,
    maximumSize: opcode.length,
    destinationRegister,
    ...(sourceRegister === undefined ? {} : { sourceRegister }),
    ...(pointerRegister === undefined ? {} : { pointerRegister }),
    summary: `${mnemonic} fused selector form.`,
    flow: fusedFlow(destinationRegister),
    effects: [],
});
/** Every canonical selector fusion emitted by MOVE/MOVES/MOVEB/MOVEW. */
export const superFxFusedSpecifications = Object.freeze([
    ...Array.from({ length: 16 }, (_, source) => Array.from({ length: 16 }, (_item, destination) => fused("MOVE", [0x20 + source, 0x10 + destination], "registerRegister", destination, source))).flat(),
    ...Array.from({ length: 16 }, (_, destination) => Array.from({ length: 16 }, (_item, source) => fused("MOVES", [0x20 + destination, 0xb0 + source], "registerRegister", destination, source))).flat(),
    ...Array.from({ length: 15 }, (_, index) => index + 1).flatMap((destination) => Array.from({ length: 12 }, (_, pointer) => [
        fused("MOVEW", [0x10 + destination, 0x40 + pointer], "registerRegisterIndirect", destination, undefined, pointer),
        fused("MOVEB", [0x10 + destination, 0x3d, 0x40 + pointer], "registerRegisterIndirect", destination, undefined, pointer),
    ]).flat()),
    ...Array.from({ length: 15 }, (_, index) => index + 1).flatMap((source) => Array.from({ length: 12 }, (_, pointer) => [
        fused("MOVEW", [0xb0 + source, 0x30 + pointer], "registerIndirectRegister", 0, source, pointer),
        fused("MOVEB", [0xb0 + source, 0x3d, 0x30 + pointer], "registerIndirectRegister", 0, source, pointer),
    ]).flat()),
]);
/**
 * Generates the editor catalog from the effective opcode matrix.
 * @returns Native SuperFX instruction descriptors.
 */
export function buildSuperFxCatalog() {
    const grouped = new Map();
    for (const entry of superFxSpecifications) {
        const mode = {
            mode: entry.mode,
            syntax: entry.syntax,
            opcode: entry.opcode[0],
            size: entry.minimumSize + (entry.alt === 0 ? 0 : 1),
        };
        const existing = grouped.get(entry.mnemonic);
        if (existing) {
            if (!existing.modes.some((value) => JSON.stringify(value) === JSON.stringify(mode))) {
                existing.modes.push(mode);
            }
        }
        else {
            grouped.set(entry.mnemonic, {
                mnemonic: entry.mnemonic,
                summary: entry.summary ?? `${entry.mnemonic} instruction.`,
                modes: [mode],
            });
        }
    }
    const conveniences = [
        {
            mnemonic: "LEA",
            summary: "Load a register with an effective address.",
            modes: [{ mode: "registerAbsolute", syntax: "Rn,addr", size: 3 }],
        },
        {
            mnemonic: "MOVE",
            summary: "Move register, immediate, or RAM data.",
            modes: [
                { mode: "registerRegister", syntax: "Rn,Rm", size: 2 },
                { mode: "registerImmediate", syntax: "Rn,#imm" },
                { mode: "registerRam", syntax: "Rn,(addr)" },
                { mode: "ramRegister", syntax: "(addr),Rn" },
            ],
        },
        {
            mnemonic: "MOVES",
            summary: "Move a register and update flags.",
            modes: [{ mode: "registerRegister", syntax: "Rn,Rm", size: 2 }],
        },
        {
            mnemonic: "MOVEB",
            summary: "Move a byte through a register pointer.",
            modes: [
                { mode: "registerIndirect", syntax: "Rn,(Rm)" },
                { mode: "indirectRegister", syntax: "(Rn),Rm" },
            ],
        },
        {
            mnemonic: "MOVEW",
            summary: "Move a word through a register pointer.",
            modes: [
                { mode: "registerIndirect", syntax: "Rn,(Rm)" },
                { mode: "indirectRegister", syntax: "(Rn),Rm" },
            ],
        },
    ];
    for (const entry of conveniences) {
        grouped.set(entry.mnemonic, entry);
    }
    return [...grouped.values()].toSorted((left, right) => left.mnemonic.localeCompare(right.mnemonic));
}
//# sourceMappingURL=superfx-spec.js.map