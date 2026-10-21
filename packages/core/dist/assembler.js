import { normalizeAddressForWidth } from "./address-width.js";
import { AddressToLineMapping } from "./addressToLine.js";
import { ArchitectureRegistry } from "./architecture-registry.js";
import { createAssemblySourceLocation, diagnosticFromError, rememberErrorSource, } from "./diagnostics.js";
import { CORE_DIRECTIVE_GROUPS } from "./directive-groups.js";
import { inheritCoreDataHandler, isCoreDataDirective } from "./directives/data.js";
import { createDirectiveRegistry } from "./directives/registry.js";
import { NodeAssemblyFileProvider } from "./file-provider.js";
import { withAstQualification, withSourceSyntax, withTypedExecution, incrementInternalCounter, measureInternalPhase, } from "./internal-instrumentation.js";
import { assetCallGuard, parseAssetCall } from "./ir/asset-call.js";
import { inheritExpressionOccurrence, isReferenceExpressionNode, parseExpressionAtSite, renderExpressionNode, } from "./ir/expression-node.js";
import { cloneNormalizedCommand, createNormalizedCommand, classifyCommand, } from "./ir/normalized-command.js";
import { bindInstructionOperands, OperandTemplateBindingError } from "./ir/parsed-operand.js";
import { referencePath } from "./ir/reference-path.js";
import { ReferencePlanner } from "./ir/reference-plan.js";
import { InstructionResolutionFrame } from "./ir/resolved-instruction.js";
import { fragmentText, sourceFragment, sliceSourceFragment, } from "./ir/source-fragment.js";
import { materializeNumericData } from "./ir/statement-node.js";
import { syntaxExpression } from "./ir/syntax-codec.js";
import { MathCore } from "./mathcore.js";
import { OperandResolver } from "./operand-resolver.js";
import { PLUGIN_API_VERSION } from "./plugin/contracts.js";
import { PluginError, PluginSessionStateStore, } from "./plugin/index.js";
import { clonePluginSyntax } from "./plugin/syntax-snapshot.js";
import { AssemblyFrontEndService, } from "./services/assembly-front-end-service.js";
import { AssemblyOutputBuffer } from "./services/assembly-output-buffer.js";
import { AssetAssemblyService } from "./services/asset-assembly-service.js";
import { CommandLoweringService, } from "./services/command-lowering-service.js";
import { isBareLabelReference } from "./services/command-text-service.js";
import { DefineEngine } from "./services/define-engine.js";
import { DirectiveRuntimeService, } from "./services/directive-runtime-service.js";
import { FrontEndCommandService } from "./services/front-end-command-service.js";
import { IncludeSourceService } from "./services/include-source-service.js";
import { MacroEngine } from "./services/macro-engine.js";
import { OutputWriterService } from "./services/output-writer-service.js";
import { createPluginSessionCapabilities } from "./services/plugin-session-capabilities.js";
import { StructEngine } from "./services/struct-engine.js";
import { parseStructInitializerEntries, structInitializerStart, } from "./services/struct-initializer.js";
import { getStructMetadata } from "./services/struct-metadata.js";
import { SymbolScopeService, parseUnnamedLabelReference, } from "./services/symbol-scope-service.js";
import { createTextSpan, sourceLineStarts } from "./source-location.js";
import { ASAR_SYNTAX_PROFILE } from "./syntax-profile.js";
const TOOLING_ANALYSIS_STAGES = ["collectDefinitions"];
/**
 * Mutable, synchronous build session. Share its frozen environment with other sessions, not its state.
 * Use assembleSource/assembleProgram for builds and analyzeSource for recovering diagnostics.
 * Dispose the session before its plugin manager or loader. Use a fresh session after a failed build.
 * Public runtime fields and service methods support directives and tooling and require stage invariants.
 */
