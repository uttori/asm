import { arrayValue, decodedObject, defaultPath, integerOption, integerValue, jsonFile, objectValue, optionsFor, readBytes, stringOption, } from "./common.js";
/** Stable id of the SNES S-DSP BRR block codec. */
export const SNES_BRR_ASSET_CODEC_ID = "snes.asset.brr";
const blockCountAndSize = (context) => {
    if (context.request.length !== undefined) {
        if (context.request.length % 9 !== 0) {
            throw new Error(`BRR asset '${context.request.id}' length must be a multiple of 9 bytes.`);
        }
        return { blockCount: context.request.length / 9, size: context.request.length };
    }
    const options = optionsFor(context);
    const maxBlocks = integerOption(options, "maxBlocks", { minimum: 1 });
    if (maxBlocks === undefined) {
        throw new Error(`BRR asset '${context.request.id}' requires a length or option 'maxBlocks'.`);
    }
    for (let blockCount = 1; blockCount <= maxBlocks; blockCount++) {
        const block = context.source.read(context.request.sourceOffset + (blockCount - 1) * 9, 9);
        if (!block)
            break;
        if ((block[0] & 1) !== 0)
            return { blockCount, size: blockCount * 9 };
    }
    throw new Error(`BRR asset '${context.request.id}' has no end block within ${maxBlocks} blocks.`);
};
/** Reversible BRR blocks represented by filter/range flags and signed encoded nibbles. */
export const snesBrrAssetCodec = Object.freeze({
    id: SNES_BRR_ASSET_CODEC_ID,
    version: "1.0.0",
    sizeBounds: { minimum: 9 },
    inspect: (context) => {
        const resolved = blockCountAndSize(context);
        return {
            size: resolved.size,
            metadata: { format: "snes-brr", blockCount: resolved.blockCount, samplesPerBlock: 16 },
        };
    },
    decode: (context) => {
        const options = optionsFor(context);
        const resolved = blockCountAndSize(context);
        const bytes = readBytes(context.source, context.request.sourceOffset, resolved.size, context.request.id);
        const blocks = Array.from({ length: resolved.blockCount }, (_, blockIndex) => {
            const offset = blockIndex * 9;
            const header = bytes[offset];
            const nibbles = Array.from({ length: 16 }, (_, sampleIndex) => {
                const byte = bytes[offset + 1 + Math.floor(sampleIndex / 2)];
                const nibble = sampleIndex % 2 === 0 ? byte >> 4 : byte & 0x0f;
                // BRR samples are signed four-bit values, stored high nibble first.
                return nibble >= 8 ? nibble - 16 : nibble;
            });
            return {
                range: header >> 4,
                filter: (header >> 2) & 3,
                loop: (header >> 1) & 1,
                end: header & 1,
                nibbles,
            };
        });
        const value = { kind: "snes-brr", blocks };
        const path = stringOption(options, "path", defaultPath(context.request.id, "brr"));
        const metadataPath = stringOption(options, "metadataPath", defaultPath(context.request.id, "brr.json"));
        return {
            value,
            files: [{ path, mediaType: "audio/x-snes-brr", bytes }, jsonFile(metadataPath, value)],
        };
    },
    encode: (context) => {
        const resolved = blockCountAndSize(context);
        const value = decodedObject(context.decoded.value, context.request.id);
        const blocks = arrayValue(value.blocks, `BRR asset '${context.request.id}' blocks`);
        if (blocks.length !== resolved.blockCount) {
            throw new Error(`BRR asset '${context.request.id}' requires ${resolved.blockCount} blocks.`);
        }
        const bytes = new Uint8Array(resolved.size);
        blocks.forEach((blockValue, blockIndex) => {
            const block = objectValue(blockValue, `BRR block ${blockIndex}`);
            const range = integerValue(block.range, `BRR block ${blockIndex} range`, 0, 15);
            const filter = integerValue(block.filter, `BRR block ${blockIndex} filter`, 0, 3);
            const loop = integerValue(block.loop, `BRR block ${blockIndex} loop`, 0, 1);
            const end = integerValue(block.end, `BRR block ${blockIndex} end`, 0, 1);
            const nibbles = arrayValue(block.nibbles, `BRR block ${blockIndex} nibbles`);
            if (nibbles.length !== 16) {
                throw new Error(`BRR block ${blockIndex} requires exactly 16 nibbles.`);
            }
            const offset = blockIndex * 9;
            bytes[offset] = (range << 4) | (filter << 2) | (loop << 1) | end;
            for (let sampleIndex = 0; sampleIndex < 16; sampleIndex += 2) {
                const high = integerValue(nibbles[sampleIndex], `BRR block ${blockIndex} nibble ${sampleIndex}`, -8, 7);
                const low = integerValue(nibbles[sampleIndex + 1], `BRR block ${blockIndex} nibble ${sampleIndex + 1}`, -8, 7);
                bytes[offset + 1 + sampleIndex / 2] =
                    ((high < 0 ? high + 16 : high) << 4) | (low < 0 ? low + 16 : low);
            }
        });
        return bytes;
    },
});
//# sourceMappingURL=brr.js.map