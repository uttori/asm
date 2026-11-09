import * as fs from "node:fs";
import path from "node:path";
import { canonicalSnesWramAddress } from "./ram-map.js";
import { validateSnesStructInstructionUses, } from "./struct-instruction-uses.js";
/** Optional, user-owned layout and address bindings consumed by source export. */
export const SNES_STRUCT_MAP_SOURCE = "struct-map.json";
/** Generated native structs included by the exported assembler entry point. */
export const SNES_STRUCT_DEFINES_SOURCE = "structs.asm";
const widths = { db: 1, dw: 2, dl: 3, dd: 4 };
/**
 * Infer scalar widths for 1–4-byte fields and byte arrays for larger fields without an explicit type.
 * @param field Validated field or synthesized opaque gap.
 * @returns Native scalar/array declaration.
 */
const fieldType = (field) => field.type ?? (["", "db", "dw", "dl", "dd"][field.size] || `db[${field.size}]`);
/** Format ROM offsets in struct-map validation errors. */
const hex = (value) => `$${value.toString(16).toUpperCase()}`;
/** Collapse whitespace in user-authored struct-map text fields. */
const comment = (value) => value.replaceAll(/\s+/g, " ").trim();
/**
 * Accepts a JSON object. Arrays and null are not struct-map records.
 * @param value Candidate record.
 * @returns True when `value` is a non-array object.
 */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/**
 * Accepts an array of strings.
 * @param value Candidate notes array.
 * @returns True when every element is a string.
 */
const isStringList = (value) => Array.isArray(value) && value.every((entry) => typeof entry === "string");
/**
 * Require a plain object when parsing struct-map JSON entries.
 * @param value Raw JSON fragment.
 */
const object = (value) => {
    if (!isRecord(value)) {
        throw new Error("Struct-map records must be objects.");
    }
    return value;
};
/**
 * Parse a safe integer within bounds for struct-map metadata.
 * @param value Raw numeric field.
 * @param minimum Smallest accepted value.
 * @param maximum Largest accepted value.
 */
const integer = (value, minimum = 0, maximum = 0xffffff) => {
    if (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < minimum ||
        value > maximum) {
        throw new Error(`Invalid struct-map integer '${String(value)}'.`);
    }
    return value;
};
/**
 * Validate a non-reserved struct-map identifier string.
 * @param value Candidate name from JSON.
 */
const identifier = (value) => {
    if (typeof value !== "string" || !/^[A-Z_a-z]\w*$/.test(value) || /^__gap_|^snes_/i.test(value)) {
        throw new Error(`Invalid or reserved struct-map identifier '${String(value)}'.`);
    }
    return value;
};
/**
 * Normalize optional note arrays to trimmed non-empty lines.
 * @param value Raw notes field from JSON.
 */
const notes = (value) => {
    if (value === undefined) {
        return [];
    }
    if (!isStringList(value)) {
        throw new Error("Struct-map notes must be an array of strings.");
    }
    return value.map(comment);
};
/**
 * Normalize optional ROM entry names/descriptions without interpreting them as assembly.
 * Keys are canonical decimal logical indexes, so one-based bindings cannot silently shift names.
 * @param value Untrusted JSON object mapping logical indexes to comment text.
 * @param firstIndex Lowest allowed logical index, from the validated binding.
 * @param count Number of physical records owned by that binding.
 * @returns Non-empty, single-line comments for valid indexes.
 */
const entryComments = (value, firstIndex, count) => {
    const result = {};
    for (const [key, text] of Object.entries(object(value))) {
        const index = Number(key);
        if (!/^(0|[1-9]\d*)$/.test(key) ||
            !Number.isSafeInteger(index) ||
            index < firstIndex ||
            index >= firstIndex + count) {
            throw new Error(`Struct entry comment index '${key}' is outside the binding's logical indexes.`);
        }
        if (typeof text !== "string" || !comment(text)) {
            throw new Error(`Struct entry comment '${key}' must be a non-empty string.`);
        }
        result[index] = comment(text);
    }
    return result;
};
/**
 * Validate layouts and non-overlapping bindings before any generated files are changed.
 * Extra source/provenance properties are retained in the input file, not interpreted as code.
 * @param value Parsed JSON metadata.
 * @returns Normalized layouts and bindings.
 */
