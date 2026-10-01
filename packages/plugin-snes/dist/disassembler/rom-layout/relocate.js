import { sourceContentHash } from "@uttori/asm-disassembler";
/** Refuse partial split pointers: repairing an offset alone can silently keep the old bank. */
export function assertSnesSplitReferences(references) {
    const pairs = new Map();
    for (const reference of references) {
        const split = reference.encoding === "low16" || reference.encoding === "bank8";
        if (!split) {
            if (reference.pair !== undefined) {
                throw new Error(`Only split pointer fields may declare a pair: ${reference.id}`);
            }
            continue;
        }
        if (typeof reference.pair !== "string" || !/^[\w.:-]+$/.test(reference.pair)) {
            throw new Error(`Split pointer needs a pair identity: ${reference.id}`);
        }
        const fields = pairs.get(reference.pair) ?? [];
        fields.push(reference);
        pairs.set(reference.pair, fields);
    }
    for (const [id, fields] of pairs) {
        if (fields.length !== 2 ||
            !fields.some((field) => field.encoding === "low16") ||
            !fields.some((field) => field.encoding === "bank8") ||
            fields[0].target !== fields[1].target ||
            (fields[0].addend ?? 0) !== (fields[1].addend ?? 0)) {
            throw new Error(`Split pointer ${id} needs one low16 and one bank8 field for the same target and addend.`);
        }
    }
}
/** Require half-open integer ranges before allocation arithmetic or buffer slicing. */
function range(start, end, limit, name) {
    if (!Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end <= start ||
        end > limit) {
        throw new Error(`Invalid ${name} extent.`);
    }
}
/** A valid declaration that rules out one candidate, allowing deterministic search to continue. */
class PlacementConstraint extends Error {
}
/** Encoding width is shared by overlap checks and the independent repair output. */
function referenceWidth(reference) {
    if (reference.encoding === "long24") {
        return 3;
    }
    return reference.encoding.endsWith("8") ? 1 : 2;
}
/** Encode only after signed/unsigned bounds have been proven; never rely on truncating bit operators. */
function bytes(value, width, signed = false) {
    const maximum = 2 ** (8 * width);
    const minimumValue = signed ? -maximum / 2 : 0;
    const maximumValue = signed ? maximum / 2 - 1 : maximum - 1;
    if (!Number.isSafeInteger(value) || value < minimumValue || value > maximumValue) {
        throw new PlacementConstraint(`Relocation reference cannot encode ${value} in ${width} byte(s).`);
    }
    const unsigned = value < 0 ? value + maximum : value;
    return Array.from({ length: width }, (_, index) => Math.floor(unsigned / 2 ** (8 * index)) % 256);
}
/** Encode a declared pointer/length/count for both relocation and ordinary saved-source validation. */
export function encodeSnesRelocationReference(reference, address, encodedLength) {
    if (![
        "long24",
        "bank16",
        "low16",
        "bank8",
        "relative8",
        "relative16",
        "length8",
        "length16",
        "count8",
        "count16",
    ].includes(reference.encoding) ||
        !Number.isSafeInteger(address) ||
        address < 0 ||
        address > 0xffffff ||
        !Number.isSafeInteger(encodedLength) ||
        encodedLength <= 0 ||
        encodedLength > 0x10000) {
        throw new Error(`Invalid reference encoding or target: ${reference.id}`);
    }
    const addend = reference.addend ?? 0;
    if (!Number.isSafeInteger(addend) || addend < 0 || addend >= encodedLength) {
        throw new Error(`Invalid interior target: ${reference.id}`);
    }
    if (reference.encoding.startsWith("count") &&
        (!Number.isSafeInteger(reference.unitSize) ||
            reference.unitSize <= 0 ||
            encodedLength % reference.unitSize !== 0)) {
        throw new Error(`Invalid count unit: ${reference.id}`);
    }
    if (reference.encoding === "bank16" &&
        (!Number.isInteger(reference.bank) || reference.bank < 0 || reference.bank > 255)) {
        throw new Error(`Invalid near-pointer bank: ${reference.id}`);
    }
    if (reference.encoding.startsWith("relative") &&
        (!Number.isSafeInteger(reference.instructionEnd) ||
            reference.instructionEnd < 0 ||
            reference.instructionEnd > 0xffffff)) {
        throw new Error(`Invalid branch location: ${reference.id}`);
    }
    let value = address + (reference.addend ?? 0);
    if (value > 0xffffff) {
        throw new PlacementConstraint(`Interior pointer exceeds the SNES address space: ${reference.id}`);
    }
    let signed = false;
    if (reference.encoding.startsWith("length")) {
        value = encodedLength;
    }
    else if (reference.encoding.startsWith("count")) {
        value = encodedLength / reference.unitSize;
    }
    else if (reference.encoding === "bank16") {
        if (Math.floor(value / 0x10000) !== reference.bank) {
            throw new PlacementConstraint(`Near pointer would leave its declared bank: ${reference.id}`);
        }
        value %= 0x10000;
    }
    else if (reference.encoding === "low16") {
        value %= 0x10000;
    }
    else if (reference.encoding === "bank8") {
        value = Math.floor(value / 0x10000);
    }
    else if (reference.encoding.startsWith("relative")) {
        if (Math.floor(value / 0x10000) !== Math.floor(reference.instructionEnd / 0x10000)) {
            throw new PlacementConstraint(`Relative branch would leave its program bank: ${reference.id}`);
        }
        value -= reference.instructionEnd;
        signed = true;
    }
    return bytes(value, referenceWidth(reference), signed);
}
/**
 * Deterministic first-fit placement over explicit free space. This planner never changes source,
 * invents reference completeness, expands a ROM, or inserts trampolines to force an allocation.
 */
