import { canonicalJson } from "@uttori/asm-core/canonical-json";
import { isFiniteNumber, isRecord, isStringArray } from "../model/record-shape.js";
import { isRuntimeGraphicsFact } from "../model/runtime-graphics-fact.js";
import { parseSqlitePayload, decodeSqliteRuntimeIdentity } from "./sqlite-payload.js";
/**
 * Stable ordering for explicit runtime arrays, independent of insertion order in the working store.
 * @param left First semantic record.
 * @param right Second semantic record.
 * @returns Lexical ID comparison. Streaming consumers deliberately do not use this sort.
 */
export const compareRuntimeRecordIds = (left, right) => {
    if (left.id < right.id) {
        return -1;
    }
    if (left.id > right.id) {
        return 1;
    }
    return 0;
};
/**
 * Store searchable coordinates as columns and variant-only fields as a bounded payload.
 * Unused coordinate columns stay null so one record kind cannot masquerade as another.
 * Canonicalize payloads here once: the writer reuses this exact text for hashing
 * and encoding, avoiding a JSON stringify/parse/canonicalize round trip per fact.
 * @param record Validated semantic runtime fact.
 * @returns Column bindings with canonical payload text. Absent variant fields remain omitted.
 */
export const runtimeColumns = (record) => {
    switch (record.kind) {
        case "runtime-execution":
            return {
                addressSpace: record.addressSpace,
                address: record.address,
                start: null,
                end: null,
                fromAddressSpace: null,
                fromAddress: null,
                toAddressSpace: null,
                toAddress: null,
                instructionAddressSpace: null,
                instructionAddress: null,
                accessedAddressSpace: null,
                accessedAddress: null,
                coverage: null,
                payload: canonicalJson({
                    ...(record.fileOffset === undefined ? {} : { fileOffset: record.fileOffset }),
                    ...(record.size === undefined ? {} : { size: record.size }),
                    ...(record.opcode === undefined ? {} : { opcode: record.opcode }),
                }),
            };
        case "runtime-instruction":
            return {
                addressSpace: record.addressSpace,
                address: record.address,
                start: null,
                end: null,
                fromAddressSpace: null,
                fromAddress: null,
                toAddressSpace: null,
                toAddress: null,
                instructionAddressSpace: null,
                instructionAddress: null,
                accessedAddressSpace: null,
                accessedAddress: null,
                coverage: null,
                payload: canonicalJson({ bytes: record.bytes, state: record.state }),
            };
        case "runtime-graphics-access":
            return {
                addressSpace: null,
                address: null,
                start: null,
                end: null,
                fromAddressSpace: null,
                fromAddress: null,
                toAddressSpace: null,
                toAddress: null,
                instructionAddressSpace: record.context === "instruction" ? record.addressSpace : null,
                instructionAddress: record.context === "instruction" ? record.pc : null,
                accessedAddressSpace: record.addressSpace,
                accessedAddress: record.address,
                coverage: null,
                payload: canonicalJson({
                    pc: record.pc,
                    actor: record.actor,
                    context: record.context,
                    direction: record.direction,
                    value: record.value,
                    cpuMapping: record.cpuMapping,
                    effect: record.effect,
                }),
            };
        case "runtime-bus-access":
            return {
                addressSpace: null,
                address: null,
                start: null,
                end: null,
                fromAddressSpace: null,
                fromAddress: null,
                toAddressSpace: null,
                toAddress: null,
                // Unowned accesses must never become instruction observations through a coordinate query.
                instructionAddressSpace: record.context === "instruction" ? record.addressSpace : null,
                instructionAddress: record.context === "instruction" ? record.pc : null,
                accessedAddressSpace: record.addressSpace,
                accessedAddress: record.address,
                coverage: null,
                payload: canonicalJson({
                    ...(record.ppu ? { ppu: record.ppu } : {}),
                    pc: record.pc,
                    value: record.value,
                    direction: record.direction,
                    actor: record.actor,
                    channel: record.channel,
                    phase: record.phase,
                    context: record.context,
                }),
            };
        case "runtime-memory-access":
            return {
                addressSpace: null,
                address: null,
                start: null,
                end: null,
                fromAddressSpace: null,
                fromAddress: null,
                toAddressSpace: null,
                toAddress: null,
                instructionAddressSpace: record.instructionAddressSpace,
                instructionAddress: record.instructionAddress,
                accessedAddressSpace: record.accessedAddressSpace,
                accessedAddress: record.accessedAddress,
                coverage: null,
                payload: canonicalJson({
                    access: record.access,
                    width: record.width,
                    ...(record.actor === undefined ? {} : { actor: record.actor }),
                    ...(record.channel === undefined ? {} : { channel: record.channel }),
                    ...(record.value === undefined ? {} : { value: record.value }),
                }),
            };
        case "runtime-cpu-state":
            return {
                addressSpace: record.addressSpace,
                address: record.address,
                start: null,
                end: null,
                fromAddressSpace: null,
                fromAddress: null,
                toAddressSpace: null,
                toAddress: null,
                instructionAddressSpace: null,
                instructionAddress: null,
                accessedAddressSpace: null,
                accessedAddress: null,
                coverage: null,
                payload: canonicalJson({ state: record.state }),
            };
        case "runtime-coverage":
            return {
                addressSpace: record.addressSpace,
                address: null,
                start: record.start,
                end: record.end,
                fromAddressSpace: null,
                fromAddress: null,
                toAddressSpace: null,
                toAddress: null,
                instructionAddressSpace: null,
                instructionAddress: null,
                accessedAddressSpace: null,
                accessedAddress: null,
                coverage: record.coverage,
                payload: null,
            };
        case "runtime-control-target":
            return {
                addressSpace: null,
                address: null,
                start: null,
                end: null,
                fromAddressSpace: record.fromAddressSpace,
                fromAddress: record.fromAddress,
                toAddressSpace: record.toAddressSpace,
                toAddress: record.toAddress,
                instructionAddressSpace: null,
                instructionAddress: null,
                accessedAddressSpace: null,
                accessedAddress: null,
                coverage: null,
                payload: canonicalJson({ flowKind: record.flowKind, indirect: record.indirect }),
            };
    }
    throw new Error("Unsupported runtime evidence kind.");
};
/** Narrow a SQLite row object; arrays are rejected because rows are keyed by column name. */
function isRowRecord(value) {
    return !Array.isArray(value);
}
/** Require a string column value; `label` names the field in the thrown error. */
function requireString(value, label) {
    if (typeof value !== "string") {
        throw new Error(`Invalid runtime ${label}.`);
    }
    return value;
}
/** Require a finite number; `label` names the field in the thrown error. */
function requireFinite(value, label) {
    if (!isFiniteNumber(value)) {
        throw new Error(`Invalid runtime ${label}.`);
    }
    return value;
}
/** Read an own finite-number field; undefined only when the key is absent, never when present but invalid. */
function optionalFinite(record, key) {
    if (!Object.hasOwn(record, key)) {
        return undefined;
    }
    return requireFinite(record[key], key);
}
/** Require a decoded payload object; undefined means the stored payload was not an object. */
function requirePayload(value) {
    if (!value) {
        throw new Error("Invalid runtime payload.");
    }
    return value;
}
/** Copy a finite-number byte list; the result is detached from the decoded payload. */
function requireBytes(value) {
    if (!Array.isArray(value)) {
        throw new Error("Invalid runtime bytes.");
    }
    const bytes = [];
    for (const entry of value) {
        if (!isFiniteNumber(entry)) {
            throw new Error("Invalid runtime bytes.");
        }
        bytes.push(entry);
    }
    return bytes;
}
/** Accept a register record whose values are strings, booleans or finite numbers. */
function isRuntimeState(value) {
    return (isRecord(value) &&
        Object.values(value).every((entry) => typeof entry === "string" || typeof entry === "boolean" || isFiniteNumber(entry)));
}
/** Require a register record; the validated object is returned without copying. */
function requireState(value) {
    if (!isRuntimeState(value)) {
        throw new Error("Invalid runtime state.");
    }
    return value;
}
/** Require the only CPU address space accepted for bus access facts. */
function requireCpuSpace(value) {
    if (value === "snes.cpu") {
        return value;
    }
    throw new Error("Invalid runtime address space.");
}
/** Require a bus transfer direction. */
function requireDirection(value) {
    if (value === "read" || value === "write") {
        return value;
    }
    throw new Error("Invalid runtime direction.");
}
/** Require the bus master that issued an access. */
function requireBusActor(value) {
    if (value === "cpu" || value === "dma" || value === "hdma") {
        return value;
    }
    throw new Error("Invalid runtime actor.");
}
/** Require the bus phase; HDMA distinguishes table, indirect and transfer fetches. */
function requirePhase(value) {
    if (value === "cpu" ||
        value === "dma" ||
        value === "hdma-indirect" ||
        value === "hdma-table" ||
        value === "hdma-transfer") {
        return value;
    }
    throw new Error("Invalid runtime phase.");
}
/** Require the CPU context an access was attributed to. */
function requireContext(value) {
    if (value === "unattributed" ||
        value === "instruction" ||
        value === "interrupt" ||
        value === "wait" ||
        value === "stop") {
        return value;
    }
    throw new Error("Invalid runtime context.");
}
/** Require a finite number or null; null means the value was not observed. */
function requireNullableFinite(value, label) {
    if (value === null) {
        return null;
    }
    return requireFinite(value, label);
}
/** Require a memory access mode; `unknown` is a persisted value, not a missing one. */
function requireMemoryAccess(value) {
    if (value === "read" || value === "write" || value === "read-write" || value === "unknown") {
        return value;
    }
    throw new Error("Invalid runtime access.");
}
/** Require a coverage classification. */
function requireCoverage(value) {
    if (value === "executed" || value === "operand" || value === "read" || value === "written") {
        return value;
    }
    throw new Error("Invalid runtime coverage.");
}
/** Accept one PPU byte effect with numeric address and value. */
function isPpuByte(value) {
    return isRecord(value) && isFiniteNumber(value.address) && isFiniteNumber(value.value);
}
/** Validate and copy a PPU effect; VRAM size is 64 KiB, 128 KiB or null when unknown. */
function requirePpu(value) {
    if (!isRecord(value) ||
        (value.target !== "vram" && value.target !== "cgram" && value.target !== "oam") ||
        (value.outcome !== "written" && value.outcome !== "blocked" && value.outcome !== "latched") ||
        typeof value.forcedBlank !== "boolean" ||
        typeof value.renderingRestricted !== "boolean" ||
        (value.implementation !== "accurate" && value.implementation !== "performance") ||
        (value.vramBytes !== null && value.vramBytes !== 65536 && value.vramBytes !== 131072) ||
        !Array.isArray(value.bytes)) {
        throw new Error("Invalid runtime ppu effect.");
    }
    const bytes = [];
    for (const entry of value.bytes) {
        if (!isPpuByte(entry)) {
            throw new Error("Invalid runtime ppu effect.");
        }
        bytes.push({ address: entry.address, value: entry.value });
    }
    return {
        target: value.target,
        outcome: value.outcome,
        forcedBlank: value.forcedBlank,
        renderingRestricted: value.renderingRestricted,
        implementation: value.implementation,
        vramBytes: value.vramBytes,
        bytes,
    };
}
/** Decode a payload column; SQL NULL yields an empty object, a non-object yields undefined. */
function readPayload(value) {
    if (value === null || value === undefined) {
        return {};
    }
    const parsed = parseSqlitePayload(value);
    return isRecord(parsed) ? parsed : undefined;
}
/**
 * Validate all captured registers before selecting decoder fields, including otherwise unused ones.
 * Bytes are detached; the validated state belongs to the caller's decoded payload.
 */
