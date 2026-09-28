import { validateMetadataReceipt } from "./metadata-validation.js";
import { ANALYSIS_PROJECT_FORMAT, ANALYSIS_PROJECT_SCHEMA_VERSION, } from "./project-types.js";
import { RecordIdSet } from "./record-id-set.js";
import { validateRuntimeBusFact } from "./runtime-bus-types.js";
import { validateRuntimeInstructionDetails } from "./trace-detail.js";
/**
 * Validate the semantic manifest and reject obsolete storage descriptors.
 * @param {AnalysisProjectManifest} manifest Semantic identity and current storage descriptors.
 */
export const validateAnalysisProjectManifest = (manifest) => {
    if (manifest.format !== ANALYSIS_PROJECT_FORMAT) {
        throw new Error(`Unsupported analysis project format '${String(manifest.format)}'.`);
    }
    if (manifest.schemaVersion !== ANALYSIS_PROJECT_SCHEMA_VERSION) {
        throw new Error(`Unsupported analysis project schema version ${String(manifest.schemaVersion)}.`);
    }
    if (!/^[\da-f]{64}$/.test(manifest.rom.sha256)) {
        throw new Error("Invalid ROM SHA-256.");
    }
    if (!/^[\da-f]{64}$/.test(manifest.rom.contentSha256)) {
        throw new Error("Invalid ROM content SHA-256.");
    }
    const addressSpaceIds = new Set();
    for (const addressSpace of manifest.addressSpaces) {
        if (addressSpace.id === "" || addressSpace.name === "") {
            throw new Error("Analysis address spaces require non-empty ids and names.");
        }
        if (addressSpaceIds.has(addressSpace.id)) {
            throw new Error(`Duplicate analysis address-space id '${addressSpace.id}'.`);
        }
        if (!Number.isSafeInteger(addressSpace.addressBits) ||
            addressSpace.addressBits <= 0 ||
            addressSpace.addressBits > 53) {
            throw new Error(`Analysis address space '${addressSpace.id}' has invalid address bits.`);
        }
        addressSpaceIds.add(addressSpace.id);
    }
    if (manifest.db !== undefined && manifest.db !== "analysis.sqlite") {
        throw new Error(`Unsupported analysis sqlite path '${manifest.db}'.`);
    }
    if (manifest.revision !== undefined &&
        (!Number.isSafeInteger(manifest.revision) || manifest.revision < 0)) {
        throw new Error("Invalid analysis sqlite revision.");
    }
    if (manifest.shards.length !== 0) {
        throw new Error("Legacy analysis shards are no longer supported. Use a SQLite project.");
    }
};
const FORBIDDEN_ROM_PAYLOAD_KEYS = new Set(["romBytes", "fileBytes", "contentBytes", "byteData"]);
/**
 * Reject embedded ROM payload fields at any depth, preserving the offending property's path.
 * @param {unknown} value JSON-compatible record or collection to inspect.
 * @param {string} location Path included in a rejected property's diagnostic.
 * @returns {void} Throws on the first forbidden payload field.
 */
