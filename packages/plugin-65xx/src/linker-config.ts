/**
 * Minimal ld65 linker-config parser for the NES iNES target.
 *
 * MEMORY / SEGMENTS / SYMBOLS support is shared by the flat NES assembler
 * and the portable link-recipe adapter. Parsing itself never places sections.
 */

import {
  compileLinkExpression,
  parseExpressionNode,
  type AssemblyLinkRecipe,
  type LinkRecipeSymbol,
} from "@uttori/asm-core";

/** One ld65 MEMORY area. */
export type Ld65MemoryRegion = {
  /** MEMORY area name referenced by segment `load`/`run`. */
  readonly name: string;
  /** First logical address of the area. */
  readonly start: number;
  /** Area size in bytes. */
  readonly size: number;
  /**
   * Byte offset of this region in the linked image (`file = %O`).
   * `-1` when `file = ""` (RAM / overlay run area).
   */
  readonly fileOffset: number;
  /** True when unused bytes of a file-backed area are padded to `size`. */
  readonly fill: boolean;
  /** Padding byte used when `fill` is true; defaults to 0. */
  readonly fillval: number;
};

/** One ld65 SEGMENTS entry. */
export type Ld65Segment = {
  /** Segment name selected by `.segment`. */
  readonly name: string;
  /** MEMORY area holding the segment's bytes in the image. */
  readonly load: string;
  /** MEMORY area where the segment executes; equals `load` when not specified. */
  readonly run: string;
  /** Fixed start address within the load area, or undefined to place after the previous segment. */
  readonly start: number | undefined;
  /** True when `__NAME_LOAD__`, `__NAME_RUN__`, and `__NAME_SIZE__` symbols are generated. */
  readonly define: boolean;
  /** ld65 segment type (`ro`, `rw`, `bss`, `zp`, ...); defaults to `ro`. */
  readonly type: string;
};

/** One ld65 SYMBOLS entry. */
export type Ld65Symbol = {
  /** Symbol name. */
  readonly name: string;
  /** Unevaluated `value` expression text. */
  readonly valueExpr: string;
};

/** Parsed ld65 configuration in declaration order. */
export type Ld65Config = {
  /** MEMORY areas keyed by name, in declaration order. */
  readonly memories: ReadonlyMap<string, Ld65MemoryRegion>;
  /** Segments keyed by name, in declaration order. */
  readonly segments: ReadonlyMap<string, Ld65Segment>;
  /** SYMBOLS entries in declaration order. */
  readonly symbols: readonly Ld65Symbol[];
  /** Total size of `file = %O` regions, in order of MEMORY declaration. */
  readonly imageSize: number;
};

/** Preserve declaration order and RAM/load/run distinctions without assigning object contributions. */
export function ld65LinkRecipe(config: Ld65Config, target = "65xx.nes"): AssemblyLinkRecipe {
  const symbols: LinkRecipeSymbol[] = [];
  for (const segment of config.segments.values()) {
    if (!segment.define) {
      continue;
    }
    for (const [suffix, property] of [
      ["LOAD", "load"],
      ["RUN", "run"],
      ["SIZE", "size"],
      ["RUN_END", "runEnd"],
    ] as const) {
      symbols.push({ name: `__${segment.name}_${suffix}__`, section: segment.name, property });
    }
  }
  for (const symbol of config.symbols) {
    symbols.push({
      name: symbol.name,
      expression: compileLinkExpression(parseExpressionNode(symbol.valueExpr), {
        reference: (node) => {
          if (node.type !== "identifier") {
            throw new Error("Linker-config symbols require global names.");
          }
          return { kind: "symbol", name: node.name };
        },
        current: () => {
          throw new Error("Linker-config symbols have no implicit section cursor.");
        },
        literal: (node) => {
          if (node.type !== "literal") {
            throw new Error("Linker-config expressions require integer literals.");
          }
          const text = node.value;
          if (text.startsWith("$")) {
            return Number.parseInt(text.slice(1), 16);
          }
          if (text.startsWith("%")) {
            return Number.parseInt(text.slice(1), 2);
          }
          return Number(text);
        },
      }),
    });
  }
  return {
    target,
    regions: [...config.memories.values()].map((region) =>
      Object.assign(
        { name: region.name, start: region.start, size: region.size },
        region.fileOffset >= 0 ? { outputOffset: region.fileOffset } : {},
        region.fill ? { fillByte: region.fillval } : {},
        { addressSpace: "65xx.ines-address-space" },
      ),
    ),
    placements: [...config.segments.values()].map((segment) =>
      Object.assign(
        { section: segment.name, load: segment.load, run: segment.run },
        segment.start !== undefined ? { start: segment.start } : {},
      ),
    ),
    // Explicit SYMBOLS declarations override generated defaults, matching the flat target's ordering.
    symbols: [...new Map(symbols.map((symbol) => [symbol.name, symbol])).values()],
  };
}

