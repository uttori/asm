const CLASSIFICATION_ORDER = [
    "opcode",
    "operand",
    "data",
    "asset",
    "unknown",
];
const RUNTIME_ORDER = ["executed", "operand", "read", "written"];
const annotationClassification = (classification) => {
    switch (classification) {
        case "opcode":
        case "operand":
            return classification;
        case "graphics":
        case "music":
        case "compressed":
        case "asset":
            return "asset";
        case "unreached":
            return undefined;
        case "data8":
        case "data16":
        case "data24":
        case "data32":
        case "empty":
        case "pointer16":
        case "pointer24":
        case "pointer32":
        case "text": {
            return "data";
        }
        default: {
            const leftover = classification;
            throw new Error(`Unsupported annotation classification: ${String(leftover)}`);
        }
    }
};
const compareStrings = (left, right) => left.localeCompare(right);
const arraysEqual = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const segmentsEqual = (left, right) => left.status === right.status &&
    arraysEqual(left.classifications, right.classifications) &&
    arraysEqual(left.runtime, right.runtime) &&
    arraysEqual(left.annotationIds, right.annotationIds) &&
    arraysEqual(left.analysisIds, right.analysisIds) &&
    arraysEqual(left.runtimeIds, right.runtimeIds) &&
    arraysEqual(left.conflictIds, right.conflictIds) &&
    arraysEqual(left.regionIds, right.regionIds);
const coverageAddressSpace = (record) => {
    if (record.kind === "runtime-coverage" || record.kind === "runtime-execution") {
        return record.addressSpace;
    }
    if (record.kind === "runtime-memory-access") {
        return record.accessedAddressSpace;
    }
    return undefined;
};
/**
 * Builds a conservative ROM-content map without invoking mapper-specific address translation.
 * Records already expressed in a file address space and records carrying an explicit file offset
 * are projected. Everything else stays visible in `unprojected` instead of being guessed.
 * @param {Pick<AnalysisProjectManifest, "addressSpaces" | "rom">} manifest Validated project manifest.
 * @param {AnalysisProjectShards} shards Validated project shards.
 * @returns {RomCoverageMap} Coalesced map, summaries, and projection diagnostics.
 * @param {Iterable} [runtime] Optional streamed history. Avoids retaining decoded SQLite rows.
 */
