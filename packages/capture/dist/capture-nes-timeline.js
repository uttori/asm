import { validateNesMapper } from "./capture-nes-mapper.js";
/** Decode eight packed MMC3 IRQ bytes at `at`, rejecting out-of-range flags. */
function irq(r, at) {
    if (r[at + 2] > 1 ||
        r[at + 3] > 1 ||
        r[at + 4] > 1 ||
        r[at + 5] > 6 ||
        r[at + 6] > 7 ||
        r[at + 7] > 1) {
        throw new Error("Invalid NES mapper IRQ state.");
    }
    return {
        counter: r[at],
        latch: r[at + 1],
        enabled: !!r[at + 2],
        output: !!r[at + 3],
        a12: !!r[at + 4],
        delay: r[at + 5],
        pulse: r[at + 6],
        mcAcc: !!r[at + 7],
    };
}
/** Decode a fixed kind-5 body after its envelope and sequence have been checked. */
export function decodeNesTimeline(r) {
    const kind = r[56], space = r[59], address = r.readUInt16LE(50);
    if (kind > 3 ||
        (kind === 0 && (r[57] !== 1 || !space)) ||
        (kind === 1 && r[57] === 2) ||
        (kind === 2 && r[57] !== 0) ||
        (kind === 3 && (r[57] !== 2 || r[58] !== r[98])) ||
        r[57] > 2 ||
        space > 3 ||
        r[98] > 1 ||
        r.subarray(99).some(Boolean) ||
        r.readUInt16LE(52) > 340 ||
        r.readUInt16LE(54) > 311 ||
        (kind !== 0 && (space || r.readUInt32LE(60))) ||
        (kind <= 1 && address > 0x3fff) ||
        (kind === 1 && r[58]) ||
        (kind === 2 && address < 0xc000) ||
        (kind === 3 && (address || r[58] > 1))) {
        throw new Error("Invalid NES PPU timeline record.");
    }
    const mapper = [...r.subarray(80, 98)];
    validateNesMapper(mapper);
    if (kind !== 0 && mapper[0] !== 4) {
        throw new Error("Mapper timing requires MMC3.");
    }
    const before = irq(r, 64), after = irq(r, 72);
    if (kind === 1 && (before.a12 === after.a12 || after.a12 !== !!(address & 0x1000))) {
        throw new Error("Invalid NES A12 transition.");
    }
    return {
        sequence: String(r.readBigUInt64LE(8)),
        cycle: String(r.readBigUInt64LE(24)),
        deviceCycle: String(r.readBigUInt64LE(32)),
        ordinal: String(r.readBigUInt64LE(40)),
        pc: r.readUInt16LE(48),
        address,
        dot: r.readUInt16LE(52),
        scanline: r.readUInt16LE(54),
        timeline: ["fetch", "a12", "mapper-write", "irq-pin"][kind],
        source: ["cpu", "ppu", "cartridge"][r[57]],
        value: r[58],
        mapping: space
            ? { space: ["chr-rom", "chr-ram", "ciram"][space - 1], offset: r.readUInt32LE(60) }
            : null,
        before,
        after,
        mapper,
        cpuIrq: !!r[98],
    };
}
//# sourceMappingURL=capture-nes-timeline.js.map