const DEFAULT_LINKER_CONFIG = `MEMORY {
    ROM: start = $8000, size = $8000, file = %O, fill = yes, fillval = $FF ;
}
SEGMENTS {
    CODE: load = ROM, type = ro ;
}
`;

/**
 * Returns the built-in 32 KiB `$8000` layout used when a target omits `linkerConfig`.
 * @returns A minimal ld65 config.
 */
export function defaultLd65ConfigText(): string {
  return DEFAULT_LINKER_CONFIG;
}

/**
 * Parses an ld65 config string into memories, segments, and exported symbols.
 * @param source Linker configuration text.
 * @returns The parsed layout.
 */
export function parseLd65Config(source: string): Ld65Config {
  // Replace block comments with whitespace so adjacent tokens stay separate.
  const text = source.replace(/\/\*[\S\s]*?\*\//g, " ");
  const memories = new Map<string, Ld65MemoryRegion>();
  const segments = new Map<string, Ld65Segment>();
  const symbols: Ld65Symbol[] = [];
  let fileOffset = 0;

  for (const statement of readBlockStatements(text, "MEMORY")) {
    const parsed = parseNamedStatement(statement);
    const start = requireNumber(parsed.attrs, "start", parsed.name);
    const size = requireNumber(parsed.attrs, "size", parsed.name);
    const file = parsed.attrs.file ?? "%O";
    const isRam = file === '""' || file === "''" || file === "";
    const region: Ld65MemoryRegion = {
      name: parsed.name,
      start,
      size,
      fileOffset: isRam ? -1 : fileOffset,
      fill: parseYesNo(parsed.attrs.fill) ?? false,
      fillval: parseNumberToken(parsed.attrs.fillval ?? "0") ?? 0,
    };
    memories.set(region.name, region);
    if (!isRam) {
      fileOffset += size;
    }
  }

  for (const statement of readBlockStatements(text, "SEGMENTS")) {
    const parsed = parseNamedStatement(statement);
    const load = parsed.attrs.load;
    if (!load) {
      throw new Error(`ld65 segment '${parsed.name}' is missing load = MEMORY.`);
    }
    if (!memories.has(load)) {
      throw new Error(`ld65 segment '${parsed.name}' loads unknown memory '${load}'.`);
    }
    const run = parsed.attrs.run ?? load;
    if (!memories.has(run)) {
      throw new Error(`ld65 segment '${parsed.name}' runs in unknown memory '${run}'.`);
    }
    segments.set(parsed.name, {
      name: parsed.name,
      load,
      run,
      start: parseNumberToken(parsed.attrs.start),
      define: parseYesNo(parsed.attrs.define) ?? false,
      type: parsed.attrs.type ?? "ro",
    });
  }

  for (const statement of readBlockStatements(text, "SYMBOLS")) {
    const parsed = parseNamedStatement(statement);
    const valueExpr = parsed.attrs.value;
    if (!valueExpr) {
      throw new Error(`ld65 symbol '${parsed.name}' is missing value = EXPR.`);
    }
    symbols.push({ name: parsed.name, valueExpr });
  }

  if (memories.size === 0) {
    throw new Error("ld65 config MEMORY block is empty.");
  }

  return {
    memories,
    segments,
    symbols,
    imageSize: fileOffset,
  };
}

/**
 * Linker-defined names produced by `define = yes` plus the SYMBOLS block.
 * @param config Parsed linker configuration.
 * @returns Symbol names that must stay session-global.
 */
export function linkerDefinedSymbolNames(config: Ld65Config): string[] {
  const names: string[] = [];
  for (const segment of config.segments.values()) {
    if (!segment.define) {
      continue;
    }
    names.push(
      `__${segment.name}_LOAD__`,
      `__${segment.name}_RUN__`,
      `__${segment.name}_SIZE__`,
      `__${segment.name}_RUN_END__`,
    );
  }
  for (const symbol of config.symbols) {
    names.push(symbol.name);
  }
  return names;
}

const LD65_BLOCK_BODY: Readonly<Record<"MEMORY" | "SEGMENTS" | "SYMBOLS", RegExp>> = {
  MEMORY: /memory\s*{([\S\s]*?)}/i,
  SEGMENTS: /segments\s*{([\S\s]*?)}/i,
  SYMBOLS: /symbols\s*{([\S\s]*?)}/i,
};

/**
 * Reads semicolon-terminated statements inside a named MEMORY/SEGMENTS/SYMBOLS block.
 * @param source Config text.
 * @param block MEMORY, SEGMENTS, or SYMBOLS.
 * @returns Statement bodies, without the trailing semicolon.
 */
function readBlockStatements(source: string, block: "MEMORY" | "SEGMENTS" | "SYMBOLS"): string[] {
  const match = source.match(LD65_BLOCK_BODY[block]);
  if (!match) {
    return [];
  }
  return match[1]
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Parsed `NAME: key = value, ...` statement. */
type NamedStatement = {
  name: string;
  attrs: Partial<Record<string, string>>;
};

/**
 * Parses `NAME: key = value, key = value`.
 * @param statement One semicolon-terminated statement.
 * @returns Name plus attribute map.
 */
function parseNamedStatement(statement: string): NamedStatement {
  const colon = statement.indexOf(":");
  if (colon <= 0) {
    throw new Error(`Invalid ld65 statement: ${statement}`);
  }
  const name = statement.slice(0, colon).trim();
  const attrs: Partial<Record<string, string>> = {};
  for (const part of splitTopLevelCommas(statement.slice(colon + 1))) {
    const equals = part.indexOf("=");
    if (equals <= 0) {
      continue;
    }
    const key = part.slice(0, equals).trim().toLowerCase();
    const value = part.slice(equals + 1).trim();
    attrs[key] = value;
  }
  return { name, attrs };
}

/**
 * Splits on commas that are not inside quotes.
 * @param input Attribute list.
 * @returns Attribute assignments.
 */
function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (const char of input) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      const trimmed = current.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
      current = "";
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) {
    parts.push(trimmed);
  }
  return parts;
}