const assertNoRomPayload = (value, location) => {
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++) {
            const entry = value[index];
            if (entry && typeof entry === "object") {
                assertNoRomPayload(entry, `${location}[${index}]`);
            }
        }
        return;
    }
    if (!value || typeof value !== "object") {
        return;
    }
    // Most record fields are scalars. Avoid allocating entry tuples and diagnostic paths for every
    // scalar in a full-project scan. Only objects can contain a forbidden property further down.
    const record = value;
    for (const key in record) {
        if (!Object.hasOwn(record, key)) {
            continue;
        }
        if (FORBIDDEN_ROM_PAYLOAD_KEYS.has(key)) {
            throw new Error(`ROM byte payload '${location}.${key}' is forbidden in analysis projects.`);
        }
        const entry = record[key];
        if (entry && typeof entry === "object") {
            assertNoRomPayload(entry, `${location}.${key}`);
        }
    }
};
const isStableId = (id) => {
    const isAlphaNumeric = (character) => {
        const code = character.charCodeAt(0);
        return ((code >= 0x30 && code <= 0x39) ||
            (code >= 0x41 && code <= 0x5a) ||
            (code >= 0x61 && code <= 0x7a));
    };
    if (id.length === 0 || !isAlphaNumeric(id[0]) || !isAlphaNumeric(id.at(-1))) {
        return false;
    }
    for (const character of id) {
        if (!isAlphaNumeric(character) && !"._:/-".includes(character)) {
            return false;
        }
    }
    return true;
};
const assertCodecReference = (reference, location) => {
    if (typeof reference.codecId !== "string" || !isStableId(reference.codecId)) {
        throw new Error(`${location} has an invalid codec id.`);
    }
    if (typeof reference.codecVersion !== "string" || reference.codecVersion.trim() === "") {
        throw new Error(`${location} has no codec version.`);
    }
    if (reference.provider) {
        if (typeof reference.provider.pluginId !== "string" ||
            !isStableId(reference.provider.pluginId)) {
            throw new Error(`${location} has an invalid provider plugin id.`);
        }
        if (typeof reference.provider.pluginVersion !== "string" ||
            reference.provider.pluginVersion.trim() === "") {
            throw new Error(`${location} has no provider plugin version.`);
        }
    }
    const visitJson = (value, current) => {
        if (value === null ||
            typeof value === "string" ||
            typeof value === "boolean" ||
            (typeof value === "number" && Number.isFinite(value))) {
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((entry, index) => visitJson(entry, `${current}[${index}]`));
            return;
        }
        if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
            Object.entries(value).forEach(([key, entry]) => visitJson(entry, `${current}.${key}`));
            return;
        }
        throw new Error(`${current} is not a JSON-safe codec option.`);
    };
    if (reference.options !== undefined) {
        visitJson(reference.options, `${location} options`);
    }
};
/**
 * Validate runtime facts in one pass, spilling large duplicate-ID indexes to temporary disk storage.
 * Stored SQLite rows skip the duplicate index because their primary key already enforces uniqueness.
 * @param {object} project ROM bounds and named address spaces.
 * @param {Array} evidence Evidence available to every retained runtime fact.
 * @param {boolean} [checkDuplicateIds] False only for rows from a primary-key constrained table.
 * @returns {Function} Stateful validator. Close it after success or failure to release its temporary index.
 */