export const validateSnesStructMap = (value) => {
    const file = object(value);
    if (file.format !== "uttori-asm-snes-struct-map" || file.schemaVersion !== 1) {
        throw new Error("Unsupported SNES struct-map format or schema.");
    }
    if (!Array.isArray(file.structures) || !Array.isArray(file.bindings)) {
        throw new Error("Struct map requires structures and bindings arrays.");
    }
    const names = new Set();
    const uniqueName = (nameInput) => {
        const name = identifier(nameInput);
        if (names.has(name.toLowerCase())) {
            throw new Error(`Duplicate struct-map name '${name}'.`);
        }
        names.add(name.toLowerCase());
        return name;
    };
    const structures = file.structures.map((input) => {
        const entry = object(input);
        const id = uniqueName(entry.id);
        const size = integer(entry.size, 1, 0x10000);
        if (entry.byteOrder !== undefined && entry.byteOrder !== "little") {
            throw new Error(`Struct '${id}' must use little-endian fields.`);
        }
        if (!Array.isArray(entry.fields)) {
            throw new Error(`Struct '${id}' requires a fields array.`);
        }
        const fieldNames = new Set();
        const fields = entry.fields
            .map((inputField) => {
            const field = object(inputField);
            const name = identifier(field.name);
            if (fieldNames.has(name.toLowerCase())) {
                throw new Error(`Duplicate struct field '${id}.${name}'.`);
            }
            fieldNames.add(name.toLowerCase());
            if (field.description !== undefined && typeof field.description !== "string") {
                throw new Error(`Invalid description for '${id}.${name}'.`);
            }
            const fieldSize = integer(field.size, 1, size);
            let type;
            if (field.type !== undefined) {
                if (typeof field.type !== "string") {
                    throw new Error(`Invalid field type '${id}.${name}'.`);
                }
                // oxlint-disable-next-line security/detect-unsafe-regex -- The fixed width token and decimal count cannot overlap.
                const match = field.type.match(/^(db|dw|dl|dd)(?:\[([1-9]\d*)])?$/i);
                const repeatText = match !== null && match.length > 2 ? match[2] : undefined;
                if (!match || widths[match[1].toLowerCase()] * Number(repeatText ?? 1) !== fieldSize) {
                    throw new Error(`Field type '${id}.${name}' must match its size (${fieldSize} bytes).`);
                }
                type = field.type.toLowerCase();
            }
            return {
                name,
                offset: integer(field.offset, 0, size - 1),
                size: fieldSize,
                ...(type === undefined ? {} : { type }),
                ...(field.description === undefined ? {} : { description: comment(field.description) }),
            };
        })
            .toSorted((a, b) => a.offset - b.offset);
        let end = 0;
        for (const field of fields) {
            if (field.offset < end || field.offset + field.size > size) {
                throw new Error(`Struct field '${id}.${field.name}' overlaps or exceeds the layout.`);
            }
            end = field.offset + field.size;
        }
        return { id, size, fields, notes: notes(entry.notes) };
    });
    const byName = new Map(structures.map((structure) => [structure.id, structure]));
    const bindings = file.bindings
        .map((input) => {
        const entry = object(input);
        const name = uniqueName(entry.name);
        const structure = byName.get(String(entry.structure));
        if (!structure) {
            throw new Error(`Unknown layout '${String(entry.structure)}' for '${name}'.`);
        }
        const address = integer(entry.address);
        const count = integer(entry.count, 1);
        const firstIndex = integer(entry.firstIndex ?? 0);
        if (address - firstIndex * structure.size < 0) {
            throw new Error(`Struct binding '${name}' has an invalid first index.`);
        }
        const length = count * structure.size;
        if (address + length > 0x1000000) {
            throw new Error(`Struct binding '${name}' exceeds CPU memory.`);
        }
        const fileOffset = entry.fileOffset === undefined ? undefined : integer(entry.fileOffset);
        if (fileOffset === undefined && (address < 0x7e0000 || address + length > 0x800000)) {
            throw new Error(`RAM struct '${name}' must be bound inside canonical WRAM.`);
        }
        if (entry.entryComments !== undefined && fileOffset === undefined) {
            throw new Error(`Struct entry comments require a ROM binding ('${name}').`);
        }
        return {
            name,
            structure,
            address,
            count,
            firstIndex,
            ...(fileOffset === undefined ? {} : { fileOffset }),
            notes: notes(entry.notes),
            ...(entry.entryComments === undefined
                ? {}
                : {
                    entryComments: entryComments(entry.entryComments, firstIndex, count),
                }),
        };
    })
        .toSorted((a, b) => a.address - b.address);
    for (let index = 1; index < bindings.length; index++) {
        const previous = bindings[index - 1];
        if (bindings[index].address < previous.address + previous.structure.size * previous.count) {
            throw new Error(`Struct bindings '${previous.name}' and '${bindings[index].name}' overlap.`);
        }
    }
    const romBindings = bindings
        .filter((binding) => binding.fileOffset !== undefined)
        .toSorted((a, b) => a.fileOffset - b.fileOffset);
    for (let index = 1; index < romBindings.length; index++) {
        const previous = romBindings[index - 1];
        if (romBindings[index].fileOffset <
            previous.fileOffset + previous.structure.size * previous.count) {
            throw new Error(`ROM struct bindings '${previous.name}' and '${romBindings[index].name}' overlap.`);
        }
    }
    if (file.constants !== undefined && !Array.isArray(file.constants)) {
        throw new Error("Struct-map constants must be an array.");
    }
    // Share the layout/binding namespace so assembly cannot silently resolve a different owner.
    const constants = (file.constants ?? []).map((input) => {
        const entry = object(input);
        if (typeof entry.description !== "string" || !entry.description.trim()) {
            throw new Error("Struct-map constants require a description.");
        }
        return {
            name: uniqueName(entry.name),
            value: integer(entry.value),
            description: comment(entry.description),
        };
    });
    const instructionUses = validateSnesStructInstructionUses(file.instructionUses, structures, bindings, constants);
    return {
        structures,
        bindings,
        ...(constants.length ? { constants } : {}),
        ...(instructionUses.length ? { instructionUses } : {}),
    };
};
/**
 * Load optional layout metadata. Existing projects without a struct map export as before.
 * @param directory Source-export root.
 * @returns Validated metadata when present.
 */
