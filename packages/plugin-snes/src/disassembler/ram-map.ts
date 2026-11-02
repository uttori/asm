import * as fs from "node:fs";
import path from "node:path";

import { canonicalJson } from "@uttori/asm-core/canonical-json";

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

/** One editable RAM variable as represented in `ram-map.json`. */
export interface SnesRamMapVariableInput {
  /** Assembly identifier emitted in generated RAM defines. */
  readonly name: string;
  /** CPU bus address as `$7EA171`, `0x7EA171`, or an integer. Never a physical SRAM offset. */
  readonly address: string | number;
  /** Defaults to WRAM. SRAM is an explicit cartridge-window declaration with exact-address lookup. */
  readonly memory?: "wram" | "sram";
  /** Number of bytes occupied, used for documentation rather than allocation. */
  readonly size?: number;
  /** Optional grouping label for generated documentation. */
  readonly category?: string;
  /** Required human-readable summary for export comments. */
  readonly description: string;
  /** Additional free-form notes preserved in metadata. */
  readonly notes?: readonly string[];
  /** Provenance citations, emitted only when includeSourceInformation is true. */
  readonly sources?: readonly string[];
}

/** Versioned, user-owned RAM-map document. */
export interface SnesRamMapFile {
  /** Optional JSON Schema URI for editor validation. */
  readonly $schema?: string;
  /** Discriminator matching SNES_RAM_MAP_FORMAT. */
  readonly format: typeof SNES_RAM_MAP_FORMAT;
  /** Document schema generation consumed by loaders. */
  readonly schemaVersion: typeof SNES_RAM_MAP_SCHEMA_VERSION;
  /** Optional provenance string stored in the map file itself. */
  readonly source?: string;
  /** Include provenance citations in generated definition comments. Defaults to false. */
  readonly includeSourceInformation?: boolean;
  /** User-authored variable declarations validated on load. */
  readonly variables: readonly SnesRamMapVariableInput[];
}

/** Validated RAM variable used by source generation and operand lookup. */
export interface SnesRamMapVariable {
  /** Normalized assembly identifier. */
  readonly name: string;
  /** Canonical 24-bit CPU bus address after parsing. */
  readonly address: number;
  /** Omitted means WRAM. SRAM addresses are not normalized across cartridge-dependent mirrors. */
  readonly memory?: "wram" | "sram";
  /** Documented byte width defaulting to one when omitted in JSON. */
  readonly size: number;
  /** Optional grouping label echoed in generated documentation. */
  readonly category?: string;
  /** Required summary copied into generated RAM define comments. */
  readonly description: string;
  /** Sanitized note lines, never empty strings. */
  readonly notes: readonly string[];
  /** Explicit citations kept separate from descriptive notes for optional source output. */
  readonly sources?: readonly string[];
}

/** Validated RAM-map document plus the exact source bytes used for provenance. */
export interface LoadedSnesRamMap {
  /** Parsed document after schema validation. */
  readonly file: SnesRamMapFile;
  /** Normalized variables ready for define generation. */
  readonly variables: readonly SnesRamMapVariable[];
  /** Exact ram-map.json bytes used for content-hash provenance. */
  readonly sourceBytes: Uint8Array;
}

/**
 * Accepts a JSON object. Arrays and null are not RAM-map documents.
 * @param value Candidate object.
 * @returns True when `value` is a non-array object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Accepts one raw RAM-map variable. Extra JSON fields are left in place.
 * @param value Candidate variable.
 * @returns True when the fields `SnesRamMapVariableInput` reads have the right types.
 */
const isRamMapVariableInput = (value: unknown): value is SnesRamMapVariableInput => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.name !== "string") {
    return false;
  }
  if (typeof value.address !== "string" && typeof value.address !== "number") {
    return false;
  }
  if (value.memory !== undefined && value.memory !== "wram" && value.memory !== "sram") {
    return false;
  }
  if (value.size !== undefined && typeof value.size !== "number") {
    return false;
  }
  if (value.category !== undefined && typeof value.category !== "string") {
    return false;
  }
  if (typeof value.description !== "string") {
    return false;
  }
  if (
    value.notes !== undefined &&
    !(Array.isArray(value.notes) && value.notes.every((note) => typeof note === "string"))
  ) {
    return false;
  }
  return (
    value.sources === undefined ||
    (Array.isArray(value.sources) && value.sources.every((source) => typeof source === "string"))
  );
};

