import { describeSnesStructAccess, SnesStructExpressionResolver, } from "./struct-expressions.js";
const record = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Struct instruction-use entries must be objects.");
    }
    return value;
};
const integer = (value, min, max) => {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error(`Invalid struct instruction-use integer '${String(value)}'.`);
    }
    return value;
};
/**
 * Collapse whitespace so provenance remains a comment and cannot inject assembly lines.
 * @param {unknown} value Required user-supplied explanation.
 * @returns {string} Non-empty text restricted to one source line.
 */
const text = (value) => {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error("Struct instruction uses require non-empty reason/source/detail strings.");
    }
    return value.replaceAll(/\s+/g, " ").trim();
};
const hex = (value) => `$${value.toString(16).toUpperCase()}`;
/**
 * Resolve optional instructionUses against already validated layouts and bindings.
 * Native expressions name exact operands; observations describe complete spans within a binding.
 * @param {unknown} value Optional instructionUses array from JSON.
 * @param {readonly SnesStructLayout[]} structures Validated zero-based layouts.
 * @param {readonly SnesStructBinding[]} bindings Validated physical record bindings.
 * @returns {readonly SnesStructInstructionUse[]} Resolved uses in CPU-address order.
 */
export const validateSnesStructInstructionUses = (value, structures, bindings) => {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new Error("Struct instructionUses must be an array.");
    }
    if (value.length === 0) {
        return [];
    }
    const resolver = new SnesStructExpressionResolver(structures, bindings);
    const addresses = new Set();
    return value
        .map((input) => {
        const entry = record(input);
        const address = integer(entry.address, 0, 0xffffff);
        if (addresses.has(address)) {
            throw new Error(`Duplicate struct instruction use at ${hex(address)}.`);
        }
        addresses.add(address);
        if (!Array.isArray(entry.expectedBytes) ||
            entry.expectedBytes.length < 1 ||
            entry.expectedBytes.length > 4) {
            throw new Error("Struct instruction uses require 1–4 complete expectedBytes.");
        }
        const expectedBytes = entry.expectedBytes.map((byte) => integer(byte, 0, 0xff));
        let operand;
        if (entry.operand !== undefined) {
            const resolved = resolver.resolve(entry.operand);
            operand = { expression: resolved.expression, value: integer(resolved.value, 0, 0xffff) };
        }
        if (entry.observations !== undefined && !Array.isArray(entry.observations)) {
            throw new Error("Struct observations must be an array.");
        }
        const observations = (entry.observations ?? []).map((inputObservation) => {
            const observation = record(inputObservation);
            const width = integer(observation.width, 1, 2);
            const target = resolver.resolve(observation.target);
            // Ownership must come from the expression, not a coincidental address match in another binding.
            if (target.bindings.length !== 1) {
                throw new Error("Struct observation target must reference exactly one binding.");
            }
            const binding = target.bindings[0];
            const parts = describeSnesStructAccess(binding, target.value, width);
            const { access, provenance } = observation;
            if (access !== "read" && access !== "write" && access !== "read-write") {
                throw new Error("Struct observation access must be read, write or read-write.");
            }
            if (provenance !== "observed" && provenance !== "trace-derived") {
                throw new Error("Struct observation provenance must be observed or trace-derived.");
            }
            if (typeof observation.romSha256 !== "string" ||
                !/^[\da-f]{64}$/.test(observation.romSha256)) {
                throw new Error("Struct observations require the capture ROM SHA-256.");
            }
            return {
                expression: target.expression,
                address: target.value,
                binding: binding.name,
                parts,
                width,
                access,
                provenance,
                source: text(observation.source),
                detail: text(observation.detail),
                romSha256: observation.romSha256,
            };
        });
        if (!operand && observations.length === 0) {
            throw new Error("A struct instruction use requires an operand or observations.");
        }
        // An immediate denotes a value, while a captured access denotes a memory operand.
        // Combining them at one instruction would assign incompatible meanings to that operand.
        if (operand && observations.length) {
            throw new Error("A struct instruction use cannot combine an immediate and memory observations.");
        }
        return {
            address,
            expectedBytes,
            reason: text(entry.reason),
            ...(operand ? { operand } : {}),
            observations,
        };
    })
        .sort((a, b) => a.address - b.address);
};
/**
 * Index only annotated instructions, O(uses), rather than scanning uses for every CFG variant.
 * Mapper aliases, complete byte encodings and capture ROM identities are checked before export.
 * The callback returns undefined for unmapped addresses; instruction bytes must map contiguously.
 * @param {readonly SnesStructInstructionUse[] | undefined} uses Validated instruction uses.
 * @param {RomImage} rom Immutable ROM supplying instruction bytes and capture identity.
 * @param {Function} toFileOffset Mapper-specific CPU-to-ROM translation.
 * @returns {ReadonlyMap<number, SnesStructInstructionUse> | undefined} Sparse lookup, absent when unused.
 */