export const loadSnesStructMap = (directory) => {
    const filename = path.join(directory, SNES_STRUCT_MAP_SOURCE);
    if (!fs.existsSync(filename)) {
        return undefined;
    }
    try {
        const sourceBytes = fs.readFileSync(filename);
        return { ...validateSnesStructMap(JSON.parse(sourceBytes.toString("utf8"))), sourceBytes };
    }
    catch (error) {
        // Worker hosts forward only the message, so preserve the input filename alongside record locations.
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid SNES struct map ${filename}: ${detail} Correct this input before regenerating.`, { cause: error });
    }
};
/**
 * Synthesize opaque gap fields so every byte in the layout stride is accounted for.
 * @param structure Validated layout whose declared fields may leave holes.
 */
const completeFields = (structure) => {
    const fields = [];
    let offset = 0;
    const gap = (end) => {
        if (end > offset) {
            fields.push({
                name: `__gap_${offset.toString(16)}`,
                offset,
                size: end - offset,
                type: `db[${end - offset}]`,
            });
        }
    };
    for (const field of structure.fields) {
        gap(field.offset);
        fields.push(field);
        offset = field.offset + field.size;
    }
    gap(structure.size);
    return fields;
};
/**
 * Render both reusable offsets and addressed native structs from the same field definitions.
 * @param map Validated layouts and bindings.
 * @returns Native assembler source. Structs reserve offsets without emitting bytes.
 */
export const renderSnesStructDefines = (map) => {
    const lines = [
        "; Layouts have base zero. Bindings use CPU addresses. Indexed fields use sizeof(struct).",
        "",
    ];
    for (const constant of map.constants ?? []) {
        lines.push(`; ${constant.description}`, `${constant.name} = ${hex(constant.value)}`, "");
    }
    const render = (name, base, structure, detail, binding) => {
        lines.push(`; ${name}: ${hex(structure.size)} bytes per record.`);
        // Notes come from the struct map. Retain their order without an input-sized argument list.
        for (const note of detail) {
            lines.push(`; ${note}`);
        }
        lines.push(`struct ${name} ${hex(base)}`);
        for (const field of completeFields(structure)) {
            lines.push(`  .${field.name}: ${fieldType(field)} ; +${hex(field.offset)}${field.description ? ` ${field.description}` : ""}`);
        }
        lines.push(binding ? `endstruct count ${binding.count} firstindex ${binding.firstIndex}` : "endstruct", "");
    };
    for (const structure of map.structures) {
        render(structure.id, 0, structure, structure.notes);
    }
    for (const binding of map.bindings) {
        render(binding.name, binding.address - binding.firstIndex * binding.structure.size, binding.structure, [
            `${binding.structure.id}; ${binding.count} mapped record(s), indexes ${binding.firstIndex} through ${binding.firstIndex + binding.count - 1}.`,
            ...binding.notes,
        ], binding);
    }
    return `${lines.join("\n")}\n`;
};
/**
 * Render a physical record's field using the binding's logical index.
 * @param binding Validated owner, including its count and index origin.
 * @param index Zero-based physical record offset within the binding.
 * @param field Named field within the record layout.
 * @returns Native field reference; only a scalar at logical index zero omits brackets.
 */
const fieldExpression = (binding, index, field) => {
    const logicalIndex = index + binding.firstIndex;
    // Only scalar bindings omit [0], keeping every physical array element visibly indexed.
    const suffix = binding.count === 1 && logicalIndex === 0 ? "" : `[${logicalIndex}]`;
    return `${binding.name}${suffix}.${field.name}`;
};
/**
 * Index known data bytes by canonical CPU address, leaving unknown gaps unnamed.
 * @param map Optional validated metadata.
 * @param [indexed] Also name biased array bases used with a runtime CPU index.
 * @returns Native field expressions, including interior-byte offsets.
 */
export const indexSnesStructFields = (map, indexed = false) => {
    const result = new Map();
    for (const binding of map?.bindings ?? []) {
        for (let index = 0; index < binding.count; index++) {
            for (const field of binding.structure.fields) {
                const expression = fieldExpression(binding, index, field);
                for (let offset = 0; offset < field.size; offset++) {
                    const address = binding.address + index * binding.structure.size + field.offset + offset;
                    result.set(address, offset === 0 ? expression : `(${expression} + ${hex(offset)})`);
                }
            }
        }
    }
    if (indexed) {
        for (const binding of map?.bindings ?? []) {
            if (binding.firstIndex === 0) {
                continue;
            }
            const base = binding.address - binding.firstIndex * binding.structure.size;
            for (const field of binding.structure.fields) {
                for (let offset = 0; offset < field.size; offset++) {
                    const expression = `${binding.name}.${field.name}`;
                    result.set(base + field.offset + offset, offset === 0 ? expression : `(${expression} + ${hex(offset)})`);
                }
            }
        }
    }
    return result;
};
/**
 * Validate CPU/file continuity and expand ROM arrays into physical fields for source emission.
 * @param map Optional validated metadata.
 * @param romSize Headerless ROM size.
 * @param cpuAddress Mapper conversion for a file offset.
 * @returns Physical field ranges, sorted by ROM offset.
 */
export const planSnesStructRomFields = (map, romSize, cpuAddress) => {
    const fields = [];
    for (const binding of map?.bindings ?? []) {
        if (binding.fileOffset === undefined) {
            continue;
        }
        const length = binding.structure.size * binding.count;
        if (binding.fileOffset + length > romSize ||
            canonicalSnesWramAddress(binding.address) !== undefined) {
            throw new Error(`ROM struct '${binding.name}' lies outside the ROM.`);
        }
        for (let offset = 0; offset < length; offset++) {
            if (cpuAddress(binding.fileOffset + offset) !== binding.address + offset) {
                throw new Error(`ROM struct '${binding.name}' has inconsistent CPU/file mapping.`);
            }
        }
        for (let index = 0; index < binding.count; index++) {
            const record = {
                start: binding.fileOffset + index * binding.structure.size,
                end: binding.fileOffset + (index + 1) * binding.structure.size,
                binding,
                index: index + binding.firstIndex,
            };
            for (const field of completeFields(binding.structure)) {
                const start = binding.fileOffset + index * binding.structure.size + field.offset;
                fields.push({
                    start,
                    end: start + field.size,
                    expression: fieldExpression(binding, index, field),
                    record,
                });
            }
        }
    }
    return fields.toSorted((a, b) => a.start - b.start);
};
/**
 * Encode every named field (including opaque gaps) from immutable ROM bytes. Field descriptions
 * stay on the authoritative declarations in structs.asm so every data row does not repeat them.
 * @param record Complete, mapped record ownership.
 * @param bytes Exactly the original record bytes.
 * @returns Named initializer assignments, including opaque gaps.
 */
export const renderSnesStructInitializerFields = (record, bytes) => {
    if (bytes.length !== record.end - record.start) {
        throw new Error("Struct initializer requires a complete record.");
    }
    return completeFields(record.binding.structure).map((field) => {
        const type = fieldType(field);
        const width = widths[type.slice(0, 2)];
        const values = [];
        for (let offset = field.offset; offset < field.offset + field.size; offset += width) {
            let value = 0;
            for (let byte = 0; byte < width; byte++) {
                value += bytes[offset + byte] * 2 ** (8 * byte);
            }
            values.push(`$${value
                .toString(16)
                .toUpperCase()
                .padStart(width * 2, "0")}`);
        }
        return {
            assignment: `${field.name} = ${type.includes("[") ? `[${values.join(", ")}]` : values[0]}`,
        };
    });
};
/**
 * Render one complete record as a compact native initializer without field documentation.
 * @param record Complete mapped record ownership.
 * @param bytes Exact record bytes from the ROM.
 * @returns Single-line brace initializer for callers that manage source layout.
 */
export const renderSnesStructInitializer = (record, bytes) => `{ ${renderSnesStructInitializerFields(record, bytes)
    .map((field) => field.assignment)
    .join(", ")} }`;
/**
 * Emit a complete field or a metadata-split fragment without changing any original byte.
 * The assertion makes the binding's actual placement part of the assembler build contract.
 * @param field Physical field and its native address expression.
 * @param start Fragment file offset.
 * @param bytes Exact fragment bytes from the ROM.
 * @returns Address assertion plus native data directive.
 */
export const renderSnesStructData = (field, start, bytes) => {
    const offset = start - field.start;
    const expression = offset === 0 ? field.expression : `${field.expression} + ${hex(offset)}`;
    const width = offset === 0 && bytes.length === field.end - field.start && bytes.length <= 4
        ? bytes.length
        : 1;
    const values = [];
    for (let index = 0; index < bytes.length; index += width) {
        let value = 0;
        for (let byte = 0; byte < width; byte++) {
            value += bytes[index + byte] * 2 ** (8 * byte);
        }
        values.push(`$${value
            .toString(16)
            .toUpperCase()
            .padStart(width * 2, "0")}`);
    }
    return [
        `  assert pc() == ${expression}`,
        `  ${["", "db", "dw", "dl", "dd"][width]} ${values.join(", ")} ; ${expression}`,
    ];
};
//# sourceMappingURL=struct-map.js.map