/** Return the cartridge header's file offset; expansion never relocates the header. */
export const expansionHeaderOffset = (policy) => policy.mapper === "lorom" ? 0x7fc0 : 0xffc0;
const powerOfTwo = (value) => Number.isSafeInteger(value) && value > 0 && Number.isInteger(Math.log2(value));
/** Reject unsupported capacities before allocation, including accidental shrinkage and mapper changes. */
export function assertSnesRomExpansion(original, size, policy) {
    if (!policy) {
        if (size !== original.length) {
            throw new Error("Changing ROM capacity requires an explicit expansion policy.");
        }
        return;
    }
    if (!["hirom", "lorom"].includes(policy.mapper) ||
        ![original.length, size, policy.maximumSize].every(powerOfTwo) ||
        original.length < 0x10000 ||
        size < original.length ||
        size > policy.maximumSize ||
        policy.maximumSize > 0x400000 ||
        !Number.isInteger(policy.fillByte) ||
        policy.fillByte < 0 ||
        policy.fillByte > 255) {
        throw new Error("Expansion requires power-of-two LoROM/HiROM capacities up to 4 MiB, a byte fill and recalculated checksum.");
    }
    const header = expansionHeaderOffset(policy);
    const modes = policy.mapper === "lorom" ? [0x20, 0x30] : [0x21, 0x31];
    if (!modes.includes(original[header + 0x15]) ||
        original[header + 0x17] !== Math.log2(original.length) - 10) {
        throw new Error("Expansion policy does not match the original cartridge mapper and size header.");
    }
}
/**
 * Virtual pristine allocation image: preserve the original ROM and append only declared fill.
 * This is an allocation oracle, never a replacement original-ROM identity or an asset file.
 */
export function expandedPristineRom(original, size, policy) {
    assertSnesRomExpansion(original, size, policy);
    if (size === original.length) {
        return original;
    }
    const result = new Uint8Array(size).fill(policy.fillByte);
    result.set(original);
    return result;
}
/** Verify header/checksum and ownership of new storage independently of assembler finalization. */
export function checkSnesRomExpansion(output, original, size, policy, objects = []) {
    assertSnesRomExpansion(original, size, policy);
    if (!policy || size === original.length || output.length !== size) {
        return [];
    }
    const diagnostics = [];
    const fail = (message, offset) => diagnostics.push({ code: "expansion", message, offset });
    const header = expansionHeaderOffset(policy);
    if (output[header + 0x15] !== original[header + 0x15]) {
        fail("Expansion cannot change the cartridge mapper or speed header.", header + 0x15);
    }
    if (output[header + 0x17] !== Math.log2(size) - 10) {
        fail("Cartridge ROM-size header does not match the expanded capacity.", header + 0x17);
    }
    const complement = output[header + 0x1c] | (output[header + 0x1d] << 8);
    const checksum = output[header + 0x1e] | (output[header + 0x1f] << 8);
    // A checksum and its complement always contribute 510 to the byte sum. Power-of-two
    // capacities need no mirrored-tail weighting, so this check is independent of the encoder.
    let sum = 0;
    for (const byte of output) {
        sum = (sum + byte) & 0xffff;
    }
    if ((checksum ^ complement) !== 0xffff || checksum !== sum) {
        fail("Expanded ROM checksum/complement must be recalculated for the complete output.", header + 0x1c);
    }
    const allocated = objects
        .filter((object) => object.start + object.length > original.length)
        .toSorted((a, b) => a.start - b.start);
    let index = 0;
    for (let offset = original.length; offset < size; offset++) {
        while (index < allocated.length && allocated[index].start + allocated[index].length <= offset) {
            index++;
        }
        if (allocated[index]?.start <= offset) {
            continue;
        }
        if (output[offset] !== policy.fillByte) {
            fail("Expanded storage outside declared objects must retain its pristine fill byte.", offset);
            break;
        }
    }
    return diagnostics;
}
//# sourceMappingURL=expansion.js.map