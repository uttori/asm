import { incrementInternalCounter, measureInternalPhase } from "../internal-instrumentation.js";
/**
 * Owns source and binary include resolution and source execution orchestration.
 */
export class IncludeSourceService {
    host;
    resolvedPathCache = new Map();
    textCache = new Map();
    constructor(host) {
        this.host = host;
    }
    /**
     * Starts a new assembly file snapshot and drops content retained by an older build.
     */
    beginAssemblySnapshot() {
        this.resolvedPathCache.clear();
        this.textCache.clear();
    }
    /**
     * Releases source text retained for the completed assembly.
     */
    endAssemblySnapshot() {
        this.beginAssemblySnapshot();
    }
    /**
     * Reads a source-relative binary or text file.
     * @param {string} filePath The path to read.
     * @param {BufferEncoding} [encoding] Optional text encoding.
     * @returns {Uint8Array | string} The file contents.
     */
    readFile(filePath, encoding) {
        try {
            const fullPath = this.resolvePath(filePath);
            if (!fullPath) {
                throw new Error(`Error reading file: ${filePath}`);
            }
            if (encoding) {
                return this.readTextFile(fullPath, encoding);
            }
            return this.host.fileProvider.readFile(fullPath);
        }
        catch {
            throw new Error(`Error reading file: ${filePath}`);
        }
    }
    /** Resolve the same include path used to read bytes, then attribute its exact consumed slice. */
    recordBinarySlice(filename, start, end, bytes) {
        this.host.recordBinarySlice?.(this.resolveIncludePath(filename), start, end, bytes);
    }
    /**
     * Resolves a source include target.
     * @param {string} filename The target filename.
     * @returns {string} The resolved provider path.
     */
    resolveIncludePath(filename) {
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
    includeFile(filename) {
        const resolvedPath = this.resolveIncludePath(filename);
        if (!this.host.includedFiles.has(resolvedPath)) {
            this.host.includedFiles.set(resolvedPath, { included: true, guarded: false });
        }
        this.assembleFile(filename);
    }
    /**
     * Guards the active source file against later includes in this pass.
     */
    guardCurrentFile() {
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
    resetGuards() {
        for (const [filePath, fileInfo] of this.host.includedFiles.entries()) {
            fileInfo.guarded = false;
            this.host.includedFiles.set(filePath, fileInfo);
        }
    }
    /**
     * Resolves, parses, lowers, and executes one source file.
     * @param {string} filename The target filename.
     */
    assembleFile(filename) {
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
            }
            else {
                this.host.includedFiles.set(resolvedPath, { included: true, guarded: false });
            }
            measureInternalPhase("includeParseLowerExecute", () => {
                const includeNode = this.host.programModelBuilder.createIncludeNode(resolvedPath, content);
                this.host.lowerAndExecuteRuntimeNodes(includeNode.commands);
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : (stringifyCaught(error) ?? "Unknown error");
            throw new Error(`Failed to assemble include '${resolvedPath}': ${message}`, { cause: error });
        }
        finally {
            this.host.currentFile = this.host.includeStack.pop() ?? "";
        }
    }
    get resolutionOptions() {
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
    resolvePath(filePath) {
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
    readTextFile(resolvedPath, encoding) {
        const key = `${encoding}\u0000${resolvedPath}`;
        const cached = this.textCache.get(key);
        if (cached !== undefined) {
            incrementInternalCounter("includeTextCacheHits");
            return cached;
        }
        incrementInternalCounter("includeReads");
        const content = measureInternalPhase("includeRead", () => this.host.fileProvider.readTextFile(resolvedPath, encoding));
        incrementInternalCounter("includeBytesRead", content.length);
        this.textCache.set(key, content);
        return content;
    }
}
function stringifyCaught(value) {
    return JSON.stringify(value);
}
//# sourceMappingURL=include-source-service.js.map