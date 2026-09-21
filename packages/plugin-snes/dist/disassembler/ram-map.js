import * as fs from "node:fs";
import path from "node:path";
import { canonicalSourceExportJson } from "@uttori/asm-disassembler";
/** Format identifier for a user-maintained SNES RAM map. */
export const SNES_RAM_MAP_FORMAT = "uttori-asm-snes-ram-map";
/** Current RAM-map schema version. */
export const SNES_RAM_MAP_SCHEMA_VERSION = 1;
/** User-owned RAM-map filename read during every source export. */
export const SNES_RAM_MAP_SOURCE = "ram-map.json";
/** Generated JSON Schema filename used by editors. */
export const SNES_RAM_MAP_SCHEMA_SOURCE = "ram-map.schema.json";
/** Generated assembly definitions included by `main.asm`. */
export const SNES_RAM_DEFINES_SOURCE = "ram-defines.asm";
const hex = (value, width = 6) => `$${value.toString(16).toUpperCase().padStart(width, "0")}`;
const cleanText = (value, field) => {
    const cleaned = value.replaceAll(/\s+/g, " ").trim();
    if (!cleaned) {
        throw new Error(`RAM-map ${field} must not be empty.`);
    }
    return cleaned;
};
/**
 * Bounds a standard LoROM/HiROM SRAM bus window without assuming cartridge size or mirroring.
 * @param {number} address Validated 24-bit CPU address.
 * @returns {number | undefined} Exclusive window end, or undefined outside the supported windows.
 */
const sramWindowEnd = (address) => {
    const bank = address >>> 16;
    const offset = address & 0xffff;
    const hiromBank = (bank >= 0x20 && bank <= 0x3f) || (bank >= 0xa0 && bank <= 0xbf);
    const loromBank = (bank >= 0x70 && bank <= 0x7d) || bank >= 0xf0;
    if ((hiromBank && offset >= 0x6000 && offset <= 0x7fff) || (loromBank && offset <= 0x7fff)) {
        return (address & 0xff0000) + 0x8000;
    }
    return undefined;
};
/**
 * Parses a CPU address and enforces the selected RAM domain before ranges are indexed.
 * @param {string | number} value Hexadecimal string or integer CPU address.
 * @param {"wram" | "sram"} memory Explicit SRAM declaration, or the WRAM default.
 * @returns {number} Valid bus address. Throws for malformed or out-of-domain values.
 */
const parseAddress = (value, memory) => {
    let address;
    if (typeof value === "number") {
        address = value;
    }
    else {
        const text = value.trim();
        if (/^\$[\dA-Fa-f]{1,6}$/.test(text)) {
            address = Number.parseInt(text.slice(1), 16);
        }
        else if (/^0x[\da-f]{1,6}$/i.test(text)) {
            address = Number.parseInt(text.slice(2), 16);
        }
        else {
            throw new Error(`Invalid RAM-map address '${value}'.`);
        }
    }
    if (!Number.isSafeInteger(address) || address < 0 || address > 0xffffff) {
        throw new Error(`Invalid RAM-map CPU address '${String(value)}'.`);
    }
    if (memory === "sram") {
        if (sramWindowEnd(address) === undefined) {
            throw new Error(`RAM-map address '${String(value)}' is outside supported SNES SRAM windows.`);
        }
    }
    else if (address < 0x7e0000 || address > 0x7fffff) {
        throw new Error(`RAM-map address '${String(value)}' is outside canonical SNES WRAM.`);
    }
    return address;
};
/**
 * Validates and normalizes a RAM-map object without reading the filesystem.
 * @param {unknown} value Parsed JSON value.
 * @returns {readonly SnesRamMapVariable[]} Deterministically sorted variables.
 */