export function planSnesRelocation(options) {
    const object = options.objects.find((item) => item.id === options.objectId);
    if (!object) {
        throw new Error(`Unknown movable object: ${options.objectId}`);
    }
    if (!object.movable ||
        !object.referencesComplete ||
        (object.kind === "code" && !object.closedControlFlow)) {
        throw new Error("Relocation requires a movable object, complete reference declaration, and closed code boundaries.");
    }
    if (!Number.isSafeInteger(options.encodedLength) ||
        options.encodedLength <= 0 ||
        !Number.isSafeInteger(object.alignment) ||
        object.alignment <= 0 ||
        ![0x8000, 0x10000].includes(object.bankSize)) {
        throw new Error("Invalid allocation size, alignment, or bank constraint.");
    }
    const ids = new Set();
    const occupied = [...options.objects].sort((a, b) => a.start - b.start);
    for (const [index, item] of occupied.entries()) {
        if (ids.has(item.id)) {
            throw new Error(`Duplicate layout object: ${item.id}`);
        }
        ids.add(item.id);
        range(item.originalStart, item.originalEnd, options.original.length, item.id);
        range(item.start, item.start + item.length, options.current.length, item.id);
        if (index && occupied[index - 1].start + occupied[index - 1].length > item.start) {
            throw new Error("Existing object allocations overlap.");
        }
    }
    const free = [...options.freeSpace].sort((a, b) => a.start - b.start);
    for (const [index, space] of free.entries()) {
        range(space.start, space.end, options.original.length, space.id);
        if (sourceContentHash(options.original.subarray(space.start, space.end)) !== space.originalSha256) {
            throw new Error(`Free-space proof differs from original bytes: ${space.id}`);
        }
        if (index && free[index - 1].end > space.start) {
            throw new Error("Free-space declarations overlap.");
        }
    }
    const encodings = new Set([
        "long24",
        "bank16",
        "low16",
        "bank8",
        "relative8",
        "relative16",
        "length8",
        "length16",
        "count8",
        "count16",
    ]);
    assertSnesSplitReferences(options.references);
    const fields = new Set();
    const referenceIds = new Set();
    const fieldExtents = [];
    for (const reference of options.references) {
        if (!encodings.has(reference.encoding) ||
            !ids.has(reference.target) ||
            referenceIds.has(reference.id)) {
            throw new Error(`Invalid relocation reference declaration: ${reference.id}`);
        }
        referenceIds.add(reference.id);
        const width = referenceWidth(reference);
        range(reference.offset, reference.offset + width, options.current.length, reference.id);
        if (reference.expected.length !== width ||
            reference.expected.some((value, index) => value !== options.current[reference.offset + index])) {
            throw new Error(`Reference changed before relocation: ${reference.id}`);
        }
        for (let offset = reference.offset; offset < reference.offset + width; offset++) {
            if (fields.has(offset)) {
                throw new Error("Relocation reference fields overlap.");
            }
            fields.add(offset);
        }
        fieldExtents.push({ start: reference.offset, end: reference.offset + width });
    }
    const targetReferences = options.references.filter((reference) => reference.target === object.id);
    for (const reference of targetReferences) {
        const addend = reference.addend ?? 0;
        if (!Number.isSafeInteger(addend) || addend < 0 || addend >= options.encodedLength) {
            throw new Error(`Invalid interior target: ${reference.id}`);
        }
        if (reference.encoding.startsWith("count") &&
            (!Number.isSafeInteger(reference.unitSize) ||
                reference.unitSize <= 0 ||
                options.encodedLength % reference.unitSize !== 0)) {
            throw new Error(`Invalid count unit: ${reference.id}`);
        }
        if (reference.encoding === "bank16" &&
            (!Number.isInteger(reference.bank) || reference.bank < 0 || reference.bank > 255)) {
            throw new Error(`Invalid near-pointer bank: ${reference.id}`);
        }
        if (reference.encoding.startsWith("relative") &&
            (!Number.isSafeInteger(reference.instructionEnd) ||
                reference.instructionEnd < 0 ||
                reference.instructionEnd > 0xffffff)) {
            throw new Error(`Invalid branch location: ${reference.id}`);
        }
    }
    // Evaluate all address-dependent constraints while choosing a destination. A first free extent
    // can be unreachable even when a later one is valid; that is a placement choice, not a hard error.
    const repairsAt = (candidate) => {
        const address = options.logicalAddress(candidate);
        if (!Number.isSafeInteger(address) ||
            address < 0 ||
            address > 0xffffff ||
            options.logicalAddress(candidate + options.encodedLength - 1) !==
                address + options.encodedLength - 1) {
            throw new PlacementConstraint("Allocation has no contiguous supported SNES bus address.");
        }
        return targetReferences.map((reference) => {
            if (candidate !== object.start &&
                reference.offset < object.start + object.length &&
                reference.offset + referenceWidth(reference) > object.start) {
                throw new Error(`Reference ${reference.id} lies inside the moved object; provide symbolic reassembly before relocating it.`);
            }
            return {
                id: reference.id,
                offset: reference.offset,
                before: reference.expected,
                after: encodeSnesRelocationReference(reference, address, options.encodedLength),
            };
        });
    };
    let rejectedPlacement;
    let destination;
    if (options.destination !== undefined) {
        const candidate = options.destination;
        range(candidate, candidate + options.encodedLength, options.current.length, "requested allocation");
        const originalSlot = candidate === object.originalStart &&
            options.encodedLength <= object.originalEnd - object.originalStart;
        const currentSlot = candidate === object.start && options.encodedLength <= object.length;
        const declaredFree = free.some((space) => candidate >= space.start && candidate + options.encodedLength <= space.end);
        if ((!originalSlot && !currentSlot && !declaredFree) ||
            candidate % object.alignment !== 0 ||
            Math.floor(candidate / object.bankSize) !==
                Math.floor((candidate + options.encodedLength - 1) / object.bankSize) ||
            occupied.some((item) => item.id !== object.id &&
                item.start < candidate + options.encodedLength &&
                candidate < item.start + item.length) ||
            fieldExtents.some((field) => field.start < candidate + options.encodedLength && candidate < field.end)) {
            throw new Error("Requested placement violates declared storage, alignment, bank, or ownership constraints.");
        }
        repairsAt(candidate);
        destination = candidate;
    }
    else if (options.encodedLength <= object.length &&
        Math.floor(object.start / object.bankSize) ===
            Math.floor((object.start + options.encodedLength - 1) / object.bankSize)) {
        destination = object.start;
    }
    else {
        for (const space of free) {
            let candidate = Math.ceil(space.start / object.alignment) * object.alignment;
            while (candidate + options.encodedLength <= space.end) {
                const bankEnd = (Math.floor(candidate / object.bankSize) + 1) * object.bankSize;
                if (candidate + options.encodedLength > bankEnd) {
                    candidate = Math.ceil(bankEnd / object.alignment) * object.alignment;
                    continue;
                }
                // Existing placements, including the old object, remain reserved until review accepts the move.
                const conflict = occupied.find((item) => item.start < candidate + options.encodedLength && candidate < item.start + item.length);
                if (conflict) {
                    candidate =
                        Math.ceil((conflict.start + conflict.length) / object.alignment) * object.alignment;
                    continue;
                }
                const field = fieldExtents.find((item) => item.start < candidate + options.encodedLength && candidate < item.end);
                if (field) {
                    candidate = Math.ceil(field.end / object.alignment) * object.alignment;
                    continue;
                }
                try {
                    repairsAt(candidate);
                    destination = candidate;
                    break;
                }
                catch (error) {
                    if (!(error instanceof PlacementConstraint)) {
                        throw error;
                    }
                    rejectedPlacement = error;
                    candidate += object.alignment;
                }
            }
            if (destination !== undefined) {
                break;
            }
        }
    }
    if (destination === undefined) {
        throw (rejectedPlacement ??
            new Error("No declared free extent satisfies this growth. Declare more space or an explicit expansion policy."));
    }
    if (destination !== object.start) {
        for (let offset = destination; offset < destination + options.encodedLength; offset++) {
            if (options.current[offset] !== options.original[offset]) {
                throw new Error("Declared free space contains source edits. Reconcile its ownership before allocating.");
            }
        }
    }
    const repairs = repairsAt(destination);
    return { object, destination, encodedLength: options.encodedLength, repairs };
}
//# sourceMappingURL=relocate.js.map