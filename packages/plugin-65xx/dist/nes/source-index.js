import { HalfOpenIntervalIndex, } from "@uttori/asm-disassembler";
import { nesPrgOffset } from "./mapper.js";
import { matchesNesResearch, nesStoredMapper } from "./research.js";
/** Preserve input order and every execution context at a shared coordinate. */
function append(index, key, value) {
    const entries = index.get(key);
    if (entries) {
        entries.push(value);
    }
    else {
        index.set(key, [value]);
    }
}
/** One export's physical intervals and mapping-qualified research candidates; never retained across exports. */
export class NesSourceIndex {
    /** Headerless cartridge-file intervals; overlapping execution contexts remain separate candidates. */
    physical;
    #cpuNodes = new Map();
    #mappedNodes = new Map();
    #cpuLabels = new Map();
    #fileLabels = new Map();
    #rom;
    /** Research-free exports avoid mapper work used solely to qualify research coordinates. */
    constructor(rom, nodes, labels, hasResearch) {
        this.#rom = rom;
        this.physical = new HalfOpenIntervalIndex(nodes.flatMap((node) => node.fileOffset === undefined
            ? []
            : [{ start: node.fileOffset, end: node.fileOffset + node.size, node }]));
        for (const node of nodes) {
            append(this.#cpuNodes, node.address, node);
            if (hasResearch) {
                // Research matches the mapped CPU fetch, which may differ from a stored candidate's offset.
                // Using the candidate offset here would change alias and malformed-evidence behavior.
                const prg = nesPrgOffset(rom, node.address, nesStoredMapper(node.incomingState));
                if (prg !== undefined) {
                    append(this.#mappedNodes, rom.prg.offset - 16 + prg, node);
                }
            }
        }
        for (const [order, label] of labels.entries()) {
            if (label.suppressed) {
                continue;
            }
            if (label.addressSpace === "nes.cpu") {
                append(this.#cpuLabels, label.address, { label, order });
            }
            if (label.addressSpace === "nes.file") {
                append(this.#fileLabels, label.address, { label, order });
            }
        }
    }
    /** Exact predicates still decide mapping selectors after the coordinate index narrows the search. */
    nodes(record) {
        let candidates = [];
        if (record.addressSpace === "nes.cpu") {
            candidates = this.#cpuNodes.get(record.address) ?? [];
        }
        if (record.addressSpace === "nes.file") {
            candidates = this.#mappedNodes.get(record.address) ?? [];
        }
        return candidates.filter((node) => matchesNesResearch(this.#rom, record, node.address, nesStoredMapper(node.incomingState)));
    }
    /** CPU and physical aliases compete in original declaration order; duplicate names stay ambiguous. */
    labels(address, mapper) {
        const prg = nesPrgOffset(this.#rom, address, mapper);
        const physical = prg === undefined ? [] : (this.#fileLabels.get(this.#rom.prg.offset - 16 + prg) ?? []);
        return [...(this.#cpuLabels.get(address) ?? []), ...physical]
            .toSorted((a, b) => a.order - b.order)
            .filter(({ label }) => matchesNesResearch(this.#rom, label, address, mapper))
            .map(({ label }) => label);
    }
}
/** Indexed overlap candidates retain all contexts while identical boundaries remain compatible. */
export function nesInstructionIntervals(nodes) {
    return new HalfOpenIntervalIndex(nodes.map((node) => ({ start: node.fileOffset, end: node.fileOffset + node.size, node })));
}
//# sourceMappingURL=source-index.js.map