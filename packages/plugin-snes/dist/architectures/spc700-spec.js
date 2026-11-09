/**
 * Builds a fixed-size SPC700 mode definition.
 * @param id Stable addressing mode id.
 * @param syntax Operand placeholder spelling.
 * @param size Encoded instruction size in bytes.
 * @returns Mode definition consumed by the opcode matrix.
 */
const mode = (id, syntax, size) => ({
    id,
    syntax,
    size,
});
/**
 * Native-source operand forms used by the opcode matrix. Names describe both
 * operand order and encoded width so decoding never guesses direct vs absolute.
 */
export const spc700Modes = Object.freeze({
    imp: mode("implied", "", 1),
    tc: mode("tableCall", "n", 1),
    dpBit: mode("directBit", "dp", 2),
    dpBitRel: mode("directBitRelative", "dp,label", 3),
    aDp: mode("accumulatorDirect", "A,dp", 2),
    aAbs: mode("accumulatorAbsolute", "A,addr", 3),
    aIndX: mode("accumulatorIndirectX", "A,(X)", 1),
    aDpxi: mode("accumulatorDirectIndexedXIndirect", "A,(dp+X)", 2),
    aImm: mode("accumulatorImmediate", "A,#const", 2),
    dpDp: mode("directDirect", "dp,dp", 3),
    cBit: mode("carryMemoryBit", "C,addr.bit", 3),
    cBitInv: mode("carryInvertedMemoryBit", "C,/addr.bit", 3),
    bitC: mode("memoryBitCarry", "addr.bit,C", 3),
    bit: mode("memoryBit", "addr.bit", 3),
    dp: mode("direct", "dp", 2),
    dpx: mode("directIndexedX", "dp+X", 2),
    abs: mode("absolute", "addr", 3),
    rel: mode("relative", "label", 2),
    absA: mode("absoluteAccumulator", "addr,A", 3),
    aDpx: mode("accumulatorDirectIndexedX", "A,dp+X", 2),
    aAbx: mode("accumulatorAbsoluteIndexedX", "A,addr+X", 3),
    aAby: mode("accumulatorAbsoluteIndexedY", "A,addr+Y", 3),
    aDpiy: mode("accumulatorDirectIndirectIndexedY", "A,(dp)+Y", 2),
    dpImm: mode("directImmediate", "dp,#const", 3),
    xy: mode("indirectXY", "(X),(Y)", 1),
    dpWord: mode("directWord", "dp", 2),
    regA: mode("registerA", "A", 1),
    regX: mode("registerX", "X", 1),
    regY: mode("registerY", "Y", 1),
    regP: mode("registerP", "P", 1),
    regYA: mode("registerYA", "YA", 1),
    regYAX: mode("registerYAX", "YA,X", 1),
    regXA: mode("registerXA", "X,A", 1),
    regAX: mode("registerAX", "A,X", 1),
    regXSP: mode("registerXSP", "X,SP", 1),
    regSPX: mode("registerSPX", "SP,X", 1),
    regAY: mode("registerAY", "A,Y", 1),
    regYA2: mode("registerYA2", "Y,A", 1),
    regPostXA: mode("registerPostIncrementXA", "(X+),A", 1),
    regAPostX: mode("registerAPostIncrementX", "A,(X+)", 1),
    regIndXA: mode("registerIndirectXA", "(X),A", 1),
    regAIndX: mode("registerAIndirectX", "A,(X)", 1),
    xAbs: mode("registerXAbsolute", "X,addr", 3),
    xDp: mode("registerXDirect", "X,dp", 2),
    xDpy: mode("registerXDirectIndexedY", "X,dp+Y", 2),
    yAbs: mode("registerYAbsolute", "Y,addr", 3),
    yDp: mode("registerYDirect", "Y,dp", 2),
    yDpx: mode("registerYDirectIndexedX", "Y,dp+X", 2),
    xImm: mode("registerXImmediate", "X,#const", 2),
    yImm: mode("registerYImmediate", "Y,#const", 2),
    jmpAbx: mode("absoluteIndexedXIndirect", "(addr+X)", 3),
    dpRel: mode("directRelative", "dp,label", 3),
    dpxRel: mode("directIndexedXRelative", "dp+X,label", 3),
    yRel: mode("registerYRelative", "Y,label", 2),
    yaDp: mode("registerYADirect", "YA,dp", 2),
    dpYa: mode("directRegisterYA", "dp,YA", 2),
    pcall: mode("upperPageCall", "upage", 2),
    dpA: mode("directRegisterA", "dp,A", 2),
    absRegA: mode("absoluteRegisterA", "addr,A", 3),
    indXA: mode("indirectXRegisterA", "(X),A", 1),
    dpxiA: mode("directIndexedXIndirectRegisterA", "(dp+X),A", 2),
    dpxA: mode("directIndexedXRegisterA", "dp+X,A", 2),
    abxA: mode("absoluteIndexedXRegisterA", "addr+X,A", 3),
    abyA: mode("absoluteIndexedYRegisterA", "addr+Y,A", 3),
    dpiyA: mode("directIndirectIndexedYRegisterA", "(dp)+Y,A", 2),
    dpX: mode("directRegisterX", "dp,X", 2),
    dpyX: mode("directIndexedYRegisterX", "dp+Y,X", 2),
    absX: mode("absoluteRegisterX", "addr,X", 3),
    dpY: mode("directRegisterY", "dp,Y", 2),
    dpxY: mode("directIndexedXRegisterY", "dp+X,Y", 2),
    absY: mode("absoluteRegisterY", "addr,Y", 3),
});
/**
 * Narrows a string to a known SPC700 mode table key.
 * @param value Candidate mode key from an opcode row cell.
 * @returns True when `value` names a mode in spc700Modes.
 */
