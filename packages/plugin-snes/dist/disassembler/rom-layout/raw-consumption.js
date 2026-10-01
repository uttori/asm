import path from "node:path";
/**
 * A clean text merge can stop including an edited raw byte after analysis discovers code/table data.
 * Compare changed input bytes against exact final-pass incbin slices, not just dependency filenames.
 * The caller retains every block snapshot so the check cannot race a later filesystem read.
 */
export function checkRawBlockConsumption(mapping, blocks) {
    const consumed = new Map();
    for (const asset of mapping.assets) {
        if (asset.format !== "raw" || asset.inputStart === undefined || asset.inputEnd === undefined) {
            continue;
        }
        const file = mapping.fileList[asset.assetFileIdx];
        if (!file) {
            throw new Error("Raw consumption refers to a missing source dependency.");
        }
        const name = path.resolve(file.name);
        const slices = consumed.get(name) ?? [];
        slices.push({ start: asset.inputStart, end: asset.inputEnd });
        consumed.set(name, slices);
    }
    const issues = [];
    for (const block of blocks) {
        if (block.current.length !== block.original.length) {
            issues.push(`${block.file}: raw blocks retain their original extent; declare an asset/table for growth.`);
            continue;
        }
        const covered = new Uint8Array(block.current.length);
        for (const slice of consumed.get(path.resolve(block.file)) ?? []) {
            covered.fill(1, slice.start, slice.end);
        }
        let first, count = 0;
        for (let offset = 0; offset < block.current.length; offset++) {
            if (block.current[offset] !== block.original[offset] && !covered[offset]) {
                first ??= offset;
                count++;
            }
        }
        if (count) {
            issues.push(`${block.file}: ${count} edited raw byte(s), beginning at +$${first.toString(16)}, are no longer consumed. Move these edits into the corresponding source or asset before accepting regeneration.`);
        }
    }
    return issues;
}
//# sourceMappingURL=raw-consumption.js.map