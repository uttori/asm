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
 * Preserve the old renderer's size convention unless metadata specifies a shape.
 * @param {SnesStructField} field Validated field or synthesized opaque gap.
 * @returns {string} Native scalar/array declaration.
 */
const fieldType = (field) => field.type ?? (["", "db", "dw", "dl", "dd"][field.size] || `db[${field.size}]`);
const hex = (value) => `$${value.toString(16).toUpperCase()}`;
const comment = (value) => value.replaceAll(/\s+/g, " ").trim();
const object = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Struct-map records must be objects.");
    }
    return value;
};
const integer = (value, minimum = 0, maximum = 0xffffff) => {
    if (typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < minimum ||
        value > maximum) {
        throw new Error(`Invalid struct-map integer '${String(value)}'.`);
    }
    return value;
};
const identifier = (value) => {
    if (typeof value !== "string" || !/^[A-Z_a-z]\w*$/.test(value) || /^__gap_|^snes_/i.test(value)) {
        throw new Error(`Invalid or reserved struct-map identifier '${String(value)}'.`);
    }
    return value;
};
const notes = (value) => {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
        throw new Error("Struct-map notes must be an array of strings.");
    }
    return value.map(comment);
};
/**
 * Validate layouts and non-overlapping bindings before any generated files are changed.
 * Extra source/provenance properties are retained in the input file, not interpreted as code.
 * @param {unknown} value Parsed JSON metadata.
 * @returns {Omit<LoadedSnesStructMap, "sourceBytes">} Normalized layouts and bindings.
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
    const uniqueName = (value) => {
        const name = identifier(value);
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
                if (!match || widths[match[1].toLowerCase()] * Number(match[2] ?? 1) !== fieldSize) {
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
            .sort((a, b) => a.offset - b.offset);
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
        return {
            name,
            structure,
            address,
            count,
            firstIndex,
            ...(fileOffset === undefined ? {} : { fileOffset }),
            notes: notes(entry.notes),
        };
    })
        .sort((a, b) => a.address - b.address);
    for (let index = 1; index < bindings.length; index++) {
        const previous = bindings[index - 1];
        if (bindings[index].address < previous.address + previous.structure.size * previous.count) {
            throw new Error(`Struct bindings '${previous.name}' and '${bindings[index].name}' overlap.`);
        }
    }
    const romBindings = bindings
        .filter((binding) => binding.fileOffset !== undefined)
        .sort((a, b) => a.fileOffset - b.fileOffset);
    for (let index = 1; index < romBindings.length; index++) {
        const previous = romBindings[index - 1];
        if (romBindings[index].fileOffset <
            previous.fileOffset + previous.structure.size * previous.count) {
            throw new Error(`ROM struct bindings '${previous.name}' and '${romBindings[index].name}' overlap.`);
        }
    }
    const instructionUses = validateSnesStructInstructionUses(file.instructionUses, structures, bindings);
    return { structures, bindings, ...(instructionUses.length ? { instructionUses } : {}) };
};
/**
 * Load optional layout metadata; existing projects without a struct map export as before.
 * @param {string} directory Source-export root.
 * @returns {LoadedSnesStructMap | undefined} Validated metadata when present.
 */
export const loadSnesStructMap = (directory) => {
    const filename = path.join(directory, SNES_STRUCT_MAP_SOURCE);
    if (!fs.existsSync(filename)) {
        return undefined;
    }
    const sourceBytes = fs.readFileSync(filename);
    return { ...validateSnesStructMap(JSON.parse(sourceBytes.toString("utf8"))), sourceBytes };
};
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
 * @param {LoadedSnesStructMap} map Validated layouts and bindings.
 * @returns {string} Native assembler source; structs reserve offsets without emitting bytes.
 */
export const renderSnesStructDefines = (map) => {
    const lines = [
        "; Generated from struct-map.json. Edit that input and export again.",
        "; Layouts have base zero; bindings use CPU addresses. Indexed fields use sizeof(struct).",
        "",
    ];
    const render = (name, base, structure, detail, binding) => {
        lines.push(`; ${name}: ${hex(structure.size)} bytes per record.`);
        // Notes come from the struct map; retain their order without an input-sized argument list.
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
const fieldExpression = (binding, index, field) => `${binding.name}${index + binding.firstIndex === 0 ? "" : `[${index + binding.firstIndex}]`}.${field.name}`;
/**
 * Index known data bytes by canonical CPU address, leaving unknown gaps unnamed.
 * @param {LoadedSnesStructMap | undefined} map Optional validated metadata.
 * @param {boolean} [indexed] Also name biased array bases used with a runtime CPU index.
 * @returns {ReadonlyMap<number, string>} Native field expressions, including interior-byte offsets.
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
 * @param {LoadedSnesStructMap | undefined} map Optional validated metadata.
 * @param {number} romSize Headerless ROM size.
 * @param {(offset: number) => number} cpuAddress Mapper conversion for a file offset.
 * @returns {readonly SnesStructRomField[]} Physical field ranges, sorted by ROM offset.
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
    return fields.sort((a, b) => a.start - b.start);
};
/**
 * Encode every named field (including opaque gaps) from immutable ROM bytes.
 * @param {SnesStructRomRecord} record Complete, mapped record ownership.
 * @param {Uint8Array} bytes Exactly the original record bytes.
 * @returns {string} Named literal suitable for dataStruct or a dataStructs row.
 */
export const renderSnesStructInitializer = (record, bytes) => {
    if (bytes.length !== record.end - record.start) {
        throw new Error("Struct initializer requires a complete record.");
    }
    const assignments = completeFields(record.binding.structure).map((field) => {
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
        return `${field.name} = ${type.includes("[") ? `[${values.join(", ")}]` : values[0]}`;
    });
    return `{ ${assignments.join(", ")} }`;
};
/**
 * Emit a complete field or a metadata-split fragment without changing any original byte.
 * The assertion makes the binding's actual placement part of the assembler build contract.
 * @param {SnesStructRomField} field Physical field and its native address expression.
 * @param {number} start Fragment file offset.
 * @param {Uint8Array} bytes Exact fragment bytes from the ROM.
 * @returns {readonly string[]} Address assertion plus native data directive.
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