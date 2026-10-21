/** CPU ranges need an explicit physical anchor; file ranges already identify their original owner. */
export function nesSourceDataRanges(rom, annotations) {
    const ranges = [];
    for (const annotation of annotations) {
        let start;
        if (annotation.addressSpace === "nes.file") {
            start = annotation.start;
        }
        else if (annotation.addressSpace === "nes.cpu") {
            start = annotation.mapping?.fileOffset;
        }
        if (start === undefined ||
            ["unreached", "opcode", "operand"].includes(annotation.classification)) {
            continue;
        }
        const end = start + annotation.end - annotation.start;
        if (start < 0 || end > rom.size - 16 || end <= start) {
            throw new Error(`Invalid NES source data range '${annotation.id}'.`);
        }
        ranges.push({ start, end, annotation });
    }
    ranges.sort((left, right) => left.start - right.start || left.end - right.end);
    for (let index = 1; index < ranges.length; index++) {
        if (ranges[index].start < ranges[index - 1].end) {
            // Choosing one of two classifications would silently discard an authored ownership decision.
            throw new Error(`Overlapping NES source data declarations '${ranges[index - 1].annotation.id}' and '${ranges[index].annotation.id}'.`);
        }
    }
    return ranges;
}
/** Fixed-width, uppercase source literals; filenames and stable IDs keep their original spelling. */
export function nesSourceHex(value, digits = 4) {
    return "$" + value.toString(16).toUpperCase().padStart(digits, "0");
}
/** Keep each contract above its equate and separate declarations for readable shared includes. */
export function nesSourceDefinition(name, address, description) {
    const lines = description.split(/\r?\n/);
    return [...lines.map((line) => `; ${line}`), `${name} = ${nesSourceHex(address)}`, ""];
}
//# sourceMappingURL=source-data.js.map