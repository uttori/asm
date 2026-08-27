import type { AssemblyFileProvider } from "../file-provider.js";
import type { ExecutableNode } from "../ir/assembly-tree.js";
import type { ProgramModelBuilder } from "./program-model-builder.js";
import { incrementInternalCounter, measureInternalPhase } from "../internal-instrumentation.js";

export interface IncludedFileInfo {
  /** Whether the file has been included. */
  included: boolean;
  /** Whether the file has been guarded with `includeonce`. */
  guarded: boolean;
}

export interface IncludeSourceHost {
  currentFile: string;
  readonly currentMacroSourceFile: string | undefined;
  includePaths: string[];
  includeStack: string[];
  includedFiles: Map<string, IncludedFileInfo>;
  fileProvider: AssemblyFileProvider;
  readonly programModelBuilder: ProgramModelBuilder;
  lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void;
  recordIncludeEdge(fromFile: string, toFile: string): void;
  /** When false, include directives record an edge without parsing the target. */
  readonly followIncludes: boolean;
}

/**
 * Owns source and binary include resolution and source execution orchestration.
 */
export class IncludeSourceService {
  readonly resolvedPathCache = new Map<string, string>();
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
   * @param {string} filePath The path to read.
   * @param {BufferEncoding} [encoding] Optional text encoding.
   * @returns {Uint8Array | string} The file contents.
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

  /**
   * Resolves a source include target.
   * @param {string} filename The target filename.
   * @returns {string} The resolved provider path.
   */
  resolveIncludePath(filename: string): string {
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
   * @param {string} filename The target filename.
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
   * @param {string} filename The target filename.
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
    if (this.host.followIncludes === false) {
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

      measureInternalPhase("includeParseLowerExecute", () => {
        const includeNode = this.host.programModelBuilder.createIncludeNode(resolvedPath, content);
        this.host.lowerAndExecuteRuntimeNodes(includeNode.commands);
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : (JSON.stringify(error) ?? "Unknown error");
      throw new Error(`Failed to assemble include '${resolvedPath}': ${message}`);
    } finally {
      this.host.currentFile = this.host.includeStack.pop() ?? "";
    }
  }

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
   * @param {string} filePath The source-relative path to resolve.
   * @returns {string | undefined} The resolved provider path.
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
   * @param {string} resolvedPath The resolved provider path.
   * @param {BufferEncoding} encoding The requested text encoding.
   * @returns {string} The cached or newly read text.
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
