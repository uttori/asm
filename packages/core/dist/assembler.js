import { normalizeAddressForWidth } from "./address-width.js";
import { AddressToLineMapping } from "./addressToLine.js";
import { ArchitectureRegistry } from "./architecture-registry.js";
import { createAssemblySourceLocation, diagnosticFromError, } from "./diagnostics.js";
import { CORE_DIRECTIVE_GROUPS } from "./directive-groups.js";
import { createDirectiveRegistry } from "./directives/registry.js";
import { NodeAssemblyFileProvider } from "./file-provider.js";
import { incrementInternalCounter, measureInternalPhase } from "./internal-instrumentation.js";
import { isReferenceExpressionNode, parseExpressionNode, renderExpressionNode, renderReferenceExpressionNode, } from "./ir/expression-node.js";
import { cloneNormalizedCommand, setCommandKind, setCommandWords, } from "./ir/normalized-command.js";
import { MathCore } from "./mathcore.js";
import { OperandResolver } from "./operand-resolver.js";
import { PluginError, PluginSessionStateStore, } from "./plugin/index.js";
import { AssemblyFrontEndService, } from "./services/assembly-front-end-service.js";
import { CommandLoweringService, } from "./services/command-lowering-service.js";
import { getDefineVariable, isBareLabelReference } from "./services/command-text-service.js";
import { DefineEngine } from "./services/define-engine.js";
import { DirectiveRuntimeService, } from "./services/directive-runtime-service.js";
import { FrontEndCommandService } from "./services/front-end-command-service.js";
import { IncludeSourceService } from "./services/include-source-service.js";
import { MacroEngine } from "./services/macro-engine.js";
import { OutputWriterService } from "./services/output-writer-service.js";
import { StructEngine } from "./services/struct-engine.js";
import { parseStructInitializer, splitInitializerList } from "./services/struct-initializer.js";
import { getStructMetadata } from "./services/struct-metadata.js";
import { SymbolScopeService, parseUnnamedLabelReference, } from "./services/symbol-scope-service.js";
import { ASAR_SYNTAX_PROFILE } from "./syntax-profile.js";
const TOOLING_ANALYSIS_STAGES = ["collectDefinitions"];
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
    /** Mutable bytes produced by this assembly session. */
    outputBytes = [];
    /** Byte used when expanding a sparse output range. */
    outputFillByte = 0;
    whileStatus = [];
    namespaceStack = [];
    currentNamespace = "";
    namespaceNestingEnabled = false;
    namespaceNestingPath = [];
    // Current macro tracking
    inMacroDefinition = false;
    currentMacroName = "";
    currentMacroParams = [];
    currentMacroBody = [];
    currentVariadicCount = undefined;
    currentVariadicArgs = [];
    macros = new Map();
    mathCore;
    operandResolver;
    addressToLineMapping = new AddressToLineMapping();
    currentFile = "";
    currentLine = 0;
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
    inFunctionDefinition = false;
    functionDefinitionLines = [];
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
    /** Deduplication index for {@link includeEdges} — O(1) vs. O(n) `.some()` scan. */
    #includeEdgeKeys = new Set();
    includeEdges = [];
    collectSourceMetadata;
    /** When false, `incsrc`/`include` record an edge but do not parse the included file. */
    followIncludes = true;
    activeStageExecutionState = null;
    analysisErrorRecoveryEnabled = false;
    runtimePassthroughRewriteEnabled = false;
    sessionDisposed = false;
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
        const source = this.traceCommandStack[this.traceCommandStack.length - 1];
        this.traceListener?.({
            type: "write",
            ...event,
            file: source?.file ?? this.currentFile,
            line: source?.line ?? this.currentLine,
            raw: source?.raw ?? "",
            normalized: source?.normalized ?? "",
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
        return createAssemblySourceLocation(this.currentFile, this.currentLine, span);
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
            location: createAssemblySourceLocation(file, line, options.span),
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
        const line = options.line ?? this.currentLine;
        const dedupeKey = `${kind}\x00${name}\x00${file}\x00${line}\x00${options.containerName ?? ""}`;
        if (this.#symbolReferenceKeys.has(dedupeKey)) {
            return;
        }
        this.#symbolReferenceKeys.add(dedupeKey);
        this.symbolReferences.push({
            name,
            kind,
            location: createAssemblySourceLocation(file, line, options.span),
            containerName: options.containerName,
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
        switch (expression.type) {
            case "defineReference":
                if (expression.name || expression.content) {
                    this.recordSymbolReference("define", expression.braced ? (expression.content ?? "") : (expression.name ?? ""));
                }
                return;
            case "identifier": {
                const segments = this.hierarchicalLabelReferences(expression.name);
                if (segments) {
                    for (const segment of segments) {
                        this.recordSymbolReference("label", segment.name, {
                            containerName: segment.containerName,
                        });
                    }
                    return;
                }
                this.recordSymbolReference("label", expression.name);
                return;
            }
            case "member":
            case "index":
                this.collectStructReferenceSegments(expression, fallbackSpan);
                return;
            case "call":
                this.recordSymbolReference("function", expression.callee.name, {
                    span: expression.callee.span ?? expression.span ?? fallbackSpan,
                });
                for (const argument of expression.arguments) {
                    this.collectExpressionReferences(argument, fallbackSpan);
                }
                return;
            case "unary":
                this.collectExpressionReferences(expression.argument, fallbackSpan);
                return;
            case "binary":
                this.collectExpressionReferences(expression.left, fallbackSpan);
                this.collectExpressionReferences(expression.right, fallbackSpan);
                return;
            case "range":
                this.collectExpressionReferences(expression.start, fallbackSpan);
                this.collectExpressionReferences(expression.end, fallbackSpan);
                return;
            default:
                return;
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
                this.recordSymbolReference("label", expression.name);
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
        return this.structNameFromExpression(parseExpressionNode(value), seen);
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
            default:
                return undefined;
        }
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
            const args = splitInitializerList(command.words.slice(1).join(" "));
            if (args.length !== 2)
                return; // The directive reports its syntax error.
            const reference = args[0];
            const containerName = reference.replace(/\[[^\]]+]$/, "");
            // An array row's root name was supplied by its header, not its source line.
            if (!command.source.raw.trimStart().startsWith("[")) {
                this.collectExpressionReferences(parseExpressionNode(reference), fallbackSpan);
            }
            else {
                const index = reference.match(/\[([^\]]+)]$/)?.[1];
                if (index)
                    this.collectExpressionReferences(parseExpressionNode(index), fallbackSpan);
            }
            for (const [field, value] of parseStructInitializer(args[1])) {
                this.recordSymbolReference("label", field, { containerName });
                for (const expression of typeof value === "string" ? [value] : value) {
                    this.collectExpressionReferences(parseExpressionNode(expression), fallbackSpan);
                }
            }
            return;
        }
        if (command.keyword.toLowerCase() === "datastructs") {
            if (command.words[1])
                this.collectExpressionReferences(parseExpressionNode(command.words[1]), fallbackSpan);
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
                this.collectExpressionReferences(parseExpressionNode(arg), fallbackSpan);
            }
        }
        if (parsed.includeTarget?.target) {
            this.recordSymbolReference("include", parsed.includeTarget.target.replace(/^["'`](.*)["'`]$/, "$1"), {
                span: command.source.tokenSpans[1] ?? fallbackSpan,
            });
        }
        if (parsed.opcodeOperands?.mnemonic) {
            this.recordSymbolReference("instruction", parsed.opcodeOperands.mnemonic, {
                span: command.source.tokenSpans[0] ?? fallbackSpan,
            });
        }
        for (const operand of parsed.dataDirective?.operands ?? []) {
            this.collectExpressionReferences(parseExpressionNode(operand), fallbackSpan);
        }
        for (const operand of parsed.opcodeOperands?.operands ?? []) {
            this.collectExpressionReferences(parseExpressionNode(operand), fallbackSpan);
        }
        for (const arg of parsed.directiveArgs?.args ?? []) {
            this.collectExpressionReferences(parseExpressionNode(arg), fallbackSpan);
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
        const target = session.environment.getTarget(session.targetId);
        for (const setId of target?.directiveSets ?? []) {
            const set = session.environment.getDirectiveSet(setId);
            if (!set)
                continue;
            const pluginId = session.environment.getContributionOwner(setId);
            for (const directive of set.directives) {
                let handler;
                try {
                    handler = directive.createHandler({
                        targetId: session.targetId,
                        state: session.pluginState,
                        session,
                    });
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
                registry.register([...directive.keywords], undefined, (_context, words, raw) => {
                    try {
                        handler({ state: session.pluginState }, words, raw);
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
                }, directive.phase);
            }
        }
        for (const [keyword, handler] of registry.handlers) {
            registry.handlers.set(keyword, (words, raw, command) => {
                if (session.runBeforeDirective(keyword, words, raw) === "handled")
                    return;
                handler(words, raw, command);
            });
        }
        return registry;
    }
    /**
     * Analyzes program.
     * @param {ProgramModel} program The program.
     * @returns {AssemblyAnalysisResult} The result.
     */
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
    /**
     * Analyzes workspace.
     * @param {Array<{ source: string; sourceFile: string; startLine?: number }>} documents The documents.
     * @param {ProgramAnalysisOptions} [options] Optional analysis options.
     * @returns {Array<AssemblyAnalysisResult & { program: ProgramModel; sourceFile: string }>} The result.
     */
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
        if (!this.baseImage || this.baseImage.length === 0) {
            return;
        }
        for (let i = 0; i < Math.min(seedSize, this.baseImage.length); i++) {
            this.outputBytes[i] = this.baseImage[i];
        }
    }
    /**
     * Creates services.
     * @returns {AssemblerServiceBag} The result.
     */
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
    constructor(options) {
        if (!options?.environment) {
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
        this.syntaxProfile = target.syntaxProfile ?? ASAR_SYNTAX_PROFILE;
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
        const frontEndHost = {
            passProgramCache: this.passProgramCache,
            resolveVariadicPlaceholders: (command) => this.macroEngine.resolveVariadicPlaceholders(command),
            shouldEndifCloseInnermostWhile: (loopType, loopStartLine, ifStartLine) => this.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
        };
        Object.defineProperties(frontEndHost, {
            currentFile: { get: () => this.currentFile },
            currentLine: { get: () => this.currentLine },
            inMacroExpansion: { get: () => this.inMacroExpansion },
            isDefinitionCollectionStage: { get: () => this.isDefinitionCollectionStage },
            syntaxProfile: { get: () => this.syntaxProfile },
        });
        this.frontEndService = new AssemblyFrontEndService(frontEndHost);
        this.programModelBuilder = this.frontEndService.programModelBuilder;
        this.incrementalProgramParseState = this.programModelBuilder.createIncrementalParseState();
        this.operandResolver = new OperandResolver({
            resolveDefines: (input) => this.resolvedefines(input),
            isStructReference: (input) => this.structEngine.hasStructReference(input),
            resolveStructLabel: (input) => this.structEngine.resolveStructLabel(input),
            tryResolveLabel: (input, requireStatic) => {
                const loopValue = this.activeLoopVariables.get(input.trim());
                if (loopValue !== undefined)
                    return loopValue;
                return this.symbolScope.tryGetLabelValue(input, requireStatic);
            },
            resolveLabel: (input, requireStatic) => {
                const loopValue = this.activeLoopVariables.get(input.trim());
                if (loopValue !== undefined)
                    return loopValue;
                return this.symbolScope.getLabelValue(input, requireStatic);
            },
            evaluateMath: (input) => this.mathCore.math(input),
            shouldDeferExpressionEvaluation: () => !this.getActiveStageCapabilities().enforceResolvedLabels,
            getCurrentAddress: () => this.currentTargetAddress,
            requireStaticLabelLookup: () => this.requireStaticLabelLookup,
        });
        const encoderContext = {
            emission: {
                write1: (value) => this.write1(value),
                write2: (value) => this.write2(value),
                write3: (value) => this.write3(value),
                writeByte: (value) => this.write1(value),
                writeBytes: (values) => this.outputWriter.writeBytes(values),
                writeValue: (value, width, endianness) => this.outputWriter.writeValue(value, width, endianness),
            },
            sizing: {
                getCurrentAddress: () => this.currentTargetAddress,
            },
            branches: {
                enforceResolvedLabels: () => this.enforceResolvedLabels,
                findNextLabel: (label, referenceAddress) => this.symbolScope.findNextLabel(label, referenceAddress),
                findPreviousLabel: (label, referenceAddress) => this.symbolScope.findPreviousLabel(label, referenceAddress),
            },
            diagnostics: {
                error: (message) => new Error(`${message} (${this.currentFile}:${this.currentLine + 1})`),
            },
        };
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
            if (!contribution.createEncoder) {
                throw new PluginError(`Architecture contribution '${contributionId}' does not provide an encoder.`, {
                    code: "PLUGIN_TARGET_INVALID",
                    targetId,
                    contributionId,
                });
            }
            let encoder;
            try {
                const architectureOperands = {
                    expandOperand: (operand) => this.operandResolver.expandOperand(operand),
                    getnum: (expression) => this.operandResolver.getnum(expression),
                    getCurrentAddress: () => this.operandResolver.getCurrentAddress(),
                    lowerOperand: (operand) => contribution.classifyOperand({ operands: this.operandResolver }, operand),
                };
                encoder = contribution.createEncoder({
                    ...encoderContext,
                    operands: architectureOperands,
                    targetId,
                    options: this.targetOptions,
                    state: this.pluginState,
                });
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
                instructions: contribution.instructions.length > 0 ? contribution.instructions : undefined,
                classifyOperand: (resolver, operand) => contribution.classifyOperand({ operands: resolver }, operand),
                splitOperands: contribution.splitOperands,
                unknownInstructionBehavior: contribution.unknownInstructionBehavior,
            }, [...(contribution.aliases ?? [])]);
        }
        this.directiveRegistry = measureInternalPhase("directiveRegistryClone", () => this.cloneDirectiveRegistryForSession(this));
        this.commandLoweringService = new CommandLoweringService(this);
        this.services.frontEnd = this.frontEndService;
        this.services.lowering = this.commandLoweringService;
        this.activeLifecycles = this.environment.getTargetLifecycles(targetId).map((record) => {
            try {
                return { record, instance: record.value.create(targetFactoryContext) };
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
        measureInternalPhase("onSessionCreated", () => this.runLifecycleHook("onSessionCreated", (lifecycle) => lifecycle.onSessionCreated?.({ state: this.pluginState, session: this })));
        this.selectArchitecture(this.arch, this.arch);
        measureInternalPhase("constructorActivateStage", () => this.activateStage("collectDefinitions"));
        incrementInternalCounter("assemblerConstructions");
    }
    runLifecycleHook(hookName, invoke) {
        for (const { record, instance } of this.activeLifecycles) {
            try {
                invoke(instance);
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
    runBeforeDirective(keyword, words, raw) {
        let result = "continue";
        this.runLifecycleHook("beforeDirective", (lifecycle) => {
            if (result === "continue" &&
                lifecycle.beforeDirective?.({
                    state: this.pluginState,
                    session: this,
                    keyword,
                    words,
                    raw,
                }) === "handled") {
                result = "handled";
            }
        });
        return result;
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
                session: this,
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
            session: this,
            previousArchitecture,
            architecture: resolved,
            sourceAlias,
        }));
    }
    beforeWrite(logicalAddress, width) {
        this.pluginAddressSpace.validateWrite?.(logicalAddress, width);
        this.runLifecycleHook("beforeWrite", (lifecycle) => lifecycle.beforeWrite?.({
            state: this.pluginState,
            session: this,
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
        if (!this.collectSourceMetadata)
            return;
        const command = this.traceCommandStack.at(-1);
        const target = this.environment.getTarget(this.targetId);
        this.addressToLineMapping.includeByte(command?.file ?? this.currentFile, (command?.line ?? this.currentLine) + 1, this.arch, target?.addressSpace ?? "target.logical", logicalAddress, outputOffset);
    }
    dispose() {
        if (this.sessionDisposed)
            return;
        this.sessionDisposed = true;
        const errors = [];
        for (const { record, instance } of [...this.activeLifecycles].reverse()) {
            try {
                instance.onSessionDispose?.({ state: this.pluginState, session: this });
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
        if (errors.length > 0) {
            throw new AggregateError(errors, "One or more assembler session resources failed to dispose.");
        }
    }
    /**
     * Reads little endian.
     * @param {Uint8Array} bytes The bytes.
     * @param {number} pos The pos.
     * @param {number} width The width.
     * @returns {number | undefined} The result.
     */
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
     * Checks whether it can read byte range.
     * @param {number} sourceLength The source length.
     * @param {number} position The position.
     * @param {number} size The size.
     * @returns {number} The result.
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
     * Reads byte range.
     * @param {Uint8Array} source The source.
     * @param {number} position The position.
     * @param {number} size The size.
     * @param {number | undefined} defaultValue The default value.
     * @param {string} errorMessage The error message.
     * @returns {number} The result.
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
    /**
     * Resolves readable path.
     * @param {string} filename The filename.
     * @returns {string | undefined} The result.
     */
    resolveReadablePath(filename) {
        return this.fileProvider.resolvePath(filename, {
            currentFile: this.currentFile,
            includePaths: this.includePaths,
            macroSourceFile: this.currentMacroSourceFile,
        });
    }
    /**
     * Resolves expression host label.
     * @param {string} identifier The identifier.
     * @returns {number | string} The result.
     */
    resolveExpressionHostLabel(identifier) {
        const trimmed = identifier.trim();
        const loopValue = this.activeLoopVariables.get(trimmed);
        if (loopValue !== undefined)
            return loopValue;
        if (parseUnnamedLabelReference(trimmed)) {
            return this.symbolScope.getLabelValue(trimmed, this.requireStaticLabelLookup);
        }
        const parsed = parseExpressionNode(trimmed);
        if (isReferenceExpressionNode(parsed)) {
            return this.resolveReferenceLabelValue(parsed, this.requireStaticLabelLookup);
        }
        return this.symbolScope.getLabelValue(identifier, this.requireStaticLabelLookup);
    }
    /**
     * Gets expression object size.
     * @param {string} identifier The identifier.
     * @param {boolean} [baseOnly] Whether to return only the base object size.
     * @returns {number} The result.
     */
    getExpressionObjectSize(identifier, baseOnly = false) {
        if (baseOnly && (identifier === "..." || identifier === "…")) {
            if (this.inMacroExpansion && this.currentVariadicCount !== undefined) {
                return this.currentVariadicCount;
            }
            if (this.inMacroDefinition) {
                return 0;
            }
            return 0;
        }
        return this.symbolScope.getObjectSize(identifier, baseOnly);
    }
    /**
     * Looks up define value.
     * @param {string} varName The var name.
     * @returns {string | undefined} The result.
     */
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
    /**
     * Checks whether it can read the base image.
     * @param {number} position The position.
     * @param {number} size The size.
     * @returns {number} The result.
     */
    canReadBaseImage(position, size) {
        const sourceLength = this.baseImage && this.baseImage.length > 0 ? this.baseImage.length : this.outputBytes.length;
        return this.canReadByteRange(sourceLength, position, size);
    }
    /**
     * Reads the base image.
     * @param {number} position The position.
     * @param {number} size The size.
     * @param {number} [defaultValue] The default value.
     * @returns {number} The result.
     */
    readBaseImage(position, size, defaultValue) {
        const pos = Math.trunc(position);
        const pcPos = this.outputWriter.toOutputOffset(pos);
        const source = this.baseImage && this.baseImage.length > 0 ? this.baseImage : this.outputBytes;
        if (pcPos < 0) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new Error(`read${Math.trunc(size)} out of bounds at ${pos}`);
        }
        const sourceBytes = Uint8Array.from(source);
        return this.readByteRange(sourceBytes, pcPos, size, defaultValue, `read${Math.trunc(size)} out of bounds at ${pos}`);
    }
    /**
     * Checks whether it can read expression file.
     * @param {string} filename The filename.
     * @param {number} position The position.
     * @param {number} size The size.
     * @returns {number} The result.
     */
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
    /**
     * Reads expression file.
     * @param {string} filename The filename.
     * @param {number} position The position.
     * @param {number} size The size.
     * @param {number} [defaultValue] The default value.
     * @returns {number} The result.
     */
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
            if (!set)
                continue;
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
        resolveLabel: (identifier) => this.resolveExpressionHostLabel(identifier),
        convertLogicalToOutputOffset: (address) => this.outputWriter.toOutputOffset(address),
        convertOutputOffsetToLogical: (offset) => this.outputWriter.fromOutputOffset(offset),
        getCurrentAddress: () => this.currentTargetAddress,
        getCurrentBaseAddress: () => this.currentTargetBaseAddress,
        isDefined: (identifier) => {
            if (this.defines.has(identifier))
                return 1;
            if (this.structs.has(identifier))
                return 1;
            return this.symbolScope.hasLabelInScope(identifier) ? 1 : 0;
        },
        getExpressionObjectSize: (identifier, baseOnly) => this.getExpressionObjectSize(identifier, baseOnly),
        getExpressionStructMetadata: (identifier, property) => {
            const definition = this.structs.get(identifier);
            if (!definition)
                throw new Error(`Unknown struct '${identifier}' for ${property}().`);
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
        for (let i = 0; i < length; i++) {
            this.outputBytes[start + i] = value & 0xff;
        }
    }
    /**
     * Creates ephemeral stage execution state.
     * @param {AssemblyStageName} stage The stage.
     * @returns {StageExecutionState} The result.
     */
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
    /**
     * Gets active stage capabilities.
     * @returns {StageExecutionCapabilities} The result.
     */
    getActiveStageCapabilities() {
        if (!this.activeStageExecutionState) {
            this.activeStageExecutionState =
                this.createEphemeralStageExecutionState("collectDefinitions");
        }
        return this.activeStageExecutionState.capabilities;
    }
    get traceStage() {
        return this.activeStageExecutionState?.stage ?? "collectDefinitions";
    }
    /**
     * Lays out instruction.
     * @param {string[] | LoweredInstruction} input The input.
     * @returns {boolean} The result.
     */
    layoutInstruction(input) {
        const words = Array.isArray(input) ? input : input.words;
        if (words.length === 0) {
            return true;
        }
        const architecture = this.resolveActiveArchitecture();
        if (!architecture.definition) {
            return true;
        }
        const size = Array.isArray(input)
            ? architecture.definition.encoder.estimateSize(words)
            : (architecture.definition.encoder.estimateInstruction?.(input) ??
                architecture.definition.encoder.estimateSize(words));
        this.step(size);
        return true;
    }
    /**
     * Emits instruction.
     * @param {string[] | LoweredInstruction} input The input.
     * @returns {boolean} The result.
     */
    emitInstruction(input) {
        const words = Array.isArray(input) ? input : input.words;
        if (words.length === 0) {
            return true;
        }
        const architecture = this.resolveActiveArchitecture();
        if (!architecture.definition) {
            return true;
        }
        const encoded = Array.isArray(input)
            ? architecture.definition.encoder.encode(words)
            : (architecture.definition.encoder.encodeInstruction?.(input) ??
                architecture.definition.encoder.encode(words));
        if (!encoded) {
            if (architecture.definition.unknownInstructionBehavior === "returnFalse") {
                return false;
            }
            throw new Error(`Unknown instruction: ${words[0]}`);
        }
        return true;
    }
    /**
     * Picks the appropriate instruction handler based on architecture.
     * @param {string[] | LoweredInstruction} input The instruction to pick.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    asblock_pick(input) {
        const words = Array.isArray(input) ? input : input.words;
        const raw = Array.isArray(input) ? words.join(" ") : input.sourceRaw;
        if (!this.inMacroDefinition && this.tryHandleCharacterMapping(raw)) {
            return true;
        }
        const keyword = words[0]?.toLowerCase() ?? "";
        if (keyword !== "" && this.directiveRegistry.has(keyword)) {
            return this.directiveRegistry.dispatch(keyword, words, words.join(" "));
        }
        const instructionExecutionMode = this.getActiveStageCapabilities().instructionMode;
        if (instructionExecutionMode === "layout") {
            return this.layoutInstruction(input);
        }
        return this.emitInstruction(input);
    }
    /**
     * Resolves active architecture.
     * @returns {{ name: string; definition?: ArchitectureDefinition }} The result.
     */
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
     * Classifies operand for active architecture.
     * @param {string} operand The operand.
     * @returns {LoweredOperand} The classified operand.
     */
    classifyOperandForActiveArchitecture(operand) {
        const architecture = this.resolveActiveArchitecture();
        if (!architecture.definition) {
            return this.operandResolver.lowerOperand(operand);
        }
        return architecture.definition.classifyOperand(this.operandResolver, operand);
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
    /**
     * Reads 2.
     * @param {number} logicalPosition The logical address.
     * @returns {number} The result.
     */
    read2(logicalPosition) {
        const addr = this.outputWriter.toOutputOffset(logicalPosition);
        if (addr < 0 || addr + 2 > this.outputBytes.length) {
            return -1;
        }
        return this.outputBytes[addr] | (this.outputBytes[addr + 1] << 8);
    }
    /**
     * Reads 3.
     * @param {number} logicalPosition The logical address.
     * @returns {number} The result.
     */
    read3(logicalPosition) {
        const addr = this.outputWriter.toOutputOffset(logicalPosition);
        if (addr < 0 || addr + 3 > this.outputBytes.length) {
            return -1;
        }
        return (this.outputBytes[addr] |
            (this.outputBytes[addr + 1] << 8) |
            (this.outputBytes[addr + 2] << 16));
    }
    /**
     * Rewrites raw command.
     * @param {string} command The command.
     * @returns {string} The result.
     */
    rewriteRawCommand(command) {
        return this.macroEngine.rewriteMacroLabelReferences(command);
    }
    /**
     * Creates normalized command from raw.
     * @param {string} command The command.
     * @param {string} sourceFile The source file.
     * @param {number} sourceLine The source line.
     * @param {boolean} [allowEmpty] The allow empty.
     * @returns {NormalizedCommand | null} The result.
     */
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
        const trimmed = command.trim();
        const singleQuoted = /^'([\S\s])'\s*=\s*(.+)$/.exec(trimmed);
        const doubleQuoted = /^"([\S\s])"\s*=\s*(.+)$/.exec(trimmed);
        const match = singleQuoted ?? doubleQuoted;
        if (!match) {
            return false;
        }
        const quote = singleQuoted ? "'" : '"';
        this.directiveRuntime.handleCharacterMapping([
            `${quote}${match[1]}${quote}`,
            "=",
            match[2].trim(),
        ]);
        return true;
    }
    /**
     * Preprocesses normalized command.
     * @param {NormalizedCommand} state The state.
     * @returns {CommandPreprocessResult} The result.
     */
    preprocessNormalizedCommand(state) {
        // Table rows are data, not static label assignments or macro definitions.
        // Rewriting before dispatch keeps normal diagnostics, references and traces.
        if (this.structEngine.data.inTable && !this.inMacroDefinition) {
            this.structEngine.data.prepareRow(state);
            return "continue";
        }
        // Asar `'X' = $nn` inside a macro is body text, not a define-time side effect.
        // Applying it here would leak the last font table into later
        // identity `db` data and leave invoke as `cleartable` only.
        if (!this.inMacroDefinition && this.tryHandleCharacterMapping(state.command)) {
            setCommandKind(state, "characterMapping");
            return "handled";
        }
        if (!this.inMacroDefinition &&
            state.words.length === 3 &&
            state.words[1] === "=" &&
            (state.words[0].startsWith("'") || state.words[0].startsWith('"'))) {
            setCommandKind(state, "characterMapping");
            this.directiveRuntime.handleCharacterMapping(state.words);
            return "handled";
        }
        if (this.frontEndCommandService.startFunctionDefinition(state)) {
            return "handled";
        }
        if (this.macroEngine.handleDefinitionCommand(state)) {
            return "handled";
        }
        if (this.defineEngine.handleCommand(state)) {
            if (state.command.includes("=")) {
                this.cursorAddress.recordCurrentAddress();
            }
            return "handled";
        }
        if (this.structEngine.handleStructMode(state)) {
            return "handled";
        }
        if (this.frontEndCommandService.handleRelativeLabelDefinition(state)) {
            return "handled";
        }
        if (this.frontEndCommandService.handleGlobalLabel(state)) {
            return "handled";
        }
        if (this.frontEndCommandService.consumeNamedLabelDefinitions(state)) {
            return "handled";
        }
        // This pass must happen after label consumption to preserve macro invoke behavior.
        if (this.macroEngine.handleDefinitionCommand(state)) {
            return "handled";
        }
        if (this.frontEndCommandService.handleStaticLabelAssignment(state)) {
            return "handled";
        }
        return "continue";
    }
    /**
     * Prepares normalized command for dispatch.
     * @param {NormalizedCommand} state The state.
     * @returns {boolean} The result.
     */
    prepareNormalizedCommandForDispatch(state) {
        if (state.kind === "unknown") {
            setCommandWords(state, state.words, state.command);
            setCommandKind(state, "opcodeCandidate");
        }
        return true;
    }
    /**
     * Processes a command from an internal re-entrant source.
     * @param {string} command - The command to process.
     * @param {boolean} [preprocessed] Whether comments and continuations were already normalized.
     */
    processCommand(command, preprocessed = false) {
        if (command.trim() === "") {
            return;
        }
        command = this.rewriteRawCommand(command);
        if (this.frontEndCommandService.continueFunctionDefinition(command)) {
            return;
        }
        // Macro bodies were normalized when their containing program was parsed.
        // Preserve inline separators while skipping another block/comment scan.
        if (preprocessed) {
            if (!command.includes(":")) {
                const nodes = this.programModelBuilder.consumeIncrementalCommand(this.incrementalProgramParseState, command.trim(), this.currentFile, this.currentLine);
                this.lowerAndExecuteRuntimeNodes(nodes);
                this.flushCompletedIncrementalNodes();
                return;
            }
            const splitCommands = this.frontEndService.splitInlineCommands([command]);
            for (const splitCommand of splitCommands) {
                const nodes = this.programModelBuilder.consumeIncrementalCommand(this.incrementalProgramParseState, splitCommand.trim(), this.currentFile, this.currentLine);
                this.lowerAndExecuteRuntimeNodes(nodes);
            }
        }
        else {
            const sourceFile = this.currentFile;
            const sourceLine = this.currentLine;
            const processedCommands = this.frontEndService.preprocessSourcedBlockCommands(command);
            const splitCommands = this.frontEndService.splitSourcedInlineCommands(processedCommands);
            for (const splitCommand of splitCommands) {
                const nodes = this.programModelBuilder.consumeIncrementalCommand(this.incrementalProgramParseState, splitCommand.text.trim(), sourceFile, sourceLine + splitCommand.line);
                this.lowerAndExecuteRuntimeNodes(nodes);
            }
        }
        this.flushCompletedIncrementalNodes();
    }
    /**
     * Processes normalized command.
     * @param {NormalizedCommand} state The state.
     * @param {boolean} [rewriteRaw] The rewrite raw.
     */
    processNormalizedCommand(state, rewriteRaw = true) {
        // Treat incoming commands as immutable execution inputs. Downstream pipeline
        // stages still mutate `kind/words`, so run them against a per-dispatch clone
        // instead of mutating cached pass-program nodes.
        let workingState = cloneNormalizedCommand(state);
        this.currentFile = workingState.source.file;
        this.currentLine = workingState.source.line;
        // Preserve legacy fixture bootstrap behavior in tree/normalized execution:
        // `;`+ means "seed assembler output with base-image bytes" before reads/writes.
        if (workingState.source.raw.trim().startsWith(";`+")) {
            this.seedOutputFromBaseImage();
            return;
        }
        if (workingState.command.trim() === "") {
            return;
        }
        if (this.frontEndCommandService.continueFunctionDefinition(workingState.command)) {
            return;
        }
        if (rewriteRaw) {
            const rewrittenRaw = this.rewriteRawCommand(workingState.source.raw);
            const requiresVariadicResolution = this.inMacroExpansion &&
                !this.isDefinitionCollectionStage &&
                (rewrittenRaw.includes("...") || rewrittenRaw.includes("…"));
            if (rewrittenRaw !== workingState.source.raw || requiresVariadicResolution) {
                incrementInternalCounter("actualReparses");
                const rewrittenState = this.createNormalizedCommandFromRaw(rewrittenRaw, workingState.source.file, workingState.source.line, true);
                if (!rewrittenState) {
                    return;
                }
                workingState = rewrittenState;
            }
        }
        // Macro invocations are consumed in preprocess and never reach the
        // post-dispatch reference collector. Record them first so rename / find
        // references can see `%greet()` as a use of `greet`.
        if (this.collectSourceMetadata &&
            !this.inMacroDefinition &&
            workingState.parsed.macroInvocation?.name) {
            this.collectCommandReferences(workingState);
        }
        const preprocessResult = this.preprocessNormalizedCommand(workingState);
        if (preprocessResult === "handled") {
            return;
        }
        // Capture the starting PC (before processing this command)
        const startPC = normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth);
        if (!this.prepareNormalizedCommandForDispatch(workingState)) {
            return;
        }
        if (this.collectSourceMetadata) {
            this.collectCommandReferences(workingState);
        }
        const traceListener = this.traceListener;
        const traceContext = {
            file: workingState.source.file,
            line: workingState.source.line,
            raw: workingState.source.raw,
            normalized: workingState.command,
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
            const lowered = this.commandLoweringService.lowerCommand(workingState);
            this.dispatchLoweredNode(lowered);
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
    /**
     * Gets or create lowered program.
     * @param {StageExecutionState} stageState The stage state.
     * @param {ProgramModel} program The program.
     * @returns {LoweredProgram} The result.
     */
    getOrCreateLoweredProgram(stageState, program) {
        if (!stageState.loweredProgram) {
            stageState.loweredProgram = measureInternalPhase("lowerProgram", () => this.commandLoweringService.lowerProgram(program));
        }
        return stageState.loweredProgram;
    }
    /**
     * Dispatches lowered node.
     * @param {LoweredCommand} lowered The lowered.
     */
    dispatchLoweredNode(lowered) {
        if (lowered.kind === "directive") {
            const loweredCommand = lowered.command;
            this.directiveRegistry.dispatch(lowered.keyword, lowered.words, lowered.source.raw, loweredCommand);
            return;
        }
        let instruction = lowered;
        if (lowered.command) {
            const refreshed = this.commandLoweringService.lowerCommand(lowered.command);
            if (refreshed.kind === "instruction") {
                instruction = refreshed;
            }
        }
        this.asblock_pick(instruction);
    }
    /**
     * Parses a function definition of the form:
     *   function name(param1, param2...) = expression
     * Possibly spanning multiple lines joined by backslashes.
     * @param {string} defLine - The function definition line.
     */
    parseFunctionDefinition(defLine) {
        // Set the string to parse in mathCore
        this.mathCore.str = defLine;
        // Call the parseFunctionDefinition method without arguments
        this.mathCore.parseFunctionDefinition();
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
        // Try evaluating the expression numerically.
        try {
            const result = this.mathCore.math(resolvedExpr);
            // Range bounds such as `(000 * 32)` legitimately evaluate to zero, so
            // treat any numeric result as valid instead of falling through to label
            // lookup on falsy `0`.
            if (!Number.isNaN(result)) {
                return result;
            }
        }
        catch (error) { }
        // If that fails, assume it's a static label.
        // (Pass 'true' to require that the label be static.)
        return this.symbolScope.getLabelValue(renderExpressionNode(resolvedExpr), true);
    }
    /**
     * Sets the paths to search for included files.
     * @param {string[]} paths The paths to search for included files.
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
            throw new Error(`Error evaluating expression "${originalExpr}" (resolved to "${resolvedText}"): ${e instanceof Error ? e.message : JSON.stringify(e)}`);
        }
        // In our assembler, a condition is true if the result is nonzero.
        return result !== 0;
    }
    /**
     * Parses string input into an expression node and resolves nested references/defines.
     * @param {string | ExpressionNode} expression The expression source or parsed node.
     * @returns {ExpressionNode} The resolved expression tree.
     */
    resolveExpressionInput(expression) {
        const parsed = typeof expression === "string" ? parseExpressionNode(expression.trim()) : expression;
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
            case "raw":
                if (/(^|[^!<=>])![\w{]/.test(expression.value)) {
                    return this.resolveExpressionInput(this.resolvedefines(expression.value));
                }
                return expression;
            default:
                return expression;
        }
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
                return this.resolveExpressionInput(value);
            }
            case "member": {
                const object = this.resolveReferenceExpressionNode(expression.object);
                if (!isReferenceExpressionNode(object)) {
                    const expandedReference = this.tryResolveExpandedReferenceExpression(expression);
                    if (expandedReference) {
                        return expandedReference;
                    }
                    return {
                        type: "raw",
                        value: `${renderExpressionNode(object)}.${expression.property.name}`,
                    };
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
                    const expandedReference = this.tryResolveExpandedReferenceExpression(expression);
                    if (expandedReference) {
                        return expandedReference;
                    }
                    return {
                        type: "raw",
                        value: `${renderExpressionNode(object)}[${renderExpressionNode(index)}]`,
                    };
                }
                return {
                    ...expression,
                    object,
                    index,
                };
            }
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
        return this.resolveNormalizedReferenceLabelValue(this.renderResolvedReferenceExpression(resolved), requireStatic);
    }
    /**
     * Resolves an already-normalized reference string as either a struct member/base
     * or a plain label lookup.
     * @param {string} normalizedReference The normalized reference text.
     * @param {boolean} [requireStatic] Whether labels must be static.
     * @returns {number} The resolved numeric address/value.
     */
    resolveNormalizedReferenceLabelValue(normalizedReference, requireStatic = false) {
        // Dotted and indexed references may name either a struct member or a plain
        // label. Try the struct path first, then fall back to standard label lookup.
        if (this.structEngine.hasStructReference(normalizedReference)) {
            return this.structEngine.resolveStructLabel(normalizedReference);
        }
        return this.symbolScope.getLabelValue(normalizedReference, requireStatic);
    }
    /**
     * Renders an index expression for a normalized reference string.
     * @param {ExpressionNode} indexExpression The index expression to render.
     * @returns {string} The rendered numeric or source-like index text.
     */
    resolveReferenceIndexText(indexExpression) {
        const resolvedIndex = this.resolveExpressionNode(indexExpression);
        try {
            return this.mathCore.math(resolvedIndex).toString();
        }
        catch {
            return renderExpressionNode(resolvedIndex);
        }
    }
    /**
     * Renders a reference expression after resolving any nested index expressions.
     * @param {ReferenceExpressionNode} expression The reference expression to render.
     * @returns {string} The normalized reference text.
     */
    renderResolvedReferenceExpression(expression) {
        return renderReferenceExpressionNode(expression, {
            renderIndex: (indexExpression) => this.resolveReferenceIndexText(indexExpression),
        });
    }
    /**
     * Re-runs `resolvedefines()` across a rendered reference expression and reparses
     * it only when define expansion materially changes the text.
     * @param {ReferenceExpressionNode} expression The reference expression to expand.
     * @returns {ExpressionNode | undefined} The reparsed expression, if expansion changed it.
     */
    tryResolveExpandedReferenceExpression(expression) {
        const renderedReference = this.renderResolvedReferenceExpression(expression);
        const expandedReference = this.resolvedefines(renderedReference);
        if (expandedReference === renderedReference) {
            return undefined;
        }
        return this.resolveExpressionInput(expandedReference);
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
        if (!input) {
            return "";
        }
        let result = "";
        let index = 0;
        const resolvedRelativeLabel = this.tryResolveRelativeLabelToken(input);
        if (resolvedRelativeLabel !== undefined) {
            return resolvedRelativeLabel;
        }
        // Special case for expressions with != operator
        // This prevents issues with != being misinterpreted as a define
        if (input.includes("!=")) {
            // Process each part of the expression separately
            const parts = input.split("!=");
            const resolvedParts = parts.map((part) => this.resolvedefines(part.trim()));
            return resolvedParts.join("!=");
        }
        if ((input.startsWith("sizeof(") || input.startsWith("objectsize(")) && input.endsWith(")")) {
            return input;
        }
        const resolvedDirectDefine = this.tryResolveDirectDefineReference(input);
        if (resolvedDirectDefine !== undefined) {
            return resolvedDirectDefine;
        }
        const resolvedMacroLabel = this.tryResolveMacroLabelReference(input);
        if (resolvedMacroLabel !== undefined) {
            return resolvedMacroLabel;
        }
        const resolvedBareLabel = this.tryResolveBareLabelReference(input);
        if (resolvedBareLabel !== undefined) {
            return resolvedBareLabel;
        }
        // Process any explicit !defines
        while (index < input.length) {
            const char = input[index];
            if (char === "\\" && input[index + 1] === "\\") {
                result += "\\";
                index += 2;
            }
            else if (char === "\\" && input[index + 1] === "!") {
                result += "!";
                index += 2;
            }
            else if (char === "!") {
                let defineName = "";
                index++; // skip the !
                if (input[index] === "{") {
                    index++;
                    let unprocessedName = "";
                    let braces = 1;
                    while (index < input.length) {
                        if (input[index] === "{")
                            braces++;
                        if (input[index] === "}")
                            braces--;
                        if (braces === 0)
                            break;
                        unprocessedName += input[index++];
                    }
                    if (braces !== 0)
                        throw new Error("Error: Mismatched braces in define name.");
                    index++; // skip the closing }
                    defineName = this.resolvedefines(unprocessedName);
                }
                else {
                    // Handle regular define (no braces)
                    while (index < input.length && /\w/.test(input[index])) {
                        defineName += input[index++];
                    }
                }
                // `!$00` / `!(1+2)` are bitwise NOT for mathcore, not `Define ''`.
                if (defineName === "") {
                    result += "!";
                    continue;
                }
                // Look up the variable using our helper function
                const value = this.lookupDefineValue(defineName);
                if (value === undefined) {
                    throw new Error(`Define '${defineName}' not found.`);
                }
                else {
                    result += value;
                }
            }
            else {
                result += char;
                index++;
            }
        }
        return result;
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
        for (const definition of this.architectureRegistry.definitions.values()) {
            definition.encoder.beginPass?.();
        }
        this.pluginState.resetForStage(stage);
        this.runLifecycleHook("onStageStart", (lifecycle) => lifecycle.onStageStart?.({ state: this.pluginState, session: this, stage }));
    }
    /**
     * Completes the current pass, performing any necessary cleanup.
     */
    finishPass() {
        this.structEngine.data.finish();
        if (/^(?:datastruct\b|\[)/i.test(this.frontEndService.commandBuffer.trimStart())) {
            throw new Error("Unclosed dataStruct initializer at end of source.");
        }
        const stage = this.activeStageExecutionState?.stage ?? "collectDefinitions";
        this.runLifecycleHook("onStageEnd", (lifecycle) => lifecycle.onStageEnd?.({ state: this.pluginState, session: this, stage }));
        if (this.getActiveStageCapabilities().canFinalize) {
            this.runLifecycleHook("beforeOutputFinalize", (lifecycle) => lifecycle.beforeOutputFinalize?.({
                state: this.pluginState,
                session: this,
                outputBytes: this.outputBytes,
            }));
        }
        this.outputWriter.finishPass();
        if (this.getActiveStageCapabilities().canFinalize) {
            this.includeSource.endAssemblySnapshot();
            this.mathCore.endAssemblySnapshot();
            this.passProgramCache.clear();
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
    /**
     * Gets stage descriptor.
     * @param {AssemblyStageName} stage The stage.
     * @returns {Pick<StageExecutionState, "stage" | "capabilities">} The result.
     */
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
    /**
     * Clones relative labels.
     * @param {{ [depth: number]: { addr: number; macroInstance?: number }[] }} source The source.
     * @returns {{ [depth: number]: { addr: number; macroInstance?: number }[]; }} The result.
     */
    cloneRelativeLabels(source) {
        const clone = {};
        for (const [depth, entries] of Object.entries(source)) {
            clone[Number(depth)] = entries.map((entry) => ({ ...entry }));
        }
        return clone;
    }
    /**
     * Creates stage execution state.
     * @param {AssemblyStageName} stage The stage.
     * @returns {StageExecutionState} The result.
     */
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
    /**
     * Gets or create stage execution state.
     * @param {AssemblyStageName} stage The stage.
     * @returns {StageExecutionState} The result.
     */
    getOrCreateStageExecutionState(stage) {
        const existing = this.stageExecutionStates.get(stage);
        if (existing) {
            return existing;
        }
        const created = this.createStageExecutionState(stage);
        this.stageExecutionStates.set(stage, created);
        return created;
    }
    /**
     * Builds program model.
     * @param {string} source The source.
     * @param {string} [sourceFile] The source file.
     * @param {number} [startLine] The start line.
     * @returns {ProgramModel} The result.
     */
    buildProgramModel(source, sourceFile = this.currentFile, startLine = 0) {
        return measureInternalPhase("buildProgramModel", () => {
            const program = this.programModelBuilder.buildProgramModel(source, sourceFile, startLine);
            return {
                sourceFile: program.sourceFile,
                startLine: program.startLine,
                nodes: program.nodes,
            };
        });
    }
    /**
     * Runs stage.
     * @param {AssemblyStageName} stage The stage.
     * @param {ProgramModel} program The program.
     * @returns {StageExecutionState} The result.
     */
    runStage(stage, program) {
        return measureInternalPhase(stage, () => {
            if (stage === "collectDefinitions") {
                this.includeSource.beginAssemblySnapshot();
                this.mathCore.beginAssemblySnapshot();
                this.stageExecutionStates.clear();
                this.activeStageExecutionState = null;
            }
            const stageState = this.getOrCreateStageExecutionState(stage);
            this.activeStageExecutionState = stageState;
            this.applyStageExecutionState(stageState);
            this.setCurrentFile(program.sourceFile);
            this.activateStage(stage);
            const loweredProgram = this.getOrCreateLoweredProgram(stageState, program);
            measureInternalPhase("executeProgram", () => this.executeLoweredNodeStream(loweredProgram.nodes));
            measureInternalPhase("finishPass", () => this.finishPass());
            this.captureStageExecutionState(stageState);
            return stageState;
        });
    }
    /**
     * Handles assemble program.
     * @param {ProgramModel} program The program.
     */
    assembleProgram(program) {
        this.runStage("collectDefinitions", program);
        this.runStage("resolveLayout", program);
        this.runStage("emitProgram", program);
    }
    /**
     * Handles assemble source.
     * @param {string} source The source.
     * @param {string} [sourceFile] The source file.
     * @param {number} [startLine] The start line.
     * @returns {ProgramModel} The result.
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
        for (let i = 0; i < length; i++) {
            this.outputBytes[start + i] = value & 0xff;
        }
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
     * Returns the compiled binary output.
     * @returns {Uint8Array} The compiled binary output.
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
        const previousRewrite = this.runtimePassthroughRewriteEnabled;
        this.runtimePassthroughRewriteEnabled = true;
        try {
            const loweredNodes = nodes.map((node) => this.commandLoweringService.lowerExecutableNode(node));
            for (const node of loweredNodes) {
                this.executeWithAnalysisRecovery(node, (currentNode) => this.getLoweredNodeSpan(currentNode), (currentNode) => this.executeLoweredNode(currentNode));
            }
        }
        finally {
            this.runtimePassthroughRewriteEnabled = previousRewrite;
        }
    }
    /**
     * Resolves for loop bounds.
     * @param {LoweredLoopNode} forBlock The for block.
     * @returns {{ variable?: string; start?: number; end?: number; }} The result.
     */
    resolveForLoopBounds(forBlock) {
        const parsedForLoop = forBlock.header?.parsed.forLoop;
        const variable = forBlock.variable ?? parsedForLoop?.variable;
        let start = forBlock.start;
        let end = forBlock.end;
        const startExpression = forBlock.startExpression ?? parsedForLoop?.start;
        const endExpression = forBlock.endExpression ?? parsedForLoop?.end;
        if (startExpression && endExpression) {
            const startExpr = renderExpressionNode(startExpression);
            const endExpr = renderExpressionNode(endExpression);
            const startDefinesResolved = /^-?\d+$/.test(startExpr)
                ? startExpr
                : this.resolvedefines(startExpr);
            const endDefinesResolved = /^-?\d+$/.test(endExpr) ? endExpr : this.resolvedefines(endExpr);
            start = this.operandResolver.getnum(startDefinesResolved);
            end = this.operandResolver.getnum(endDefinesResolved);
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
        else if (loopBlock.loopType === "while") {
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
        this.executeWhileLoopCommands(whileBlock, whileBlock.commands, (cmd) => cmd.kind === "command" && cmd.command.kind === "defineCommand"
            ? (getDefineVariable(cmd.command.command) ?? null)
            : null, (cmd) => this.executeLoweredNodeWithRecovery(cmd));
    }
    /**
     * Gets lowered node span.
     * @param {LoweredExecutableNode} node The node.
     * @returns {SourceSpan | undefined} The result.
     */
    getLoweredNodeSpan(node) {
        if (node.kind === "command") {
            return node.command.source.normalizedSpan;
        }
        if (node.kind === "directive") {
            return node.source.normalizedSpan;
        }
        if (node.kind === "loop" || node.kind === "conditional") {
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
        this.executeWithAnalysisRecovery(node, (currentNode) => this.getLoweredNodeSpan(currentNode), (currentNode) => this.executeLoweredNode(currentNode));
    }
    /**
     * Executes lowered node.
     * @param {LoweredExecutableNode} node The node.
     */
    executeLoweredNode(node) {
        const sourceCommand = node.kind === "loop" || node.kind === "conditional" ? node.header : node.command;
        if (sourceCommand) {
            this.currentFile = sourceCommand.source.file;
            this.currentLine = sourceCommand.source.line;
        }
        if (node.kind === "command") {
            incrementInternalCounter("passthroughDispatches");
            this.processNormalizedCommand(node.command, this.runtimePassthroughRewriteEnabled);
            return;
        }
        if (node.kind === "directive" || node.kind === "instruction") {
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