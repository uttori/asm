import type { AssemblyFileProvider } from "../file-provider.js";
import type { ExecutableNode } from "../ir/assembly-tree.js";
import type { AssemblyFrontEndService } from "./assembly-front-end-service.js";

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
  readonly frontEndService: AssemblyFrontEndService;
  lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void;
  recordIncludeEdge(fromFile: string, toFile: string): void;
}

/**
 * Owns source and binary include resolution and source execution orchestration.
 */
export class IncludeSourceService {
  constructor(readonly host: IncludeSourceHost) {}

  /**
   * Reads a source-relative binary or text file.
   * @param {string} filePath The path to read.
   * @param {BufferEncoding} [encoding] Optional text encoding.
   * @returns {Uint8Array | string} The file contents.
   */
  readFile(filePath: string, encoding?: BufferEncoding): Uint8Array | string {
    try {
      const fullPath = this.host.fileProvider.resolvePath(filePath, this.resolutionOptions);
      if (!fullPath) {
        throw new Error(`Error reading file: ${filePath}`);
      }
      if (encoding) {
        return this.host.fileProvider.readTextFile(fullPath, encoding);
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
    const resolved = this.host.fileProvider.resolvePath(filename, this.resolutionOptions);
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
    const fileInfo = this.host.includedFiles.get(this.host.currentFile) ?? { included: true, guarded: false };
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

    try {
      const content = this.host.fileProvider.readTextFile(resolvedPath, "utf8");
      this.host.currentFile = resolvedPath;

      const includedFile = this.host.includedFiles.get(resolvedPath);
      if (includedFile) {
        includedFile.included = true;
        this.host.includedFiles.set(resolvedPath, includedFile);
      } else {
        this.host.includedFiles.set(resolvedPath, { included: true, guarded: false });
      }

      const includeNode = this.host.frontEndService.createIncludeNode(resolvedPath, content);
      this.host.lowerAndExecuteRuntimeNodes(includeNode.commands);
    } catch (error) {
      const message = error instanceof Error ? error.message : JSON.stringify(error) ?? "Unknown error";
      throw new Error(`Failed to assemble include '${resolvedPath}': ${message}`);
    } finally {
      this.host.currentFile = this.host.includeStack.pop() ?? "";
    }
  }

  private get resolutionOptions(): {
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
}