/**
 * Parses `$hex` or decimal tokens. Returns undefined when missing.
 * @param token Raw attribute value.
 * @returns The numeric value.
 */
function parseNumberToken(token: string | undefined): number | undefined {
  if (token === undefined || token === "") {
    return undefined;
  }
  if (token.startsWith("$")) {
    const value = Number.parseInt(token.slice(1), 16);
    return Number.isFinite(value) ? value : undefined;
  }
  if (/^-?\d+$/.test(token)) {
    return Number.parseInt(token, 10);
  }
  return undefined;
}

/**
 * Requires a numeric attribute.
 * @param attrs Attribute map.
 * @param key Attribute name.
 * @param owner Statement name for errors.
 * @returns The parsed number.
 */
function requireNumber(attrs: Partial<Record<string, string>>, key: string, owner: string): number {
  const value = parseNumberToken(attrs[key]);
  if (value === undefined) {
    throw new Error(`ld65 '${owner}' is missing numeric ${key}.`);
  }
  return value;
}

/**
 * Parses ld65 yes/no flags.
 * @param raw Raw token.
 * @returns Parsed flag.
 */
function parseYesNo(raw: string | undefined): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const normalized = raw.toLowerCase();
  if (normalized === "yes" || normalized === "true") {
    return true;
  }
  if (normalized === "no" || normalized === "false") {
    return false;
  }
  return undefined;
}