export const validateSnesRamMap = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("RAM map must be a JSON object.");
    }
    const file = value;
    if (file.format !== SNES_RAM_MAP_FORMAT) {
        throw new Error("Invalid SNES RAM-map format.");
    }
    if (file.schemaVersion !== SNES_RAM_MAP_SCHEMA_VERSION) {
        throw new Error(`Unsupported SNES RAM-map schema ${String(file.schemaVersion)}.`);
    }
    if (!Array.isArray(file.variables)) {
        throw new Error("RAM map must contain a variables array.");
    }
    if (file.includeSourceInformation !== undefined &&
        typeof file.includeSourceInformation !== "boolean") {
        throw new Error("RAM-map includeSourceInformation must be a boolean.");
    }
    const names = new Set();
    const addresses = new Set();
    const variables = file.variables.map((input, index) => {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            throw new Error(`RAM-map variable ${index + 1} must be an object.`);
        }
        const record = input;
        if (typeof record.name !== "string") {
            throw new Error(`RAM-map variable ${index + 1} name must be a string.`);
        }
        const name = cleanText(record.name, `variable ${index + 1} name`);
        if (!/^[A-Z_a-z]\w*$/.test(name)) {
            throw new Error(`RAM-map variable name '${name}' is not an assembler identifier.`);
        }
        const nameKey = name.toLowerCase();
        if (names.has(nameKey)) {
            throw new Error(`Duplicate RAM-map variable name '${name}'.`);
        }
        names.add(nameKey);
        if (typeof record.address !== "string" && typeof record.address !== "number") {
            throw new Error(`RAM-map variable '${name}' must have a string or integer address.`);
        }
        const memory = record.memory ?? "wram";
        if (memory !== "wram" && memory !== "sram") {
            throw new Error(`RAM-map memory for '${name}' must be 'wram' or 'sram'.`);
        }
        const address = parseAddress(record.address, memory);
        if (addresses.has(address)) {
            throw new Error(`Duplicate RAM-map address '${hex(address)}'. Combine aliases in one entry.`);
        }
        addresses.add(address);
        const size = record.size ?? 1;
        // A SRAM declaration owns one CPU window, not the ROM or I/O beyond its end.
        // Physical size and aliases depend on the cartridge and remain the map author's responsibility.
        const end = memory === "sram" ? sramWindowEnd(address) : 0x800000;
        if (typeof size !== "number" ||
            !Number.isSafeInteger(size) ||
            size < 1 ||
            address + size > end) {
            throw new Error(`Invalid size for RAM-map variable '${name}'.`);
        }
        if (record.category !== undefined && typeof record.category !== "string") {
            throw new Error(`RAM-map category for '${name}' must be a string.`);
        }
        const category = record.category === undefined ? undefined : cleanText(record.category, `${name} category`);
        if (typeof record.description !== "string") {
            throw new Error(`RAM-map description for '${name}' must be a string.`);
        }
        const description = cleanText(record.description, `${name} description`);
        if (record.notes !== undefined && !Array.isArray(record.notes)) {
            throw new Error(`RAM-map notes for '${name}' must be an array.`);
        }
        const notes = (record.notes ?? []).map((note) => {
            if (typeof note !== "string") {
                throw new Error(`RAM-map notes for '${name}' must be strings.`);
            }
            return cleanText(note, `${name} note`);
        });
        let sources;
        if (record.sources !== undefined) {
            if (!Array.isArray(record.sources)) {
                throw new Error(`RAM-map sources for '${name}' must be an array.`);
            }
            sources = record.sources.map((source) => {
                if (typeof source !== "string") {
                    throw new Error(`RAM-map sources for '${name}' must be strings.`);
                }
                return cleanText(source, `${name} source`);
            });
        }
        return {
            name,
            address,
            ...(record.memory === undefined ? {} : { memory }),
            size,
            ...(category ? { category } : {}),
            description,
            notes,
            ...(sources === undefined ? {} : { sources }),
        };
    });
    const sorted = variables.sort((left, right) => left.address - right.address || left.name.localeCompare(right.name));
    for (let index = 1; index < sorted.length; index++) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        if (current.address < previous.address + previous.size) {
            throw new Error(`RAM-map variables '${previous.name}' and '${current.name}' overlap at ${hex(current.address)}.`);
        }
    }
    return sorted;
};
/**
 * Returns the canonical empty RAM-map file created for new projects.
 * @returns {SnesRamMapFile} A versioned empty editable map.
 */
export const emptySnesRamMap = () => ({
    $schema: `./${SNES_RAM_MAP_SCHEMA_SOURCE}`,
    format: SNES_RAM_MAP_FORMAT,
    schemaVersion: SNES_RAM_MAP_SCHEMA_VERSION,
    includeSourceInformation: false,
    variables: [],
});
/**
 * Loads the user-owned RAM map, creating an empty editable map when absent.
 * @param {string} directory Generated-source root.
 * @returns {LoadedSnesRamMap} Validated variables and exact input bytes.
 */
export const loadSnesRamMap = (directory) => {
    const file = path.join(directory, SNES_RAM_MAP_SOURCE);
    if (!fs.existsSync(file)) {
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(file, canonicalSourceExportJson(emptySnesRamMap()));
    }
    const sourceBytes = fs.readFileSync(file);
    let parsed;
    try {
        parsed = JSON.parse(sourceBytes.toString("utf8"));
    }
    catch (error) {
        throw new Error(`Could not parse '${SNES_RAM_MAP_SOURCE}': ${error instanceof Error ? error.message : String(error)}`);
    }
    const variables = validateSnesRamMap(parsed);
    return { file: parsed, variables, sourceBytes };
};
/**
 * Maps WRAM mirrors in banks `$00–$3F`/`$80–$BF` to canonical `$7E0000–$7E1FFF`.
 * @param {number} address 24-bit CPU address.
 * @returns {number | undefined} Canonical WRAM address, or undefined outside WRAM.
 */
export const canonicalSnesWramAddress = (address) => {
    if (!Number.isInteger(address) || address < 0 || address > 0xffffff) {
        return undefined;
    }
    if (address >= 0x7e0000 && address <= 0x7fffff) {
        return address;
    }
    const bank = address >>> 16;
    const offset = address & 0xffff;
    if ((bank <= 0x3f || (bank >= 0x80 && bank <= 0xbf)) && offset <= 0x1fff) {
        return 0x7e0000 | offset;
    }
    return undefined;
};
/**
 * Builds a range-aware address lookup for RAM-variable substitution.
 * @param {readonly SnesRamMapVariable[]} variables Validated, non-overlapping RAM variables.
 * @returns {ReadonlyMap<number, SnesRamMapVariable>} Every known byte address mapped to its variable.
 */