export const createRuntimeRecordValidator = (project, evidence, checkDuplicateIds = true) => {
    const ids = checkDuplicateIds ? new RecordIdSet() : undefined;
    const evidenceIds = new Set(evidence.map((record) => record.id));
    const addressSpaceById = new Map(project.addressSpaces.map((space) => [space.id, space]));
    const validate = (record) => {
        if (!record || typeof record.id !== "string" || record.id === "") {
            throw new Error("Analysis shard 'runtime' contains a record without an id.");
        }
        if (ids && !ids.add(record.id)) {
            throw new Error(`Analysis shard 'runtime' contains duplicate id '${record.id}'.`);
        }
        for (const id of record.evidence ?? []) {
            if (!evidenceIds.has(id)) {
                throw new Error(`Analysis record '${record.id}' refers to missing evidence '${id}'.`);
            }
        }
        if (!Number.isSafeInteger(record.count) || record.count <= 0) {
            throw new Error(`Runtime record '${record.id}' has an invalid observation count.`);
        }
        if (record.kind === "runtime-coverage") {
            if (!Number.isSafeInteger(record.start) ||
                !Number.isSafeInteger(record.end) ||
                record.start < 0 ||
                record.end <= record.start) {
                throw new Error(`Runtime coverage '${record.id}' has an invalid half-open range.`);
            }
        }
        if (record.kind === "runtime-bus-access") {
            if (record.architecture !== "snes.65816") {
                throw new Error("Bus facts require the SNES 65816 architecture.");
            }
            validateRuntimeBusFact(record);
        }
        if (record.kind === "runtime-memory-access") {
            if ((record.actor !== undefined && !["cpu", "dma", "hdma"].includes(record.actor)) ||
                (record.channel !== undefined &&
                    (!Number.isInteger(record.channel) ||
                        record.channel < 0 ||
                        record.channel > 7 ||
                        !["dma", "hdma"].includes(record.actor ?? "cpu")))) {
                throw new Error(`Runtime memory access '${record.id}' has an invalid actor/channel.`);
            }
            if (!Number.isSafeInteger(record.width) || record.width <= 0) {
                throw new Error(`Runtime memory access '${record.id}' has an invalid width.`);
            }
            if (record.value !== undefined && (!Number.isSafeInteger(record.value) || record.value < 0)) {
                throw new Error(`Runtime memory access '${record.id}' has an invalid value.`);
            }
        }
        if (record.kind === "runtime-execution") {
            if (record.size !== undefined && (!Number.isSafeInteger(record.size) || record.size <= 0)) {
                throw new Error(`Runtime execution '${record.id}' has an invalid instruction size.`);
            }
            if (record.opcode !== undefined &&
                (!Number.isInteger(record.opcode) || record.opcode < 0 || record.opcode > 0xff)) {
                throw new Error(`Runtime execution '${record.id}' has an invalid opcode.`);
            }
            if (record.fileOffset !== undefined &&
                (!Number.isSafeInteger(record.fileOffset) ||
                    record.fileOffset < 0 ||
                    record.fileOffset >= project.rom.contentSize)) {
                throw new Error(`Runtime execution '${record.id}' has an invalid ROM file offset.`);
            }
        }
        if (record.kind === "runtime-instruction") {
            validateRuntimeInstructionDetails([{ bytes: record.bytes, state: record.state }], 1);
        }
        if (record.kind === "runtime-cpu-state") {
            for (const [name, value] of Object.entries(record.state)) {
                if (name === "" ||
                    !["string", "boolean", "number"].includes(typeof value) ||
                    (typeof value === "number" && !Number.isFinite(value))) {
                    throw new Error(`Runtime CPU state '${record.id}' has invalid field '${name}'.`);
                }
            }
        }
        if ("addressSpace" in record) {
            const space = addressSpaceById.get(record.addressSpace);
            if (!space) {
                throw new Error(`Analysis record '${record.id}' refers to unknown address space '${record.addressSpace}'.`);
            }
            const addresses = record.kind === "runtime-coverage" ? [record.start, record.end - 1] : [record.address];
            if (addresses.some((address) => !Number.isSafeInteger(address) || address < 0 || address >= 2 ** space.addressBits)) {
                throw new Error(`Analysis record '${record.id}' exceeds address space '${record.addressSpace}'.`);
            }
        }
        let addresses = [];
        if (record.kind === "runtime-memory-access") {
            addresses = [
                [record.instructionAddressSpace, record.instructionAddress],
                [record.accessedAddressSpace, record.accessedAddress],
            ];
        }
        else if (record.kind === "runtime-bus-access") {
            addresses = [[record.addressSpace, record.pc]];
        }
        else if (record.kind === "runtime-control-target") {
            addresses = [
                [record.fromAddressSpace, record.fromAddress],
                [record.toAddressSpace, record.toAddress],
            ];
        }
        for (const [spaceId, address] of addresses) {
            const addressSpace = addressSpaceById.get(spaceId);
            if (!addressSpace) {
                throw new Error(`Runtime record '${record.id}' refers to unknown address space '${spaceId}'.`);
            }
            if (!Number.isSafeInteger(address) ||
                address < 0 ||
                address >= 2 ** addressSpace.addressBits) {
                throw new Error(`Runtime record '${record.id}' exceeds address space '${spaceId}'.`);
            }
        }
        assertNoRomPayload(record, `shards.runtime.${record.id}`);
    };
    return Object.assign(validate, { close: () => ids?.close() });
};
/**
 * Validate an iterable without copying its records into intermediate arrays.
 * @param {Iterable} records Complete runtime history.
 * @param {object} project ROM identity and address-space bounds.
 * @param {Array} evidence Valid referenced evidence.
 * @returns {void}
 */
export const validateRuntimeRecords = (records, project, evidence) => {
    const validate = createRuntimeRecordValidator(project, evidence);
    try {
        for (const record of records) {
            validate(record);
        }
    }
    finally {
        validate.close();
    }
};
/**
 * Validate metadata, runtime values, address bounds and provenance before publication.
 * @param {AnalysisProjectShards} shards Complete record collections, or metadata with empty runtime.
 * @param {object} project ROM identity, mapper and address-space bounds.
 */
