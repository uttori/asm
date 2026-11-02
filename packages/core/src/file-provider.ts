/**
 * Node built-ins are resolved only when the Node provider is used. Browser
 * sessions supply MemoryAssemblyFileProvider and never touch the host disk.
 */
const nodePath = typeof process === "undefined" ? undefined : process.getBuiltinModule("node:path");
const nodeFs = typeof process === "undefined" ? undefined : process.getBuiltinModule("node:fs");

const virtualPath = {
  isAbsolute: (value: string) => value.startsWith("/"),
  dirname: (value: string) => value.slice(0, value.lastIndexOf("/")) || ".",
  resolve: (...parts: string[]) => {
    const joined = parts.filter(Boolean).join("/");
    const stack: string[] = [];
    for (const part of joined.split("/")) {
      if (part === "..") {
        stack.pop();
      } else if (part && part !== ".") {
        stack.push(part);
      }
    }
    return `/${stack.join("/")}`;
  },
};
const path = nodePath ?? virtualPath;

/**
 * Fail explicitly if a host selects the Node provider in a browser runtime.
 * @returns Node's synchronous filesystem API.
 */
const requireNodeFs = (): typeof import("node:fs") => {
  if (!nodeFs) {
    throw new Error("NodeAssemblyFileProvider requires Node.js.");
  }
  return nodeFs;
};

/** Search context supplied by includes and file-reading expressions. */
export type AssemblyFileResolutionOptions = {
  /** Active source file used as a relative include anchor. */
  currentFile?: string;
  /** Additional directories searched after macro and current file locations. */
  includePaths?: string[];
  /** Macro expansion site used ahead of the current file in search order. */
  macroSourceFile?: string;
};

