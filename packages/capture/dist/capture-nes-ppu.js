import { validateNesMapper } from "./capture-nes-mapper.js";
export { validateNesMapper } from "./capture-nes-mapper.js";
import { decodeNesTimeline } from "./capture-nes-timeline.js";
/** Decode the ten-byte PPU address/latch tuple shared by NPP1 and ACT2. */
export function decodeNesPPUState(bytes, offset) {
    const state = {
        v: bytes.readUInt16LE(offset),
        t: bytes.readUInt16LE(offset + 2),
        busAddress: bytes.readUInt16LE(offset + 4),
        fineX: bytes[offset + 6],
        writeLatch: bytes[offset + 7],
        readBuffer: bytes[offset + 8],
        oamAddress: bytes[offset + 9],
    };
    if (state.v > 0x7fff ||
        state.t > 0x7fff ||
        state.busAddress > 0x3fff ||
        state.fineX > 7 ||
        state.writeLatch > 1) {
        throw new Error("Invalid NES PPU address/latch state.");
    }
    return state;
}
/** The wire sentinel is outside the supported physical PRG range. */
const physical = (value) => (value === 0xffffffff ? null : value);
/** Decode kind-4 bus and kind-5 timeline records only after the common envelope/session/CRC has been validated. */
export function decodeNesBusRecords(b, first, count) {
    if (b.length !== 64 + count * 128) {
        throw new Error("Invalid NES bus record length.");
    }
    const records = [];
    for (let index = 0; index < count; index++) {
        const at = 64 + index * 128;
        const r = b.subarray(at, at + 128);
        const sequence = first + BigInt(index), ordinal = r.readBigUInt64LE(32), cycle = r.readBigUInt64LE(24);
        if (r.readUInt16LE(2) !== 1 ||
            r.readUInt32LE(4) !== 128 ||
            r.readBigUInt64LE(8) !== sequence ||
            r.readUInt32LE(16) !== 1 ||
            r.readUInt32LE(20) !== 1) {
            throw new Error("Invalid NES bus/timeline envelope.");
        }
        if (index && cycle < BigInt(records[index - 1].cycle)) {
            throw new Error("Capture clock moved backwards.");
        }
        if (r.readUInt16LE(0) === 5) {
            records.push(decodeNesTimeline(r));
            continue;
        }
        const direction = r[45], actor = r[46], context = r[47], target = r[102], outcome = r[103], n = r[104];
        const hasWrites = n > 0;
        if (r.readUInt16LE(0) !== 4 ||
            direction > 1 ||
            actor > 3 ||
            context > 2 ||
            (ordinal !== 0n) !== (context === 1) ||
            r.readUInt16LE(56) > 340 ||
            r.readUInt16LE(58) > 311 ||
            r[101] > 7 ||
            target > 5 ||
            outcome > 1 ||
            n > 2 ||
            r[118] > 3 ||
            r.subarray(105, 108).some(Boolean) ||
            r[119] ||
            r.readUInt32LE(124) ||
            (!target && (outcome || n)) ||
            (target && !direction) ||
            (target && (outcome === 0) !== hasWrites) ||
            (target === 5 && outcome !== 1)) {
            throw new Error("Invalid NES bus/PPU record.");
        }
        const mapper = [...r.subarray(60, 78)];
        validateNesMapper(mapper);
        const writes = [];
        for (let byte = 0; byte < 2; byte++) {
            const offset = r.readUInt32LE(108 + byte * 4), value = r[116 + byte];
            if (byte >= n) {
                if (offset || value) {
                    throw new Error("Unused NES PPU effect bytes must be zero.");
                }
            }
            else {
                if ((target === 2 && offset >= 2048) ||
                    (target === 3 && (offset >= 32 || value >= 64)) ||
                    (target === 4 && offset >= 256)) {
                    throw new Error("NES PPU destination exceeds its storage.");
                }
                writes.push({ offset, value });
            }
        }
        // Required effects cannot silently disappear or attach to an unrelated CPU port.
        const address = r.readUInt16LE(42);
        const ppuPort = address >= 0x2000 && address < 0x4000 ? address & 7 : -1;
        const dataWrite = direction === 1 && (ppuPort === 4 || ppuPort === 7);
        if (!!target !== dataWrite ||
            (target && ppuPort === 4 && target !== 4) ||
            (target === 4 && ppuPort !== 4)) {
            throw new Error("NES PPU effect does not match its CPU port.");
        }
        let effect = null;
        if (target) {
            effect = {
                target: ["chr-ram", "ciram", "palette", "oam", "chr-rom"][target - 1],
                outcome: outcome ? "blocked" : "written",
                bytes: writes,
            };
        }
        records.push({
            sequence: String(sequence),
            ordinal: String(ordinal),
            cycle: String(cycle),
            pc: r.readUInt16LE(40),
            address: r.readUInt16LE(42),
            value: r[44],
            direction: direction ? "write" : "read",
            actor: ["cpu", "oam-dma", "dmc-dma", "dma-dummy"][actor],
            context: ["unattributed", "instruction", "interrupt"][context],
            pcPrgOffset: physical(r.readUInt32LE(48)),
            prgOffset: physical(r.readUInt32LE(52)),
            dot: r.readUInt16LE(56),
            scanline: r.readUInt16LE(58),
            mapper,
            before: decodeNesPPUState(r, 78),
            after: decodeNesPPUState(r, 88),
            control: r[98],
            mask: r[99],
            status: r[100],
            lines: r[101],
            ppuMapping: r[118]
                ? {
                    space: ["chr-rom", "chr-ram", "ciram"][r[118] - 1],
                    offset: r.readUInt32LE(120),
                }
                : null,
            effect,
        });
    }
    return records;
}
//# sourceMappingURL=capture-nes-ppu.js.map