function isSpc700ModeKey(value) {
    return Object.hasOwn(spc700Modes, value);
}
/** Opcode matrix rows transcribed from the SPC700 appendix table. */
const opcodeRows = [
    "NOP:imp TCALL:tc SET0:dpBit BBS0:dpBitRel OR:aDp OR:aAbs OR:aIndX OR:aDpxi OR:aImm OR:dpDp OR1:cBit ASL:dp ASL:abs PUSH:regP TSET:absA BRK:imp",
    "BPL:rel TCALL:tc CLR0:dpBit BBC0:dpBitRel OR:aDpx OR:aAbx OR:aAby OR:aDpiy OR:dpImm OR:xy DECW:dpWord ASL:dpx ASL:regA DEC:regX CMP:xAbs JMP:jmpAbx",
    "CLRP:imp TCALL:tc SET1:dpBit BBS1:dpBitRel AND:aDp AND:aAbs AND:aIndX AND:aDpxi AND:aImm AND:dpDp OR1:cBitInv ROL:dp ROL:abs PUSH:regA CBNE:dpRel BRA:rel",
    "BMI:rel TCALL:tc CLR1:dpBit BBC1:dpBitRel AND:aDpx AND:aAbx AND:aAby AND:aDpiy AND:dpImm AND:xy INCW:dpWord ROL:dpx ROL:regA INC:regX CMP:xDp CALL:abs",
    "SETP:imp TCALL:tc SET2:dpBit BBS2:dpBitRel EOR:aDp EOR:aAbs EOR:aIndX EOR:aDpxi EOR:aImm EOR:dpDp AND1:cBit LSR:dp LSR:abs PUSH:regX TCLR:absA PCALL:pcall",
    "BVC:rel TCALL:tc CLR2:dpBit BBC2:dpBitRel EOR:aDpx EOR:aAbx EOR:aAby EOR:aDpiy EOR:dpImm EOR:xy CMPW:yaDp LSR:dpx LSR:regA MOV:regXA CMP:yAbs JMP:abs",
    "CLRC:imp TCALL:tc SET3:dpBit BBS3:dpBitRel CMP:aDp CMP:aAbs CMP:aIndX CMP:aDpxi CMP:aImm CMP:dpDp AND1:cBitInv ROR:dp ROR:abs PUSH:regY DBNZ:dpRel RET:imp",
    "BVS:rel TCALL:tc CLR3:dpBit BBC3:dpBitRel CMP:aDpx CMP:aAbx CMP:aAby CMP:aDpiy CMP:dpImm CMP:xy ADDW:yaDp ROR:dpx ROR:regA MOV:regAX CMP:yDp RETI:imp",
    "SETC:imp TCALL:tc SET4:dpBit BBS4:dpBitRel ADC:aDp ADC:aAbs ADC:aIndX ADC:aDpxi ADC:aImm ADC:dpDp EOR1:cBit DEC:dp DEC:abs MOV:yImm POP:regP MOV:dpImm",
    "BCC:rel TCALL:tc CLR4:dpBit BBC4:dpBitRel ADC:aDpx ADC:aAbx ADC:aAby ADC:aDpiy ADC:dpImm ADC:xy SUBW:yaDp DEC:dpx DEC:regA MOV:regXSP DIV:regYAX XCN:regA",
    "EI:imp TCALL:tc SET5:dpBit BBS5:dpBitRel SBC:aDp SBC:aAbs SBC:aIndX SBC:aDpxi SBC:aImm SBC:dpDp MOV1:cBit INC:dp INC:abs CMP:yImm POP:regA MOV:regPostXA",
    "BCS:rel TCALL:tc CLR5:dpBit BBC5:dpBitRel SBC:aDpx SBC:aAbx SBC:aAby SBC:aDpiy SBC:dpImm SBC:xy MOVW:yaDp INC:dpx INC:regA MOV:regSPX DAS:regA MOV:regAPostX",
    "DI:imp TCALL:tc SET6:dpBit BBS6:dpBitRel MOV:dpA MOV:absRegA MOV:indXA MOV:dpxiA CMP:xImm MOV:absX MOV1:bitC MOV:dpY MOV:absY MOV:xImm POP:regX MUL:regYA",
    "BNE:rel TCALL:tc CLR6:dpBit BBC6:dpBitRel MOV:dpxA MOV:abxA MOV:abyA MOV:dpiyA MOV:dpX MOV:dpyX MOVW:dpYa MOV:dpxY DEC:regY MOV:regAY CBNE:dpxRel DAA:regA",
    "CLRV:imp TCALL:tc SET7:dpBit BBS7:dpBitRel MOV:aDp MOV:aAbs MOV:regAIndX MOV:aDpxi MOV:aImm MOV:xAbs NOT1:bit MOV:yDp MOV:yAbs NOTC:imp POP:regY SLEEP:imp",
    "BEQ:rel TCALL:tc CLR7:dpBit BBC7:dpBitRel MOV:aDpx MOV:aAbx MOV:aAby MOV:aDpiy MOV:xDp MOV:xDpy MOV:dpDp MOV:yDpx INC:regY MOV:regYA2 DBNZ:yRel STOP:imp",
];
const summaries = {
    ADC: "Add with carry.",
    ADDW: "Add a direct-page word to YA.",
    AND: "Bitwise AND.",
    AND1: "AND carry with a memory bit.",
    ASL: "Arithmetic shift left.",
    BBC0: "Branch if direct-page bit 0 is clear.",
    BBS0: "Branch if direct-page bit 0 is set.",
    BRA: "Branch always.",
    BRK: "Software interrupt.",
    CALL: "Call an absolute subroutine.",
    CBNE: "Compare accumulator and branch if not equal.",
    CLR0: "Clear direct-page bit 0.",
    CLRC: "Clear carry.",
    CLRP: "Select direct page zero.",
    CLRV: "Clear overflow and half-carry.",
    CMP: "Compare values.",
    CMPW: "Compare YA with a direct-page word.",
    DAA: "Decimal-adjust accumulator after addition.",
    DAS: "Decimal-adjust accumulator after subtraction.",
    DBNZ: "Decrement and branch if not zero.",
    DEC: "Decrement.",
    DECW: "Decrement a direct-page word.",
    DI: "Disable interrupts.",
    DIV: "Divide YA by X.",
    EI: "Enable interrupts.",
    EOR: "Bitwise exclusive OR.",
    EOR1: "Exclusive-OR carry with a memory bit.",
    INC: "Increment.",
    INCW: "Increment a direct-page word.",
    JMP: "Jump.",
    LSR: "Logical shift right.",
    MOV: "Move data between registers and memory.",
    MOV1: "Move a memory bit to or from carry.",
    MOVW: "Move a direct-page word to or from YA.",
    MUL: "Multiply Y by A into YA.",
    NOP: "No operation.",
    NOT1: "Invert a memory bit.",
    NOTC: "Invert carry.",
    OR: "Bitwise OR.",
    OR1: "OR carry with a memory bit.",
    PCALL: "Call within the upper page.",
    POP: "Pop a register from the stack.",
    PUSH: "Push a register onto the stack.",
    RET: "Return from subroutine.",
    RETI: "Return from interrupt.",
    ROL: "Rotate left through carry.",
    ROR: "Rotate right through carry.",
    SBC: "Subtract with borrow.",
    SET0: "Set direct-page bit 0.",
    SETC: "Set carry.",
    SETP: "Select direct page one.",
    SLEEP: "Wait for an interrupt.",
    STOP: "Stop the processor.",
    SUBW: "Subtract a direct-page word from YA.",
    TCALL: "Call through a fixed vector table entry.",
    TCLR: "Test and clear accumulator bits in memory.",
    TSET: "Test and set accumulator bits in memory.",
    XCN: "Exchange accumulator nibbles.",
};
/** Conditional branch mnemonics whose opcode does not encode a bit number. */
export const spc700ConditionalBranches = new Set([
    "BCC",
    "BCS",
    "BEQ",
    "BMI",
    "BNE",
    "BPL",
    "BVC",
    "BVS",
    "CBNE",
    "DBNZ",
]);
/**
 * Derives control-flow metadata from mnemonic and addressing mode ids.
 * @param mnemonic Uppercased instruction mnemonic.
 * @param addressingMode Stable mode id from the opcode matrix.
 * @returns Flow descriptor for decode and analysis consumers.
 */