/**
 * Accepts a RAM-map document whose fields match `SnesRamMapFile`.
 * @param value Parsed JSON.
 * @returns True when format, schema, and variables have the expected types.
 */
const isSnesRamMapFile = (value: unknown): value is SnesRamMapFile => {
  if (!isRecord(value)) {
    return false;
  }
  if (value.format !== SNES_RAM_MAP_FORMAT || value.schemaVersion !== SNES_RAM_MAP_SCHEMA_VERSION) {
    return false;
  }
  if (value.$schema !== undefined && typeof value.$schema !== "string") {
    return false;
  }
  if (value.source !== undefined && typeof value.source !== "string") {
    return false;
  }
  if (
    value.includeSourceInformation !== undefined &&
    typeof value.includeSourceInformation !== "boolean"
  ) {
    return false;
  }
  return Array.isArray(value.variables) && value.variables.every(isRamMapVariableInput);
};

/** Format bus addresses for RAM-map validation errors. */
const hex = (value: number, width = 6): string =>
  `$${value.toString(16).toUpperCase().padStart(width, "0")}`;

/**
 * Collapse whitespace and reject empty user-authored strings.
 * @param value Raw text from JSON.
 * @param field Field name used in error messages.
 */
const cleanText = (value: string, field: string): string => {
  const cleaned = value.replaceAll(/\s+/g, " ").trim();
  if (!cleaned) {
    throw new Error(`RAM-map ${field} must not be empty.`);
  }
  return cleaned;
};

/**
 * Bounds a standard LoROM/HiROM SRAM bus window without assuming cartridge size or mirroring.
 * @param address Validated 24-bit CPU address.
 * @returns Exclusive window end, or undefined outside the supported windows.
 */