export class Assembler {
    /** The current logical target address. */
    currentTargetAddress = 0;
    /** The current logical target base address. */
    currentTargetBaseAddress = 0;
    /** The current target start address. `startpos` */
    currentTargetStartAddress = 0;
    /** The current target base start address. `realstartpos` */
    currentTargetBaseStartAddress = 0;
    bytes = 0;
    pushBaseStack = [];
    outputBuffer = new AssemblyOutputBuffer();
    /**
     * Mutable output; large contiguous session-owned images may use typed views. Reacquire a view after
     * growing writes; assigned arrays retain their growth behavior and assigned typed arrays stay fixed.
     */
    get outputBytes() {
        return this.outputBuffer.bytes;
    }
    set outputBytes(value) {
        this.outputBuffer.replace(value);
    }
    /** Byte used when expanding a sparse output range. */
    outputFillByte = 0;
    whileStatus = [];
    namespaceStack = [];
    currentNamespace = "";
    namespaceNestingEnabled = false;
    namespaceNestingPath = [];
    // Current macro tracking
    currentMacroName = "";
    currentVariadicCount = undefined;
    currentVariadicArgs = [];
    macros = new Map();
    mathCore;
    operandResolver;
    addressToLineMapping = new AddressToLineMapping();
    currentFile = "";
    currentLine = 0;
    /** Invocation-local provenance. Buffered nodes snapshot it before this scope ends. */
    currentSourceOrigin;
    /** Optional sink for structured tracing used by tests and ad-hoc debug scripts. */
    traceListener = null;
    /** Active command contexts so nested byte writes inherit the right source line. */
    traceCommandStack = [];
    defines = new Map();
    /** Bare numeric values exposed only while executing typed `for` loops. */
    activeLoopVariables = new Map();
    // Character mapping support
    characterMappings = new Map();
    currentTable = null;
    tableStack = [];
    arch = "";
    pushpcStack = [];
    pushpcnum = 0;
    labelTable = new Map();
    /** ca65 `.export` / `.import` names that stay session-global. */
    globalSymbols = new Set();
    /** Track multiple `+` labels */
    forwardLabels = {};
    /** Track multiple `-` labels */
    backwardLabels = {};
    padUnit = 1;
    padbyte = [];
    structs = new Map();
    currentStruct = null;
    savedPCStack = [];
    /** Initialize fill pattern */
    fillbyte = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    baseImage;
    // Add a static property to hold our CRC table.
    static crcTable = null;
    includedFiles = new Map();
    includeStack = [];
    includePaths = ["./"];
    macroLabelInstance = 0; // Tracks the current macro instance
    inMacroExpansion = false; // Flag to track if we're inside a macro expansion
    currentParentLabel = ""; // Track the most recent parent label
    currentParentIsGlobal = false; // Track if the parent label is global
    currentGlobalParentLabel = ""; // Track the active top-level parent for single-dot labels
    labelParents = new Map(); // Track explicit label ancestry without relying on underscores
    requireStaticLabelLookup = false;
    /** Session syntax values indexed by opaque builder identities, with source keys owned by the builder. */
    passProgramCache = new Map();
    directiveRegistry;
    architectureRegistry;
    environment;
    targetId;
    targetOptions;
    syntaxProfile;
    coreDirectiveGroups;
    pluginState;
    pluginAddressSpace;
    pluginOutputFormat;
    activeLifecycles;
    cursorAddress;
    fileProvider;
    /** Binary/resource dependencies and converted bytes owned by the active build. */
    assetAssembly = new AssetAssemblyService(this);
    /** Tooling-only path discovery avoids conversion on edit bursts. */
    deferAssetConversion = false;
    /** Once an active asset is skipped, subsequent layout values cannot validate assertions in this pass. */
    #hasDeferredAssetLayout = false;
    frontEndService;
    programModelBuilder;
    commandLoweringService;
    incrementalProgramParseState;
    services;
    stageExecutionStates = new Map();
    diagnostics = [];
    symbolDefinitions = [];
    symbolReferences = [];
    /** Deduplication index for {@link symbolDefinitions} — O(1) vs. the former O(n) `.some()` scan. */
    #symbolDefinitionKeys = new Set();
    /** Deduplication index for {@link symbolReferences} — O(1) vs. the former O(n) `.some()` scan. */
    #symbolReferenceKeys = new Set();
    /** Pure occurrence plans replay against the current scope instead of caching resolved references. */
    referencePlanner = new ReferencePlanner();
    /** Static records need replay only when the same deduplication fields or analysis epoch change. */
    stableReferences = new WeakMap();
    referenceEpoch = 0;
    /** Deduplication index for {@link includeEdges} — O(1) vs. O(n) `.some()` scan. */
    #includeEdgeKeys = new Set();
    includeEdges = [];
    collectSourceMetadata;
    /** When false, `incsrc`/`include` record an edge but do not parse the included file. */
    followIncludes = true;
    activeStageExecutionState = null;
    analysisErrorRecoveryEnabled = false;
    sessionDisposed = false;
    #pluginBorrowDepth = 0;
    #pluginCapabilities = createPluginSessionCapabilities(this, () => {
        if (this.#pluginBorrowDepth === 0) {
            throw new Error("Plugin capabilities are only valid during a synchronous callback.");
        }
    });
    /** Nesting permits target hooks triggered synchronously by another plugin capability. */
    borrowPluginCapabilities(callback) {
        this.#pluginBorrowDepth++;
        try {
            return callback();
        }
        finally {
            this.#pluginBorrowDepth--;
        }
    }
    get defineEngine() {
        return this.services.defineEngine;
    }
    get directiveRuntime() {
        return this.services.directiveRuntime;
    }
    get addressWidth() {
        return this.pluginAddressSpace.addressWidth;
    }
    get availableArchitectures() {
        return new Set(this.environment.getTarget(this.targetId)?.architectures ?? []);
    }
    get targetDisplayName() {
        return this.environment.getTarget(this.targetId)?.displayName ?? this.targetId;
    }
    get frontEndCommandService() {
        return this.services.frontEndCommandService;
    }
    get includeSource() {
        return this.services.includeSource;
    }
    get macroEngine() {
        return this.services.macroEngine;
    }
    get symbolScope() {
        return this.services.symbolScope;
    }
    get outputWriter() {
        return this.services.outputWriter;
    }
    get structEngine() {
        return this.services.structEngine;
    }
    // Core assembler wrapper helpers
    get currentAddress() {
        return this.currentTargetAddress;
    }
    /**
     * Records current address.
     */
    recordCurrentAddress() {
        this.addAddressToLine(normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth));
    }
    /** Record raw input consumption at its actual output location, including incbin arrow seeks. */
    recordBinarySlice(file, start, end, bytes) {
        if (this.traceStage !== "emitProgram" || !this.collectSourceMetadata) {
            return;
        }
        const mapping = this.addressToLineMapping;
        mapping.registerDependencySnapshot(file, bytes);
        // base changes label addresses without moving the physical load cursor used by source maps.
        const outputOffset = this.outputWriter.toOutputOffset(this.currentTargetBaseAddress);
        mapping.assets.push({
            fileIdx: mapping.getFileIndex(this.currentFile),
            assetFileIdx: mapping.getFileIndex(file),
            line: this.currentLine + 1,
            format: "raw",
            part: "bytes",
            size: end - start,
            transforms: [],
            address: this.currentAddress,
            inputStart: start,
            inputEnd: end,
            ...(outputOffset >= 0 ? { outputOffset } : {}),
        });
    }
    /**
     * Sets write position.
     * @param {number} address The address.
     */
    setWritePosition(address) {
        this.currentTargetAddress = address;
        this.currentTargetBaseAddress = address;
        this.currentTargetStartAddress = address;
        this.currentTargetBaseStartAddress = address;
        if (this.activeStageExecutionState) {
            this.activeStageExecutionState.cursor.currentTargetAddress = address;
            this.activeStageExecutionState.cursor.currentTargetBaseAddress = address;
            this.activeStageExecutionState.cursor.currentTargetStartAddress = address;
            this.activeStageExecutionState.cursor.currentTargetBaseStartAddress = address;
        }
    }
    /**
     * Enters struct definition.
     * @param {number} base The base.
     */
    enterStructDefinition(base) {
        this.savedPCStack.push(this.currentTargetAddress);
        this.cursorAddress.setWritePosition(base);
    }
    /**
     * Restores struct definition.
     */
    restoreStructDefinition() {
        if (this.savedPCStack.length === 0) {
            return;
        }
        const previousPosition = this.savedPCStack.pop();
        if (previousPosition !== undefined) {
            this.cursorAddress.setWritePosition(previousPosition);
        }
    }
    /**
     * Synchronizes write starts.
     */
    syncWriteStarts() {
        this.currentTargetStartAddress = this.currentTargetAddress;
        this.currentTargetBaseStartAddress = this.currentTargetBaseAddress;
    }
    /**
     * Increments bytes written.
     * @param {number} num The num.
     */
    incrementBytesWritten(num) {
        this.bytes += num;
    }
    get mode() {
        return this.getActiveStageCapabilities().instructionMode;
    }
    get canEmitBytes() {
        return this.getActiveStageCapabilities().canEmitBytes;
    }
    get canFinalize() {
        return this.getActiveStageCapabilities().canFinalize;
    }
    get enforceResolvedLabels() {
        return this.getActiveStageCapabilities().enforceResolvedLabels;
    }
    get isDefinitionCollectionStage() {
        return this.getActiveStageCapabilities().isDefinitionCollectionStage;
    }
    /**
     * Reports whether structured tracing is active for this assembly session.
     * @returns {boolean} Whether a trace listener is installed.
     */
    get isTracing() {
        return this.traceListener !== null;
    }
    /**
     * Traces write.
     * @param {Omit<AssemblerTraceWriteEvent, "type">} event The event.
     */
    traceWrite(event) {
        // Byte writes happen below the command dispatcher, so recover the
        // most specific source context from the active command stack.
        const sourceIndex = this.traceCommandStack.length - 1;
        const traceSource = sourceIndex >= 0 ? this.traceCommandStack[sourceIndex] : undefined;
        this.traceListener?.({
            type: "write",
            ...event,
            file: traceSource?.file ?? this.currentFile,
            line: traceSource?.line ?? this.currentLine,
            raw: traceSource?.raw ?? "",
            normalized: traceSource?.normalized ?? "",
            ...(traceSource?.origin ? { origin: traceSource.origin } : {}),
        });
    }
    /**
     * Installs or clears the structured trace listener.
     * @param {AssemblerTraceListener | null} listener The listener to receive trace events.
     */
    setTraceListener(listener) {
        this.traceListener = listener;
    }
    /**
     * Clears accumulated diagnostics and symbol definitions.
     */
    clearAnalysisArtifacts() {
        this.diagnostics.length = 0;
        this.symbolDefinitions.length = 0;
        this.symbolReferences.length = 0;
        this.includeEdges.length = 0;
        this.#symbolDefinitionKeys.clear();
        this.#symbolReferenceKeys.clear();
        this.referenceEpoch++;
        this.#includeEdgeKeys.clear();
    }
    /**
     * Records a directed include-graph edge if it has not already been recorded.
     * Includes execute once per pass, so edges are de-duplicated by file pair.
     * @param {string} fromFile The file issuing the include directive.
     * @param {string} toFile The resolved path of the included file.
     */
    recordIncludeEdge(fromFile, toFile) {
        if (!this.collectSourceMetadata) {
            return;
        }
        if (!fromFile || !toFile) {
            return;
        }
        const edgeKey = `${fromFile}\x00${toFile}`;
        if (this.#includeEdgeKeys.has(edgeKey)) {
            return;
        }
        this.#includeEdgeKeys.add(edgeKey);
        this.includeEdges.push({ fromFile, toFile });
    }
    /**
     * Returns the current source location.
     * @param {SourceSpan} [span] Optional source span override.
     * @returns {AssemblySourceLocation} The current source location.
     */
    getCurrentSourceLocation(span) {
        return createAssemblySourceLocation(this.currentFile, this.currentLine, span, this.currentSourceOrigin);
    }
    /**
     * Converts and records an unknown error.
     * @param {unknown} error The error to normalize.
     * @param {SourceSpan} [span] Optional source span override.
     * @param {string} [stage] Optional stage name.
     * @returns {AssemblyDiagnostic} The recorded diagnostic.
     */
    reportErrorDiagnostic(error, span, stage) {
        const diagnostic = diagnosticFromError(error, this.getCurrentSourceLocation(span), stage);
        this.diagnostics.push(diagnostic);
        return diagnostic;
    }
    /**
     * Records a symbol definition if it has not already been recorded.
     * @param {AssemblySymbolKind} kind The symbol kind.
     * @param {string} name The symbol name.
     * @param {{ file?: string; line?: number; span?: SourceSpan; value?: number | string; containerName?: string }} [options] Optional symbol metadata.
     * @param {string} [options.file] Optional source file override.
     * @param {number} [options.line] Optional source line override.
     * @param {SourceSpan} [options.span] Optional precise source span.
     * @param {number | string} [options.value] Optional resolved symbol value.
     * @param {string} [options.containerName] Optional owning container name.
     */
    recordSymbolDefinition(kind, name, options = {}) {
        if (!this.collectSourceMetadata) {
            return;
        }
        const file = options.file ?? this.currentFile;
        const line = options.line ?? this.currentLine;
        const dedupeKey = `${kind}\x00${name}\x00${file}\x00${line}\x00${options.containerName ?? ""}`;
        if (this.#symbolDefinitionKeys.has(dedupeKey)) {
            return;
        }
        this.#symbolDefinitionKeys.add(dedupeKey);
        this.symbolDefinitions.push({
            name,
            kind,
            location: createAssemblySourceLocation(file, line, options.span, this.currentSourceOrigin),
            value: options.value,
            containerName: options.containerName,
        });
    }
    /**
     * Records a symbol reference if it has not already been recorded.
     * @param {AssemblySymbolReferenceKind} kind The reference kind.
     * @param {string} name The reference name.
     * @param {{ file?: string; line?: number; span?: SourceSpan; containerName?: string }} [options] Optional reference metadata.
     * @param {string} [options.file] Optional source file override.
     * @param {number} [options.line] Optional source line override.
     * @param {SourceSpan} [options.span] Optional precise source span.
     * @param {string} [options.containerName] Optional owning container name.
     */
    recordSymbolReference(kind, name, options = {}) {
        if (!this.collectSourceMetadata) {
            return;
        }
        const file = options.file ?? this.currentFile;
        const line = options.line ?? options.span?.line ?? this.currentLine;
        // Distinct occurrences on one line must survive for rename. Coarse legacy
        // references still deduplicate by line when no physical span is available.
        const columns = options.span?.line === undefined ? "" : `${options.span.start}:${options.span.end}`;
        const dedupeKey = `${kind}\x00${name}\x00${file}\x00${line}\x00${options.containerName ?? ""}\x00${columns}`;
        if (this.#symbolReferenceKeys.has(dedupeKey)) {
            return;
        }
        this.#symbolReferenceKeys.add(dedupeKey);
        this.symbolReferences.push({
            name,
            kind,
            location: createAssemblySourceLocation(file, line, options.span, this.currentSourceOrigin),
            containerName: options.containerName,
        });
    }
    /**
     * Avoid rebuilding an already-recorded static occurrence. These fields match reference deduplication;
     * hierarchy and struct-container selection stay outside this shortcut because they can change later.
     */
    recordStableSymbolReference(owner, kind, name, span) {
        if (!this.collectSourceMetadata) {
            return;
        }
        const line = span?.line ?? this.currentLine;
        const cached = this.stableReferences.get(owner);
        if (cached?.epoch === this.referenceEpoch &&
            cached.file === this.currentFile &&
            cached.line === line &&
            cached.kind === kind &&
            cached.name === name &&
            cached.span === span) {
            return;
        }
        this.recordSymbolReference(kind, name, { span });
        this.stableReferences.set(owner, {
            epoch: this.referenceEpoch,
            file: this.currentFile,
            line,
            kind,
            name,
            span,
        });
    }
    /**
     * Collects expression references.
     * @param {ExpressionNode | undefined} expression The expression.
     * @param {SourceSpan} [fallbackSpan] The fallback span.
     */
    collectExpressionReferences(expression, fallbackSpan) {
        if (!expression) {
            return;
        }
        for (const reference of this.referencePlanner.expression(expression)) {
            switch (reference.type) {
                case "defineReference":
                    if (reference.name || reference.content) {
                        this.recordStableSymbolReference(reference, "define", reference.braced ? (reference.content ?? "") : (reference.name ?? ""), reference.span?.line === undefined ? undefined : reference.span);
                    }
                    break;
                case "identifier": {
                    // Hierarchy can become known in a later stage; only the syntax walk is cached.
                    const segments = this.hierarchicalLabelReferences(reference.name);
                    if (segments) {
                        for (const segment of segments) {
                            this.recordSymbolReference("label", segment.name, {
                                containerName: segment.containerName,
                            });
                        }
                    }
                    else {
                        this.recordStableSymbolReference(reference, "label", reference.name, reference.span?.line === undefined ? undefined : reference.span);
                    }
                    break;
                }
                case "member":
                case "index":
                    this.collectStructReferenceSegments(reference, fallbackSpan);
                    break;
                case "call":
                    this.recordStableSymbolReference(reference, "function", reference.callee.name, reference.callee.span ?? reference.span ?? fallbackSpan);
                    break;
            }
        }
    }
    /**
     * Records one reference per struct-path segment so `obj.timer` can target
     * the struct root and the field independently.
     * @param {ReferenceExpressionNode} expression The struct-rooted reference.
     * @param {SourceSpan} [fallbackSpan] The fallback span.
     */
    collectStructReferenceSegments(expression, fallbackSpan) {
        switch (expression.type) {
            case "identifier":
                this.recordSymbolReference("label", expression.name, {
                    span: expression.span?.line === undefined ? undefined : expression.span,
                });
                return;
            case "defineReference":
                this.collectExpressionReferences(expression, fallbackSpan);
                return;
            case "member":
                this.collectStructReferenceSegments(expression.object, fallbackSpan);
                this.recordSymbolReference("label", expression.property.name, {
                    span: expression.property.span,
                    containerName: this.structSegmentContainerName(expression.object),
                });
                return;
            case "index":
                this.collectStructReferenceSegments(expression.object, fallbackSpan);
                this.collectExpressionReferences(expression.index, fallbackSpan);
                return;
            case "relativeReference":
            default:
                return;
        }
    }
    /**
     * Returns the immediate struct/extension name a member should nest under.
     * Strips `[...]` so `obj[19].ext.index` yields `ext` for `index`.
     * Define roots (`!obj_arthur.flags2`) resolve through the define value
     * (`obj_start+obj[0]`) to the actual struct name.
     * @param {ReferenceExpressionNode} object The object of a member access.
     * @returns {string | undefined} The container name.
     */
    structSegmentContainerName(object) {
        switch (object.type) {
            case "identifier":
                return object.name;
            case "defineReference":
                return this.structNameFromDefine(object.name ?? object.content) ?? object.name;
            case "member":
                return object.property.name;
            case "index":
                return this.structSegmentContainerName(object.object);
            case "relativeReference":
            default:
                return undefined;
        }
    }
    /**
     * Finds a known struct name in a define's expansion, walking nested defines.
     * @param {string | undefined} name The define name.
     * @param {Set<string>} [seen] Define names already visited.
     * @returns {string | undefined} The struct name, if any.
     */
    structNameFromDefine(name, seen = new Set()) {
        if (!name || seen.has(name)) {
            return undefined;
        }
        seen.add(name);
        const value = this.defines.get(name);
        if (value === undefined) {
            return undefined;
        }
        return this.structNameFromExpression(this.frontEndService.parseAssemblyExpression(value), seen);
    }
    /**
     * Walks an expression right-to-left looking for a known struct identifier.
     * `obj_start+obj[0]` yields `obj`.
     * @param {ExpressionNode} node The expression to search.
     * @param {Set<string>} seen Define names already visited.
     * @returns {string | undefined} The struct name, if any.
     */
    structNameFromExpression(node, seen) {
        switch (node.type) {
            case "identifier":
                return this.structs.has(node.name) ? node.name : undefined;
            case "defineReference":
                return this.structNameFromDefine(node.name ?? node.content, seen);
            case "member":
                if (this.structs.has(node.property.name)) {
                    return node.property.name;
                }
                return this.structNameFromExpression(node.object, seen);
            case "index":
                return this.structNameFromExpression(node.object, seen);
            case "binary":
                return (this.structNameFromExpression(node.right, seen) ??
                    this.structNameFromExpression(node.left, seen));
            case "unary":
                return this.structNameFromExpression(node.argument, seen);
            case "call":
            case "literal":
            case "range":
            case "error":
            case "relativeReference":
            case "sourceText":
            case "template":
            case "raw":
            case "string":
                break;
        }
        return undefined;
    }
    /**
     * Splits a hierarchical label (`_018049_8053`) into parent + sublabel
     * segments so each part can be targeted independently.
     * @param {string} name The identifier text.
     * @returns {{ name: string; containerName?: string }[] | undefined} Segments, if this is a known sublabel.
     */
    hierarchicalLabelReferences(name) {
        if (!name.includes("_") || !this.labelTable.has(name)) {
            return undefined;
        }
        const chain = this.symbolScope.getHierarchyChain(name);
        if (chain.length < 2 || chain[chain.length - 1] !== name) {
            return undefined;
        }
        const segments = [];
        for (let index = 0; index < chain.length; index++) {
            const full = chain[index];
            const parent = index > 0 ? chain[index - 1] : undefined;
            if (!parent) {
                segments.push({ name: full });
                continue;
            }
            if (!full.startsWith(`${parent}_`)) {
                return undefined;
            }
            segments.push({
                name: `.${full.slice(parent.length + 1)}`,
                containerName: parent,
            });
        }
        return segments;
    }
    /**
     * Collects command references.
     * @param {NormalizedCommand} command The command.
     */
    collectCommandReferences(command) {
        incrementInternalCounter("referenceCollections");
        if (!this.collectSourceMetadata) {
            return;
        }
        const fallbackSpan = command.source.normalizedSpan;
        const parsed = command.parsed;
        if (command.keyword.toLowerCase() === "datastruct") {
            const record = parsed.declaration;
            if (record?.kind !== "dataStruct") {
                return;
            } // The directive reports its syntax error.
            const reference = record.reference.text;
            const containerName = record.reference.name;
            // An array row's root name was supplied by its header, not its source line.
            if (!command.source.raw.trimStart().startsWith("[")) {
                this.collectExpressionReferences(this.frontEndService.parseAssemblyExpression(reference), fallbackSpan);
            }
            else {
                const index = reference.match(/\[([^\]]+)]$/)?.[1];
                if (index) {
                    this.collectExpressionReferences(this.frontEndService.parseAssemblyExpression(index), fallbackSpan);
                }
            }
            // Read the literal from original source: row lowering supplies a struct
            // name that is absent from the source and cannot provide physical offsets.
            const raw = command.source.raw;
            const lineStarts = sourceLineStarts(raw);
            const literalStart = structInitializerStart(raw);
            for (const field of parseStructInitializerEntries(raw.slice(literalStart))) {
                this.recordSymbolReference("label", field.name, {
                    containerName,
                    span: createTextSpan(raw, literalStart + field.start, literalStart + field.start + field.name.length, command.source.line, lineStarts),
                });
                for (const expression of field.expressions) {
                    this.collectExpressionReferences(parseExpressionAtSite(expression.text, "assembler", {
                        text: raw,
                        offset: literalStart + expression.start,
                        line: command.source.line,
                        lineStarts,
                    }), fallbackSpan);
                }
            }
            return;
        }
        if (command.keyword.toLowerCase() === "datastructs") {
            if (command.words[1]) {
                this.collectExpressionReferences(this.frontEndService.parseAssemblyExpression(command.words[1]), fallbackSpan);
            }
            return;
        }
        this.collectExpressionReferences(parsed.assignment?.expression, fallbackSpan);
        this.collectExpressionReferences(parsed.condition?.expression, fallbackSpan);
        this.collectExpressionReferences(parsed.forLoop?.range, fallbackSpan);
        this.collectExpressionReferences(parsed.forLoop?.start, fallbackSpan);
        this.collectExpressionReferences(parsed.forLoop?.end, fallbackSpan);
        this.collectExpressionReferences(parsed.incbinRange?.range, fallbackSpan);
        this.collectExpressionReferences(parsed.incbinRange?.start, fallbackSpan);
        this.collectExpressionReferences(parsed.incbinRange?.end, fallbackSpan);
        if (parsed.macroInvocation?.name) {
            this.recordSymbolReference("macro", parsed.macroInvocation.name, {
                span: command.source.tokenSpans[0] ?? fallbackSpan,
            });
            for (const arg of parsed.macroInvocation.args) {
                this.collectExpressionReferences(this.frontEndService.parseAssemblyExpression(arg), fallbackSpan);
            }
        }
        if (parsed.includeTarget?.target) {
            this.recordSymbolReference("include", parsed.includeTarget.target.replace(/^["'`](.*)["'`]$/, "$1"), {
                span: command.source.tokenSpans[1] ?? fallbackSpan,
            });
        }
        const instructionCandidate = command.kind === "opcodeCandidate" &&
            !this.directiveRegistry.has(this.canonicalizeDirectiveKeyword(command.keyword));
        if (instructionCandidate && parsed.opcodeOperands?.mnemonic) {
            this.recordStableSymbolReference(command, "instruction", parsed.opcodeOperands.mnemonic, command.source.tokenSpans[0] ?? fallbackSpan);
        }
        if (command.syntax?.kind === "numericData") {
            for (const operand of command.syntax.statement.operands) {
                this.collectExpressionReferences(operand.expression, fallbackSpan);
            }
        }
        if (instructionCandidate && parsed.opcodeOperands) {
            const instruction = this.commandLoweringService.parseInstruction(command);
            if (instruction) {
                for (const expression of this.referencePlanner.instruction(instruction.operands, command)) {
                    this.collectExpressionReferences(expression, fallbackSpan);
                }
            }
        }
        // Native data references were collected above. Plugin payloads already carry their
        // parsed expressions; parsing here would duplicate references and work on every stage.
        const directiveSyntax = command.syntax?.kind === "plugin" ? command.syntax : undefined;
        if (directiveSyntax?.kind === "plugin" && directiveSyntax.payload !== undefined) {
            this.collectSyntaxReferences(directiveSyntax.payload, fallbackSpan);
        }
    }
    /** Walk portable directive payloads, collecting expression nodes without interpreting enum/path strings. */
    collectSyntaxReferences(payload, fallbackSpan) {
        if (!payload || typeof payload !== "object") {
            return;
        }
        if (syntaxExpression(payload)) {
            this.collectExpressionReferences(payload, fallbackSpan);
            return;
        }
        for (const value of Object.values(payload)) {
            this.collectSyntaxReferences(value, fallbackSpan);
        }
    }
    /**
     * Runs a staged analysis pass and captures the first diagnostic instead of throwing.
     * @param {ProgramModel} program The program model to analyze.
     * @param {ProgramAnalysisOptions} [options] Optional analysis options.
     * @param {boolean} [options.followIncludes] Whether to follow includes.
     * @param {Array<AssemblyStageName>} [options.stages] Optional stages to run.
     * @param {boolean} [options.collectSourceMetadata] Whether to collect source metadata.
     * @returns {AssemblyAnalysisResult} The accumulated diagnostics and symbols.
     */
    collectProgramAnalysis(program, options = {}) {
        this.clearAnalysisArtifacts();
        this.analysisErrorRecoveryEnabled = true;
        const stages = options.stages ?? TOOLING_ANALYSIS_STAGES;
        this.deferAssetConversion = options.deferAssetConversion ?? false;
        if (options.followIncludes !== undefined) {
            this.followIncludes = options.followIncludes;
        }
        try {
            for (const stage of stages) {
                this.runStage(stage, program);
            }
        }
        catch (error) {
            this.reportErrorDiagnostic(error, undefined, this.activeStageExecutionState?.stage);
        }
        finally {
            this.analysisErrorRecoveryEnabled = false;
        }
        return {
            diagnostics: [...this.diagnostics],
            symbols: [...this.symbolDefinitions],
            references: [...this.symbolReferences],
            includeEdges: [...this.includeEdges],
            assetDependencies: Object.fromEntries(this.assetAssembly.dependencies),
        };
    }
    /**
     * Creates an isolated assembler session suitable for editor-style analysis.
     * This keeps batch assembly state and tooling state from leaking into each
     * other while still sharing the same file provider and directive registry.
     * @returns {Assembler} A configured analysis session.
     */
    createToolingSession() {
        const session = measureInternalPhase("sessionConstruct", () => new Assembler({
            environment: this.environment,
            target: this.targetId,
            architecture: this.arch,
            targetOptions: this.targetOptions,
            baseImage: this.baseImage,
            fileProvider: this.fileProvider,
        }));
        session.includePaths = [...this.includePaths];
        session.followIncludes = this.followIncludes;
        measureInternalPhase("pluginStateClone", () => session.pluginState.restore(this.pluginState.cloneSnapshot()));
        session.outputFillByte = this.outputFillByte;
        session.padbyte = [...this.padbyte];
        session.fillbyte = [...this.fillbyte];
        session.padUnit = this.padUnit;
        session.arch = this.arch;
        incrementInternalCounter("sessionConstructions");
        return session;
    }
    /**
     * Creates directive handlers bound to a fresh session's family capabilities.
     * @param {Assembler} session The session that should receive directive calls.
     * @returns {DirectiveRegistry} A registry bound to the provided session.
     */
    cloneDirectiveRegistryForSession(session) {
        const operandResolver = session.operandResolver;
        const runtime = session.directiveRuntime;
        const registry = createDirectiveRegistry({
            data: { runtime },
            fillPad: { session, operandResolver },
            flowControl: { session },
            includeSource: {
                session,
                includeSource: session.includeSource,
                operandResolver,
                runtime,
                defineEngine: session.defineEngine,
            },
            layout: {
                addressStack: { session },
                architecture: { session },
                base: { session, operandResolver },
                org: { runtime },
                runtime: { runtime },
            },
            namespace: { session },
            struct: { session },
            table: { session },
            diagnostic: { session },
        }, session.coreDirectiveGroups, session.syntaxProfile.directivePrefixes);
        registry.registerTyped("includeasset", ({ text }) => {
            const call = parseAssetCall(text);
            if (!call) {
                throw new Error("includeAsset requires call syntax: includeAsset(path, format, ...).");
            }
            return call;
        }, assetCallGuard, (call) => {
            const active = session;
            if (active.deferAssetConversion) {
                // Editor analysis discovers dependencies while exact byte counts wait for an explicit build.
                // This keeps PNG/WAVE codecs out of the synchronous edit path.
                active.assetAssembly.discoverDependencies(call);
                active.#hasDeferredAssetLayout = true;
                return;
            }
            const bytes = active.assetAssembly.materialize(call);
            const startAddress = active.currentAddress;
            // Preserve the logical asset address, but locate its bytes through the physical load cursor.
            const startOutput = active.outputWriter.toOutputOffset(active.currentTargetBaseAddress);
            // Validate the complete range before the first write; a failed conversion
            // or invalid target address must never leave a partial asset in output.
            active.outputWriter.validateWrite(bytes.length);
            for (const byte of bytes) {
                active.write1(byte);
            }
            const asset = active.assetAssembly.lastEmission;
            if (active.traceStage === "emitProgram" && active.collectSourceMetadata && asset) {
                active.addressToLineMapping.assets.push({
                    fileIdx: active.addressToLineMapping.getFileIndex(active.currentFile),
                    assetFileIdx: active.addressToLineMapping.getFileIndex(asset.sourcePath),
                    line: active.currentLine + 1,
                    format: asset.format,
                    part: asset.part,
                    size: asset.size,
                    transforms: asset.transforms,
                    conversion: asset.conversion,
                    address: startAddress,
                    ...(startOutput >= 0 ? { outputOffset: startOutput } : {}),
                });
            }
            active.recordCurrentAddress();
        });
        const target = session.environment.getTarget(session.targetId);
        for (const setId of target?.directiveSets ?? []) {
            const set = session.environment.getDirectiveSet(setId);
            if (!set) {
                continue;
            }
            const pluginId = session.environment.getContributionOwner(setId);
            for (const directive of set.directives) {
                const grammar = directive.syntax;
                let bound;
                try {
                    bound = session.borrowPluginCapabilities(() => grammar.bind({
                        targetId: session.targetId,
                        state: session.pluginState,
                        session: session.#pluginCapabilities,
                    }));
                    if (bound && typeof bound.execute !== "function") {
                        throw new Error("Typed directive binding requires execute().");
                    }
                }
                catch (cause) {
                    throw new PluginError(`Directive factory '${directive.id}' failed.`, {
                        code: "PLUGIN_ACTIVATION_FAILED",
                        pluginId,
                        contributionId: directive.id,
                        targetId: session.targetId,
                        cause,
                    });
                }
                if (bound) {
                    registry.registerSyntax(directive.keywords, directive.id, grammar, (payload, command) => {
                        try {
                            session.borrowPluginCapabilities(() => bound.execute(payload, {
                                state: session.pluginState,
                                command: clonePluginSyntax({
                                    keyword: command.keyword,
                                    source: command.source,
                                }),
                            }));
                        }
                        catch (cause) {
                            const detail = cause instanceof Error ? ` ${cause.message}` : "";
                            throw new PluginError(`Directive '${directive.id}' failed.${detail}`, {
                                code: "PLUGIN_HOOK_FAILED",
                                pluginId,
                                contributionId: directive.id,
                                targetId: session.targetId,
                                cause,
                            });
                        }
                    });
                    continue;
                }
                // An unavailable binding leaves the previously registered keyword owner active.
            }
        }
        for (const [keyword, handler] of registry.handlers) {
            const wrapped = (words, raw, command) => {
                // Direct registry calls enter the same parser before hooks observe the directive.
                command ??= createNormalizedCommand(raw, raw || words.join(" "), [...words], session.currentFile, session.currentLine, false);
                if (session.runBeforeDirective(keyword, command) === "handled") {
                    return;
                }
                handler(words, raw, command);
            };
            inheritCoreDataHandler(handler, wrapped);
            registry.handlers.set(keyword, wrapped);
        }
        return registry;
    }
    analyzeProgram(program) {
        const session = this.createToolingSession();
        try {
            return session.collectProgramAnalysis(program);
        }
        finally {
            session.dispose();
        }
    }
    /**
     * Builds and analyzes raw source without throwing on the first error.
     * @param {string} source The source to analyze.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @param {ProgramAnalysisOptions} [options] Optional analysis options.
     * @returns {AssemblyAnalysisResult & { program: ProgramModel }} The analysis result and program model.
     */
    analyzeSource(source, sourceFile = this.currentFile, startLine = 0, options = {}) {
        const session = this.createToolingSession();
        if (options.followIncludes !== undefined) {
            session.followIncludes = options.followIncludes;
        }
        try {
            const program = session.buildProgramModel(source, sourceFile, startLine);
            return {
                program,
                ...session.collectProgramAnalysis(program, options),
            };
        }
        finally {
            session.dispose();
        }
    }
    analyzeWorkspace(documents, options = {}) {
        const results = [];
        for (const document of documents) {
            const session = this.createToolingSession();
            try {
                const program = session.buildProgramModel(document.source, document.sourceFile, document.startLine ?? 0);
                const result = session.collectProgramAnalysis(program, options);
                results.push({
                    sourceFile: document.sourceFile,
                    program,
                    ...result,
                });
            }
            finally {
                session.dispose();
            }
        }
        return results;
    }
    /**
     * Loads base-image data.
     */
    seedOutputFromBaseImage() {
        const seedSize = 512 * 1024;
        if (this.baseImage.length === 0) {
            return;
        }
        this.outputBuffer.seed(this.baseImage.subarray(0, seedSize));
    }
    createServices() {
        const defineEngine = new DefineEngine(this);
        const directiveRuntime = new DirectiveRuntimeService(this);
        const frontEndCommandService = new FrontEndCommandService(this);
        const includeSource = new IncludeSourceService(this);
        const symbolScope = new SymbolScopeService(this);
        const outputWriter = new OutputWriterService(this);
        const macroEngine = new MacroEngine(this);
        const structEngine = new StructEngine(this);
        return {
            defineEngine,
            directiveRuntime,
            fileProvider: this.fileProvider,
            frontEndCommandService,
            includeSource,
            macroEngine,
            outputWriter,
            structEngine,
            symbolScope,
        };
    }
    /**
     * Resolve the target and instantiate per-session factories. Throws on invalid selection/options
     * or factory failure. Factory construction is not a resource transaction: keep external resources
     * in plugin activation disposables and session state cloneable.
     */
    constructor(options) {
        if (!options.environment) {
            throw new PluginError("Assembler construction requires a frozen plugin environment.", {
                code: "PLUGIN_CONFIGURATION_INVALID",
            });
        }
        this.environment = options.environment;
        const targetId = this.environment.resolveTargetId(options.target);
        const target = targetId ? this.environment.getTarget(targetId) : undefined;
        if (!targetId || !target) {
            throw new PluginError(`Assembler target '${options.target}' is not available.`, {
                code: "PLUGIN_TARGET_INVALID",
                targetId: options.target,
            });
        }
        this.targetId = targetId;
        this.coreDirectiveGroups = target.coreDirectiveGroups ?? CORE_DIRECTIVE_GROUPS;
        const configuredTargetOptions = options.targetOptions;
        if (!target.createOptions && configuredTargetOptions !== undefined) {
            const emptyObject = typeof configuredTargetOptions === "object" &&
                configuredTargetOptions !== null &&
                !Array.isArray(configuredTargetOptions) &&
                Object.keys(configuredTargetOptions).length === 0;
            if (!emptyObject) {
                throw new PluginError(`Target '${targetId}' does not accept options.`, {
                    code: "PLUGIN_CONFIGURATION_INVALID",
                    pluginId: this.environment.getContributionOwner(targetId),
                    contributionId: targetId,
                    targetId,
                });
            }
        }
        const normalizedTargetOptions = target.createOptions?.(configuredTargetOptions) ?? {};
        this.targetOptions = Object.freeze({ ...normalizedTargetOptions });
        // Grammar and symbol scopes must be selected before any source is parsed, using the same validated options as output.
        this.syntaxProfile =
            target.createSyntaxProfile?.(this.targetOptions) ??
                target.syntaxProfile ??
                ASAR_SYNTAX_PROFILE;
        this.pluginState = measureInternalPhase("pluginStateCreate", () => new PluginSessionStateStore(this.environment.sessionStates, {
            targetId,
            targetOptions: this.targetOptions,
        }));
        const targetFactoryContext = {
            targetId,
            options: this.targetOptions,
            state: this.pluginState,
        };
        const addressContribution = this.environment.getAddressSpace(target.addressSpace);
        const outputContribution = this.environment.getOutputFormat(target.outputFormat);
        if (!addressContribution || !outputContribution) {
            throw new PluginError(`Target '${targetId}' has unresolved output factories.`, {
                code: "PLUGIN_TARGET_INVALID",
                targetId,
            });
        }
        try {
            this.pluginAddressSpace = addressContribution.create(targetFactoryContext);
        }
        catch (cause) {
            throw new PluginError(`Address-space factory '${target.addressSpace}' failed.`, {
                code: "PLUGIN_ACTIVATION_FAILED",
                pluginId: this.environment.getContributionOwner(target.addressSpace),
                contributionId: target.addressSpace,
                targetId,
                cause,
            });
        }
        try {
            this.pluginOutputFormat = outputContribution.create(targetFactoryContext);
        }
        catch (cause) {
            throw new PluginError(`Output-format factory '${target.outputFormat}' failed.`, {
                code: "PLUGIN_ACTIVATION_FAILED",
                pluginId: this.environment.getContributionOwner(target.outputFormat),
                contributionId: target.outputFormat,
                targetId,
                cause,
            });
        }
        const requestedArchitecture = options.architecture ?? target.defaultArchitecture;
        const architectureId = this.environment.resolveArchitectureId(targetId, requestedArchitecture);
        if (!architectureId) {
            throw new PluginError(`Architecture '${requestedArchitecture}' is unavailable for target '${targetId}'.`, {
                code: "PLUGIN_TARGET_INVALID",
                targetId,
                contributionId: requestedArchitecture,
            });
        }
        this.arch = architectureId;
        this.baseImage = options.baseImage ? Uint8Array.from(options.baseImage) : new Uint8Array();
        this.fileProvider = options.fileProvider ?? new NodeAssemblyFileProvider();
        this.collectSourceMetadata = options.collectSourceMetadata ?? true;
        this.cursorAddress = {
            recordCurrentAddress: () => this.recordCurrentAddress(),
            setWritePosition: (address) => this.setWritePosition(address),
            syncWriteStarts: () => this.syncWriteStarts(),
            incrementBytesWritten: (num) => this.incrementBytesWritten(num),
        };
        this.mathCore = new MathCore();
        this.mathCore.host = this.expressionHost;
        this.installExpressionFunctions(target.expressionSets);
        this.services = this.createServices();
        const readCurrentFile = () => this.currentFile;
        const readCurrentLine = () => this.currentLine;
        const readInMacroExpansion = () => this.inMacroExpansion;
        const readIsDefinitionCollectionStage = () => this.isDefinitionCollectionStage;
        const readSyntaxProfile = () => this.syntaxProfile;
        const readCollectSourceMetadata = () => this.collectSourceMetadata;
        const frontEndHost = {
            passProgramCache: this.passProgramCache,
            parsePluginSyntax: (command) => isCoreDataDirective(this.directiveRegistry, this.canonicalizeDirectiveKeyword(command.keyword))
                ? undefined
                : this.directiveRegistry.parseSyntax(command),
            grammarIdentity: () => `api${PLUGIN_API_VERSION}:${this.targetId}:${this.syntaxProfile.id}:${target.architectures.map((id) => `${id}@${this.environment.getArchitecture(id)?.operandGrammar.version}`).join(",")}:${this.directiveRegistry.grammarIdentity}`,
            resolveVariadicPlaceholders: (command) => this.macroEngine.resolveVariadicPlaceholders(command),
            shouldEndifCloseInnermostWhile: (loopType, loopStartLine, ifStartLine) => this.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
            get currentFile() {
                return readCurrentFile();
            },
            get currentLine() {
                return readCurrentLine();
            },
            get inMacroExpansion() {
                return readInMacroExpansion();
            },
            get isDefinitionCollectionStage() {
                return readIsDefinitionCollectionStage();
            },
            get syntaxProfile() {
                return readSyntaxProfile();
            },
            get collectSourceMetadata() {
                return readCollectSourceMetadata();
            },
        };
        this.frontEndService = new AssemblyFrontEndService(frontEndHost);
        this.programModelBuilder = this.frontEndService.programModelBuilder;
        this.incrementalProgramParseState = this.programModelBuilder.createIncrementalParseState();
        this.operandResolver = new OperandResolver({
            resolveReference: (node) => this.resolveStructuredReference(node, this.requireStaticLabelLookup),
            evaluateMath: (input) => this.mathCore.math(input),
            shouldDeferExpressionEvaluation: () => !this.getActiveStageCapabilities().enforceResolvedLabels,
            getCurrentAddress: () => this.currentTargetAddress,
        });
        this.architectureRegistry = new ArchitectureRegistry();
        for (const contributionId of target.architectures) {
            const contribution = this.environment.getArchitecture(contributionId);
            if (!contribution) {
                throw new PluginError(`Architecture contribution '${contributionId}' is unavailable.`, {
                    code: "PLUGIN_TARGET_INVALID",
                    targetId,
                    contributionId,
                });
            }
            if (!contribution.createTypedEncoder) {
                throw new PluginError(`Architecture contribution '${contributionId}' does not provide a typed encoder.`, {
                    code: "PLUGIN_TARGET_INVALID",
                    targetId,
                    contributionId,
                });
            }
            let encoder;
            try {
                const typed = contribution.createTypedEncoder({
                    targetId,
                    options: this.targetOptions,
                    state: this.pluginState,
                });
                if (!typed || typeof typed.estimate !== "function" || typeof typed.encode !== "function") {
                    throw new Error("Typed encoder must provide estimate and encode operations.");
                }
                encoder = {
                    typed,
                    // Keep catalog discovery available through the public architecture adapter during cutover.
                    getInstructionCatalog: () => [...contribution.instructions],
                    beginPass: typed.beginPass?.bind(typed),
                };
            }
            catch (cause) {
                throw new PluginError(`Architecture factory '${contributionId}' failed.`, {
                    code: "PLUGIN_ACTIVATION_FAILED",
                    pluginId: this.environment.getContributionOwner(contributionId),
                    contributionId,
                    targetId,
                    cause,
                });
            }
            this.architectureRegistry.register({
                name: contribution.id,
                encoder,
                operandGrammar: contribution.operandGrammar,
                instructions: contribution.instructions.length > 0 ? contribution.instructions : undefined,
                unknownInstructionBehavior: contribution.unknownInstructionBehavior,
            }, [...(contribution.aliases ?? [])]);
        }
        this.directiveRegistry = measureInternalPhase("directiveRegistryClone", () => this.cloneDirectiveRegistryForSession(this));
        this.commandLoweringService = new CommandLoweringService(this);
        this.services.frontEnd = this.frontEndService;
        this.services.lowering = this.commandLoweringService;
        this.activeLifecycles = this.environment.getTargetLifecycles(targetId).map((record) => {
            try {
                return {
                    record,
                    instance: record.value.create(targetFactoryContext),
                    directiveKeywords: record.value.beforeDirectiveKeywords === undefined
                        ? undefined
                        : new Set(record.value.beforeDirectiveKeywords),
                };
            }
            catch (cause) {
                throw new PluginError(`Lifecycle factory '${record.contributionId}' failed.`, {
                    code: "PLUGIN_ACTIVATION_FAILED",
                    pluginId: record.pluginId,
                    contributionId: record.contributionId,
                    targetId,
                    cause,
                });
            }
        });
        measureInternalPhase("onSessionCreated", () => this.runLifecycleHook("onSessionCreated", (lifecycle) => lifecycle.onSessionCreated?.({
            state: this.pluginState,
            session: this.#pluginCapabilities,
        })));
        this.selectArchitecture(this.arch, this.arch);
        measureInternalPhase("constructorActivateStage", () => this.activateStage("collectDefinitions"));
        incrementInternalCounter("assemblerConstructions");
    }
    runLifecycleHook(hookName, invoke) {
        for (const { record, instance } of this.activeLifecycles) {
            try {
                this.borrowPluginCapabilities(() => invoke(instance));
            }
            catch (cause) {
                throw new PluginError(`Lifecycle hook '${hookName}' failed.`, {
                    code: "PLUGIN_HOOK_FAILED",
                    pluginId: record.pluginId,
                    contributionId: record.contributionId,
                    targetId: this.targetId,
                    cause,
                });
            }
        }
    }
    runBeforeDirective(keyword, command, syntax = command.syntax ?? this.directiveRegistry.parseSyntax(command)) {
        for (const { record, instance, directiveKeywords } of this.activeLifecycles) {
            // Irrelevant middleware must not materialize detached source/AST copies. Unfiltered hooks
            // retain registration order and receive their own mutable snapshot for every invocation.
            if (!instance.beforeDirective || (directiveKeywords && !directiveKeywords.has(keyword))) {
                continue;
            }
            try {
                let observedSyntax = syntax;
                // Compact literals remain internal syntax storage. Materialize only for an interested
                // middleware hook so its detached AST view and mutation isolation stay unchanged.
                if (syntax?.kind === "numericData" && syntax.statement.literalData) {
                    observedSyntax = { ...syntax, statement: materializeNumericData(syntax.statement) };
                }
                else if (syntax?.kind === "sequence" &&
                    syntax.following.kind === "numericDataFragment" &&
                    syntax.following.statement.literalData) {
                    observedSyntax = {
                        ...syntax,
                        following: {
                            ...syntax.following,
                            statement: materializeNumericData(syntax.following.statement),
                        },
                    };
                }
                const result = this.borrowPluginCapabilities(() => instance.beforeDirective({
                    state: this.pluginState,
                    session: this.#pluginCapabilities,
                    keyword,
                    source: clonePluginSyntax(command.source),
                    syntax: observedSyntax ? clonePluginSyntax(observedSyntax) : undefined,
                }));
                if (result === "handled") {
                    return "handled";
                }
            }
            catch (cause) {
                throw new PluginError("Lifecycle hook 'beforeDirective' failed.", {
                    code: "PLUGIN_HOOK_FAILED",
                    pluginId: record.pluginId,
                    contributionId: record.contributionId,
                    targetId: this.targetId,
                    cause,
                });
            }
        }
        return "continue";
    }
    /**
     * Resolves ambiguous `endif` handling through active dialect lifecycles.
     * @param {"for" | "while"} [loopType] The innermost loop type.
     * @param {number} [loopStartLine] The innermost loop start line.
     * @param {number} [ifStartLine] The innermost conditional start line.
     * @returns {boolean} Whether `endif` should close the innermost while loop.
     */
    shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine) {
        let result = false;
        this.runLifecycleHook("shouldEndifCloseInnermostWhile", (lifecycle) => {
            const resolution = lifecycle.shouldEndifCloseInnermostWhile?.({
                state: this.pluginState,
                session: this.#pluginCapabilities,
                loopType,
                loopStartLine,
                ifStartLine,
            });
            if (resolution !== undefined) {
                result = resolution;
            }
        });
        return result;
    }
    selectArchitecture(architecture, sourceAlias = architecture) {
        const resolved = this.environment.resolveArchitectureId(this.targetId, architecture);
        if (!resolved) {
            throw new PluginError(`Architecture ${architecture} is unavailable for target ${this.targetDisplayName}.`, {
                code: "PLUGIN_TARGET_INVALID",
                targetId: this.targetId,
                contributionId: architecture,
            });
        }
        const previousArchitecture = this.arch || undefined;
        this.arch = resolved;
        this.runLifecycleHook("onArchitectureSelected", (lifecycle) => lifecycle.onArchitectureSelected?.({
            state: this.pluginState,
            session: this.#pluginCapabilities,
            previousArchitecture,
            architecture: resolved,
            sourceAlias,
        }));
    }
    beforeWrite(logicalAddress, width) {
        this.pluginAddressSpace.validateWrite?.(logicalAddress, width);
        this.runLifecycleHook("beforeWrite", (lifecycle) => lifecycle.beforeWrite?.({
            state: this.pluginState,
            session: this.#pluginCapabilities,
            logicalAddress,
            width,
        }));
    }
    /**
     * Records one emitted byte against the active command source.
     * @param {number} logicalAddress Logical byte address.
     * @param {number} outputOffset Physical output offset, or a negative value when unmapped.
     */
    recordSourceWrite(logicalAddress, outputOffset) {
        if (!this.collectSourceMetadata) {
            return;
        }
        const command = this.traceCommandStack.at(-1);
        const target = this.environment.getTarget(this.targetId);
        this.addressToLineMapping.includeByte(command?.file ?? this.currentFile, (command?.line ?? this.currentLine) + 1, this.arch, target?.addressSpace ?? "target.logical", logicalAddress, outputOffset);
    }
    /** Record the actual typed field encoding without splitting or overlapping its row's byte ownership. */
    recordStructField(reference, expression, offset, width) {
        if (!this.collectSourceMetadata || !this.canEmitBytes) {
            return;
        }
        const address = this.pluginAddressSpace.advance(this.currentTargetBaseAddress, offset);
        const outputOffset = this.outputWriter.toOutputOffset(address);
        if (outputOffset < 0) {
            return;
        }
        const command = this.traceCommandStack.at(-1);
        this.addressToLineMapping.structFields.push({
            fileIdx: this.addressToLineMapping.getFileIndex(command?.file ?? this.currentFile),
            line: (command?.line ?? this.currentLine) + 1,
            reference,
            expression,
            size: width,
            outputOffset,
        });
    }
    /**
     * Run lifecycle disposal in reverse registration order, then dispose live state slots.
     * Idempotent. Attempts all cleanup and throws AggregateError for failures. The environment
     * and file provider remain owned by the host. Do not use this session afterward.
     */
    dispose() {
        if (this.sessionDisposed) {
            return;
        }
        this.sessionDisposed = true;
        this.operandResolver.clearParsedOperands();
        const errors = [];
        for (const { record, instance } of [...this.activeLifecycles].toReversed()) {
            try {
                this.borrowPluginCapabilities(() => instance.onSessionDispose?.({
                    state: this.pluginState,
                    session: this.#pluginCapabilities,
                }));
            }
            catch (cause) {
                errors.push(new PluginError("Lifecycle hook 'onSessionDispose' failed.", {
                    code: "PLUGIN_HOOK_FAILED",
                    pluginId: record.pluginId,
                    contributionId: record.contributionId,
                    targetId: this.targetId,
                    cause,
                }));
            }
        }
        try {
            this.pluginState.dispose();
        }
        catch (error) {
            errors.push(error);
        }
        // Syntax/provenance belongs to this session. Release strong cache roots after lifecycle
        // callbacks, including failed builds whose finishPass never cleared their include caches.
        this.programModelBuilder.clearCache();
        this.stageExecutionStates.clear();
        this.activeStageExecutionState = null;
        this.programModelBuilder.resetIncrementalParseState(this.incrementalProgramParseState);
        this.includeSource.endAssemblySnapshot();
        this.mathCore.endAssemblySnapshot();
        this.defineEngine.clearSyntaxCache();
        this.frontEndService.clearFragmentCache();
        // Captured bodies can own most of a large source graph. A disposed session must release
        // them even when a caller/JIT stack keeps the assembler alive during the next build.
        // Remove only our bindings; externally retained definitions and output remain unchanged.
        this.macros.clear();
        if (errors.length > 0) {
            throw new AggregateError(errors, "One or more assembler session resources failed to dispose.");
        }
    }
    readLittleEndian(bytes, pos, width) {
        if (!Number.isInteger(pos) || pos < 0 || pos + width > bytes.length) {
            return undefined;
        }
        let out = 0;
        for (let i = 0; i < width; i++) {
            out |= (bytes[pos + i] ?? 0) << (8 * i);
        }
        return out >>> 0;
    }
    /**
     * Check a byte interval after truncating its position and size to integers.
     * @param {number} sourceLength Available source bytes.
     * @param {number} position Zero-based byte offset.
     * @param {number} size Requested byte count, which may be zero.
     * @returns {number} Numeric 1 or 0 for use by assembly expressions.
     */
    canReadByteRange(sourceLength, position, size) {
        const pos = Math.trunc(position);
        const num = Math.trunc(size);
        return Number.isInteger(pos) &&
            Number.isInteger(num) &&
            pos >= 0 &&
            num >= 0 &&
            pos + num <= sourceLength
            ? 1
            : 0;
    }
    /**
     * Read an unsigned little-endian value after truncating offset and width.
     * @param {Uint8Array} source Borrowed input bytes, never modified.
     * @param {number} position Zero-based byte offset.
     * @param {number} size Width in bytes, used by the 1–4-byte expression readers.
     * @param {number | undefined} defaultValue Returned for an out-of-bounds read when supplied.
     * @param {string} errorMessage Error thrown for an out-of-bounds read without a default.
     * @returns {number} Unsigned value or the supplied default.
     */
    readByteRange(source, position, size, defaultValue, errorMessage) {
        const pos = Math.trunc(position);
        const num = Math.trunc(size);
        const value = this.readLittleEndian(source, pos, num);
        if (value === undefined) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new Error(errorMessage);
        }
        return value;
    }
    resolveReadablePath(filename) {
        return this.fileProvider.resolvePath(filename, {
            currentFile: this.currentFile,
            includePaths: this.includePaths,
            macroSourceFile: this.currentMacroSourceFile,
        });
    }
    resolveExpressionHostLabel(identifier) {
        const trimmed = identifier.trim();
        const loopValue = this.activeLoopVariables.get(trimmed);
        if (loopValue !== undefined) {
            return loopValue;
        }
        if (parseUnnamedLabelReference(trimmed)) {
            return this.symbolScope.getLabelValue(trimmed, this.requireStaticLabelLookup);
        }
        const parsed = this.frontEndService.parseAssemblyExpression(trimmed);
        if (isReferenceExpressionNode(parsed)) {
            return this.resolveReferenceLabelValue(parsed, this.requireStaticLabelLookup);
        }
        return this.symbolScope.getLabelValue(identifier, this.requireStaticLabelLookup);
    }
    getExpressionObjectSize(identifier, baseOnly = false) {
        if (baseOnly && (identifier === "..." || identifier === "…")) {
            if (this.inMacroExpansion && this.currentVariadicCount !== undefined) {
                return this.currentVariadicCount;
            }
            return 0;
        }
        return this.symbolScope.getObjectSize(identifier, baseOnly);
    }
    lookupDefineValue(varName) {
        const defineValue = this.defines.get(varName);
        if (defineValue !== undefined) {
            return defineValue;
        }
        for (let i = this.whileStatus.length - 1; i >= 0; i--) {
            const loop = this.whileStatus[i];
            if (loop.is_for && loop.for_variable === varName && loop.for_cur !== undefined) {
                return loop.for_cur.toString();
            }
        }
        return undefined;
    }
    get currentMacroSourceFile() {
        if (!this.inMacroExpansion || !this.currentMacroName) {
            return undefined;
        }
        return this.macros.get(this.currentMacroName)?.sourceFile;
    }
    canReadBaseImage(position, size) {
        const sourceLength = this.baseImage.length > 0 ? this.baseImage.length : this.outputBytes.length;
        return this.canReadByteRange(sourceLength, position, size);
    }
    readBaseImage(position, size, defaultValue) {
        const pos = Math.trunc(position);
        const pcPos = this.outputWriter.toOutputOffset(pos);
        const source = this.baseImage.length > 0 ? this.baseImage : this.outputBytes;
        if (pcPos < 0) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new Error(`read${Math.trunc(size)} out of bounds at ${pos}`);
        }
        const sourceBytes = Uint8Array.from(source);
        return this.readByteRange(sourceBytes, pcPos, size, defaultValue, `read${Math.trunc(size)} out of bounds at ${pos}`);
    }
    canReadExpressionFile(filename, position, size) {
        const resolvedPath = this.resolveReadablePath(filename);
        if (!resolvedPath) {
            return 0;
        }
        const fileSize = this.fileProvider.stat(resolvedPath).size;
        if (fileSize === undefined) {
            return 0;
        }
        return this.canReadByteRange(fileSize, position, size);
    }
    readExpressionFile(filename, position, size, defaultValue) {
        const pos = Math.trunc(position);
        const resolvedPath = this.resolveReadablePath(filename);
        if (!resolvedPath) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new Error(`Could not read file: ${filename}`);
        }
        const fileBytes = this.fileProvider.readFile(resolvedPath);
        return this.readByteRange(fileBytes, pos, size, defaultValue, `readfile${Math.trunc(size)} out of bounds at ${pos}`);
    }
    /**
     * Installs the active target's expression contributions into this session.
     * @param {readonly string[]} setIds Resolved expression-set contribution IDs.
     */
    installExpressionFunctions(setIds) {
        for (const setId of setIds) {
            const set = this.environment.getExpressionSet(setId);
            if (!set) {
                continue;
            }
            const pluginId = this.environment.getContributionOwner(setId);
            for (const expressionFunction of set.functions) {
                const minimumArguments = expressionFunction.signature.minimumArguments ??
                    expressionFunction.signature.parameters.length;
                const maximumArguments = expressionFunction.signature.maximumArguments ??
                    (expressionFunction.signature.minimumArguments === undefined
                        ? expressionFunction.signature.parameters.length
                        : Number.POSITIVE_INFINITY);
                this.mathCore.registerExpressionFunction([expressionFunction.name, ...(expressionFunction.aliases ?? [])], {
                    minimumArguments,
                    maximumArguments,
                    evaluate: (args) => {
                        try {
                            return expressionFunction.evaluate({
                                state: this.pluginState,
                                addresses: {
                                    toOutputOffset: (address) => this.outputWriter.toOutputOffset(address),
                                    fromOutputOffset: (offset) => this.outputWriter.fromOutputOffset(offset),
                                },
                                output: {
                                    canRead: (position, size) => this.canReadBaseImage(position, size),
                                    read: (position, size, defaultValue) => this.readBaseImage(position, size, defaultValue),
                                },
                            }, args);
                        }
                        catch (cause) {
                            throw new PluginError(`Expression function '${expressionFunction.name}' failed.`, {
                                code: "PLUGIN_HOOK_FAILED",
                                pluginId,
                                contributionId: set.id,
                                targetId: this.targetId,
                                cause,
                            });
                        }
                    },
                });
            }
        }
    }
    expressionHost = {
        resolveReference: (reference) => this.resolveStructuredReference(reference, this.requireStaticLabelLookup),
        bindExpressionTemplate: (template) => this.resolveExpressionNode(template),
        resolveLabel: (identifier) => this.resolveExpressionHostLabel(identifier),
        convertLogicalToOutputOffset: (address) => this.outputWriter.toOutputOffset(address),
        convertOutputOffsetToLogical: (offset) => this.outputWriter.fromOutputOffset(offset),
        getCurrentAddress: () => this.currentTargetAddress,
        getCurrentBaseAddress: () => this.currentTargetBaseAddress,
        isDefined: (identifier) => {
            if (this.defines.has(identifier)) {
                return 1;
            }
            if (this.structs.has(identifier)) {
                return 1;
            }
            return this.symbolScope.hasLabelInScope(identifier) ? 1 : 0;
        },
        getExpressionObjectSize: (identifier, baseOnly) => this.getExpressionObjectSize(identifier, baseOnly),
        getExpressionStructMetadata: (identifier, property) => {
            const definition = this.structs.get(identifier);
            if (!definition) {
                throw new Error(`Unknown struct '${identifier}' for ${property}().`);
            }
            return getStructMetadata(definition, property);
        },
        getFileSize: (filename) => {
            const resolvedPath = this.resolveReadablePath(filename);
            if (!resolvedPath) {
                throw new Error(`Could not get filesize for '${filename}'`);
            }
            const stat = this.fileProvider.stat(resolvedPath);
            if (stat.size === undefined) {
                throw new Error(`Could not get filesize for '${filename}'`);
            }
            return stat.size;
        },
        getFileStatus: (filename) => {
            const resolvedPath = this.resolveReadablePath(filename);
            if (!resolvedPath) {
                return 1;
            }
            return this.fileProvider.stat(resolvedPath).readable ? 0 : 2;
        },
        canReadFile: (filename, position, size) => this.canReadExpressionFile(filename, position, size),
        readFile: (filename, position, size, defaultValue) => this.readExpressionFile(filename, position, size, defaultValue),
        canReadBaseImage: (position, size) => this.canReadBaseImage(position, size),
        readBaseImage: (position, size, defaultValue) => this.readBaseImage(position, size, defaultValue),
    };
    /**
     * Advances the logical program counter.
     * @param {number} num Number of logical address units to advance.
     */
    step(num) {
        this.outputWriter.step(num);
    }
    /**
     * Writes a single architecture byte to output.
     * @param {number} num Byte value to write.
     */
    writeArchitectureByte(num) {
        this.outputWriter.write1(num);
    }
    /**
     * Fills a section of output data with a value.
     * @param {number} start The starting address.
     * @param {number} value The value to fill with.
     * @param {number} length The length of the section to fill.
     */
    fillOutputBytes(start, value, length) {
        this.outputBuffer.fill(start, value, length);
    }
    /** Store one already-validated emitted byte, preserving sparse gap fill and public fill overrides. */
    writeOutputByte(offset, value) {
        const length = this.outputBuffer.length;
        if (offset > length) {
            this.fillOutputBytes(length, this.outputFillByte, offset - length);
        }
        this.outputBuffer.write(offset, value);
    }
    createEphemeralStageExecutionState(stage) {
        const descriptor = this.getStageDescriptor(stage);
        return {
            ...descriptor,
            cursor: {
                currentTargetAddress: this.currentTargetAddress,
                currentTargetBaseAddress: this.currentTargetBaseAddress,
                currentTargetStartAddress: this.currentTargetStartAddress,
                currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
                bytes: this.bytes,
            },
            symbols: {
                labelTable: this.labelTable,
                forwardLabels: this.forwardLabels,
                backwardLabels: this.backwardLabels,
                currentParentLabel: this.currentParentLabel,
                currentParentIsGlobal: this.currentParentIsGlobal,
                currentGlobalParentLabel: this.currentGlobalParentLabel,
                labelParents: this.labelParents,
            },
            control: {
                namespaceStack: this.namespaceStack,
                currentNamespace: this.currentNamespace,
                namespaceNestingEnabled: this.namespaceNestingEnabled,
                namespaceNestingPath: this.namespaceNestingPath,
                inMacroExpansion: this.inMacroExpansion,
                macroLabelInstance: this.macroLabelInstance,
            },
            pluginState: this.pluginState.cloneSnapshot(),
            loweredProgram: null,
        };
    }
    /**
     * Synchronizes active stage execution state.
     * @param {AssemblyStageName} stage The stage.
     */
    syncActiveStageExecutionState(stage) {
        const descriptor = this.getStageDescriptor(stage);
        if (!this.activeStageExecutionState) {
            this.activeStageExecutionState = this.createEphemeralStageExecutionState(stage);
            return;
        }
        this.activeStageExecutionState.stage = descriptor.stage;
        this.activeStageExecutionState.capabilities = descriptor.capabilities;
    }
    getActiveStageCapabilities() {
        this.activeStageExecutionState ??=
            this.createEphemeralStageExecutionState("collectDefinitions");
        return this.activeStageExecutionState.capabilities;
    }
    get traceStage() {
        return this.activeStageExecutionState?.stage ?? "collectDefinitions";
    }
    /** Public word entry; all source forms use the shared parser and typed execution contracts. */
    asblock_pick(words) {
        if (words.length === 0) {
            return true;
        }
        const raw = words.join(" ");
        const command = this.createNormalizedCommandFromRaw(raw, this.currentFile, this.currentLine, true);
        if (!command) {
            return true;
        }
        const node = this.commandLoweringService.lowerExecutableNode(command);
        if (node.kind === "typedInstruction") {
            return this.executeTypedInstruction(node);
        }
        this.executeLoweredNode(node);
        return true;
    }
    resolveActiveArchitecture() {
        const normalized = this.arch.toLowerCase();
        const canonical = this.architectureRegistry.getCanonicalName(normalized);
        const name = canonical ?? normalized;
        return {
            name,
            definition: this.architectureRegistry.getDefinition(name),
        };
    }
    /**
     * Resolves target-specific directive prefixes without teaching the registry a dialect.
     * @param {string} keyword Source directive keyword.
     * @returns {string} Canonical registry keyword.
     */
    canonicalizeDirectiveKeyword(keyword) {
        const normalized = keyword.toLowerCase();
        for (const prefix of this.syntaxProfile.directivePrefixes) {
            if (normalized.startsWith(prefix) &&
                this.directiveRegistry.has(normalized.slice(prefix.length))) {
                return normalized.slice(prefix.length);
            }
        }
        return normalized;
    }
    /**
     * Returns whether the active syntax profile treats a token as a named label.
     * @param {string} candidate Candidate token.
     * @returns {boolean} Whether the token is a named label.
     */
    isNamedLabelToken(candidate) {
        if (candidate === ":") {
            return false;
        }
        return (candidate.endsWith(":") || (this.syntaxProfile.leadingDotLabels && candidate.startsWith(".")));
    }
    /**
     * Writes 1, 2, 3, or 4 bytes to output.
     * @param {number} num - The byte to write.
     */
    write1(num) {
        this.outputWriter.write1(num);
    }
    /**
     * Writes 2.
     * @param {number} num The num.
     */
    write2(num) {
        this.outputWriter.write2(num);
    }
    /**
     * Writes 3.
     * @param {number} num The num.
     */
    write3(num) {
        this.outputWriter.write3(num);
    }
    /**
     * Writes 4.
     * @param {number} num The num.
     */
    write4(num) {
        this.outputWriter.write4(num);
    }
    /**
     * Reads 1, 2, or 3 bytes from the configured output image.
     * @param {number} logicalPosition The logical address to read from.
     * @returns {number} The byte read from the output image.
     */
    read1(logicalPosition) {
        const addr = this.outputWriter.toOutputOffset(logicalPosition);
        if (addr < 0 || addr + 1 > this.outputBytes.length) {
            return -1;
        }
        return this.outputBytes[addr];
    }
    read2(logicalPosition) {
        const addr = this.outputWriter.toOutputOffset(logicalPosition);
        if (addr < 0 || addr + 2 > this.outputBytes.length) {
            return -1;
        }
        return this.outputBytes[addr] | (this.outputBytes[addr + 1] << 8);
    }
    read3(logicalPosition) {
        const addr = this.outputWriter.toOutputOffset(logicalPosition);
        if (addr < 0 || addr + 3 > this.outputBytes.length) {
            return -1;
        }
        return (this.outputBytes[addr] |
            (this.outputBytes[addr + 1] << 8) |
            (this.outputBytes[addr + 2] << 16));
    }
    createNormalizedCommandFromRaw(command, sourceFile, sourceLine, allowEmpty = false) {
        return this.frontEndService.createNormalizedCommandFromRaw(command, sourceFile, sourceLine, allowEmpty);
    }
    /**
     * Applies a `!name =` assignment without routing it through the incremental if-tree.
     * @param {string} command The define assignment command.
     * @returns {boolean} `true` when the define engine handled the command.
     */
    applyDefineAssignment(command) {
        const commandNode = this.createNormalizedCommandFromRaw(command, this.currentFile, this.currentLine, true);
        if (!commandNode) {
            return false;
        }
        return this.defineEngine.handleCommand(commandNode);
    }
    /**
     * Asar `'X' = $nn` / `"X" = $nn` table entries, including `''' = $2A` for apostrophe.
     * @param {string} command Raw command text.
     * @returns {boolean} `true` when the line was a character mapping.
     */
    tryHandleCharacterMapping(command) {
        const parsed = this.createNormalizedCommandFromRaw(command, this.currentFile, this.currentLine, true);
        if (parsed?.parsed.declaration?.kind !== "character") {
            return false;
        }
        this.executeLoweredNode(this.commandLoweringService.lowerExecutableNode(parsed));
        return true;
    }
    /** Scope expansion metadata and restore caller positions even when nested expansion fails. */
    withSourceOrigin(origin, execute) {
        const previous = this.currentSourceOrigin;
        const file = this.currentFile;
        const line = this.currentLine;
        this.currentSourceOrigin = origin;
        try {
            execute();
        }
        catch (error) {
            const occurrence = origin.kind === "macro" ? origin.template : origin.location;
            rememberErrorSource(error, createAssemblySourceLocation(occurrence.file, occurrence.line, occurrence.span, origin));
            throw error;
        }
        finally {
            this.currentSourceOrigin = previous;
            this.currentFile = file;
            this.currentLine = line;
        }
    }
    /** Include origins are execution-local; the same cached file can be reached from many callers. */
    withIncludeSource(file, execute, fromFile = this.currentFile) {
        this.withSourceOrigin({
            kind: "include",
            file,
            location: { file: fromFile, line: this.currentLine },
            parent: this.currentSourceOrigin,
        }, execute);
    }
    /**
     * Processes a command from an internal re-entrant source.
     * @param {string} command - The command to process.
     * @param {boolean} [preprocessed] Whether comments and continuations were already normalized.
     */
    processCommand(command, preprocessed = false, template) {
        this.processSourceFragment(sourceFragment(command, [{ file: this.currentFile, line: this.currentLine, text: command }]), preprocessed, template);
    }
    /** Physical fragments retained only while the frontend buffers one multiline statement. */
    pendingGeneratedFragment;
    /** Execute an attributed generated fragment through the shared incremental frontend. */
    processSourceFragment(fragment, preprocessed = false, template) {
        return withSourceSyntax(() => {
            let command = fragmentText(fragment);
            if (command.trim() === "") {
                return;
            }
            if (!preprocessed && this.frontEndService.commandBuffer && this.pendingGeneratedFragment) {
                fragment = {
                    segments: [
                        ...this.pendingGeneratedFragment.segments,
                        ...sourceFragment("\n").segments,
                        ...fragment.segments,
                    ],
                };
            }
            const consume = (text, file, line) => {
                let normalized;
                if (this.currentSourceOrigin) {
                    // Stable template syntax can be shared. Variadic indexes and dialect rewrites still
                    // bind at dispatch time; their generated spelling must pass through normalization.
                    if (template?.command === text &&
                        !/\?|\.{3}|…/.test(text) &&
                        !this.syntaxProfile.rewriteCommand) {
                        normalized = cloneNormalizedCommand(template);
                        normalized.kind = classifyCommand(normalized.command, normalized.words);
                    }
                    else {
                        const occurrence = this.currentSourceOrigin.kind === "macro"
                            ? this.currentSourceOrigin.template
                            : { file, line };
                        normalized = this.frontEndService.parseFragmentCommand(text, occurrence.file, occurrence.line);
                    }
                    normalized.source = { ...normalized.source, origin: this.currentSourceOrigin };
                }
                // Attach only the selected fragment extent. Parser/cache identity remains syntax-only.
                normalized ??= this.frontEndService.parseFragmentCommand(text, file, line);
                const offset = fragmentText(fragment).indexOf(text);
                // A buffered multiline statement or profile rewrite may have a different spelling.
                // Keep its parsed text authoritative while retaining the contributing input occurrences.
                const selected = offset >= 0
                    ? sliceSourceFragment(fragment, offset, offset + text.length)
                    : sourceFragment(text, fragment.segments.flatMap((part) => part.origins));
                let origin = normalized.source.origin;
                if (origin?.kind === "macro") {
                    origin = { ...origin, fragment: selected };
                }
                normalized.source = { ...normalized.source, origin, fragment: selected };
                // Control-stack ordering uses the call-site sequence, independently of physical body spans.
                return this.frontEndService.parseGeneratedCommand(this.incrementalProgramParseState, text, file, line, normalized);
            };
            // Macro bodies were normalized when their containing program was parsed.
            // Preserve inline separators while skipping another block/comment scan.
            if (preprocessed) {
                if (!command.includes(":")) {
                    const nodes = consume(command.trim(), this.currentFile, this.currentLine);
                    this.lowerAndExecuteRuntimeNodes(nodes);
                    this.flushCompletedIncrementalNodes();
                    return;
                }
                const splitCommands = this.frontEndService.splitInlineCommands([command]);
                for (const splitCommand of splitCommands) {
                    const nodes = consume(splitCommand.trim(), this.currentFile, this.currentLine);
                    this.lowerAndExecuteRuntimeNodes(nodes);
                }
            }
            else {
                const sourceFile = this.currentFile;
                const sourceLine = this.currentLine;
                const processedCommands = this.frontEndService.preprocessSourcedBlockCommands(command);
                this.pendingGeneratedFragment = this.frontEndService.commandBuffer ? fragment : undefined;
                const splitCommands = this.frontEndService.splitSourcedInlineCommands(processedCommands);
                for (const splitCommand of splitCommands) {
                    const nodes = consume(splitCommand.text.trim(), sourceFile, sourceLine + splitCommand.line);
                    this.lowerAndExecuteRuntimeNodes(nodes);
                }
            }
            this.flushCompletedIncrementalNodes();
        });
    }
    /** Public normalized-source entry: the shared parser owns streaming captures and control flow. */
    processNormalizedCommand(command, rewriteRaw = true) {
        if (rewriteRaw) {
            this.processSourceFragment(command.source.fragment ?? sourceFragment(command.source.raw, [command.source]));
            return;
        }
        this.frontEndService.parseCommandSyntax(command);
        const nodes = this.frontEndService.parseGeneratedCommand(this.incrementalProgramParseState, command.command, command.source.file, command.source.line, command);
        this.lowerAndExecuteRuntimeNodes(nodes);
        this.flushCompletedIncrementalNodes();
    }
    /** Execute typed syntax with current scope and the same source ownership as directive dispatch. */
    executeStatement(node) {
        if (node.kind === "label") {
            this.frontEndCommandService.executeLabelStatement(node.statement);
            if (node.statement.trailing) {
                this.lowerAndExecuteRuntimeNodes([node.statement.trailing]);
            }
        }
        else if (node.kind === "assignment") {
            this.frontEndCommandService.executeAssignmentStatement(node.statement);
        }
        else {
            this.executeAttributedCommand(node.command, () => {
                const keyword = this.canonicalizeDirectiveKeyword(node.command.keyword);
                if (this.runBeforeDirective(keyword, node.command) === "handled") {
                    return;
                }
                withTypedExecution(() => this.directiveRuntime.executeDataStatement(node.statement));
            });
        }
    }
    /** Keep nested write attribution and trace event ordering identical for typed and legacy data. */
    executeAttributedCommand(command, dispatch) {
        const startPC = normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth);
        if (this.collectSourceMetadata) {
            this.collectCommandReferences(command);
        }
        const traceListener = this.traceListener;
        const traceContext = {
            file: command.source.file,
            line: command.source.line,
            raw: command.source.raw,
            normalized: command.command,
            ...(this.currentSourceOrigin ? { origin: this.currentSourceOrigin } : {}),
        };
        if (traceListener) {
            traceListener({
                type: "command-start",
                stage: this.traceStage,
                arch: this.arch,
                ...traceContext,
                logicalAddress: startPC,
                addressWidth: this.addressWidth,
                outputOffset: this.outputWriter.toOutputOffset(startPC),
            });
        }
        // Nested directives can emit additional writes while this command is still
        // active, so keep the current source context on a stack until dispatch ends.
        this.traceCommandStack.push(traceContext);
        try {
            dispatch();
        }
        finally {
            this.traceCommandStack.pop();
        }
        if (traceListener) {
            const endPC = normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth);
            traceListener({
                type: "command-end",
                stage: this.traceStage,
                arch: this.arch,
                ...traceContext,
                logicalAddress: startPC,
                addressWidth: this.addressWidth,
                outputOffset: this.outputWriter.toOutputOffset(startPC),
                endLogicalAddress: endPC,
                endOutputOffset: this.outputWriter.toOutputOffset(endPC),
                bytesWritten: endPC - startPC,
            });
        }
        if (this.collectSourceMetadata) {
            this.addAddressToLine(normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth));
        }
    }
    getOrCreateLoweredProgram(stageState, program) {
        stageState.loweredProgram ??= measureInternalPhase("lowerProgram", () => this.commandLoweringService.lowerProgram(program));
        return stageState.loweredProgram;
    }
    /**
     * Dispatches lowered node.
     * @param {LoweredCommand} lowered The lowered.
     */
    dispatchLoweredNode(lowered) {
        if (lowered.kind === "pluginSyntax") {
            this.executeAttributedCommand(lowered.command, () => {
                const keyword = this.canonicalizeDirectiveKeyword(lowered.command.keyword);
                if (this.runBeforeDirective(keyword, lowered.command, lowered.statement) === "handled") {
                    return;
                }
                try {
                    this.directiveRegistry.executeSyntax(lowered.statement, lowered.command);
                }
                catch (cause) {
                    // Core syntax uses the same transport contract, but retains native diagnostic identity.
                    if (lowered.statement.contributionId.startsWith("core.directive.")) {
                        throw cause;
                    }
                    if (cause instanceof PluginError) {
                        throw cause;
                    }
                    const detail = cause instanceof Error ? ` ${cause.message}` : "";
                    throw new PluginError(`Directive '${lowered.statement.contributionId}' failed.${detail}`, {
                        code: "PLUGIN_HOOK_FAILED",
                        contributionId: lowered.statement.contributionId,
                        targetId: this.targetId,
                        cause,
                    });
                }
            });
            return;
        }
        // Architecture selection can change in source order after the program was lowered.
        const instruction = withSourceSyntax(() => this.commandLoweringService.lowerCommand(lowered.command));
        if (instruction.kind !== "typedInstruction") {
            throw new Error("Expected a typed instruction.");
        }
        this.executeTypedInstruction(instruction);
        lowered.resolved = instruction.resolved;
    }
    /** Classification retains its stage-entry ordering; no prepared values enter the syntax cache. */
    prepareTypedInstruction(node) {
        const definition = this.resolveActiveArchitecture().definition;
        if (!definition?.encoder.typed?.prepare || !definition.operandGrammar) {
            return;
        }
        let operands;
        let bindingFailure;
        try {
            operands = bindInstructionOperands(node.instruction.operands, (fragment) => this.resolveDefineFragment(fragment), (text) => definition.operandGrammar.parse(node.instruction.mnemonic, text));
        }
        catch (cause) {
            // Unresolved source can still determine an addressing mode. The opted-in target owns
            // whether binding failure is observable in sizing, a numeric read, or final branch emission.
            if (!definition.encoder.typed.deferOperandBindingErrors) {
                return;
            }
            operands = node.instruction.operands;
            bindingFailure = this.operandBindingFailure(cause);
        }
        node.instruction = { ...node.instruction, operands };
        const frame = this.createInstructionFrame(node.instruction, undefined, bindingFailure);
        try {
            withTypedExecution(() => definition.encoder.typed.prepare(frame));
            node.prepared = frame.snapshot();
        }
        finally {
            frame.close();
        }
    }
    /** Preserve binding diagnostics as data without retaining exception/session objects in a receipt. */
    operandBindingFailure(cause) {
        return {
            reason: cause instanceof OperandTemplateBindingError ? cause.reason : "other",
            message: cause instanceof Error ? cause.message : String(cause),
        };
    }
    /** Every borrowed evaluation capability expires with its instruction's stage frame. */
    createInstructionFrame(instruction, preparation, bindingFailure) {
        // Method syntax avoids per-instruction name wrappers while captured session access permits detached calls.
        // oxlint-disable-next-line typescript/no-this-alias -- Detached method callbacks avoid hot-path transpiler name wrappers.
        const session = this;
        const identity = session.activeStageExecutionState ?? {};
        return new InstructionResolutionFrame(instruction, {
            bindingFailure,
            evaluate(expression) {
                return session.operandResolver.getnum(expression);
            },
            evaluateMath(expression) {
                return session.mathCore.math(expression);
            },
            reference(expression, address) {
                return session.resolveStructuredReference(expression, session.requireStaticLabelLookup, address);
            },
            error(message) {
                return new Error(`${message} (${session.currentFile}:${session.currentLine + 1})`);
            },
            currentAddress() {
                return session.currentTargetAddress;
            },
            stage() {
                return session.traceStage;
            },
            stageIdentity() {
                return session.activeStageExecutionState ?? identity;
            },
        }, preparation);
    }
    /** Bind templates at the source boundary, then lend a fresh frame for exactly one stage invocation. */
    executeTypedInstruction(node) {
        const definition = this.resolveActiveArchitecture().definition;
        const encoder = definition?.encoder.typed;
        const grammar = definition?.operandGrammar;
        if (!encoder || !grammar) {
            throw new Error("Typed architecture has no operand grammar or encoder.");
        }
        let operands;
        let bindingFailure;
        try {
            operands = bindInstructionOperands(node.instruction.operands, (fragment) => this.resolveDefineFragment(fragment), (text) => grammar.parse(node.instruction.mnemonic, text));
        }
        catch (cause) {
            if (!encoder.deferOperandBindingErrors) {
                throw cause;
            }
            operands = node.instruction.operands;
            bindingFailure = this.operandBindingFailure(cause);
        }
        // Instructions retain their existing write-only trace contract. Enclosing directives
        // still own nested command attribution through the trace stack.
        const capabilities = this.getActiveStageCapabilities();
        const beforeBytes = this.bytes;
        const address = this.currentTargetAddress;
        const capture = this.collectSourceMetadata && this.canEmitBytes;
        const outputOffset = capture
            ? this.outputWriter.toOutputOffset(this.currentTargetBaseAddress)
            : -1;
        const frame = this.createInstructionFrame({ ...node.instruction, operands }, node.prepared, bindingFailure);
        const assertLive = () => {
            frame.currentAddress();
        };
        try {
            if (capabilities.instructionMode === "layout") {
                const size = withTypedExecution(() => encoder.estimate(frame));
                node.resolved = frame.snapshot();
                if (size !== node.resolved.size) {
                    throw new Error("Typed instruction estimate disagrees with selected form.");
                }
                this.step(size);
                return true;
            }
            else {
                // oxlint-disable-next-line typescript/no-this-alias -- Capabilities remain callable detached from their method object.
                const session = this;
                const handled = withTypedExecution(() => encoder.encode(frame, {
                    emission: {
                        write1(value) {
                            assertLive();
                            session.write1(value);
                        },
                        write2(value) {
                            assertLive();
                            session.write2(value);
                        },
                        write3(value) {
                            assertLive();
                            session.write3(value);
                        },
                        writeByte(value) {
                            assertLive();
                            session.write1(value);
                        },
                        writeBytes(values) {
                            assertLive();
                            session.outputWriter.writeBytes(values);
                        },
                        writeValue(value, width, endianness) {
                            assertLive();
                            session.outputWriter.writeValue(value, width, endianness);
                        },
                    },
                    diagnostics: {
                        error(message) {
                            assertLive();
                            return new Error(`${message} (${session.currentFile}:${session.currentLine + 1})`);
                        },
                    },
                }));
                if (handled) {
                    node.resolved = frame.snapshot();
                    if (capture) {
                        const operandText = node.command.parsed.opcodeOperands?.operandText ?? "";
                        // Match the legacy numeric observer: one finite value per displayed expression,
                        // even when a compound instruction reads the same operand more than once.
                        // Width probes are preparatory reads, not emitted instruction operands.
                        const observations = node.resolved.values
                            .filter((value) => value.point !== "classification")
                            .map((value) => ({
                            expression: value.displayText ?? operandText.slice(value.span.start, value.span.end),
                            value: value.value,
                        }))
                            .filter((value, index, all) => Number.isFinite(value.value) &&
                            all.findIndex((other) => other.expression === value.expression && other.value === value.value) === index);
                        this.addressToLineMapping.instructions.push({
                            fileIdx: this.addressToLineMapping.getFileIndex(node.source.file),
                            line: node.source.line + 1,
                            architecture: this.arch,
                            addressSpace: this.environment.getTarget(this.targetId)?.addressSpace ?? "target.logical",
                            address,
                            size: this.bytes - beforeBytes,
                            ...(outputOffset >= 0 ? { outputOffset } : {}),
                            // Spelling is attribution only; values come from observations, never another evaluation.
                            operands: observations,
                        });
                    }
                }
                else if (definition.unknownInstructionBehavior !== "returnFalse") {
                    throw new Error(`Unknown instruction: ${node.instruction.mnemonic}`);
                }
                return handled;
            }
        }
        finally {
            frame.close();
        }
    }
    /**
     * Parses a function definition of the form:
     *   function name(param1, param2...) = expression
     * Possibly spanning multiple lines joined by backslashes.
     * @param {string} defLine - The function definition line.
     */
    parseFunctionDefinition(defLine) {
        this.mathCore.parseFunctionDefinition(defLine);
        const functionName = defLine.match(/^function\s+([_a-z]\w*)\s*\(/i)?.[1];
        if (functionName) {
            this.recordSymbolDefinition("function", functionName);
        }
    }
    /**
     * Adds a mapping of the current address to the source line number.
     * @param {number} address The logical address to add to the mapping.
     */
    addAddressToLine(address) {
        incrementInternalCounter("addressMappings");
        if (!this.collectSourceMetadata) {
            return;
        }
        this.addressToLineMapping.includeMapping(this.currentFile, this.currentLine + 1, address);
    }
    /**
     * Evaluates a range expression and returns the result.
     * @param {string} expr The expression to evaluate.
     * @returns {number} The result of the expression.
     */
    evaluateRangeExpression(expr) {
        const resolvedExpr = this.resolveExpressionInput(expr);
        if (isReferenceExpressionNode(resolvedExpr)) {
            return this.evaluateReferenceExpressionNode(resolvedExpr, true);
        }
        return this.mathCore.math(resolvedExpr);
    }
    /**
     * Replace include search paths before assembly. Retains the array without copying.
     * @param {string[]} paths Provider-specific search paths. Node resolves relative paths from cwd.
     */
    setIncludePaths(paths) {
        this.includePaths = paths;
    }
    /**
     * Evaluates an expression for conditionals (if, while).
     * @param {string} expression - The expression to evaluate.
     * @returns {boolean} True if the expression is true, false otherwise.
     */
    evaluateExpression(expression) {
        let resolvedExpr;
        let result;
        try {
            // Resolve inside the guarded block so failures from define/label/static checks
            // are reported with the same contextual wrapper as math failures.
            resolvedExpr = this.resolveExpressionInput(expression);
            result = isReferenceExpressionNode(resolvedExpr)
                ? this.evaluateReferenceExpressionNode(resolvedExpr)
                : this.mathCore.math(resolvedExpr);
        }
        catch (e) {
            const originalExpr = typeof expression === "string" ? expression : renderExpressionNode(expression);
            const resolvedText = resolvedExpr ? renderExpressionNode(resolvedExpr) : "<unresolved>";
            throw new Error(`Error evaluating expression "${originalExpr}" (resolved to "${resolvedText}"): ${e instanceof Error ? e.message : JSON.stringify(e)}`, { cause: e });
        }
        // In our assembler, a condition is true if the result is nonzero.
        return result !== 0;
    }
    /**
     * Evaluate an assertion, or defer it when skipped asset bytes make its inputs provisional.
     * Literal arithmetic and expanded numeric defines remain checkable during editor analysis.
     * @param {string | ExpressionNode} expression Assertion condition.
     * @returns {boolean | undefined} The condition result, or undefined until a build resolves the layout.
     */
    evaluateAssertion(expression) {
        if (this.#hasDeferredAssetLayout) {
            const resolved = this.resolveExpressionInput(expression);
            // Symbols and calls can depend on skipped bytes, including through defines or user functions.
            // Keep them out of diagnostics until conversion supplies real addresses; never guess a zero size.
            if (!this.mathCore.isPureExpressionNode(resolved)) {
                return undefined;
            }
            return this.evaluateExpression(resolved);
        }
        return this.evaluateExpression(expression);
    }
    /**
     * Parses string input into an expression node and resolves nested references/defines.
     * @param {string | ExpressionNode} expression The expression source or parsed node.
     * @returns {ExpressionNode} The resolved expression tree.
     */
    resolveExpressionInput(expression) {
        const parsed = typeof expression === "string"
            ? this.frontEndService.parseAssemblyExpression(expression.trim())
            : expression;
        return this.resolveExpressionNode(parsed);
    }
    /**
     * Recursively resolves define references and nested reference-expression nodes.
     * @param {ExpressionNode} expression The expression node to resolve.
     * @returns {ExpressionNode} The resolved expression node.
     */
    resolveExpressionNode(expression) {
        if (isReferenceExpressionNode(expression)) {
            return this.resolveReferenceExpressionNode(expression);
        }
        switch (expression.type) {
            case "binary":
                return {
                    ...expression,
                    left: this.resolveExpressionNode(expression.left),
                    right: this.resolveExpressionNode(expression.right),
                };
            case "unary":
                return {
                    ...expression,
                    argument: this.resolveExpressionNode(expression.argument),
                };
            case "range":
                return {
                    ...expression,
                    start: this.resolveExpressionNode(expression.start),
                    end: this.resolveExpressionNode(expression.end),
                };
            case "call":
                return {
                    ...expression,
                    arguments: expression.arguments.map((argument) => this.resolveExpressionNode(argument)),
                };
            case "template":
                if (expression.form === "source") {
                    const fragment = this.resolveDefineFragment(sourceFragment(expression.text, [
                        {
                            file: this.currentFile,
                            line: this.currentLine,
                            text: expression.text,
                            span: expression.span,
                        },
                    ]));
                    const text = fragmentText(fragment);
                    if (text === expression.text) {
                        throw new Error(`Unbound expression template: ${text}`);
                    }
                    return inheritExpressionOccurrence(this.resolveExpressionNode(this.frontEndService.parseFragmentExpression(text)), expression);
                }
                return expression;
            case "raw":
                throw new Error("Raw expression nodes are not executable; parse source before evaluation.");
            case "literal":
            case "error":
            case "sourceText":
            case "string":
                break;
        }
        return expression;
    }
    /**
     * Resolves reference-style expressions such as identifiers, define references,
     * member access, and indexed access into either simpler reference nodes or
     * raw/math expressions when defines collapse them further.
     * @param {ReferenceExpressionNode} expression The reference expression to resolve.
     * @returns {ExpressionNode} The resolved expression tree.
     */
    resolveReferenceExpressionNode(expression) {
        switch (expression.type) {
            case "identifier":
                return expression;
            case "defineReference": {
                const defineName = expression.braced
                    ? this.resolvedefines(expression.content ?? "")
                    : (expression.name ?? "");
                const value = this.lookupDefineValue(defineName);
                if (value === undefined) {
                    throw new Error(`Define '${defineName}' not found.`);
                }
                return inheritExpressionOccurrence(this.resolveExpressionNode(this.frontEndService.parseFragmentExpression(value)), expression);
            }
            case "member": {
                const object = this.resolveReferenceExpressionNode(expression.object);
                if (!isReferenceExpressionNode(object)) {
                    return inheritExpressionOccurrence(this.bindReferenceSuffix(object, expression), expression);
                }
                return {
                    ...expression,
                    object,
                };
            }
            case "index": {
                const object = this.resolveReferenceExpressionNode(expression.object);
                const index = this.resolveExpressionNode(expression.index);
                if (!isReferenceExpressionNode(object)) {
                    return inheritExpressionOccurrence(this.bindReferenceSuffix(object, expression), expression);
                }
                return {
                    ...expression,
                    object,
                    index,
                };
            }
            case "relativeReference":
            default:
                return expression;
        }
    }
    /**
     * Resolves a reference expression all the way to a numeric value.
     * @param {ReferenceExpressionNode} expression The reference expression to evaluate.
     * @param {boolean} [requireStatic] Whether labels must be static.
     * @returns {number} The numeric value of the reference.
     */
    evaluateReferenceExpressionNode(expression, requireStatic = false) {
        const resolved = this.resolveReferenceLabelValue(expression, requireStatic);
        if (typeof resolved === "number") {
            return resolved;
        }
        throw new Error(`Reference '${resolved}' did not resolve to a numeric value.`);
    }
    /**
     * Resolves a reference expression to either a numeric value or a normalized
     * label/struct lookup target, depending on how far the expression collapses.
     * @param {ReferenceExpressionNode} expression The reference expression to resolve.
     * @param {boolean} [requireStatic] Whether labels must be static.
     * @returns {number | string} The resolved numeric value.
     */
    resolveReferenceLabelValue(expression, requireStatic = false) {
        const resolved = this.resolveReferenceExpressionNode(expression);
        if (!isReferenceExpressionNode(resolved)) {
            return this.mathCore.math(resolved);
        }
        const result = this.resolveStructuredReference(resolved, requireStatic);
        if (result.kind === "error") {
            throw result.error;
        }
        if (result.kind === "resolved") {
            return result.value;
        }
        if (result.deferred) {
            return 0;
        }
        throw new Error(`Error: Label '${result.name}' not found.`);
    }
    /**
     * Resolve structured references with explicit stage deferral. `relativeAddress` selects
     * relative labels at that logical byte address; omission uses the current instruction cursor.
     */
    resolveStructuredReference(expression, requireStatic = false, relativeAddress) {
        try {
            const resolved = this.resolveReferenceExpressionNode(expression);
            if (!isReferenceExpressionNode(resolved)) {
                return { kind: "resolved", value: this.mathCore.math(resolved) };
            }
            if (resolved.type === "relativeReference") {
                return {
                    kind: "resolved",
                    value: this.symbolScope.resolveRelativeReference(resolved, relativeAddress),
                };
            }
            const path = referencePath(resolved);
            if (!path) {
                throw new Error("Unbound define reference.");
            }
            if (!path.segments.length) {
                const loopValue = this.activeLoopVariables.get(path.root);
                if (loopValue !== undefined) {
                    return { kind: "resolved", value: loopValue };
                }
            }
            const structValue = this.structEngine.resolveStructPath(path, (node) => this.mathCore.math(this.resolveExpressionNode(node)));
            if (structValue !== undefined) {
                return { kind: "resolved", value: structValue };
            }
            // Flat symbol tables need a key, not a second grammar pass. Member separators remain lexical.
            let name = path.root;
            for (const segment of path.segments) {
                if (segment.kind === "member") {
                    name += `.${segment.name}`;
                }
                else {
                    name += `[${this.mathCore.math(this.resolveExpressionNode(segment.expression))}]`;
                }
            }
            const value = this.symbolScope.tryGetLabelValue(name, requireStatic);
            if (value !== undefined) {
                return { kind: "resolved", value };
            }
            return { kind: "missing", name, deferred: this.isDefinitionCollectionStage };
        }
        catch (error) {
            return { kind: "error", error: error instanceof Error ? error : new Error(String(error)) };
        }
    }
    /** A textual define suffix binds to its final operand; it does not introduce an implicit group. */
    bindReferenceSuffix(object, suffix) {
        if (isReferenceExpressionNode(object)) {
            if (suffix.type === "member") {
                return { ...suffix, object };
            }
            return { ...suffix, object, index: this.resolveExpressionNode(suffix.index) };
        }
        if (!object.parenthesized && object.type === "binary") {
            return { ...object, right: this.bindReferenceSuffix(object.right, suffix) };
        }
        if (!object.parenthesized && object.type === "unary") {
            return { ...object, argument: this.bindReferenceSuffix(object.argument, suffix) };
        }
        return {
            type: "error",
            value: "",
            outcome: { kind: "unsupported", reason: "postfix" },
            message: "Mismatched parentheses.",
        };
    }
    /**
     * Resolves standalone relative-label tokens used in define contexts.
     * @param {string} input The token to resolve.
     * @returns {string | undefined} The resolved address string, if applicable.
     */
    tryResolveRelativeLabelToken(input) {
        if (input !== "+" && input !== "-" && input !== "?+" && input !== "?-") {
            return undefined;
        }
        try {
            switch (input) {
                case "+":
                    return `$${this.symbolScope.findNextLabel("+").toString(16)}`;
                case "-":
                    return `$${this.symbolScope.findPreviousLabel("-").toString(16)}`;
                case "?+":
                    return `$${this.symbolScope.findNextLabel("?+").toString(16)}`;
                case "?-":
                    return `$${this.symbolScope.findPreviousLabel("?-").toString(16)}`;
                default:
                    return undefined;
            }
        }
        catch (error) {
            if (!this.enforceResolvedLabels) {
                return "$0000";
            }
            throw error;
        }
    }
    /**
     * Resolves direct `!name` define references that are not assignments.
     * @param {string} input The token to resolve.
     * @returns {string | undefined} The resolved define value, if applicable.
     */
    tryResolveDirectDefineReference(input) {
        if (!input.startsWith("!") ||
            input.includes(" ") ||
            input.includes("=") ||
            input.includes("{")) {
            return undefined;
        }
        const varName = input.substring(1);
        return this.lookupDefineValue(varName);
    }
    /**
     * Resolves macro-label references such as `?label` or `#+?label`.
     * @param {string} input The token to resolve.
     * @returns {string | undefined} The resolved macro-label value, if applicable.
     */
    tryResolveMacroLabelReference(input) {
        const prefixMatch = input.match(/^(#\?|\?|#\?\.|\?\+|\?-)(.*)/);
        if (!prefixMatch) {
            return undefined;
        }
        const labelName = prefixMatch[2];
        return this.symbolScope.getLabelValue(labelName, false).toString();
    }
    /**
     * Resolves bare label-like tokens before the generic character-by-character
     * define scanner runs.
     * @param {string} input The token to resolve.
     * @returns {string | undefined} The resolved label value, if applicable.
     */
    tryResolveBareLabelReference(input) {
        if (!isBareLabelReference(input)) {
            return undefined;
        }
        // Expressions like `.zone_n-.zone_max` must stay intact so later arithmetic
        // can evaluate both sides instead of collapsing to the first local label.
        const labelValue = this.symbolScope.tryGetLabelValue(input, false);
        if (labelValue === undefined) {
            // Preserve legacy definition-pass behavior: unresolved bare candidates,
            // including numeric-only tokens, temporarily collapse to zero.
            if (this.isDefinitionCollectionStage) {
                return "0";
            }
            return undefined;
        }
        return labelValue.toString();
    }
    /**
     * Resolves all define replacements in a given string.
     * @param {string} input The string to resolve defines in.
     * @returns {string} The string with defines resolved.
     */
    resolvedefines(input) {
        const relative = this.tryResolveRelativeLabelToken(input);
        if (relative !== undefined) {
            return relative;
        }
        const macro = this.tryResolveMacroLabelReference(input);
        if (macro !== undefined) {
            return macro;
        }
        const label = this.tryResolveBareLabelReference(input);
        if (label !== undefined) {
            return label;
        }
        return fragmentText(this.resolveDefineFragment(sourceFragment(input)));
    }
    /** Bind source-valued defines without converting symbol references into numeric source text. */
    resolveDefineFragment(fragment) {
        const input = fragmentText(fragment);
        if (!input) {
            return fragment;
        }
        // Trim each comparison operand as before, but keep definition and invocation contributors.
        if (input.includes("!=")) {
            const segments = [];
            let start = 0;
            for (const part of input.split("!=")) {
                const left = start + part.length - part.trimStart().length;
                const right = start + part.trimEnd().length;
                segments.push(...this.resolveDefineFragment(sliceSourceFragment(fragment, left, right)).segments);
                start += part.length;
                if (start < input.length) {
                    segments.push(...sliceSourceFragment(fragment, start, start + 2).segments);
                }
                start += 2;
            }
            return { segments };
        }
        if ((input.startsWith("sizeof(") || input.startsWith("objectsize(")) && input.endsWith(")")) {
            return fragment;
        }
        const resolvedDirectDefine = this.tryResolveDirectDefineReference(input);
        if (resolvedDirectDefine !== undefined) {
            return this.defineEngine.resolveFragment(fragment);
        }
        return this.defineEngine.resolveFragment(fragment);
    }
    /**
     * Handles activate stage.
     * @param {AssemblyStageName} stage The stage.
     */
    activateStage(stage) {
        this.syncActiveStageExecutionState(stage);
        this.structEngine.data.reset();
        if (stage === "resolveLayout") {
            // Rebuild relative-label tables from layout sizing only.
            this.forwardLabels = {};
            this.backwardLabels = {};
        }
        // Reset the macro macroLabelInstance
        this.macroLabelInstance = 0;
        // Include guards are pass-local so includeonce files run once in each pass.
        this.includeSource.resetGuards();
        // Reset the in macro flag
        this.inMacroExpansion = false;
        this.programModelBuilder.resetIncrementalParseState(this.incrementalProgramParseState);
        this.pendingGeneratedFragment = undefined;
        for (const definition of this.architectureRegistry.definitions.values()) {
            definition.encoder.beginPass?.();
        }
        this.pluginState.resetForStage(stage);
        this.runLifecycleHook("onStageStart", (lifecycle) => lifecycle.onStageStart?.({
            state: this.pluginState,
            session: this.#pluginCapabilities,
            stage,
        }));
    }
    /**
     * Completes the current pass, performing any necessary cleanup.
     */
    finishPass() {
        this.structEngine.data.finish();
        if (/^(?:datastruct\b|\[)/i.test(this.frontEndService.commandBuffer.trimStart())) {
            throw new Error("Unclosed dataStruct initializer at end of source.");
        }
        if (/^includeasset\s*\(/i.test(this.frontEndService.commandBuffer.trimStart())) {
            throw new Error("Unclosed includeAsset call at end of source.");
        }
        const stage = this.activeStageExecutionState?.stage ?? "collectDefinitions";
        this.runLifecycleHook("onStageEnd", (lifecycle) => lifecycle.onStageEnd?.({ state: this.pluginState, session: this.#pluginCapabilities, stage }));
        if (this.getActiveStageCapabilities().canFinalize) {
            this.runLifecycleHook("beforeOutputFinalize", (lifecycle) => lifecycle.beforeOutputFinalize?.({
                state: this.pluginState,
                session: this.#pluginCapabilities,
                outputBytes: this.outputBytes,
            }));
        }
        this.outputWriter.finishPass();
        if (this.getActiveStageCapabilities().canFinalize) {
            this.includeSource.endAssemblySnapshot();
            this.mathCore.endAssemblySnapshot();
            this.defineEngine.clearSyntaxCache();
            this.frontEndService.clearFragmentCache();
            this.operandResolver.clearParsedOperands();
            this.programModelBuilder.clearCache();
        }
    }
    /**
     * Sets the current file being processed.
     * @param {string} filename - The filename to set.
     */
    setCurrentFile(filename) {
        this.currentFile = filename;
        this.currentLine = 0;
        this.programModelBuilder.resetIncrementalParseState(this.incrementalProgramParseState);
    }
    /**
     * Sets the current line number.
     * @param {number} line - The line number to set.
     */
    setCurrentLine(line) {
        this.currentLine = line;
    }
    getStageDescriptor(stage) {
        if (stage === "collectDefinitions") {
            return {
                stage,
                capabilities: {
                    instructionMode: "layout",
                    canEmitBytes: false,
                    canFinalize: false,
                    enforceResolvedLabels: false,
                    isDefinitionCollectionStage: true,
                },
            };
        }
        if (stage === "resolveLayout") {
            return {
                stage,
                capabilities: {
                    instructionMode: "emit",
                    canEmitBytes: false,
                    canFinalize: false,
                    enforceResolvedLabels: false,
                    isDefinitionCollectionStage: false,
                },
            };
        }
        return {
            stage,
            capabilities: {
                instructionMode: "emit",
                canEmitBytes: true,
                canFinalize: true,
                enforceResolvedLabels: true,
                isDefinitionCollectionStage: false,
            },
        };
    }
    cloneRelativeLabels(source) {
        const clone = {};
        for (const [depth, entries] of Object.entries(source)) {
            clone[Number(depth)] = entries.map((entry) => Object.assign({}, entry));
        }
        return clone;
    }
    createStageExecutionState(stage) {
        const descriptor = this.getStageDescriptor(stage);
        let previousStage;
        if (stage === "resolveLayout") {
            previousStage = "collectDefinitions";
        }
        else if (stage === "emitProgram") {
            previousStage = "resolveLayout";
        }
        const seed = previousStage ? this.stageExecutionStates.get(previousStage) : undefined;
        const cursorSeed = seed?.cursor ?? {
            currentTargetAddress: this.currentTargetAddress,
            currentTargetBaseAddress: this.currentTargetBaseAddress,
            currentTargetStartAddress: this.currentTargetStartAddress,
            currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
            bytes: this.bytes,
        };
        const symbolSeed = seed?.symbols ?? {
            labelTable: this.labelTable,
            forwardLabels: this.forwardLabels,
            backwardLabels: this.backwardLabels,
            currentParentLabel: this.currentParentLabel,
            currentParentIsGlobal: this.currentParentIsGlobal,
            currentGlobalParentLabel: this.currentGlobalParentLabel,
            labelParents: this.labelParents,
        };
        const controlSeed = seed?.control ?? {
            namespaceStack: this.namespaceStack,
            currentNamespace: this.currentNamespace,
            namespaceNestingEnabled: this.namespaceNestingEnabled,
            namespaceNestingPath: this.namespaceNestingPath,
            inMacroExpansion: this.inMacroExpansion,
            macroLabelInstance: this.macroLabelInstance,
        };
        return {
            ...descriptor,
            cursor: { ...cursorSeed },
            symbols: {
                labelTable: new Map(Array.from(symbolSeed.labelTable.entries()).map(([key, value]) => [key, { ...value }])),
                forwardLabels: this.cloneRelativeLabels(symbolSeed.forwardLabels),
                backwardLabels: this.cloneRelativeLabels(symbolSeed.backwardLabels),
                currentParentLabel: symbolSeed.currentParentLabel,
                currentParentIsGlobal: symbolSeed.currentParentIsGlobal,
                currentGlobalParentLabel: symbolSeed.currentGlobalParentLabel,
                labelParents: new Map(symbolSeed.labelParents),
            },
            control: {
                namespaceStack: [...controlSeed.namespaceStack],
                currentNamespace: controlSeed.currentNamespace,
                namespaceNestingEnabled: controlSeed.namespaceNestingEnabled,
                namespaceNestingPath: [...controlSeed.namespaceNestingPath],
                inMacroExpansion: controlSeed.inMacroExpansion,
                macroLabelInstance: controlSeed.macroLabelInstance,
            },
            pluginState: this.pluginState.cloneSnapshot(seed?.pluginState),
            loweredProgram: null,
        };
    }
    /**
     * Applies stage execution state.
     * @param {StageExecutionState} stageState The stage state.
     */
    applyStageExecutionState(stageState) {
        this.pluginState.restore(this.pluginState.cloneSnapshot(stageState.pluginState));
        this.currentTargetAddress = stageState.cursor.currentTargetAddress;
        this.currentTargetBaseAddress = stageState.cursor.currentTargetBaseAddress;
        this.currentTargetStartAddress = stageState.cursor.currentTargetStartAddress;
        this.currentTargetBaseStartAddress = stageState.cursor.currentTargetBaseStartAddress;
        this.bytes = stageState.cursor.bytes;
        this.labelTable = stageState.symbols.labelTable;
        this.forwardLabels = stageState.symbols.forwardLabels;
        this.backwardLabels = stageState.symbols.backwardLabels;
        this.currentParentLabel = stageState.symbols.currentParentLabel;
        this.currentParentIsGlobal = stageState.symbols.currentParentIsGlobal;
        this.currentGlobalParentLabel = stageState.symbols.currentGlobalParentLabel;
        this.labelParents = stageState.symbols.labelParents;
        this.namespaceStack = stageState.control.namespaceStack;
        this.currentNamespace = stageState.control.currentNamespace;
        this.namespaceNestingEnabled = stageState.control.namespaceNestingEnabled;
        this.namespaceNestingPath = stageState.control.namespaceNestingPath;
        this.inMacroExpansion = stageState.control.inMacroExpansion;
        this.macroLabelInstance = stageState.control.macroLabelInstance;
    }
    /**
     * Captures stage execution state.
     * @param {StageExecutionState} stageState The stage state.
     */
    captureStageExecutionState(stageState) {
        stageState.pluginState = this.pluginState.cloneSnapshot();
        stageState.cursor = {
            currentTargetAddress: this.currentTargetAddress,
            currentTargetBaseAddress: this.currentTargetBaseAddress,
            currentTargetStartAddress: this.currentTargetStartAddress,
            currentTargetBaseStartAddress: this.currentTargetBaseStartAddress,
            bytes: this.bytes,
        };
        stageState.symbols = {
            labelTable: this.labelTable,
            forwardLabels: this.forwardLabels,
            backwardLabels: this.backwardLabels,
            currentParentLabel: this.currentParentLabel,
            currentParentIsGlobal: this.currentParentIsGlobal,
            currentGlobalParentLabel: this.currentGlobalParentLabel,
            labelParents: this.labelParents,
        };
        stageState.control = {
            namespaceStack: this.namespaceStack,
            currentNamespace: this.currentNamespace,
            namespaceNestingEnabled: this.namespaceNestingEnabled,
            namespaceNestingPath: this.namespaceNestingPath,
            inMacroExpansion: this.inMacroExpansion,
            macroLabelInstance: this.macroLabelInstance,
        };
    }
    getOrCreateStageExecutionState(stage) {
        const existing = this.stageExecutionStates.get(stage);
        if (existing) {
            return existing;
        }
        const created = this.createStageExecutionState(stage);
        this.stageExecutionStates.set(stage, created);
        return created;
    }
    buildProgramModel(source, sourceFile = this.currentFile, startLine = 0) {
        return withSourceSyntax(() => measureInternalPhase("buildProgramModel", () => {
            const program = this.frontEndService.parseSource(source, sourceFile, startLine);
            return program;
        }));
    }
    runStage(stage, program) {
        if (program.grammarIdentity !== undefined &&
            program.grammarIdentity !== this.frontEndService.grammarIdentity) {
            throw new Error("Source grammar changed; parse the source again before execution.");
        }
        return withAstQualification(() => measureInternalPhase(stage, () => {
            if (stage === "collectDefinitions") {
                this.#hasDeferredAssetLayout = false;
                this.assetAssembly.beginBuild();
                this.includeSource.beginAssemblySnapshot();
                this.mathCore.beginAssemblySnapshot();
                this.operandResolver.clearParsedOperands();
                this.stageExecutionStates.clear();
                this.activeStageExecutionState = null;
            }
            const stageState = this.getOrCreateStageExecutionState(stage);
            this.activeStageExecutionState = stageState;
            this.applyStageExecutionState(stageState);
            this.setCurrentFile(program.sourceFile);
            this.activateStage(stage);
            const loweredProgram = withSourceSyntax(() => this.getOrCreateLoweredProgram(stageState, program));
            measureInternalPhase("executeProgram", () => this.executeLoweredNodeStream(loweredProgram.nodes));
            measureInternalPhase("finishPass", () => this.finishPass());
            this.captureStageExecutionState(stageState);
            return stageState;
        }));
    }
    /**
     * Run definition collection, layout resolution, and byte emission synchronously in that order.
     * Throws at the first unrecovered failure. Partial state/output is not a successful binary.
     * @param {ProgramModel} program Parsed source model produced for this target's syntax.
     */
    assembleProgram(program) {
        const definitions = this.runStage("collectDefinitions", program);
        // Later stages seed symbol/plugin snapshots, not lowered instructions and their prepared values.
        // Full builds can reclaim these caches immediately; direct runStage calls retain durable results.
        definitions.loweredProgram = null;
        const layout = this.runStage("resolveLayout", program);
        layout.loweredProgram = null;
        this.runStage("emitProgram", program);
    }
    /**
     * Parse and run all three assembly stages. Includes are read through the configured provider.
     * Throws on failure. Read the finalized bytes with getBinaryOutput after success.
     * @param {string} source Assembly source text, not a filename.
     * @param {string} [sourceFile] Source identity and include-resolution base. Defaults to currentFile.
     * @param {number} [startLine] Zero-based line offset. Defaults to zero.
     * @returns {ProgramModel} Parsed model used for this build.
     */
    assembleSource(source, sourceFile = this.currentFile, startLine = 0) {
        const program = this.buildProgramModel(source, sourceFile, startLine);
        this.assembleProgram(program);
        return program;
    }
    /**
     * Writes a repeated byte into the output buffer.
     * @param {number} start The starting address of the block to write.
     * @param {number} value The byte value to write.
     * @param {number} [length] The length of the block to write.
     */
    writeOutputBytes(start, value, length = 1) {
        if (typeof start !== "number" || typeof value !== "number" || typeof length !== "number") {
            throw new Error("writeOutputBytes requires a number for start, value, and length");
        }
        this.outputBuffer.fill(start, value, length);
    }
    /**
     * Expands the output buffer and fills it with a specified byte.
     * @param {number} newSize The new output size.
     * @param {number} fillByte The byte used for the new range.
     */
    expandOutput(newSize, fillByte) {
        if (typeof newSize !== "number" || typeof fillByte !== "number") {
            throw new Error("expandOutput requires a number for newSize and fillByte");
        }
        if (newSize > this.outputBytes.length) {
            this.writeOutputBytes(this.outputBytes.length, fillByte, newSize - this.outputBytes.length);
        }
    }
    /** Runs the active output-format finalizer. */
    finalizeOutput() {
        this.pluginOutputFormat.finalize({
            state: this.pluginState,
            outputBytes: this.outputBytes,
        });
    }
    /**
     * Materialize the target format's current bytes without assembling or finalizing again.
     * @returns {Uint8Array} Output whose ownership depends on the formatter. Copy before retaining or mutating independently.
     */
    getBinaryOutput = () => {
        return this.pluginOutputFormat.getOutput({
            state: this.pluginState,
            outputBytes: this.outputBytes,
        });
    };
    /**
     * Lowers completed runtime nodes and executes them through the production executor.
     * @param {ExecutableNode[]} nodes The runtime nodes to lower and execute.
     */
    lowerAndExecuteRuntimeNodes(nodes) {
        const loweredNodes = nodes.map((node) => this.commandLoweringService.lowerExecutableNode(node));
        for (const node of loweredNodes) {
            this.executeWithAnalysisRecovery(node, (current) => this.getLoweredNodeSpan(current), (current) => this.executeLoweredNode(current));
        }
    }
    resolveForLoopBounds(forBlock) {
        const parsedForLoop = forBlock.header?.parsed.forLoop;
        const variable = forBlock.variable ?? parsedForLoop?.variable;
        let start = forBlock.start;
        let end = forBlock.end;
        const startExpression = forBlock.startExpression ?? parsedForLoop?.start;
        const endExpression = forBlock.endExpression ?? parsedForLoop?.end;
        if (startExpression && endExpression) {
            // Bounds bind in source order so defines and effectful functions retain stage timing.
            start = this.operandResolver.getnum(this.resolveExpressionNode(startExpression));
            end = this.operandResolver.getnum(this.resolveExpressionNode(endExpression));
        }
        return { variable, start, end };
    }
    /**
     * Executes for loop iterations.
     * @param {LoweredLoopNode} forBlock The for block.
     * @param {() => void} executeBody The execute body.
     */
    executeForLoopIterations(forBlock, executeBody) {
        const { variable, start, end } = this.resolveForLoopBounds(forBlock);
        if (!variable || start === undefined || end === undefined) {
            return;
        }
        // Save the original variable value before we modify it
        const originalValue = this.defines.get(variable);
        const originalLoopValue = this.activeLoopVariables.get(variable);
        // Only process the loop if start < end
        if (start < end) {
            // Loop through the range and process commands for each iteration
            for (let i = start; i < end; i++) {
                // Set our loop counter directly in defines map
                this.defines.set(variable, i.toString());
                this.activeLoopVariables.set(variable, i);
                executeBody();
            }
        }
        // Restore the original variable value or delete if it didn't exist
        if (originalValue !== undefined) {
            this.defines.set(variable, originalValue);
        }
        else {
            this.defines.delete(variable);
        }
        if (originalLoopValue !== undefined) {
            this.activeLoopVariables.set(variable, originalLoopValue);
        }
        else {
            this.activeLoopVariables.delete(variable);
        }
    }
    /**
     * Executes lowered loop.
     * @param {LoweredLoopNode} loopBlock The loop block.
     */
    executeLoweredLoop(loopBlock) {
        if (loopBlock.loopType === "for") {
            this.executeLoweredForLoop(loopBlock);
        }
        else {
            this.executeLoweredWhileLoop(loopBlock);
        }
    }
    /**
     * Executes lowered for loop.
     * @param {LoweredLoopNode} forBlock The for block.
     */
    executeLoweredForLoop(forBlock) {
        this.executeForLoopIterations(forBlock, () => this.executeLoweredNodeStream(forBlock.commands));
    }
    /**
     * Executes while loop commands.
     * @param {LoweredLoopNode} whileBlock The while block.
     * @param {TCommand[]} commands The commands.
     * @param {(command: TCommand) => string | null} getDefineTarget The get define target.
     * @param {(command: TCommand) => void} executeCommand The execute command.
     */
    executeWhileLoopCommands(whileBlock, commands, getDefineTarget, executeCommand) {
        const conditionNode = whileBlock.conditionNode ?? whileBlock.header?.parsed.condition?.expression;
        if (!conditionNode) {
            return;
        }
        let iteration = 0;
        const MAX_ITERATIONS = 10000;
        const loopVars = new Set();
        const originalValues = new Map();
        // Continue looping as long as the condition evaluates to true
        while (this.evaluateExpression(conditionNode) && iteration < MAX_ITERATIONS) {
            for (const cmd of commands) {
                const defineTarget = getDefineTarget(cmd);
                if (defineTarget && !loopVars.has(defineTarget)) {
                    loopVars.add(defineTarget);
                    originalValues.set(defineTarget, this.defines.get(defineTarget));
                }
                executeCommand(cmd);
            }
            iteration++;
        }
        // Restore original variable values
        for (const [varName, value] of originalValues.entries()) {
            if (value !== undefined) {
                this.defines.set(varName, value);
            }
            else {
                this.defines.delete(varName);
            }
        }
    }
    /**
     * Executes lowered while loop.
     * @param {LoweredLoopNode} whileBlock The while block.
     */
    executeLoweredWhileLoop(whileBlock) {
        this.executeWhileLoopCommands(whileBlock, whileBlock.commands, (cmd) => cmd.kind === "operation" &&
            cmd.operation.kind === "defineAssignment" &&
            cmd.operation.operator === "=" &&
            !cmd.operation.dynamic &&
            /^[A-Z_a-z]/.test(cmd.operation.name)
            ? cmd.operation.name
            : null, (cmd) => this.executeLoweredNodeWithRecovery(cmd));
    }
    getLoweredNodeSpan(node) {
        if ("source" in node) {
            return node.source.normalizedSpan;
        }
        if (node.kind === "loop" || node.kind === "conditional" || node.kind === "capture") {
            return node.header?.source.normalizedSpan;
        }
        return undefined;
    }
    /**
     * Executes a tree or lowered node while routing analysis-mode failures into diagnostics.
     * @param {TNode} node The node to execute.
     * @param {(node: TNode) => SourceSpan | undefined} getSpan Resolves the node span for diagnostics.
     * @param {(node: TNode) => void} executeNode Executes the node with its native dispatcher.
     */
    executeWithAnalysisRecovery(node, getSpan, executeNode) {
        if (!this.analysisErrorRecoveryEnabled) {
            executeNode(node);
            return;
        }
        try {
            executeNode(node);
        }
        catch (error) {
            this.reportErrorDiagnostic(error, getSpan(node), this.activeStageExecutionState?.stage);
        }
    }
    /**
     * Executes lowered node with recovery.
     * @param {LoweredExecutableNode} node The node.
     */
    executeLoweredNodeWithRecovery(node) {
        const command = node.kind === "loop" || node.kind === "conditional" || node.kind === "capture"
            ? node.header
            : node.command;
        const previous = this.currentSourceOrigin;
        this.currentSourceOrigin = command?.source.origin ?? previous;
        try {
            this.executeWithAnalysisRecovery(node, (currentNode) => this.getLoweredNodeSpan(currentNode), (currentNode) => this.executeLoweredNode(currentNode));
        }
        catch (error) {
            if (this.currentSourceOrigin) {
                rememberErrorSource(error, this.getCurrentSourceLocation(this.getLoweredNodeSpan(node)));
            }
            throw error;
        }
        finally {
            this.currentSourceOrigin = previous;
        }
    }
    /**
     * Executes lowered node.
     * @param {LoweredExecutableNode} node The node.
     */
    executeLoweredNode(node) {
        const sourceCommand = node.kind === "loop" || node.kind === "conditional" || node.kind === "capture"
            ? node.header
            : node.command;
        if (sourceCommand) {
            this.currentFile = sourceCommand.source.file;
            this.currentLine = sourceCommand.source.line;
        }
        if (node.kind === "capture") {
            if (node.captureKind === "macro") {
                // An unterminated capture never installs a definition or executes its body.
                if (!node.footer) {
                    return;
                }
                const declaration = node.header.parsed.operation;
                if (declaration?.kind === "invalid") {
                    throw new Error(declaration.message);
                }
                if (declaration?.kind !== "macroHeader") {
                    throw new Error(`Invalid macro header: ${node.header.command}`);
                }
                const body = node.commands.map((command) => {
                    if (!("source" in command)) {
                        throw new Error("Macro captures must contain source templates.");
                    }
                    // Captured body syntax is shared, but the include chain belongs to this declaration occurrence.
                    return {
                        ...command,
                        source: {
                            ...command.source,
                            origin: command.source.origin ?? this.currentSourceOrigin,
                        },
                    };
                });
                this.macroEngine.installDefinition(declaration, body, {
                    ...node.header.source,
                    origin: node.header.source.origin ?? this.currentSourceOrigin,
                });
                return;
            }
            this.executeLoweredNodeWithRecovery(this.commandLoweringService.lowerExecutableNode(node.header));
            const scope = node.captureKind === "struct" ? "struct" : undefined;
            for (const command of node.commands) {
                if (node.captureKind === "dataStructs" &&
                    (!("source" in command) || command.parsed.declaration?.kind !== "dataStructRow")) {
                    throw new Error("dataStructs accepts only indexed records: [index] = { field = value }.");
                }
                this.executeLoweredNodeWithRecovery(this.commandLoweringService.lowerExecutableNode(command, scope));
            }
            if (node.footer) {
                if (node.captureKind === "struct") {
                    // Closing a struct restores its cursor without emitting an executable command trace.
                    this.currentFile = node.footer.source.file;
                    this.currentLine = node.footer.source.line;
                    this.structEngine.handleStructMode(node.footer);
                }
                else {
                    this.executeLoweredNodeWithRecovery(this.commandLoweringService.lowerExecutableNode(node.footer));
                }
            }
            return;
        }
        if (node.kind === "operation") {
            const operation = node.operation;
            switch (operation.kind) {
                case "empty":
                    if (operation.seedBaseImage) {
                        this.seedOutputFromBaseImage();
                    }
                    return;
                case "invalid":
                    throw new Error(operation.message);
                case "macroHeader":
                    throw new Error("Macro header requires a captured body.");
                case "macroCall":
                    if (this.collectSourceMetadata) {
                        this.collectCommandReferences(node.command);
                    }
                    this.macroEngine.executeInvocation(operation, node.source);
                    return;
                case "defineAssignment":
                case "defineExpansion":
                case "undef":
                    this.defineEngine.executeOperation(operation, node.source);
                    if (operation.kind === "defineAssignment") {
                        this.cursorAddress.recordCurrentAddress();
                    }
                    return;
            }
        }
        if (node.kind === "bareInvocation") {
            if (this.macros.has(node.invocation.name)) {
                this.macroEngine.executeInvocation(node.invocation, node.source);
            }
            else {
                // Bare invocation candidates retain their source envelope even when they bind to a directive/opcode.
                this.executeAttributedCommand(node.command, () => this.dispatchLoweredNode(this.commandLoweringService.lowerCommand(node.command)));
            }
            return;
        }
        if (node.kind === "sourceTemplate") {
            if (this.isDefinitionCollectionStage && node.command.syntax?.kind === "numericData") {
                // Collection retains the template occurrence while data binding determines its reserved width.
                this.executeStatement({
                    kind: "numericData",
                    statement: node.command.syntax.statement,
                    command: node.command,
                    source: node.source,
                });
                return;
            }
            const input = node.source.fragment ?? sourceFragment(node.source.raw, [node.source]);
            const origin = node.source.origin;
            const fragment = this.macroEngine.resolveVariadicFragment(input, origin?.kind === "macro" ? origin.arguments : []);
            if (fragmentText(fragment) === node.command.command) {
                throw new Error(`Unbound source template: ${node.command.command}`);
            }
            incrementInternalCounter("actualReparses");
            this.processSourceFragment(fragment, true);
            return;
        }
        if (node.kind === "declaration") {
            const declaration = node.declaration;
            switch (declaration.kind) {
                case "invalid":
                    throw new Error(declaration.message);
                case "character":
                    this.characterMappings.set(declaration.character, this.operandResolver.getnum(declaration.expression));
                    return;
                case "function":
                    this.mathCore.installFunctionTemplate(declaration.name, declaration.template);
                    this.recordSymbolDefinition("function", declaration.name);
                    return;
                case "structField":
                    this.structEngine.handleStructMode(node.command);
                    return;
                case "dataStructRow": {
                    const record = this.structEngine.data.bindRow(declaration);
                    const command = {
                        ...node.command,
                        keyword: "datastruct",
                        parsed: { ...node.command.parsed, declaration: record },
                    };
                    // The row binds a declaration, then honors the current typed directive owner and middleware.
                    const lowered = withSourceSyntax(() => this.commandLoweringService.lowerCommand(command));
                    this.executeAttributedCommand(command, () => this.dispatchLoweredNode(lowered));
                    return;
                }
                case "struct":
                case "endStruct":
                case "dataStruct":
                case "dataStructs":
                case "endDataStructs":
                    throw new Error(`Unexpected declaration: ${declaration.kind}`);
            }
        }
        if (node.kind === "label" || node.kind === "assignment" || node.kind === "numericData") {
            // Registration can change ownership after lowering; select the replacement's parsed contract.
            if (this.commandLoweringService.lowerStatement(node.command)) {
                this.executeStatement(node);
            }
            else {
                this.dispatchLoweredNode(this.commandLoweringService.lowerCommand(node.command));
            }
            return;
        }
        if (node.kind === "typedInstruction") {
            if (node.command && this.collectSourceMetadata) {
                this.collectCommandReferences(node.command);
            }
        }
        if (node.kind === "loop") {
            this.executeLoweredLoop(node);
            return;
        }
        if (node.kind === "conditional") {
            this.executeConditionalBranches(node.branches, (commands) => this.executeLoweredNodeStream(commands));
            return;
        }
        if (node.kind === "pluginSyntax" &&
            !node.command.keyword.startsWith(".") &&
            !["unknown", "opcodeCandidate", "directive"].includes(node.command.kind)) {
            // Declaration-shaped directives retain both declaration and directive trace envelopes.
            this.executeAttributedCommand(node.command, () => this.dispatchLoweredNode(node));
            return;
        }
        this.dispatchLoweredNode(node);
    }
    /**
     * Executes lowered node stream.
     * @param {LoweredExecutableNode[]} nodes The nodes.
     */
    executeLoweredNodeStream(nodes) {
        for (const node of nodes) {
            this.executeLoweredNodeWithRecovery(node);
        }
    }
    /**
     * Drains and executes any completed nodes still buffered in the incremental parser.
     * This protects re-entrant command sources, such as macro expansion, from leaving
     * finished typed roots stranded until the next top-level line arrives.
     */
    flushCompletedIncrementalNodes() {
        const ready = this.programModelBuilder.drainCompletedRoots(this.incrementalProgramParseState);
        if (ready.length > 0) {
            this.lowerAndExecuteRuntimeNodes(ready);
        }
    }
    /**
     * Executes conditional branches.
     * @param {Array<{ kind: "if" | "elseif" | "else"; conditionNode?: ExpressionNode; commands: TCommand[]; }>} branches The branches.
     * @param {(commands: TCommand[]) => void} executeCommands The execute commands.
     */
    executeConditionalBranches(branches, executeCommands) {
        for (const branch of branches) {
            if (branch.kind === "else") {
                executeCommands(branch.commands);
                return;
            }
            if (!branch.conditionNode) {
                continue;
            }
            let branchConditionMatched = false;
            this.requireStaticLabelLookup = true;
            try {
                // Match legacy `if` / `elseif` behavior: condition labels must resolve as
                // static and any failure should be wrapped by evaluateExpression.
                branchConditionMatched = this.evaluateExpression(branch.conditionNode);
            }
            finally {
                this.requireStaticLabelLookup = false;
            }
            if (branchConditionMatched) {
                executeCommands(branch.commands);
                return;
            }
        }
    }
}
//# sourceMappingURL=assembler.js.map