const flowFor = (mnemonic, addressingMode) => {
    if (spc700ConditionalBranches.has(mnemonic) ||
        mnemonic.startsWith("BBS") ||
        mnemonic.startsWith("BBC")) {
        return { kind: "conditionalBranch", fallthrough: true };
    }
    if (mnemonic === "BRA") {
        return { kind: "jump", fallthrough: false };
    }
    if (mnemonic === "JMP") {
        return {
            kind: "jump",
            fallthrough: false,
            ...(addressingMode === "absoluteIndexedXIndirect" ? { indirect: true } : {}),
        };
    }
    if (mnemonic === "CALL" || mnemonic === "PCALL" || mnemonic === "TCALL") {
        return {
            kind: "call",
            fallthrough: true,
            ...(mnemonic === "TCALL" ? { indirect: true } : {}),
        };
    }
    if (mnemonic === "RET" || mnemonic === "RETI") {
        return { kind: "return", fallthrough: false };
    }
    if (mnemonic === "BRK") {
        return { kind: "interrupt", fallthrough: false };
    }
    if (mnemonic === "SLEEP") {
        return { kind: "wait", fallthrough: false };
    }
    if (mnemonic === "STOP") {
        return { kind: "stop", fallthrough: false };
    }
    return { kind: "fallthrough", fallthrough: true };
};
const effects = {
    CLRC: [{ kind: "clearBits", target: "p", mask: 0x01 }],
    SETC: [{ kind: "setBits", target: "p", mask: 0x01 }],
    DI: [{ kind: "clearBits", target: "p", mask: 0x04 }],
    EI: [{ kind: "setBits", target: "p", mask: 0x04 }],
    CLRP: [{ kind: "clearBits", target: "p", mask: 0x20 }],
    SETP: [{ kind: "setBits", target: "p", mask: 0x20 }],
    CLRV: [{ kind: "clearBits", target: "p", mask: 0x48 }],
    NOTC: [{ kind: "custom", name: "invert-status-bit", details: { target: "p", mask: 1 } }],
    PUSH: [{ kind: "push", source: "operand-register" }],
    POP: [{ kind: "pull", target: "operand-register" }],
    RET: [{ kind: "pull", target: "pc" }],
    RETI: [
        { kind: "pull", target: "p" },
        { kind: "pull", target: "pc" },
    ],
};
const entries = opcodeRows.flatMap((row) => row.split(" "));
if (entries.length !== 256) {
    throw new Error(`SPC700 opcode table has ${entries.length} entries.`);
}
/** Complete fixed-width SPC700 opcode specification, indexed by opcode byte. */
export const spc700Specifications = Object.freeze(entries.map((entry, opcode) => {
    const [mnemonic, modeKeyText] = entry.split(":");
    if (!mnemonic || !isSpc700ModeKey(modeKeyText)) {
        throw new Error(`Invalid SPC700 opcode entry '${entry}'.`);
    }
    const definition = spc700Modes[modeKeyText];
    const summaryKey = mnemonic.replace(/[0-7]$/, "0");
    return Object.freeze({
        id: `snes.spc700.${opcode.toString(16).padStart(2, "0")}`,
        architecture: "snes.spc700",
        opcode: [opcode],
        mnemonic,
        mode: definition.id,
        syntax: definition.syntax,
        minimumSize: definition.size,
        maximumSize: definition.size,
        summary: summaries[mnemonic] ?? summaries[summaryKey] ?? `${mnemonic} instruction.`,
        flow: flowFor(mnemonic, definition.id),
        effects: effects[mnemonic] ?? [],
    });
}));
/**
 * Generates editor hover/completion data from the decoder's opcode authority.
 * @returns Alphabetized SPC700 instruction descriptors.
 */
export function buildSpc700Catalog() {
    const grouped = new Map();
    for (const specification of spc700Specifications) {
        const addressingMode = {
            mode: specification.mode,
            syntax: specification.syntax,
            opcode: specification.opcode[0],
            size: specification.minimumSize,
        };
        const descriptor = grouped.get(specification.mnemonic);
        if (descriptor) {
            descriptor.modes.push(addressingMode);
        }
        else {
            grouped.set(specification.mnemonic, {
                mnemonic: specification.mnemonic,
                summary: specification.summary,
                modes: [addressingMode],
            });
        }
    }
    return [...grouped.values()].toSorted((left, right) => left.mnemonic.localeCompare(right.mnemonic));
}
//# sourceMappingURL=spc700-spec.js.map