const sramWindowEnd = (address: number): number | undefined => {
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
 * @param value Hexadecimal string or integer CPU address.
 * @param memory Explicit SRAM declaration, or the WRAM default.
 * @returns Valid bus address. Throws for malformed or out-of-domain values.
 */
const parseAddress = (value: string | number, memory: "wram" | "sram"): number => {
  let address: number;
  if (typeof value === "number") {
    address = value;
  } else {
    const text = value.trim();
    if (/^\$[\dA-Fa-f]{1,6}$/.test(text)) {
      address = Number.parseInt(text.slice(1), 16);
    } else if (/^0x[\da-f]{1,6}$/i.test(text)) {
      address = Number.parseInt(text.slice(2), 16);
    } else {
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
  } else if (address < 0x7e0000 || address > 0x7fffff) {
    throw new Error(`RAM-map address '${String(value)}' is outside canonical SNES WRAM.`);
  }
  return address;
};

/**
 * Validates and normalizes a RAM-map object without reading the filesystem.
 * @param value Parsed JSON value.
 * @returns Deterministically sorted variables.
 */
export const validateSnesRamMap = (value: unknown): readonly SnesRamMapVariable[] => {
  if (!isRecord(value)) {
    throw new Error("RAM map must be a JSON object.");
  }
  if (value.format !== SNES_RAM_MAP_FORMAT) {
    throw new Error("Invalid SNES RAM-map format.");
  }
  if (value.schemaVersion !== SNES_RAM_MAP_SCHEMA_VERSION) {
    throw new Error(`Unsupported SNES RAM-map schema ${String(value.schemaVersion)}.`);
  }
  if (!Array.isArray(value.variables)) {
    throw new Error("RAM map must contain a variables array.");
  }
  if (
    value.includeSourceInformation !== undefined &&
    typeof value.includeSourceInformation !== "boolean"
  ) {
    throw new Error("RAM-map includeSourceInformation must be a boolean.");
  }

  const names = new Set<string>();
  const addresses = new Set<number>();
  const variables = value.variables.map((input: unknown, index: number): SnesRamMapVariable => {
    if (!isRecord(input)) {
      throw new Error(`RAM-map variable ${index + 1} must be an object.`);
    }
    if (typeof input.name !== "string") {
      throw new Error(`RAM-map variable ${index + 1} name must be a string.`);
    }
    const name = cleanText(input.name, `variable ${index + 1} name`);
    if (!/^[A-Z_a-z]\w*$/.test(name)) {
      throw new Error(`RAM-map variable name '${name}' is not an assembler identifier.`);
    }
    const nameKey = name.toLowerCase();
    if (names.has(nameKey)) {
      throw new Error(`Duplicate RAM-map variable name '${name}'.`);
    }
    names.add(nameKey);
    if (typeof input.address !== "string" && typeof input.address !== "number") {
      throw new Error(`RAM-map variable '${name}' must have a string or integer address.`);
    }
    const memory = input.memory ?? "wram";
    if (memory !== "wram" && memory !== "sram") {
      throw new Error(`RAM-map memory for '${name}' must be 'wram' or 'sram'.`);
    }
    const address = parseAddress(input.address, memory);
    if (addresses.has(address)) {
      throw new Error(`Duplicate RAM-map address '${hex(address)}'. Combine aliases in one entry.`);
    }
    addresses.add(address);
    const size = input.size ?? 1;
    // A SRAM declaration owns one CPU window, not the ROM or I/O beyond its end.
    // Physical size and aliases depend on the cartridge and remain the map author's responsibility.
    const end = memory === "sram" ? sramWindowEnd(address)! : 0x800000;
    if (
      typeof size !== "number" ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      address + size > end
    ) {
      throw new Error(`Invalid size for RAM-map variable '${name}'.`);
    }
    if (input.category !== undefined && typeof input.category !== "string") {
      throw new Error(`RAM-map category for '${name}' must be a string.`);
    }
    const category =
      input.category === undefined ? undefined : cleanText(input.category, `${name} category`);
    if (typeof input.description !== "string") {
      throw new Error(`RAM-map description for '${name}' must be a string.`);
    }
    const description = cleanText(input.description, `${name} description`);
    if (input.notes !== undefined && !Array.isArray(input.notes)) {
      throw new Error(`RAM-map notes for '${name}' must be an array.`);
    }
    const notes = (input.notes ?? []).map((note: unknown) => {
      if (typeof note !== "string") {
        throw new Error(`RAM-map notes for '${name}' must be strings.`);
      }
      return cleanText(note, `${name} note`);
    });
    let sources: string[] | undefined;
    if (input.sources !== undefined) {
      if (!Array.isArray(input.sources)) {
        throw new Error(`RAM-map sources for '${name}' must be an array.`);
      }
      sources = input.sources.map((source: unknown) => {
        if (typeof source !== "string") {
          throw new Error(`RAM-map sources for '${name}' must be strings.`);
        }
        return cleanText(source, `${name} source`);
      });
    }
    return {
      name,
      address,
      ...(input.memory === undefined ? {} : { memory }),
      size,
      ...(category ? { category } : {}),
      description,
      notes,
      ...(sources === undefined ? {} : { sources }),
    };
  });
  const sorted = variables.toSorted(
    (left, right) => left.address - right.address || left.name.localeCompare(right.name),
  );
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.address < previous.address + previous.size) {
      throw new Error(
        `RAM-map variables '${previous.name}' and '${current.name}' overlap at ${hex(current.address)}.`,
      );
    }
  }
  return sorted;
};

/**
 * Returns the canonical empty RAM-map file created for new projects.
 * @returns A versioned empty editable map.
 */
export const emptySnesRamMap = (): SnesRamMapFile => ({
  $schema: `./${SNES_RAM_MAP_SCHEMA_SOURCE}`,
  format: SNES_RAM_MAP_FORMAT,
  schemaVersion: SNES_RAM_MAP_SCHEMA_VERSION,
  includeSourceInformation: false,
  variables: [],
});

/**
 * Loads the user-owned RAM map, creating an empty editable map when absent.
 * @param directory Generated-source root.
 * @returns Validated variables and exact input bytes.
 */
