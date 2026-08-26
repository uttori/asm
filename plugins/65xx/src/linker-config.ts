/**
 * Minimal ld65 linker-config parser for the NES iNES target.
 *
 * Enough of MEMORY / SEGMENTS / SYMBOLS to assemble ca65 sources that emit a
 * flat image (Zelda 1's `Z.cfg`) without producing relocatable objects.
 */

export type Ld65MemoryRegion = {
  readonly name: string;
  readonly start: number;
  readonly size: number;
  /**
   * Byte offset of this region in the linked image (`file = %O`).
   * `-1` when `file = ""` (RAM / overlay run area).
   */
  readonly fileOffset: number;
  readonly fill: boolean;
  readonly fillval: number;
};

export type Ld65Segment = {
  readonly name: string;
  readonly load: string;
  readonly run: string;
  readonly start: number | undefined;
  readonly define: boolean;
  readonly type: string;
};

export type Ld65Symbol = {
  readonly name: string;
  readonly valueExpr: string;
};

export type Ld65Config = {
  readonly memories: ReadonlyMap<string, Ld65MemoryRegion>;
  readonly segments: ReadonlyMap<string, Ld65Segment>;
  readonly symbols: readonly Ld65Symbol[];
  /** Total size of `file = %O` regions, in order of MEMORY declaration. */
  readonly imageSize: number;
};

const DEFAULT_LINKER_CONFIG = `MEMORY {
    ROM: start = $8000, size = $8000, file = %O, fill = yes, fillval = $FF ;
}
SEGMENTS {
    CODE: load = ROM, type = ro ;
}
`;

/**
 * Returns the built-in 32 KiB `$8000` layout used when a target omits `linkerConfig`.
 * @returns {string} A minimal ld65 config.
 */
export function defaultLd65ConfigText(): string {
  return DEFAULT_LINKER_CONFIG;
}

/**
 * Parses an ld65 config string into memories, segments, and exported symbols.
 * @param {string} source Linker configuration text.
 * @returns {Ld65Config} The parsed layout.
 */
export function parseLd65Config(source: string): Ld65Config {
  const text = stripBlockComments(source);
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
 * @param {Ld65Config} config Parsed linker configuration.
 * @returns {string[]} Symbol names that must stay session-global.
 */
export function linkerDefinedSymbolNames(config: Ld65Config): string[] {
  const names: string[] = [];
  for (const segment of config.segments.values()) {
    if (!segment.define) continue;
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

/**
 * Strips C-style block comments.
 * @param {string} source Raw config text.
 * @returns {string} Source without block comments.
 */
function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\S\s]*?\*\//g, " ");
}

const LD65_BLOCK_BODY: Readonly<Record<"MEMORY" | "SEGMENTS" | "SYMBOLS", RegExp>> = {
  MEMORY: /memory\s*{([\S\s]*?)}/i,
  SEGMENTS: /segments\s*{([\S\s]*?)}/i,
  SYMBOLS: /symbols\s*{([\S\s]*?)}/i,
};

/**
 * Reads semicolon-terminated statements inside a named MEMORY/SEGMENTS/SYMBOLS block.
 * @param {string} source Config text.
 * @param {"MEMORY" | "SEGMENTS" | "SYMBOLS"} block MEMORY, SEGMENTS, or SYMBOLS.
 * @returns {string[]} Statement bodies, without the trailing semicolon.
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

type NamedStatement = {
  name: string;
  attrs: Record<string, string>;
};

/**
 * Parses `NAME: key = value, key = value`.
 * @param {string} statement One semicolon-terminated statement.
 * @returns {NamedStatement} Name plus attribute map.
 */
function parseNamedStatement(statement: string): NamedStatement {
  const colon = statement.indexOf(":");
  if (colon <= 0) {
    throw new Error(`Invalid ld65 statement: ${statement}`);
  }
  const name = statement.slice(0, colon).trim();
  const attrs: Record<string, string> = {};
  for (const part of splitTopLevelCommas(statement.slice(colon + 1))) {
    const equals = part.indexOf("=");
    if (equals <= 0) continue;
    const key = part.slice(0, equals).trim().toLowerCase();
    const value = part.slice(equals + 1).trim();
    attrs[key] = value;
  }
  return { name, attrs };
}

/**
 * Splits on commas that are not inside quotes.
 * @param {string} input Attribute list.
 * @returns {string[]} Attribute assignments.
 */
function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | undefined;
  for (const char of input) {
    if (quote) {
      current += char;
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === ",") {
      const trimmed = current.trim();
      if (trimmed) parts.push(trimmed);
      current = "";
      continue;
    }
    current += char;
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

/**
 * Parses `$hex` or decimal tokens. Returns undefined when missing.
 * @param {string | undefined} token Raw attribute value.
 * @returns {number | undefined} The numeric value.
 */
function parseNumberToken(token: string | undefined): number | undefined {
  if (token === undefined || token === "") return undefined;
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
 * @param {Record<string, string>} attrs Attribute map.
 * @param {string} key Attribute name.
 * @param {string} owner Statement name for errors.
 * @returns {number} The parsed number.
 */
function requireNumber(attrs: Record<string, string>, key: string, owner: string): number {
  const value = parseNumberToken(attrs[key]);
  if (value === undefined) {
    throw new Error(`ld65 '${owner}' is missing numeric ${key}.`);
  }
  return value;
}

/**
 * Parses ld65 yes/no flags.
 * @param {string | undefined} raw Raw token.
 * @returns {boolean | undefined} Parsed flag.
 */
function parseYesNo(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const normalized = raw.toLowerCase();
  if (normalized === "yes" || normalized === "true") return true;
  if (normalized === "no" || normalized === "false") return false;
  return undefined;
}