/** Provider metadata used for existence checks and source-cache invalidation. */
export type AssemblyFileStat = {
  /** Whether the path resolves to a stored or on-disk object. */
  exists: boolean;
  /** Whether the provider can read bytes for an existing path. */
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
  /** Returns existence, readability, and optional size or mtime metadata. */
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
  /** Consumed paths for dependency snapshots; callers reusing a provider may clear this per build. */
  readonly readFiles = new Set<string>();

  /**
   * Find the first existing path: macro directory, current source directory, include paths, then cwd.
   * @param filename Include path token, optionally quoted.
   * @param [options] Source and include directories in search order.
   * @returns First existing file identity, or undefined.
   */
  resolvePath(filename: string, options: AssemblyFileResolutionOptions = {}): string | undefined {
    requireNodeFs();
    if (!filename) {
      return undefined;
    }

    const normalized = stripWrappingQuotes(filename);
    if (path.isAbsolute(normalized)) {
      return this.stat(normalized).exists ? normalized : undefined;
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
      // Resolve through the provider's view so snapshot overlays can create or hide candidates.
      if (this.stat(candidate).exists) {
        return candidate;
      }
    }

    return undefined;
  }

  /** Probes disk metadata without recording the path as a consumed dependency. */
  stat(filePath: string): AssemblyFileStat {
    const fs = requireNodeFs();
    let st: import("node:fs").Stats;
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

  /** Reads disk bytes and records the path in the build dependency set. */
  readFile(filePath: string): Uint8Array {
    const fs = requireNodeFs();
    this.readFiles.add(filePath);
    return new Uint8Array(fs.readFileSync(filePath));
  }

  /** Reads disk text and records the path in the build dependency set. */
  readTextFile(filePath: string, encoding: BufferEncoding = "utf8"): string {
    const fs = requireNodeFs();
    this.readFiles.add(filePath);
    return fs.readFileSync(filePath, encoding);
  }
}

/** Bounds owned overlay bytes and consumed snapshots independently; defaults to 256 MiB each. */
export interface NodeAssemblySnapshotOptions {
  /** Absolute file identities. Null hides a saved file; supplied maps and bytes are copied. */
  readonly overlays?: ReadonlyMap<string, Uint8Array | null>;
  /** Positive safe-integer byte limit, including binary includes. */
  readonly maxBytes?: number;
}

/**
 * One Node build's owned input view. All passes see the first bytes read, including after disk
 * changes; call assertUnchanged before accepting the result. Create a new provider for each build.
 * Node path/filesystem policy stays here; assemblers consume the portable AssemblyFileProvider contract.
 */
export class NodeAssemblySnapshotProvider extends NodeAssemblyFileProvider {
  readonly #overlays = new Map<string, Uint8Array | null>();
  readonly #snapshots = new Map<string, Uint8Array>();
  readonly #maxBytes: number;
  #bytes = 0;
  /** Exact consumed bytes keyed by absolute path. Entries and buffers are borrowed read-only. */
  readonly snapshots: ReadonlyMap<string, Uint8Array> = this.#snapshots;

  constructor(options: NodeAssemblySnapshotOptions = {}) {
    super();
    requireNodeFs();
    this.#maxBytes = options.maxBytes ?? 256 * 1024 * 1024;
    if (!Number.isSafeInteger(this.#maxBytes) || this.#maxBytes < 1) {
      throw new Error("Source snapshot byte limit must be a positive safe integer.");
    }
    let bytes = 0;
    for (const [file, value] of options.overlays ?? []) {
      if (!path.isAbsolute(file)) {
        throw new Error(`Source overlay requires an absolute path: ${file}`);
      }
      bytes += value?.length ?? 0;
      if (bytes > this.#maxBytes) {
        throw new Error(`Source overlays exceed ${this.#maxBytes} bytes.`);
      }
      this.#overlays.set(path.resolve(file), value === null ? null : Uint8Array.from(value));
    }
  }

  /** Applies overlays and retained snapshots before falling back to disk stat. */
  override stat(file: string): AssemblyFileStat {
    const name = path.resolve(file);
    if (this.#overlays.has(name)) {
      const bytes = this.#overlays.get(name);
      return { exists: bytes !== null, readable: bytes !== null, size: bytes?.length };
    }
    const snapshot = this.#snapshots.get(name);
    if (snapshot) {
      // Resolution and length checks must keep seeing the consumed input until freshness validation.
      return { exists: true, readable: true, size: snapshot.length };
    }
    return super.stat(name);
  }

  /** Returns immutable snapshot bytes, honoring overlays and the build byte budget. */
  override readFile(file: string): Uint8Array {
    const name = path.resolve(file);
    let bytes = this.#snapshots.get(name);
    if (!bytes) {
      const overlay = this.#overlays.get(name);
      if (overlay === null) {
        throw new Error(`Candidate source removed '${name}'.`);
      }
      const size = overlay?.length ?? super.stat(name).size ?? 0;
      if (size > this.#maxBytes - this.#bytes) {
        throw new Error(`Source build input snapshot exceeds ${this.#maxBytes} bytes.`);
      }
      bytes = overlay ?? super.readFile(name);
      // Recheck actual bytes because a disk file may grow between stat and read.
      if (bytes.length > this.#maxBytes - this.#bytes) {
        throw new Error(`Source build input snapshot exceeds ${this.#maxBytes} bytes.`);
      }
      this.#bytes += bytes.length;
      this.#snapshots.set(name, bytes);
      this.readFiles.add(name);
    }
    // Encoders and converters cannot mutate the input observed by later passes or receipts.
    return bytes.slice();
  }

  /** Decodes snapshot bytes using the same copy-on-read path as binary reads. */
  override readTextFile(file: string, encoding: BufferEncoding = "utf8"): string {
    return Buffer.from(this.readFile(file)).toString(encoding);
  }

  /** Reject changed or removed saved inputs; copied overlays remain independent of the host disk. */
  assertUnchanged(): void {
    const fs = requireNodeFs();
    for (const [file, bytes] of this.#snapshots) {
      if (this.#overlays.has(file)) {
        continue;
      }
      try {
        if (fs.statSync(file).size === bytes.length && fs.readFileSync(file).equals(bytes)) {
          continue;
        }
      } catch (cause) {
        throw new Error(`Source dependency changed during assembly: ${file}`, { cause });
      }
      throw new Error(`Source dependency changed during assembly: ${file}`);
    }
  }
}

/** Virtual lookup base. No host cwd fallback or filesystem access is used. */
export type MemoryAssemblyFileProviderOptions = {
  /** Default relative lookup root when no macro or current file anchor applies. */
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
   * @param filename Include path token, optionally quoted.
   * @param [options] Source and include directories in search order.
   * @returns First existing file identity, or undefined.
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

  /** Reports virtual document presence and encoded byte length. */
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
      size: typeof entry === "string" ? new TextEncoder().encode(entry).length : entry.length,
    };
  }

  /** Returns a copy of virtual file bytes, encoding strings as UTF-8. */
  readFile(filePath: string): Uint8Array {
    const entry = this.files.get(filePath);
    if (entry === undefined) {
      throw new Error(`Virtual file not found: ${filePath}`);
    }
    return typeof entry === "string" ? new TextEncoder().encode(entry) : new Uint8Array(entry);
  }

  /** Returns stored string content or decodes binary virtual entries. */
  readTextFile(filePath: string, encoding: BufferEncoding = "utf8"): string {
    const entry = this.files.get(filePath);
    if (entry === undefined) {
      throw new Error(`Virtual file not found: ${filePath}`);
    }
    if (typeof entry === "string") {
      return entry;
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(entry).toString(encoding);
    }
    return new TextDecoder(encoding).decode(entry);
  }
}

/**
 * Removes matching wrapping quotes from a user-supplied file path token.
 * @param filename The raw path token.
 * @returns The unwrapped path.
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