export const indexSnesStructInstructionUses = (uses, rom, toFileOffset) => {
    if (!uses?.length) {
        return undefined;
    }
    const result = new Map();
    for (const use of uses) {
        const offset = toFileOffset(use.address);
        const last = toFileOffset(use.address + use.expectedBytes.length - 1);
        if (offset === undefined || offset < 0 || last !== offset + use.expectedBytes.length - 1) {
            throw new Error(`Struct instruction use at ${hex(use.address)} is not contiguous ROM.`);
        }
        if (result.has(offset)) {
            throw new Error(`Aliased struct instruction uses at ROM ${hex(offset)}.`);
        }
        const bytes = rom.read(offset, use.expectedBytes.length);
        if (!bytes || use.expectedBytes.some((byte, index) => byte !== bytes[index])) {
            throw new Error(`Stale struct instruction bytes at ${hex(use.address)}.`);
        }
        for (const observation of use.observations) {
            if (observation.romSha256 !== rom.identity.contentSha256) {
                throw new Error(`Struct observation '${observation.source}' belongs to a different ROM.`);
            }
        }
        result.set(offset, use);
    }
    return result;
};
/**
 * Replace a proven immediate with its native struct expression, preserving the encoded width.
 * This runs for every accepted state variant. A size/value mismatch is an error, never truncation.
 * @param {DecodedInstruction} instruction One accepted decode context.
 * @param {string} source Existing formatted source, including any conservative numeric fallback.
 * @param {SnesStructInstructionUse} use Validated metadata at this ROM instruction.
 * @returns {string} Width-preserving symbolic immediate, or the original instruction for observations.
 */
export const applySnesStructInstructionOperand = (instruction, source, use) => {
    if (instruction.size !== use.expectedBytes.length ||
        use.expectedBytes.some((byte, index) => instruction.bytes[index] !== byte)) {
        throw new Error(`Struct instruction use at ${hex(use.address)} does not match the decoded instruction.`);
    }
    // These references describe explicit memory operands. Stack traffic, DMA and control-flow
    // fetches need their own evidence model and must not masquerade as a struct operand access.
    if (use.observations.length &&
        !instruction.references.some(({ kind }) => kind === "data" || kind === "pointer")) {
        throw new Error(`Struct observations at ${hex(use.address)} require a memory operand.`);
    }
    if (!use.operand) {
        return source;
    }
    const operand = instruction.operands[0];
    if (instruction.mode !== "immediate" ||
        instruction.operands.length !== 1 ||
        (operand?.width !== 1 && operand?.width !== 2) ||
        operand.value !== use.operand.value ||
        use.operand.value >= 2 ** (operand.width * 8)) {
        throw new Error(`Struct operand '${use.operand.expression}' does not match the encoded immediate at ${hex(use.address)}.`);
    }
    return `${instruction.mnemonic}.${operand.width === 1 ? "b" : "w"} #${use.operand.expression}`;
};
/**
 * Render all capture alternatives as comments; they never become fixed-address CPU operands.
 * @param {SnesStructInstructionUse} use Validated instruction metadata in curator-supplied order.
 * @returns {readonly string[]} Individual comment bodies without the leading semicolon.
 */
export const renderSnesStructUseComments = (use) => [
    `[struct use] ${use.reason}`,
    ...use.observations.map((observation) => {
        let coverage = "";
        if (observation.parts.length > 1 || !observation.parts[0].field) {
            coverage = `; covers: ${observation.parts.map((part) => `${part.expression} (${part.width} byte(s)${part.field ? "" : ", opaque"})`).join(", ")}`;
        }
        return `[${observation.provenance} ${observation.access}] ${observation.expression} (${hex(observation.address)}, ${observation.width} byte(s))${coverage}; ${observation.source}: ${observation.detail}`;
    }),
];
//# sourceMappingURL=struct-instruction-uses.js.map