export const validateLoadedShards = (shards, project) => {
    const { addressSpaces } = project;
    const evidenceIds = new Set(shards.evidence.map((record) => record.id));
    for (const [kind, records] of Object.entries(shards)) {
        if (kind === "runtime") {
            continue;
        }
        const ids = new Set();
        for (const record of records) {
            if (!record || typeof record.id !== "string" || record.id === "") {
                throw new Error(`Analysis shard '${kind}' contains a record without an id.`);
            }
            if (ids.has(record.id)) {
                throw new Error(`Analysis shard '${kind}' contains duplicate id '${record.id}'.`);
            }
            ids.add(record.id);
            for (const evidence of record.evidence ?? []) {
                if (!evidenceIds.has(evidence)) {
                    throw new Error(`Analysis record '${record.id}' refers to missing evidence '${evidence}'.`);
                }
            }
        }
    }
    for (const evidence of shards.evidence) {
        if (!evidence.artifact) {
            continue;
        }
        if (evidence.artifact.format === "" ||
            !/^[\da-f]{64}$/.test(evidence.artifact.sha256) ||
            !/^[\da-f]{64}$/.test(evidence.artifact.romContentSha256)) {
            throw new Error(`Evidence '${evidence.id}' has an invalid artifact identity.`);
        }
        if (evidence.artifact.romContentSha256 !== project.rom.contentSha256) {
            throw new Error(`Evidence '${evidence.id}' belongs to a different ROM.`);
        }
        if (evidence.artifact.mapper && evidence.artifact.mapper !== project.mapping.mapper) {
            throw new Error(`Evidence '${evidence.id}' belongs to a different mapper.`);
        }
    }
    for (const interval of [...shards.annotations, ...shards.regions]) {
        if (!Number.isSafeInteger(interval.start) ||
            !Number.isSafeInteger(interval.end) ||
            interval.start < 0 ||
            interval.end <= interval.start) {
            throw new Error(`Analysis interval '${interval.id}' has an invalid half-open range.`);
        }
    }
    for (const annotation of shards.annotations) {
        if (!annotation.asset) {
            continue;
        }
        if (!["asset", "compressed", "graphics", "music", "text"].includes(annotation.classification)) {
            throw new Error(`Analysis annotation '${annotation.id}' cannot attach an asset codec to '${annotation.classification}'.`);
        }
        assertCodecReference(annotation.asset, `Analysis annotation '${annotation.id}' asset codec`);
        const compression = annotation.asset.compression;
        if (!compression) {
            continue;
        }
        assertCodecReference(compression, `Analysis annotation '${annotation.id}' compression codec`);
        const rangeSize = annotation.end - annotation.start;
        const maximumSize = compression.maximumSize ?? rangeSize;
        if (!Number.isSafeInteger(maximumSize) || maximumSize <= 0 || maximumSize > rangeSize) {
            throw new Error(`Analysis annotation '${annotation.id}' compression maximumSize must be within its range.`);
        }
        const hasBankStart = compression.bankStart !== undefined;
        const hasBankEnd = compression.bankEnd !== undefined;
        if (hasBankStart !== hasBankEnd) {
            throw new Error(`Analysis annotation '${annotation.id}' compression bank bounds must be supplied together.`);
        }
        const bankStart = compression.bankStart;
        const bankEnd = compression.bankEnd;
        if (hasBankStart &&
            (typeof bankStart !== "number" ||
                typeof bankEnd !== "number" ||
                !Number.isSafeInteger(bankStart) ||
                !Number.isSafeInteger(bankEnd) ||
                bankStart < 0 ||
                bankEnd <= bankStart ||
                annotation.start < bankStart ||
                annotation.end > bankEnd)) {
            throw new Error(`Analysis annotation '${annotation.id}' has invalid compression bank bounds.`);
        }
        if (compression.fillByte !== undefined &&
            (!Number.isInteger(compression.fillByte) ||
                compression.fillByte < 0 ||
                compression.fillByte > 0xff)) {
            throw new Error(`Analysis annotation '${annotation.id}' has an invalid compression fillByte.`);
        }
    }
    for (const conflict of shards.analysis) {
        if (conflict.kind !== "conflict" || conflict.end === undefined) {
            continue;
        }
        if (!Number.isSafeInteger(conflict.end) || conflict.end <= conflict.address) {
            throw new Error(`Analysis conflict '${conflict.id}' has an invalid half-open range.`);
        }
    }
    const regionsById = new Map(shards.regions.map((region) => [region.id, region]));
    for (const region of shards.regions) {
        if (!region.parentRegion) {
            continue;
        }
        const parent = regionsById.get(region.parentRegion);
        if (!parent) {
            throw new Error(`Analysis region '${region.id}' refers to missing parent region '${region.parentRegion}'.`);
        }
        const visited = new Set([region.id]);
        let ancestor = parent;
        while (ancestor.parentRegion) {
            if (visited.has(ancestor.id)) {
                throw new Error(`Analysis region '${region.id}' has a cyclic parent relationship.`);
            }
            visited.add(ancestor.id);
            const next = regionsById.get(ancestor.parentRegion);
            if (!next) {
                break;
            }
            ancestor = next;
        }
        if (visited.has(ancestor.id)) {
            throw new Error(`Analysis region '${region.id}' has a cyclic parent relationship.`);
        }
        if (parent.addressSpace === region.addressSpace &&
            (region.start < parent.start || region.end > parent.end)) {
            throw new Error(`Analysis region '${region.id}' is not contained by parent region '${parent.id}'.`);
        }
    }
    for (const addressed of [...shards.labels, ...shards.comments]) {
        if (!Number.isSafeInteger(addressed.address) || addressed.address < 0) {
            throw new Error(`Analysis record '${addressed.id}' has an invalid address.`);
        }
    }
    for (const receipt of shards.analysis) {
        if (receipt.kind === "metadata-edit") {
            validateMetadataReceipt(receipt);
        }
    }
    for (const label of shards.labels) {
        if (label.suppressed !== undefined && typeof label.suppressed !== "boolean") {
            throw new Error(`Analysis label '${label.id}' has an invalid suppression flag.`);
        }
        if (label.sourceName !== undefined &&
            (typeof label.sourceName !== "string" || !/^[A-Z_a-z]\w*$/.test(label.sourceName))) {
            throw new Error(`Analysis label '${label.id}' has an invalid source name.`);
        }
        if (label.inlineComment !== undefined &&
            (typeof label.inlineComment !== "string" || /[\n\r\u2028\u2029]/.test(label.inlineComment))) {
            throw new Error(`Analysis label '${label.id}' requires a single-line inline comment.`);
        }
        if (label.analysisEntryPoint !== undefined && typeof label.analysisEntryPoint !== "boolean") {
            throw new Error(`Analysis label '${label.id}' has an invalid analysisEntryPoint.`);
        }
    }
    for (const comment of shards.comments) {
        if (comment.placement !== undefined &&
            !["before", "inline-instruction"].includes(comment.placement)) {
            throw new Error(`Analysis comment '${comment.id}' has an invalid placement.`);
        }
        if (comment.placement === "inline-instruction" &&
            (typeof comment.text !== "string" || /[\n\r\u2028\u2029]/.test(comment.text))) {
            throw new Error(`Analysis comment '${comment.id}' requires a single-line inline comment.`);
        }
    }
    const addressSpaceById = new Map(addressSpaces.map((addressSpace) => [addressSpace.id, addressSpace]));
    // Scan collections in place. Flattening them and collecting each record's addresses creates
    // substantial temporary allocation when validating a complete CFG before every save or load.
    const outsideSpace = (address, exclusiveMaximum) => !Number.isSafeInteger(address) || address < 0 || address >= exclusiveMaximum;
    for (const records of [
        shards.annotations,
        shards.labels,
        shards.comments,
        shards.regions,
        shards.analysis,
    ]) {
        for (const record of records) {
            if (!("addressSpace" in record)) {
                continue;
            }
            const addressSpace = addressSpaceById.get(record.addressSpace);
            if (!addressSpace) {
                throw new Error(`Analysis record '${record.id}' refers to unknown address space '${record.addressSpace}'.`);
            }
            const maximum = 2 ** addressSpace.addressBits;
            let invalid = false;
            if ("start" in record) {
                invalid = outsideSpace(record.start, maximum) || outsideSpace(record.end - 1, maximum);
            }
            else if ("address" in record) {
                invalid = outsideSpace(record.address, maximum);
                if ("kind" in record && record.kind === "conflict" && record.end !== undefined) {
                    invalid ||= outsideSpace(record.end - 1, maximum);
                }
            }
            else {
                if ("fromAddress" in record) {
                    invalid = outsideSpace(record.fromAddress, maximum);
                }
                if ("toAddress" in record && record.toAddress !== undefined) {
                    invalid ||= outsideSpace(record.toAddress, maximum);
                }
                // Imported target lists can outgrow the engine's call-argument limit. Visit them directly.
                if ("targets" in record) {
                    for (const target of record.targets) {
                        invalid ||= outsideSpace(target, maximum);
                    }
                }
            }
            if (invalid) {
                throw new Error(`Analysis record '${record.id}' exceeds address space '${record.addressSpace}'.`);
            }
        }
    }
    validateRuntimeRecords(shards.runtime, project, shards.evidence);
    assertNoRomPayload({ ...shards, runtime: [] }, "shards");
};
//# sourceMappingURL=project-validation.js.map