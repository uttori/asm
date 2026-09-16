/**
 * Reflect the physical extent of a struct without changing sizeof's single-record meaning.
 * Missing bounds describe one record at index zero; explicit first indexes undo the biased base.
 * @param {object} definition Final layout and native indexed base, after alignment.
 * @param {StructMetadataProperty} property Requested count, byte extent or physical boundary.
 * @returns {number} Record count, byte count or logical address; never stored record contents.
 */
export function getStructMetadata(definition, property) {
    const count = definition.indexRange?.count ?? 1;
    const bytes = definition.size * count;
    const start = definition.base + (definition.indexRange?.first ?? 0) * definition.size;
    switch (property) {
        case "countof":
            return count;
        case "bytesof":
            return bytes;
        case "startof":
            return start;
        case "endof":
            return start + bytes;
        default:
            throw new Error(`Unknown struct metadata property '${String(property)}'.`);
    }
}
//# sourceMappingURL=struct-metadata.js.map