import fs from "node:fs";
import path from "node:path";

/** Search context supplied by includes and file-reading expressions. */
export type AssemblyFileResolutionOptions = {
  currentFile?: string;
  includePaths?: string[];
  macroSourceFile?: string;
};

/** Provider metadata used for existence checks and source-cache invalidation. */
export type AssemblyFileStat = {
  exists: boolean;
  readable: boolean;
  /** Byte length when known. */
  size?: number;
  /** Modification time in milliseconds since epoch (disk files only). */
  mtimeMs?: number;
};

/**
 * Abstracts file resolution and reads so tooling callers can provide in-memory
 * documents instead of depending on the host filesystem directly.
 */
export interface AssemblyFileProvider {
  /** Return a stable file identity, or undefined if no candidate exists. */
  resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
  stat(filePath: string): AssemblyFileStat;
  /** Read synchronously, throwing on failure. Callers must treat returned bytes as read-only. */
  readFile(filePath: string): Uint8Array;
  /** Read synchronously. Built-in providers default to UTF-8 and throw on missing files. */
  readTextFile(filePath: string, encoding?: BufferEncoding): string;
}

/**
 * Default Node.js-backed file provider used by the assembler runtime.
 */
export class NodeAssemblyFileProvider implements AssemblyFileProvider {
  /**
   * Find the first existing path: macro directory, current source directory, include paths, then cwd.
   * @param {string} filename Include path token, optionally quoted.
   * @param {AssemblyFileResolutionOptions} [options] Source and include directories in search order.
   * @returns {string | undefined} First existing file identity, or undefined.
   */
  resolvePath(filename: string, options: AssemblyFileResolutionOptions = {}): string | undefined {
    if (!filename) {
      return undefined;
    }

    const normalized = stripWrappingQuotes(filename);
    if (path.isAbsolute(normalized)) {
      return fs.existsSync(normalized) ? normalized : undefined;
    }

    const candidates = new Set<string>();
    const baseDirectories = [
      options.macroSourceFile ? path.dirname(options.macroSourceFile) : undefined,
      options.currentFile ? path.dirname(options.currentFile) : undefined,
      ...(options.includePaths ?? []),
      process.cwd(),
    ].filter((entry): entry is string => Boolean(entry));

    for (const baseDirectory of baseDirectories) {
      candidates.add(path.resolve(baseDirectory, normalized));
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  stat(filePath: string): AssemblyFileStat {
    let st: fs.Stats;
    try {
      st = fs.statSync(filePath);
    } catch {
      return { exists: false, readable: false };
    }
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      return { exists: true, readable: true, size: st.size, mtimeMs: st.mtimeMs };
    } catch {
      return { exists: true, readable: false, mtimeMs: st.mtimeMs };
    }
  }

  readFile(filePath: string): Uint8Array {
    return new Uint8Array(fs.readFileSync(filePath));
  }

  readTextFile(filePath: string, encoding: BufferEncoding = "utf8"): string {
    return fs.readFileSync(filePath, encoding);
  }
}

/** Virtual lookup base. No host cwd fallback or filesystem access is used. */
export type MemoryAssemblyFileProviderOptions = {
  workingDirectory?: string;
};

/**
 * In-memory file provider intended for editor workflows and virtual documents.
 */
export class MemoryAssemblyFileProvider implements AssemblyFileProvider {
  /** Mutable document map. Construction copies keys/entries but retains supplied byte-array values. */
  readonly files: Map<string, string | Uint8Array>;

  constructor(
    files: Map<string, string | Uint8Array> | Record<string, string | Uint8Array> = new Map(),
    readonly options: MemoryAssemblyFileProviderOptions = {},
  ) {
    this.files = files instanceof Map ? new Map(files) : new Map(Object.entries(files));
  }

  /**
   * Match an exact virtual key, then search macro/source/include directories and workingDirectory.
   * @param {string} filename Include path token, optionally quoted.
   * @param {AssemblyFileResolutionOptions} [options] Source and include directories in search order.
   * @returns {string | undefined} First existing file identity, or undefined.
   */
  resolvePath(filename: string, options: AssemblyFileResolutionOptions = {}): string | undefined {
    if (!filename) {
      return undefined;
    }

    const normalized = stripWrappingQuotes(filename);
    if (this.files.has(normalized)) {
      return normalized;
    }

    if (path.isAbsolute(normalized)) {
      return undefined;
    }

    const baseDirectories = [
      options.macroSourceFile ? path.dirname(options.macroSourceFile) : undefined,
      options.currentFile ? path.dirname(options.currentFile) : undefined,
      ...(options.includePaths ?? []),
      this.options.workingDirectory,
    ].filter((entry): entry is string => Boolean(entry));

    for (const baseDirectory of baseDirectories) {
      const candidate = path.resolve(baseDirectory, normalized);
      if (this.files.has(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  stat(filePath: string): AssemblyFileStat {
    const entry = this.files.get(filePath);
    if (entry === undefined) {
      return {
        exists: false,
        readable: false,
      };
    }

    return {
      exists: true,
      readable: true,
      size: typeof entry === "string" ? Buffer.byteLength(entry, "utf8") : entry.length,
    };
  }

  readFile(filePath: string): Uint8Array {
    const entry = this.files.get(filePath);
    if (entry === undefined) {
      throw new Error(`Virtual file not found: ${filePath}`);
    }
    return typeof entry === "string"
      ? new Uint8Array(Buffer.from(entry, "utf8"))
      : new Uint8Array(entry);
  }

  readTextFile(filePath: string, encoding: BufferEncoding = "utf8"): string {
    const entry = this.files.get(filePath);
    if (entry === undefined) {
      throw new Error(`Virtual file not found: ${filePath}`);
    }
    return typeof entry === "string" ? entry : Buffer.from(entry).toString(encoding);
  }
}

/**
 * Removes matching wrapping quotes from a user-supplied file path token.
 * @param {string} filename The raw path token.
 * @returns {string} The unwrapped path.
 */
export function stripWrappingQuotes(filename: string): string {
  if (
    (filename.startsWith('"') && filename.endsWith('"')) ||
    (filename.startsWith("'") && filename.endsWith("'")) ||
    (filename.startsWith("`") && filename.endsWith("`"))
  ) {
    return filename.slice(1, -1);
  }
  return filename;
}