export const runtimeInstructionFields = (value) => {
    const body = requirePayload(value);
    return { bytes: requireBytes(body.bytes), state: requireState(body.state) };
};
/**
 * Reconstruct a semantic fact without inventing absent optional fields. Stable-ID comparisons
 * depend on preserving the same payload across inserts and subsequent reads.
 * @param row SQLite runtime row selected with all columns.
 * @returns Decoded fact in its original discriminated shape.
 */
export const runtimeFromRow = (row) => {
    if (!isRowRecord(row)) {
        throw new Error("Invalid runtime row.");
    }
    const extra = readPayload(row.payload);
    // LEFT JOIN keeps a corrupt dictionary reference visible. Silently omitting the row would lose history.
    if (typeof row.evidence !== "string") {
        throw new Error("Missing SQLite runtime evidence dictionary entry.");
    }
    const parsedEvidence = JSON.parse(row.evidence);
    if (!isStringArray(parsedEvidence)) {
        throw new Error("Invalid runtime evidence list.");
    }
    const kind = row.kind;
    const count = Number(row.count);
    const id = decodeSqliteRuntimeIdentity(row.id_prefix, row.id);
    if (kind === "runtime-execution") {
        const body = requirePayload(extra);
        const fileOffset = optionalFinite(body, "fileOffset");
        const size = optionalFinite(body, "size");
        const opcode = optionalFinite(body, "opcode");
        return {
            id,
            kind,
            architecture: requireString(row.architecture, "architecture"),
            count,
            evidence: parsedEvidence,
            addressSpace: requireString(row.address_space, "address space"),
            address: Number(row.address),
            ...(fileOffset === undefined ? {} : { fileOffset }),
            ...(size === undefined ? {} : { size }),
            ...(opcode === undefined ? {} : { opcode }),
        };
    }
    if (kind === "runtime-instruction") {
        return {
            id,
            kind,
            architecture: requireString(row.architecture, "architecture"),
            count,
            evidence: parsedEvidence,
            addressSpace: requireString(row.address_space, "address space"),
            address: Number(row.address),
            ...runtimeInstructionFields(extra),
        };
    }
    if (kind === "runtime-graphics-access") {
        const fact = {
            ...requirePayload(extra),
            addressSpace: row.accessed_address_space,
            address: row.accessed_address,
        };
        if (!isRuntimeGraphicsFact(fact)) {
            throw new Error("Invalid stored graphics fact.");
        }
        return {
            ...fact,
            id,
            kind,
            architecture: requireString(row.architecture, "architecture"),
            count,
            evidence: parsedEvidence,
        };
    }
    if (kind === "runtime-bus-access") {
        const body = requirePayload(extra);
        return {
            id,
            kind,
            architecture: requireString(row.architecture, "architecture"),
            count,
            evidence: parsedEvidence,
            ...(body.ppu === undefined ? {} : { ppu: requirePpu(body.ppu) }),
            addressSpace: requireCpuSpace(row.accessed_address_space),
            address: Number(row.accessed_address),
            pc: requireFinite(body.pc, "pc"),
            value: requireFinite(body.value, "value"),
            direction: requireDirection(body.direction),
            actor: requireBusActor(body.actor),
            channel: requireNullableFinite(body.channel, "channel"),
            phase: requirePhase(body.phase),
            context: requireContext(body.context),
        };
    }
    if (kind === "runtime-memory-access") {
        const body = requirePayload(extra);
        const actor = optionalBusActor(body);
        const channel = optionalFinite(body, "channel");
        const value = optionalFinite(body, "value");
        return {
            id,
            kind,
            architecture: requireString(row.architecture, "architecture"),
            count,
            evidence: parsedEvidence,
            instructionAddressSpace: requireString(row.instruction_address_space, "address space"),
            instructionAddress: Number(row.instruction_address),
            accessedAddressSpace: requireString(row.accessed_address_space, "address space"),
            accessedAddress: Number(row.accessed_address),
            access: requireMemoryAccess(body.access),
            width: requireFinite(body.width, "width"),
            ...actor,
            ...(channel === undefined ? {} : { channel }),
            ...(value === undefined ? {} : { value }),
        };
    }
    if (kind === "runtime-cpu-state") {
        const body = requirePayload(extra);
        return {
            id,
            kind,
            architecture: requireString(row.architecture, "architecture"),
            count,
            evidence: parsedEvidence,
            addressSpace: requireString(row.address_space, "address space"),
            address: Number(row.address),
            state: requireState(body.state),
        };
    }
    if (kind === "runtime-coverage") {
        return {
            id,
            kind,
            architecture: requireString(row.architecture, "architecture"),
            count,
            evidence: parsedEvidence,
            addressSpace: requireString(row.address_space, "address space"),
            start: Number(row.start),
            end: Number(row.end),
            coverage: requireCoverage(row.coverage),
        };
    }
    if (kind === "runtime-control-target") {
        const body = requirePayload(extra);
        return {
            id,
            kind: "runtime-control-target",
            architecture: requireString(row.architecture, "architecture"),
            count,
            evidence: parsedEvidence,
            fromAddressSpace: requireString(row.from_address_space, "address space"),
            fromAddress: Number(row.from_address),
            toAddressSpace: requireString(row.to_address_space, "address space"),
            toAddress: Number(row.to_address),
            flowKind: requireString(body.flowKind, "flow kind"),
            indirect: Boolean(body.indirect),
        };
    }
    throw new Error(`Unsupported stored runtime kind '${String(kind)}'.`);
};
/** Read an optional bus actor as a spreadable fragment; an absent key yields no `actor` field. */
function optionalBusActor(record) {
    if (!Object.hasOwn(record, "actor")) {
        return {};
    }
    return { actor: requireBusActor(record.actor) };
}
/** Accept an absent optional field or a finite number. */
function allowsFinite(value) {
    return value === undefined || isFiniteNumber(value);
}
/** Flat semantic runtime fact, as stored inside an indexed trace payload. */
export function isRuntimeEvidenceRecord(value) {
    if (!isRecord(value) ||
        typeof value.id !== "string" ||
        typeof value.architecture !== "string" ||
        !isFiniteNumber(value.count) ||
        !isStringArray(value.evidence)) {
        return false;
    }
    switch (value.kind) {
        case "runtime-graphics-access":
            return isRuntimeGraphicsFact(value);
        case "runtime-execution":
            return (typeof value.addressSpace === "string" &&
                isFiniteNumber(value.address) &&
                allowsFinite(value.fileOffset) &&
                allowsFinite(value.size) &&
                allowsFinite(value.opcode));
        case "runtime-instruction":
            return (typeof value.addressSpace === "string" &&
                isFiniteNumber(value.address) &&
                Array.isArray(value.bytes) &&
                value.bytes.every(isFiniteNumber) &&
                isRuntimeState(value.state));
        case "runtime-cpu-state":
            return (typeof value.addressSpace === "string" &&
                isFiniteNumber(value.address) &&
                isRuntimeState(value.state));
        case "runtime-coverage":
            return (typeof value.addressSpace === "string" &&
                isFiniteNumber(value.start) &&
                isFiniteNumber(value.end) &&
                (value.coverage === "executed" ||
                    value.coverage === "operand" ||
                    value.coverage === "read" ||
                    value.coverage === "written"));
        case "runtime-control-target":
            return (typeof value.fromAddressSpace === "string" &&
                isFiniteNumber(value.fromAddress) &&
                typeof value.toAddressSpace === "string" &&
                isFiniteNumber(value.toAddress) &&
                typeof value.flowKind === "string" &&
                typeof value.indirect === "boolean");
        case "runtime-memory-access":
            return (typeof value.instructionAddressSpace === "string" &&
                isFiniteNumber(value.instructionAddress) &&
                typeof value.accessedAddressSpace === "string" &&
                isFiniteNumber(value.accessedAddress) &&
                (value.access === "read" ||
                    value.access === "write" ||
                    value.access === "read-write" ||
                    value.access === "unknown") &&
                isFiniteNumber(value.width) &&
                (value.actor === undefined ||
                    value.actor === "cpu" ||
                    value.actor === "dma" ||
                    value.actor === "hdma") &&
                allowsFinite(value.channel) &&
                allowsFinite(value.value));
        case "runtime-bus-access":
            return ((value.ppu === undefined || isBusPpu(value.ppu)) &&
                value.addressSpace === "snes.cpu" &&
                isFiniteNumber(value.address) &&
                isFiniteNumber(value.pc) &&
                isFiniteNumber(value.value) &&
                (value.direction === "read" || value.direction === "write") &&
                (value.actor === "cpu" || value.actor === "dma" || value.actor === "hdma") &&
                (value.channel === null || isFiniteNumber(value.channel)) &&
                (value.phase === "cpu" ||
                    value.phase === "dma" ||
                    value.phase === "hdma-indirect" ||
                    value.phase === "hdma-table" ||
                    value.phase === "hdma-transfer") &&
                (value.context === "unattributed" ||
                    value.context === "instruction" ||
                    value.context === "interrupt" ||
                    value.context === "wait" ||
                    value.context === "stop"));
        default:
            return false;
    }
}
/** Non-throwing counterpart of `requirePpu` for validating flat trace payloads. */
function isBusPpu(value) {
    return (isRecord(value) &&
        (value.target === "vram" || value.target === "cgram" || value.target === "oam") &&
        (value.outcome === "written" || value.outcome === "blocked" || value.outcome === "latched") &&
        typeof value.forcedBlank === "boolean" &&
        typeof value.renderingRestricted === "boolean" &&
        (value.implementation === "accurate" || value.implementation === "performance") &&
        (value.vramBytes === null || value.vramBytes === 65536 || value.vramBytes === 131072) &&
        Array.isArray(value.bytes) &&
        value.bytes.every(isPpuByte));
}
/**
 * Extract a point coordinate for persisted analysis metadata. Interval-only records have none.
 * @param record Semantic analysis variant.
 * @returns Point or source coordinate, with null columns when no point is represented.
 */
export const analysisAddress = (record) => {
    if ("addressSpace" in record && "address" in record) {
        return { addressSpace: record.addressSpace, address: record.address };
    }
    if ("addressSpace" in record && "fromAddress" in record) {
        return { addressSpace: record.addressSpace, address: record.fromAddress };
    }
    return { addressSpace: null, address: null };
};
//# sourceMappingURL=sqlite-records.js.map