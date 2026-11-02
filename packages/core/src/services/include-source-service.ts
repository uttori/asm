import type { AssemblyFileProvider } from "../file-provider.js";
import {
  incrementInternalCounter,
  measureInternalPhase,
  withSourceSyntax,
} from "../internal-instrumentation.js";
import type { ExecutableNode } from "../ir/assembly-tree.js";
import type { ProgramModelBuilder } from "./program-model-builder.js";

/** Per-path include-once and guarded-include state tracked across the build. */
export interface IncludedFileInfo {
  /** Whether the file has been included. */
  included: boolean;
  /** Whether the file has been guarded with `includeonce`. */
  guarded: boolean;
}

/** Session services required to resolve, cache, and execute included sources. */
export interface IncludeSourceHost {
  /** Active file path while processing include directives. */
  currentFile: string;
  /** Macro expansion site used as an include search anchor when set. */
  readonly currentMacroSourceFile: string | undefined;
  /** Search paths consulted after macro and current file directories. */
  includePaths: string[];
  /** Stack of files entered through nested includes. */
  includeStack: string[];
  /** Include-once metadata keyed by resolved absolute paths. */
  includedFiles: Map<string, IncludedFileInfo>;
  /** File resolver and reader backing include path resolution. */
  fileProvider: AssemblyFileProvider;
  /** Builder producing executable nodes from included source text. */
  readonly programModelBuilder: ProgramModelBuilder;
  /** Lowers and executes nodes parsed from an included translation unit. */
  lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void;
  /** Records a directed include edge for dependency graphs. */
  recordIncludeEdge(fromFile: string, toFile: string): void;
  /** Scope include ownership without attaching caller state to cached file syntax. */
  withIncludeSource?(file: string, execute: () => void, fromFile: string): void;
  /** Final-pass hosts record which raw input bytes reach output for orphaned-edit validation. */
  recordBinarySlice?(file: string, start: number, end: number, bytes: Uint8Array): void;
  /** When false, include directives record an edge without parsing the target. */
  readonly followIncludes: boolean;
}

/**
 * Owns source and binary include resolution and source execution orchestration.
 */
export class IncludeSourceService {
  /** Memoized include resolution keyed by active file, paths, and requested path. */
  readonly resolvedPathCache = new Map<string, string>();
  /** Memoized text reads keyed by encoding and resolved path. */
  readonly textCache = new Map<string, string>();

  constructor(readonly host: IncludeSourceHost) {}

  /**
   * Starts a new assembly file snapshot and drops content retained by an older build.
   */
  beginAssemblySnapshot(): void {
    this.resolvedPathCache.clear();
    this.textCache.clear();
  }

  /**
   * Releases source text retained for the completed assembly.
   */
  endAssemblySnapshot(): void {
    this.beginAssemblySnapshot();
  }

  /**
   * Reads a source-relative binary or text file.
   * @param filePath The path to read.
   * @param [encoding] Optional text encoding.
   * @returns The file contents.
   */
  readFile(filePath: string, encoding?: BufferEncoding): Uint8Array | string {
    try {
      const fullPath = this.resolvePath(filePath);
      if (!fullPath) {
        throw new Error(`Error reading file: ${filePath}`);
      }
      if (encoding) {
        return this.readTextFile(fullPath, encoding);
      }
      return this.host.fileProvider.readFile(fullPath);
    } catch {
      throw new Error(`Error reading file: ${filePath}`);
    }
  }

  /** Resolve the same include path used to read bytes, then attribute its exact consumed slice. */
  recordBinarySlice(filename: string, start: number, end: number, bytes: Uint8Array): void {
    this.host.recordBinarySlice?.(this.resolveIncludePath(filename), start, end, bytes);
  }

  /**
   * Resolves a source include target.
   * @param filename The target filename.
   * @returns The resolved provider path.
   */
  resolveIncludePath(filename: string | null | undefined): string {
    if (filename == null) {
      throw new Error("Invalid or missing filename");
    }
    const resolved = this.resolvePath(filename);
    if (!resolved) {
      throw new Error(`Could not find file: ${filename}`);
    }
    return resolved;
  }

  /**
   * Marks and assembles an `include` target.
   * @param filename The target filename.
   */
  includeFile(filename: string): void {
    const resolvedPath = this.resolveIncludePath(filename);
    if (!this.host.includedFiles.has(resolvedPath)) {
      this.host.includedFiles.set(resolvedPath, { included: true, guarded: false });
    }
    this.assembleFile(filename);
  }

  /**
   * Guards the active source file against later includes in this pass.
   */
  guardCurrentFile(): void {
    const fileInfo = this.host.includedFiles.get(this.host.currentFile) ?? {
      included: true,
      guarded: false,
    };
    fileInfo.guarded = true;
    this.host.includedFiles.set(this.host.currentFile, fileInfo);
  }