export const indexSnesRamMap = (variables) => new Map(variables.flatMap((variable) => Array.from({ length: variable.size }, (_, offset) => [variable.address + offset, variable])));
/**
 * Recognizes standalone file citations used by older maps before the sources field existed.
 * Embedded references in explanatory prose stay visible; new citations belong in sources.
 * @param {string} note A normalized, single-line note.
 * @returns {boolean} Whether the entire note has a supported file or file/line citation form.
 */
const isLegacySourceNote = (note) => {
    const citation = note.endsWith(".") ? note.slice(0, -1) : note;
    const separator = citation.lastIndexOf(":");
    if (separator >= 0) {
        const file = citation.slice(0, separator);
        const lines = citation.slice(separator + 1);
        return (/^[^!:;?]+\.(?:txt|md|asm|json)$/i.test(file) &&
            (/^l\d+$/i.test(lines) || /^l\d+-l?\d+$/i.test(lines)));
    }
    return /^[\w./-]+\.(?:txt|md|asm|json)$/i.test(citation);
};
/**
 * Renders a documented generated definition file from a validated RAM map.
 * @param {readonly SnesRamMapVariable[]} variables Validated RAM variables.
 * @param {Pick<SnesRamMapFile, "includeSourceInformation">} options Source citations are omitted by default; descriptive notes remain visible.
 * @returns {string} Generated assembler definitions with hover-ready comments.
 */
export const renderSnesRamDefines = (variables, options = {}) => {
    const lines = [
        `; Generated from ${SNES_RAM_MAP_SOURCE} by Uttori ASM.`,
        `; Edit ${SNES_RAM_MAP_SOURCE}, then run Assembly: Analyze and Regenerate Disassembly.`,
        "; Every variable has a trailing description so symbol hover remains useful.",
        "",
        ...variables.flatMap((variable, index) => {
            const details = [
                variable.category,
                variable.description,
                variable.size === 1 ? undefined : `Size: ${variable.size} bytes.`,
                ...variable.notes.filter((note) => options.includeSourceInformation || !isLegacySourceNote(note)),
                ...(options.includeSourceInformation ? (variable.sources ?? []) : []),
            ].filter((entry) => Boolean(entry));
            const categorySeparator = variable.category ? " — " : "";
            const comment = variable.category
                ? `${details[0]}${categorySeparator}${details.slice(1).join(" ")}`
                : details.join(" ");
            // Removing a citation can expose an unpunctuated description from an imported map.
            const sentence = /[!.?]$/.test(comment) ? comment : `${comment}.`;
            return [
                ...(index > 0 && variables[index - 1]?.category !== variable.category ? [""] : []),
                `${variable.name} = ${hex(variable.address)} ; ${sentence}`,
            ];
        }),
        "",
    ];
    return `${lines.join("\n")}\n`;
};
/**
 * Renders the local JSON Schema included beside every RAM map.
 * @returns {string} Canonical JSON Schema text.
 */
export const renderSnesRamMapSchema = () => canonicalSourceExportJson({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Uttori ASM SNES RAM Map",
    type: "object",
    additionalProperties: false,
    required: ["format", "schemaVersion", "variables"],
    properties: {
        $schema: { type: "string" },
        format: { const: SNES_RAM_MAP_FORMAT },
        schemaVersion: { const: SNES_RAM_MAP_SCHEMA_VERSION },
        source: { type: "string", description: "Optional human-readable provenance." },
        includeSourceInformation: {
            type: "boolean",
            default: false,
            description: "Include source citations in generated definition comments. Descriptive notes are always included.",
        },
        variables: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "address", "description"],
                properties: {
                    name: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
                    address: {
                        oneOf: [
                            { type: "integer", minimum: 0, maximum: 0xffffff },
                            { type: "string", pattern: "^(?:\\$|0x)[0-9A-Fa-f]{1,6}$" },
                        ],
                        description: "Canonical WRAM CPU address, or an explicit SRAM CPU-window address when memory is sram. SRAM mirrors are not inferred.",
                    },
                    memory: {
                        enum: ["wram", "sram"],
                        default: "wram",
                        description: "SRAM requires a standard LoROM/HiROM cartridge window. Confirm the actual cartridge mapping and size separately.",
                    },
                    size: { type: "integer", minimum: 1, maximum: 0x20000 },
                    category: { type: "string", minLength: 1 },
                    description: { type: "string", minLength: 1 },
                    notes: { type: "array", items: { type: "string", minLength: 1 } },
                    sources: {
                        type: "array",
                        items: { type: "string", minLength: 1 },
                        description: "Provenance citations, shown only when includeSourceInformation is true.",
                    },
                },
            },
        },
    },
});
//# sourceMappingURL=ram-map.js.map