export const loadSnesRamMap = (directory: string): LoadedSnesRamMap => {
  const file = path.join(directory, SNES_RAM_MAP_SOURCE);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(file, canonicalJson(emptySnesRamMap()));
  }
  const sourceBytes = fs.readFileSync(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(sourceBytes.toString("utf8"));
  } catch (error) {
    throw new Error(
      `Could not parse '${SNES_RAM_MAP_SOURCE}': ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  const variables = validateSnesRamMap(parsed);
  if (!isSnesRamMapFile(parsed)) {
    throw new Error("Invalid SNES RAM-map format.");
  }
  return { file: parsed, variables, sourceBytes };
};

/**
 * Maps WRAM mirrors in banks `$00–$3F`/`$80–$BF` to canonical `$7E0000–$7E1FFF`.
 * @param address 24-bit CPU address.
 * @returns Canonical WRAM address, or undefined outside WRAM.
 */
export const canonicalSnesWramAddress = (address: number): number | undefined => {
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
 * @param variables Validated, non-overlapping RAM variables.
 * @returns Every known byte address mapped to its variable.
 */
export const indexSnesRamMap = (
  variables: readonly SnesRamMapVariable[],
): ReadonlyMap<number, SnesRamMapVariable> =>
  new Map(
    variables.flatMap((variable) =>
      Array.from({ length: variable.size }, (_, offset) => [variable.address + offset, variable]),
    ),
  );

/**
 * Recognizes standalone file citations used by older maps before the sources field existed.
 * A legacy note can combine a file citation and a named layout reference. These remain
 * provenance even when joined with a semicolon; explanatory sentences stay visible.
 * @param note A normalized, single-line note.
 * @returns Whether the entire note has a supported file or file/line citation form.
 */
const isLegacySourceNote = (note: string): boolean => {
  const parts = note.split(/;\s*/);
  if (parts.length > 1) {
    return parts.every(isLegacySourceNote);
  }
  const citation = note.endsWith(".") ? note.slice(0, -1) : note;
  if (/^[_a-z]\w* in [\w./-]+\.(?:txt|md|asm|json)$/i.test(citation)) {
    return true;
  }
  const separator = citation.lastIndexOf(":");
  if (separator >= 0) {
    const file = citation.slice(0, separator);
    const lines = citation.slice(separator + 1);
    return (
      /^[^!:;?]+\.(?:txt|md|asm|json)$/i.test(file) &&
      (/^l\d+$/i.test(lines) || /^l\d+-l?\d+$/i.test(lines))
    );
  }
  return /^[\w./-]+\.(?:txt|md|asm|json)$/i.test(citation);
};

/**
 * Renders a documented generated definition file from a validated RAM map.
 * @param variables Validated RAM variables.
 * @param options Source citations are omitted by default; descriptive notes remain visible.
 * @returns Generated assembler definitions with hover-ready comments.
 */
export const renderSnesRamDefines = (
  variables: readonly SnesRamMapVariable[],
  options: Pick<SnesRamMapFile, "includeSourceInformation"> = {},
): string => {
  const lines = [
    "; RAM and SRAM addresses identify bytes; multi-byte values occupy consecutive addresses.",
    "",
    ...variables.flatMap((variable, index) => {
      const details = [
        variable.category,
        variable.description,
        variable.size === 1 ? undefined : `Size: ${variable.size} bytes.`,
        ...variable.notes.filter(
          (note) => options.includeSourceInformation === true || !isLegacySourceNote(note),
        ),
        ...(options.includeSourceInformation ? (variable.sources ?? []) : []),
      ].filter((entry): entry is string => Boolean(entry));
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
 * @returns Canonical JSON Schema text.
 */
export const renderSnesRamMapSchema = (): string =>
  canonicalJson({
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
        description:
          "Include source citations in generated definition comments. Descriptive notes are always included.",
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
              description:
                "Canonical WRAM CPU address, or an explicit SRAM CPU-window address when memory is sram. SRAM mirrors are not inferred.",
            },
            memory: {
              enum: ["wram", "sram"],
              default: "wram",
              description:
                "SRAM requires a standard LoROM/HiROM cartridge window. Confirm the actual cartridge mapping and size separately.",
            },
            size: { type: "integer", minimum: 1, maximum: 0x20000 },
            category: { type: "string", minLength: 1 },
            description: { type: "string", minLength: 1 },
            notes: { type: "array", items: { type: "string", minLength: 1 } },
            sources: {
              type: "array",
              items: { type: "string", minLength: 1 },
              description:
                "Provenance citations, shown only when includeSourceInformation is true.",
            },
          },
        },
      },
    },
  });