  /**
   * Clears pass-local include guards.
   */
  resetGuards(): void {
    for (const [filePath, fileInfo] of this.host.includedFiles.entries()) {
      fileInfo.guarded = false;
      this.host.includedFiles.set(filePath, fileInfo);
    }
  }

  /**
   * Resolves, parses, lowers, and executes one source file.
   * @param filename The target filename.
   */
  assembleFile(filename: string): void {
    const resolvedPath = this.resolveIncludePath(filename);
    const fileInfo = this.host.includedFiles.get(resolvedPath);
    if (fileInfo?.guarded) {
      return;
    }
    if (this.host.includeStack.length >= 512) {
      throw new Error("Recursion limit exceeded (512 levels)");
    }
    if (resolvedPath === this.host.currentFile || this.host.includeStack.includes(resolvedPath)) {
      throw new Error(`Recursive include detected for '${resolvedPath}'`);
    }

    const previousFile = this.host.currentFile;
    this.host.includeStack.push(previousFile);
    this.host.recordIncludeEdge(previousFile, resolvedPath);

    // If followIncludes is false, we don't want to parse the included file.
    // This is used for editor-style analysis where we don't want to parse the included file.
    // We still record the include edge so that we can provide hover information for the include directive.
    if (!this.host.followIncludes) {
      this.host.includeStack.pop();
      return;
    }

    try {
      const content = this.readTextFile(resolvedPath, "utf8");
      this.host.currentFile = resolvedPath;

      const includedFile = this.host.includedFiles.get(resolvedPath);
      if (includedFile) {
        includedFile.included = true;
        this.host.includedFiles.set(resolvedPath, includedFile);
      } else {
        this.host.includedFiles.set(resolvedPath, { included: true, guarded: false });
      }

      measureInternalPhase("includeParseLowerExecute", () =>
        withSourceSyntax(() => {
          const includeNode = this.host.programModelBuilder.createIncludeNode(
            resolvedPath,
            content,
          );
          const execute = (): void => this.host.lowerAndExecuteRuntimeNodes(includeNode.commands);
          if (this.host.withIncludeSource) {
            this.host.withIncludeSource(resolvedPath, execute, previousFile);
          } else {
            execute();
          }
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : (stringifyCaught(error) ?? "Unknown error");
      throw new Error(`Failed to assemble include '${resolvedPath}': ${message}`, { cause: error });
    } finally {
      this.host.currentFile = this.host.includeStack.pop() ?? "";
    }
  }

  /** Snapshot of host path context used for include resolution cache keys. */
  get resolutionOptions(): {
    currentFile: string;
    includePaths: string[];
    macroSourceFile: string | undefined;
  } {
    return {
      currentFile: this.host.currentFile,
      includePaths: this.host.includePaths,
      macroSourceFile: this.host.currentMacroSourceFile,
    };
  }

  /**
   * Resolves a path once for the active source and include-path context.
   * @param filePath The source-relative path to resolve.
   * @returns The resolved provider path.
   */
  resolvePath(filePath: string): string | undefined {
    const options = this.resolutionOptions;
    const key = [
      options.currentFile,
      options.macroSourceFile ?? "",
      options.includePaths.join("\u0000"),
      filePath,
    ].join("\u0001");
    const cached = this.resolvedPathCache.get(key);
    if (cached !== undefined) {
      incrementInternalCounter("includeResolutionCacheHits");
      return cached;
    }
    const resolved = this.host.fileProvider.resolvePath(filePath, options);
    if (resolved !== undefined) {
      this.resolvedPathCache.set(key, resolved);
    }
    return resolved;
  }

  /**
   * Reads source text once per assembly snapshot.
   * @param resolvedPath The resolved provider path.
   * @param encoding The requested text encoding.
   * @returns The cached or newly read text.
   */
  readTextFile(resolvedPath: string, encoding: BufferEncoding): string {
    const key = `${encoding}\u0000${resolvedPath}`;
    const cached = this.textCache.get(key);
    if (cached !== undefined) {
      incrementInternalCounter("includeTextCacheHits");
      return cached;
    }
    incrementInternalCounter("includeReads");
    const content = measureInternalPhase("includeRead", () =>
      this.host.fileProvider.readTextFile(resolvedPath, encoding),
    );
    incrementInternalCounter("includeBytesRead", content.length);
    this.textCache.set(key, content);
    return content;
  }
}

/** Best-effort JSON serialization for include failure diagnostics. */
function stringifyCaught(value: unknown): string | undefined {
  return JSON.stringify(value);
}
