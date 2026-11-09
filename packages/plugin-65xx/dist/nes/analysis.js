import { Uint8ArrayDecoderSource } from "@uttori/asm-core";
import { analyzeStaticControlFlow, } from "@uttori/asm-disassembler";
import { Cpu6502Decoder } from "../decoder.js";
import { ricoh2a03Cpu } from "../instructions/opcodes.js";
import { initialNesMapperState, nesExecutionContext, nesPrgOffset, validateNesMapper, writeNesMapper, } from "./mapper.js";
import { matchesNesResearch, nesResearchState } from "./research.js";
/** Empty NES analysis seed: unknown mapper, no banks, no PPU clock. */
export const initialNesAnalysisState = () => ({
    mapper: initialNesMapperState(),
    a: null,
    x: null,
    y: null,
});
const decoder = new Cpu6502Decoder(ricoh2a03Cpu);
/** Decode through each live CPU window; noncontiguous physical fetches remain a conservative analysis boundary. */
export function decodeNesInstruction(rom, address, state) {
    const offsets = [];
    const bytes = [];
    for (let index = 0; index < 3; index++) {
        const offset = nesPrgOffset(rom, (address + index) & 0xffff, state);
        if (offset === undefined) {
            break;
        }
        offsets.push(offset);
        bytes.push(rom.readPrg(offset));
    }
    const result = decoder.decode({
        source: new Uint8ArrayDecoderSource(bytes),
        offset: 0,
        logicalAddress: address,
    });
    return { result, offsets };
}
/** Effective bus location only when the index/indirection is known; unknown stores may change a mapper. */
function effectiveAddress(instruction, state) {
    const value = instruction.operands[0]?.value;
    if (value === undefined || instruction.mode === "immediate") {
        return undefined;
    }
    if (instruction.mode === "absolute" || instruction.mode === "zeroPage") {
        return value;
    }
    if (instruction.mode === "absoluteIndexedX" && state.x !== null) {
        return (value + state.x) & 0xffff;
    }
    if (instruction.mode === "absoluteIndexedY" && state.y !== null) {
        return (value + state.y) & 0xffff;
    }
    if (instruction.mode === "zeroPageIndexedX" && state.x !== null) {
        return (value + state.x) & 255;
    }
    if (instruction.mode === "zeroPageIndexedY" && state.y !== null) {
        return (value + state.y) & 255;
    }
    return undefined;
}
/** Ordered mapper effects use old CPU values; loads and arithmetic update constants only afterward. */
function transferNes(rom, instruction, state) {
    let { a, x, y, mapper } = state;
    const mnemonic = instruction.mnemonic;
    const writes = new Set([
        "STA",
        "STX",
        "STY",
        "SAX",
        "SHA",
        "SHX",
        "SHY",
        "TAS",
        "INC",
        "DEC",
        "ASL",
        "LSR",
        "ROL",
        "ROR",
        "SLO",
        "SRE",
        "RLA",
        "RRA",
        "DCP",
        "ISC",
    ]);
    if (rom.mapper === 4 && instruction.mode !== "accumulator" && writes.has(mnemonic)) {
        const address = effectiveAddress(instruction, state);
        let value = null;
        if (mnemonic === "STA") {
            value = a;
        }
        if (mnemonic === "STX") {
            value = x;
        }
        if (mnemonic === "STY") {
            value = y;
        }
        if (mnemonic === "SAX" && a !== null && x !== null) {
            value = a & x;
        }
        if (address === undefined) {
            // An indirect store could hit either select/data register, so neither bank is still proven.
            mapper = {
                ...mapper,
                select: null,
                prgMode: null,
                chrMode: null,
                banks: mapper.banks.map(() => null),
            };
        }
        else {
            mapper = writeNesMapper(mapper, address, value);
        }
    }
    const immediate = instruction.mode === "immediate" ? (instruction.operands[0]?.value ?? null) : null;
    if (mnemonic === "LDA") {
        a = immediate;
    }
    else if (mnemonic === "LDX") {
        x = immediate;
    }
    else if (mnemonic === "LDY") {
        y = immediate;
    }
    else if (mnemonic === "TAX") {
        x = a;
    }
    else if (mnemonic === "TAY") {
        y = a;
    }
    else if (mnemonic === "TXA") {
        a = x;
    }
    else if (mnemonic === "TYA") {
        a = y;
    }
    else if (mnemonic === "INX") {
        x = x === null ? null : (x + 1) & 255;
    }
    else if (mnemonic === "DEX") {
        x = x === null ? null : (x - 1) & 255;
    }
    else if (mnemonic === "INY") {
        y = y === null ? null : (y + 1) & 255;
    }
    else if (mnemonic === "DEY") {
        y = y === null ? null : (y - 1) & 255;
    }
    else if ([
        "ADC",
        "SBC",
        "AND",
        "ORA",
        "EOR",
        "PLA",
        "LAX",
        "LAS",
        "ANE",
        "ARR",
        "ALR",
        "ANC",
        "SLO",
        "SRE",
        "RLA",
        "RRA",
        "ISC",
    ].includes(mnemonic) ||
        instruction.mode === "accumulator") {
        a = null;
    }
    if (["LAX", "LAS", "TSX", "AXS"].includes(mnemonic)) {
        x = null;
    }
    return { a, x, y, mapper };
}
/** Worklist analysis seeds only justified entries. Unknown banks and indirect RAM pointers stop discovery. */
export function analyzeNes(rom, options = {}) {
    validateNesMapper(rom);
    const seedState = initialNesAnalysisState();
    const seeds = [...(options.seeds ?? [])];
    for (const [name, vector] of [
        ["nmi", 0xfffa],
        ["reset", 0xfffc],
        ["irq", 0xfffe],
    ]) {
        const low = nesPrgOffset(rom, vector, seedState.mapper);
        const address = rom.readPrg(low) | (rom.readPrg(low + 1) << 8);
        seeds.push({
            id: `nes:vector:${name}`,
            kind: "vector",
            address,
            state: seedState,
            evidence: ["nes:analysis"],
            detail: "ares initial mapper profile",
        });
    }
    const instructions = new Map();
    const adapter = {
        backingSize: rom.size - 16,
        executionContextKey: (_address, state) => nesExecutionContext(state.mapper),
        stateKey: (state) => JSON.stringify(state),
        mappingState: (state) => nesResearchState(state.mapper),
        join: (left, right) => ({
            a: left.a === right.a ? left.a : null,
            x: left.x === right.x ? left.x : null,
            y: left.y === right.y ? left.y : null,
            mapper: {
                select: left.mapper.select === right.mapper.select ? left.mapper.select : null,
                prgMode: left.mapper.prgMode === right.mapper.prgMode ? left.mapper.prgMode : null,
                chrMode: left.mapper.chrMode === right.mapper.chrMode ? left.mapper.chrMode : null,
                banks: left.mapper.banks.map((value, index) => value === right.mapper.banks[index] ? value : null),
                ramEnabled: left.mapper.ramEnabled === right.mapper.ramEnabled ? left.mapper.ramEnabled : null,
                ramWritable: left.mapper.ramWritable === right.mapper.ramWritable ? left.mapper.ramWritable : null,
                mirroring: left.mapper.mirroring === right.mapper.mirroring ? left.mapper.mirroring : null,
                irqLatch: left.mapper.irqLatch === right.mapper.irqLatch ? left.mapper.irqLatch : null,
                irqEnabled: left.mapper.irqEnabled === right.mapper.irqEnabled ? left.mapper.irqEnabled : null,
            },
        }),
        decode(address, state) {
            const { result, offsets } = decodeNesInstruction(rom, address, state.mapper);
            if (result.kind !== "instruction") {
                return { kind: "error", reason: "Unmapped or truncated NES instruction fetch." };
            }
            const instruction = result.instruction;
            if (offsets.slice(0, instruction.size).some((offset, index) => offset !== offsets[0] + index)) {
                return {
                    kind: "blocked",
                    reason: "Instruction spans noncontiguous PRG banks; retained as raw bytes.",
                    evidence: ["nes:analysis"],
                };
            }
            // A data range blocks any overlapping operand too; decoding through one byte would invent code.
            const blocked = (options.annotations ?? []).find((annotation) => !["opcode", "operand", "unreached"].includes(annotation.classification) &&
                Array.from({ length: instruction.size }, (_, index) => (address + index) & 0xffff).some((at) => matchesNesResearch(rom, annotation, at, state.mapper)));
            if (blocked) {
                return {
                    kind: "blocked",
                    reason: `Research '${blocked.id}' classifies these bytes as data.`,
                    evidence: blocked.evidence,
                };
            }
            instructions.set(`${address}:${nesExecutionContext(state.mapper)}`, instruction);
            const targets = instruction.references
                .filter((ref) => ref.kind !== "data" && ref.kind !== "pointer")
                .map((ref) => {
                let resolved = ref.address;
                if (ref.indirect && resolved !== undefined) {
                    // NMOS JMP reads the high pointer byte from the same page, including the $xxFF case.
                    const lo = nesPrgOffset(rom, resolved, state.mapper);
                    const hi = nesPrgOffset(rom, (resolved & 0xff00) | ((resolved + 1) & 255), state.mapper);
                    resolved =
                        lo === undefined || hi === undefined
                            ? undefined
                            : rom.readPrg(lo) | (rom.readPrg(hi) << 8);
                }
                return {
                    kind: ref.kind === "call" || ref.kind === "branch" ? ref.kind : "jump",
                    address: resolved,
                    indirect: ref.indirect,
                };
            });
            // Return propagation supplies post-call state. Speculative call fallthrough would retain stale bank values.
            const flow = {
                ...instruction.flow,
                fallthrough: instruction.flow.kind === "call" ? false : instruction.flow.fallthrough,
            };
            return {
                kind: "instruction",
                instruction: {
                    specificationId: instruction.specificationId,
                    address,
                    fileOffset: rom.prg.offset - 16 + offsets[0],
                    size: instruction.size,
                    opcode: instruction.opcode,
                    mnemonic: instruction.mnemonic,
                    mode: instruction.mode,
                    effects: instruction.effects,
                    flow,
                    targets,
                },
            };
        },
        transfer(instruction, state) {
            return transferNes(rom, instructions.get(`${instruction.address}:${nesExecutionContext(state.mapper)}`), state);
        },
    };
    return analyzeStaticControlFlow(adapter, seeds, options);
}
//# sourceMappingURL=analysis.js.map