export const buildRomCoverageMap = (manifest, shards, runtime = shards.runtime) => {
    const contentSize = manifest.rom.contentSize;
    if (!Number.isSafeInteger(contentSize) || contentSize < 0) {
        throw new Error("ROM coverage requires a non-negative safe content size.");
    }
    const fileAddressSpaces = manifest.addressSpaces
        .filter(({ kind }) => kind === "file")
        .map(({ id }) => id)
        .toSorted(compareStrings);
    const fileAddressSpaceSet = new Set(fileAddressSpaces);
    const events = new Map();
    const unprojected = [];
    const diagnostics = [];
    let nextToken = 0;
    const eventAt = (offset) => {
        let event = events.get(offset);
        if (!event) {
            event = { starts: [], ends: [] };
            events.set(offset, event);
        }
        return event;
    };
    const addOverlay = (overlay, start, end, source) => {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) {
            unprojected.push({ ...source, reason: "invalid-range" });
            return false;
        }
        if (start >= contentSize || end <= 0 || contentSize === 0) {
            unprojected.push({ ...source, reason: "outside-rom" });
            return false;
        }
        const clippedStart = Math.max(0, start);
        const clippedEnd = Math.min(contentSize, end);
        if (clippedStart !== start || clippedEnd !== end) {
            diagnostics.push({
                recordId: source.id,
                message: `Clipped coverage range [${start}, ${end}) to ROM content [${clippedStart}, ${clippedEnd}).`,
            });
        }
        const value = {
            ...overlay,
            token: nextToken++,
            start: clippedStart,
            end: clippedEnd,
        };
        eventAt(clippedStart).starts.push(value);
        eventAt(clippedEnd).ends.push(value);
        return true;
    };
    const addAddressSpaceOverlay = (overlay, start, end, source) => {
        if (!source.addressSpace || !fileAddressSpaceSet.has(source.addressSpace)) {
            unprojected.push({ ...source, reason: "non-file-address-space" });
            return false;
        }
        return addOverlay(overlay, start, end, source);
    };
    for (const annotation of shards.annotations) {
        const classification = annotationClassification(annotation.classification);
        if (!classification) {
            continue;
        }
        addAddressSpaceOverlay({ classification, annotationId: annotation.id }, annotation.start, annotation.end, { kind: "annotation", id: annotation.id, addressSpace: annotation.addressSpace });
    }
    for (const region of shards.regions) {
        addAddressSpaceOverlay({ regionId: region.id }, region.start, region.end, {
            kind: "region",
            id: region.id,
            addressSpace: region.addressSpace,
        });
    }
    const controlFlowNodes = new Map();
    for (const record of shards.analysis) {
        if (record.kind !== "cfg-node") {
            continue;
        }
        controlFlowNodes.set(record.id, record);
        if (record.fileOffset === undefined) {
            unprojected.push({
                kind: "analysis",
                id: record.id,
                addressSpace: record.addressSpace,
                reason: "missing-file-offset",
            });
            continue;
        }
        addOverlay({ classification: "opcode", analysisId: record.id }, record.fileOffset, record.fileOffset + 1, { kind: "analysis", id: record.id, addressSpace: record.addressSpace });
        if (record.size > 1) {
            addOverlay({ classification: "operand", analysisId: record.id }, record.fileOffset + 1, record.fileOffset + record.size, { kind: "analysis", id: record.id, addressSpace: record.addressSpace });
        }
    }
    const addConflict = (record) => {
        if (fileAddressSpaceSet.has(record.addressSpace)) {
            addOverlay({ conflictId: record.id }, record.address, record.end ?? record.address + 1, {
                kind: "analysis",
                id: record.id,
                addressSpace: record.addressSpace,
            });
            return;
        }
        let projected = false;
        for (const nodeId of record.nodes) {
            const node = controlFlowNodes.get(nodeId);
            if (!node || node.fileOffset === undefined) {
                continue;
            }
            projected =
                addOverlay({ conflictId: record.id, analysisId: node.id }, node.fileOffset, node.fileOffset + node.size, { kind: "analysis", id: record.id, addressSpace: record.addressSpace }) || projected;
        }
        if (!projected) {
            unprojected.push({
                kind: "analysis",
                id: record.id,
                addressSpace: record.addressSpace,
                reason: "missing-file-offset",
            });
        }
    };
    for (const record of shards.analysis) {
        if (record.kind === "conflict") {
            addConflict(record);
        }
    }
    const addRuntimeAddressSpaceOverlay = (record, runtimeCoverage, start, end) => {
        const addressSpace = coverageAddressSpace(record);
        addAddressSpaceOverlay({ runtime: runtimeCoverage, runtimeId: record.id }, start, end, {
            kind: "runtime",
            id: record.id,
            addressSpace,
        });
    };
    for (const record of runtime) {
        if (record.kind === "runtime-coverage") {
            addRuntimeAddressSpaceOverlay(record, record.coverage, record.start, record.end);
            continue;
        }
        if (record.kind === "runtime-execution") {
            if (record.fileOffset === undefined) {
                unprojected.push({
                    kind: "runtime",
                    id: record.id,
                    addressSpace: record.addressSpace,
                    reason: "missing-file-offset",
                });
                continue;
            }
            const size = record.size ?? 1;
            addOverlay({ runtime: "executed", runtimeId: record.id }, record.fileOffset, record.fileOffset + 1, { kind: "runtime", id: record.id, addressSpace: record.addressSpace });
            if (size > 1) {
                addOverlay({ runtime: "operand", runtimeId: record.id }, record.fileOffset + 1, record.fileOffset + size, { kind: "runtime", id: record.id, addressSpace: record.addressSpace });
            }
            continue;
        }
        if (record.kind === "runtime-memory-access") {
            if (!fileAddressSpaceSet.has(record.accessedAddressSpace)) {
                continue;
            }
            if (record.access === "read" || record.access === "read-write") {
                addRuntimeAddressSpaceOverlay(record, "read", record.accessedAddress, record.accessedAddress + record.width);
            }
            if (record.access === "write" || record.access === "read-write") {
                addRuntimeAddressSpaceOverlay(record, "written", record.accessedAddress, record.accessedAddress + record.width);
            }
        }
    }
    eventAt(0);
    eventAt(contentSize);
    const boundaries = [...events.keys()].toSorted((left, right) => left - right);
    const active = new Map();
    const segments = [];
    for (let index = 0; index + 1 < boundaries.length; index++) {
        const start = boundaries[index];
        const event = events.get(start);
        for (const overlay of event.ends) {
            active.delete(overlay.token);
        }
        for (const overlay of event.starts) {
            active.set(overlay.token, overlay);
        }
        const end = boundaries[index + 1];
        if (end <= start) {
            continue;
        }
        const values = [...active.values()];
        const classifications = new Set();
        for (const { classification } of values) {
            if (classification) {
                classifications.add(classification);
            }
        }
        const sortedClassifications = classifications.size === 0 ? ["unknown"] : [...classifications];
        sortedClassifications.sort((left, right) => CLASSIFICATION_ORDER.indexOf(left) - CLASSIFICATION_ORDER.indexOf(right));
        const conflictIds = [
            ...new Set(values.flatMap(({ conflictId }) => (conflictId ? [conflictId] : []))),
        ].toSorted(compareStrings);
        let status = "classified";
        if (classifications.size === 0 && conflictIds.length === 0) {
            status = "unknown";
        }
        else if (classifications.size > 1 || conflictIds.length > 0) {
            status = "conflict";
        }
        const segment = {
            start,
            end,
            status,
            classifications: sortedClassifications,
            runtime: [
                ...new Set(values.flatMap(({ runtime: runtimeKind }) => (runtimeKind ? [runtimeKind] : []))),
            ].toSorted((left, right) => RUNTIME_ORDER.indexOf(left) - RUNTIME_ORDER.indexOf(right)),
            annotationIds: [
                ...new Set(values.flatMap(({ annotationId }) => (annotationId ? [annotationId] : []))),
            ].toSorted(compareStrings),
            analysisIds: [
                ...new Set(values.flatMap(({ analysisId }) => (analysisId ? [analysisId] : []))),
            ].toSorted(compareStrings),
            runtimeIds: [
                ...new Set(values.flatMap(({ runtimeId }) => (runtimeId ? [runtimeId] : []))),
            ].toSorted(compareStrings),
            conflictIds,
            regionIds: [
                ...new Set(values.flatMap(({ regionId }) => (regionId ? [regionId] : []))),
            ].toSorted(compareStrings),
        };
        const previous = segments.at(-1);
        if (previous && previous.end === segment.start && segmentsEqual(previous, segment)) {
            segments[segments.length - 1] = { ...previous, end: segment.end };
        }
        else {
            segments.push(segment);
        }
    }
    const bytesByClassification = {
        opcode: 0,
        operand: 0,
        data: 0,
        asset: 0,
        unknown: 0,
    };
    const bytesByRuntimeCoverage = {
        executed: 0,
        operand: 0,
        read: 0,
        written: 0,
    };
    let classifiedBytes = 0;
    let unknownBytes = 0;
    let conflictBytes = 0;
    for (const segment of segments) {
        const size = segment.end - segment.start;
        for (const classification of segment.classifications) {
            bytesByClassification[classification] += size;
        }
        for (const runtimeKind of segment.runtime) {
            bytesByRuntimeCoverage[runtimeKind] += size;
        }
        if (segment.status === "classified") {
            classifiedBytes += size;
        }
        else if (segment.status === "unknown") {
            unknownBytes += size;
        }
        else {
            conflictBytes += size;
        }
    }
    return {
        contentSize,
        fileAddressSpaces,
        segments,
        summary: {
            totalBytes: contentSize,
            classifiedBytes,
            unknownBytes,
            conflictBytes,
            segmentCount: segments.length,
            bytesByClassification,
            bytesByRuntimeCoverage,
        },
        unprojected: unprojected.toSorted((left, right) => left.kind.localeCompare(right.kind) ||
            left.id.localeCompare(right.id) ||
            left.reason.localeCompare(right.reason)),
        diagnostics: diagnostics.toSorted((left, right) => left.recordId.localeCompare(right.recordId) || left.message.localeCompare(right.message)),
    };
};
//# sourceMappingURL=coverage-map.js.map