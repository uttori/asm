import path from "node:path";

import {
  NodeAssemblyFileProvider,
  stripWrappingQuotes,
  type AssemblyFileProvider,
  type AssemblyFileResolutionOptions,
  type AssemblyFileStat,
} from "../file-provider.js";

/**
 * A file provider that layers unsaved editor buffers on top of a backing
 * provider (the real filesystem by default). Open documents win over disk so
 * the language server analyses the in-editor content, while includes that only
 * exist on disk still resolve normally.
 */
export class OverlayFileProvider implements AssemblyFileProvider {
  /** Open document contents keyed by absolute, normalized path. */
  readonly overlay: Map<string, string>;

  /** The backing provider used when a path is not in the overlay. */
  readonly base: AssemblyFileProvider;
  /** Files consumed by this provider, including binary and definition-only dependencies. */
  readonly readFiles = new Set<string>();

  /**
   * Creates an overlay provider.
   * @param [overlay] Initial overlay contents keyed by absolute path.
   * @param [base] Backing provider for disk reads.
   */
  constructor(
    overlay: Map<string, string> = new Map(),
    base: AssemblyFileProvider = new NodeAssemblyFileProvider(),
  ) {
    this.overlay = overlay;
    this.base = base;
  }

  /**
   * Resolves a filename to an absolute path, preferring overlay entries.
   * @param filename The filename or relative path to resolve.
   * @param [options] Resolution context (current file, include paths).
   * @returns The resolved absolute path, or undefined when not found.
   */
  resolvePath(filename: string, options: AssemblyFileResolutionOptions = {}): string | undefined {
    if (!filename) {
      return undefined;
    }

    const normalized = stripWrappingQuotes(filename);

    // Let the backing provider resolve real files first. The overlay only
    // changes the bytes we return at read time, not where files live on disk.
    const baseResolved = this.base.resolvePath(filename, options);
    if (baseResolved) {
      return baseResolved;
    }

    // Overlay-only fallback for buffers that have never been written to disk.
    if (path.isAbsolute(normalized) && this.overlay.has(normalized)) {
      return normalized;
    }

    for (const candidate of this.candidatePaths(normalized, options)) {
      if (this.overlay.has(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  /**
   * Returns stat information, treating overlay entries as readable files.
   * @param filePath The absolute path to stat.
   * @returns The stat result.
   */
  stat(filePath: string): AssemblyFileStat {
    const entry = this.overlay.get(filePath);
    if (entry !== undefined) {
      return {
        exists: true,
        readable: true,
        size: Buffer.byteLength(entry, "utf8"),
      };
    }
    return this.base.stat(filePath);
  }

  /**
   * Reads a file as bytes, using overlay content when present.
   * @param filePath The absolute path to read.
   * @returns The file bytes.
   */
  readFile(filePath: string): Uint8Array {
    this.readFiles.add(filePath);
    const entry = this.overlay.get(filePath);
    if (entry !== undefined) {
      return new Uint8Array(Buffer.from(entry, "utf8"));
    }
    return this.base.readFile(filePath);
  }

  /**
   * Reads a file as text, using overlay content when present.
   * @param filePath The absolute path to read.
   * @param [encoding] The text encoding for disk reads.
   * @returns The file text.
   */
  readTextFile(filePath: string, encoding: BufferEncoding = "utf8"): string {
    this.readFiles.add(filePath);
    const entry = this.overlay.get(filePath);
    if (entry !== undefined) {
      return entry;
    }
    return this.base.readTextFile(filePath, encoding);
  }

  /**
   * Builds the candidate absolute paths for a relative filename, mirroring the
   * Node provider's resolution order.
   * @param normalized The unquoted filename.
   * @param options Resolution context.
   * @returns The candidate absolute paths to probe in the overlay.
   */
  candidatePaths(normalized: string, options: AssemblyFileResolutionOptions): string[] {
    if (path.isAbsolute(normalized)) {
      return [normalized];
    }
    const baseDirectories = [
      options.macroSourceFile ? path.dirname(options.macroSourceFile) : undefined,
      options.currentFile ? path.dirname(options.currentFile) : undefined,
      ...(options.includePaths ?? []),
      process.cwd(),
    ].filter((entry): entry is string => Boolean(entry));
    return baseDirectories.map((directory) => path.resolve(directory, normalized));
  }
}
