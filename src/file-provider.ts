import fs from "node:fs";
import path from "node:path";

export type AssemblyFileResolutionOptions = {
  currentFile?: string;
  includePaths?: string[];
  macroSourceFile?: string;
};

export type AssemblyFileStat = {
  exists: boolean;
  readable: boolean;
  size?: number;
};

/**
 * Abstracts file resolution and reads so tooling callers can provide in-memory
 * documents instead of depending on the host filesystem directly.
 */
export interface AssemblyFileProvider {
  resolvePath(filename: string, options?: AssemblyFileResolutionOptions): string | undefined;
  stat(filePath: string): AssemblyFileStat;
  readFile(filePath: string): Uint8Array;
  readTextFile(filePath: string, encoding?: BufferEncoding): string;
}

/**
 * Default Node.js-backed file provider used by the assembler runtime.
 */
export class NodeAssemblyFileProvider implements AssemblyFileProvider {
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
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        readable: false,
      };
    }

    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      return {
        exists: true,
        readable: true,
        size: fs.statSync(filePath).size,
      };
    } catch {
      return {
        exists: true,
        readable: false,
      };
    }
  }

  readFile(filePath: string): Uint8Array {
    return new Uint8Array(fs.readFileSync(filePath));
  }

  readTextFile(filePath: string, encoding: BufferEncoding = "utf8"): string {
    return fs.readFileSync(filePath, encoding);
  }
}

export type MemoryAssemblyFileProviderOptions = {
  workingDirectory?: string;
};

/**
 * In-memory file provider intended for editor workflows and virtual documents.
 */
export class MemoryAssemblyFileProvider implements AssemblyFileProvider {
  readonly files: Map<string, string | Uint8Array>;

  constructor(
    files: Map<string, string | Uint8Array> | Record<string, string | Uint8Array> = new Map(),
    readonly options: MemoryAssemblyFileProviderOptions = {},
  ) {
    this.files = files instanceof Map ? new Map(files) : new Map(Object.entries(files));
  }

  resolvePath(filename: string, options: AssemblyFileResolutionOptions = {}): string | undefined {
    if (!filename) {
      return undefined;
    }

    const normalized = stripWrappingQuotes(filename);
    if (this.files.has(normalized)) {
      return normalized;
    }

    const baseDirectories = [
      options.macroSourceFile ? getDirectoryForProviderPath(options.macroSourceFile) : undefined,
      options.currentFile ? getDirectoryForProviderPath(options.currentFile) : undefined,
      ...(options.includePaths ?? []),
      this.options.workingDirectory,
    ].filter((entry): entry is string => Boolean(entry));

    for (const baseDirectory of baseDirectories) {
      const candidate = resolveProviderPath(baseDirectory, normalized);
      if (candidate && this.files.has(candidate)) {
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
    return typeof entry === "string" ? new Uint8Array(Buffer.from(entry, "utf8")) : new Uint8Array(entry);
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
 * Creates the default filesystem-backed provider.
 * @returns {AssemblyFileProvider} The Node.js provider instance.
 */
export function createNodeAssemblyFileProvider(): AssemblyFileProvider {
  return new NodeAssemblyFileProvider();
}

/**
 * Creates a memory-backed provider for virtual / unsaved editor documents.
 * @param {Map<string, string | Uint8Array> | Record<string, string | Uint8Array>} files The virtual file contents.
 * @param {MemoryAssemblyFileProviderOptions} [options] Resolution options for relative paths.
 * @returns {AssemblyFileProvider} The memory-backed provider instance.
 */
export function createMemoryAssemblyFileProvider(
  files: Map<string, string | Uint8Array> | Record<string, string | Uint8Array>,
  options: MemoryAssemblyFileProviderOptions = {},
): AssemblyFileProvider {
  return new MemoryAssemblyFileProvider(files, options);
}

/**
 * Removes matching wrapping quotes from a user-supplied file path token.
 * @param {string} filename The raw path token.
 * @returns {string} The unwrapped path.
 */
function stripWrappingQuotes(filename: string): string {
  if (
    (filename.startsWith("\"") && filename.endsWith("\"")) ||
    (filename.startsWith("'") && filename.endsWith("'")) ||
    (filename.startsWith("`") && filename.endsWith("`"))
  ) {
    return filename.slice(1, -1);
  }
  return filename;
}

/**
 * Resolves a provider path.
 * @param {string} baseDirectory The base directory to resolve the path from.
 * @param {string} filename The filename to resolve.
 * @returns {string} The resolved path.
 */
function resolveProviderPath(baseDirectory: string, filename: string): string {
  if (path.isAbsolute(filename) || hasProviderScheme(filename)) {
    return filename;
  }

  const schemeMatch = baseDirectory.match(/^([A-Za-z][\d+.A-Za-z-]*:)(\/.*)?$/);
  if (schemeMatch) {
    const [, scheme, schemePath = "/"] = schemeMatch;
    const resolvedPath = path.posix.resolve(schemePath, filename);
    return `${scheme}${resolvedPath}`;
  }

  return path.resolve(baseDirectory, filename);
}

/**
 * Gets the directory for a provider path.
 * @param {string} filePath The path to get the directory for.
 * @returns {string} The directory for the provider path.
 */
function getDirectoryForProviderPath(filePath: string): string {
  const schemeMatch = filePath.match(/^([A-Za-z][\d+.A-Za-z-]*:)(\/.*)?$/);
  if (schemeMatch) {
    const [, scheme, schemePath = "/"] = schemeMatch;
    return `${scheme}${path.posix.dirname(schemePath)}`;
  }
  return path.dirname(filePath);
}

/**
 * Checks if a value has a provider scheme.
 * @param {string} value The value to check.
 * @returns {boolean} True if the value has a provider scheme, false otherwise.
 */
function hasProviderScheme(value: string): boolean {
  return /^[A-Za-z][\d+.A-Za-z-]*:/.test(value);
}
