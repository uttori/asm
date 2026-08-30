import type { ExpressionHost, LoweredInstruction, LoweredOperand } from "./architecture-types.js";
import { AddressToLineMapping } from "./addressToLine.js";
import { type CoreDirectiveGroup } from "./directive-groups.js";
import type { AssemblerTraceCommandEvent, AssemblerTraceListener, AssemblerTraceWriteEvent } from "./debug-tracing.js";
import { type AssemblyAnalysisResult, type AssemblyDiagnostic, type AssemblyIncludeEdge, type AssemblySourceLocation, type AssemblySymbolDefinition, type AssemblySymbolKind, type AssemblySymbolReference, type AssemblySymbolReferenceKind } from "./diagnostics.js";
import type { ConditionalBranchNode, ExecutableNode, LoopNode } from "./ir/assembly-tree.js";
import { type ExpressionNode, type ReferenceExpressionNode } from "./ir/expression-node.js";
import { type NormalizedCommand } from "./ir/normalized-command.js";
import { MathCore } from "./mathcore.js";
import { OperandResolver } from "./operand-resolver.js";
import { ArchitectureRegistry, type ArchitectureDefinition } from "./architecture-registry.js";
import { DirectiveRegistry } from "./directives/registry.js";
import { DefineEngine } from "./services/define-engine.js";
import { DirectiveRuntimeService, type PushPcStackEntry } from "./services/directive-runtime-service.js";
import { AssemblyFrontEndService } from "./services/assembly-front-end-service.js";
import { CommandLoweringService, type LoweredCommand, type LoweredExecutableNode, type LoweredLoopNode, type LoweredProgram } from "./services/command-lowering-service.js";
import { FrontEndCommandService } from "./services/front-end-command-service.js";
import { IncludeSourceService, type IncludedFileInfo } from "./services/include-source-service.js";
import { MacroEngine, type MacroDefinition } from "./services/macro-engine.js";
import { ProgramModelBuilder, type IncrementalProgramParseState, type ProgramModel } from "./services/program-model-builder.js";
import { OutputWriterService } from "./services/output-writer-service.js";
import { StructEngine, type StructDefinition } from "./services/struct-engine.js";
import { SymbolScopeService, type LabelEntry } from "./services/symbol-scope-service.js";
import { type SyntaxProfile } from "./syntax-profile.js";
import type { SourceSpan } from "./source-location.js";
import { type AssemblyFileProvider } from "./file-provider.js";
import { type AssemblerEnvironment, type LifecycleContribution, type OwnedContribution, type SessionLifecycle, type TargetAddressSpace as PluginTargetAddressSpace, type TargetOutputFormat as PluginTargetOutputFormat, PluginSessionStateStore, type PluginStateSnapshot } from "./plugin/index.js";
import type { AssemblyStageName } from "./plugin/contracts.js";
type RuntimeConditionalNode = ConditionalBranchNode;
type RuntimeNode = NormalizedCommand | LoopNode | RuntimeConditionalNode;
type StageExecutionMode = "layout" | "emit";
type StageExecutionCapabilities = {
    instructionMode: StageExecutionMode;
    canEmitBytes: boolean;
    canFinalize: boolean;
    enforceResolvedLabels: boolean;
    isDefinitionCollectionStage: boolean;
};
type StageCursorState = {
    currentTargetAddress: number;
    currentTargetBaseAddress: number;
    currentTargetStartAddress: number;
    currentTargetBaseStartAddress: number;
    bytes: number;
};
type StageSymbolState = {
    labelTable: Map<string, LabelEntry>;
    forwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
            unit?: string;
        }[];
    };
    backwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
            unit?: string;
        }[];
    };
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    currentGlobalParentLabel: string;
    labelParents: Map<string, string | null>;
};
type StageControlState = {
    namespaceStack: string[];
    currentNamespace: string;
    namespaceNestingEnabled: boolean;
    namespaceNestingPath: string[];
    inMacroExpansion: boolean;
    macroLabelInstance: number;
};
type StageExecutionState = {
    stage: AssemblyStageName;
    capabilities: StageExecutionCapabilities;
    cursor: StageCursorState;
    symbols: StageSymbolState;
    control: StageControlState;
    pluginState: PluginStateSnapshot;
    loweredProgram: LoweredProgram | null;
};
type CommandPreprocessResult = "continue" | "handled";
type AssemblerServiceBag = {
    defineEngine: DefineEngine;
    directiveRuntime: DirectiveRuntimeService;
    fileProvider?: AssemblyFileProvider;
    frontEnd?: AssemblyFrontEndService;
    frontEndCommandService: FrontEndCommandService;
    includeSource: IncludeSourceService;
    lowering?: CommandLoweringService;
    macroEngine: MacroEngine;
    outputWriter: OutputWriterService;
    structEngine: StructEngine;
    symbolScope: SymbolScopeService;
};
type CursorAddressFacade = {
    recordCurrentAddress(): void;
    setWritePosition(address: number): void;
    syncWriteStarts(): void;
    incrementBytesWritten(num: number): void;
};
type TraceCommandContext = Pick<AssemblerTraceCommandEvent, "file" | "line" | "raw" | "normalized">;
type WhileTracker = {
    iswhile: boolean;
    startline: number;
    cond: boolean;
    is_for: boolean;
    for_variable?: string;
    /** Internal representation of the variable to avoid collisions */
    for_internal_variable?: string;
    for_start?: number;
    for_end?: number;
    for_cur?: number;
};
export type AssemblerOptions = {
    /** Frozen plugin environment shared by build and tooling sessions. */
    environment: AssemblerEnvironment;
    /** Target contribution ID or alias. */
    target: string;
    /** Optional architecture contribution ID or source alias. */
    architecture?: string;
    /** Optional target-specific configuration. */
    targetOptions?: unknown;
    /** Optional base image to seed output. */
    baseImage?: number[] | Uint8Array;
    /** The file provider to use for the assembler. */
    fileProvider?: AssemblyFileProvider;
    /** Whether to collect source metadata. */
    collectSourceMetadata?: boolean;
};
export type ProgramAnalysisOptions = {
    /** Assembly stages to run. Tooling defaults to definitions-only. */
    stages?: readonly AssemblyStageName[];
    /** When false, include directives record an edge without parsing the target. */
    followIncludes?: boolean;
};
type ActiveLifecycle = {
    record: OwnedContribution<LifecycleContribution>;
    instance: SessionLifecycle;
};
export declare class Assembler {
    #private;
    /** The current logical target address. */
    currentTargetAddress: number;
    /** The current logical target base address. */
    currentTargetBaseAddress: number;
    /** The current target start address. `startpos` */
    currentTargetStartAddress: number;
    /** The current target base start address. `realstartpos` */
    currentTargetBaseStartAddress: number;
    bytes: number;
    pushBaseStack: number[];
    /** Mutable bytes produced by this assembly session. */
    outputBytes: number[] | Uint8Array;
    /** Byte used when expanding a sparse output range. */
    outputFillByte: number;
    whileStatus: WhileTracker[];
    namespaceStack: string[];
    currentNamespace: string;
    namespaceNestingEnabled: boolean;
    namespaceNestingPath: string[];
    inMacroDefinition: boolean;
    currentMacroName: string;
    currentMacroParams: string[];
    currentMacroBody: NormalizedCommand[];
    currentVariadicCount: number | undefined;
    currentVariadicArgs: string[];
    macros: Map<string, MacroDefinition>;
    mathCore: MathCore;
    operandResolver: OperandResolver;
    addressToLineMapping: AddressToLineMapping;
    currentFile: string;
    currentLine: number;
    /** Optional sink for structured tracing used by tests and ad-hoc debug scripts. */
    traceListener: AssemblerTraceListener | null;
    /** Active command contexts so nested byte writes inherit the right source line. */
    traceCommandStack: TraceCommandContext[];
    defines: Map<string, string>;
    /** Bare numeric values exposed only while executing typed `for` loops. */
    private readonly activeLoopVariables;
    characterMappings: Map<string, number>;
    currentTable: string | null;
    tableStack: Map<string, number>[];
    inFunctionDefinition: boolean;
    functionDefinitionLines: string[];
    arch: string;
    pushpcStack: PushPcStackEntry[];
    pushpcnum: number;
    labelTable: Map<string, LabelEntry>;
    /** ca65 `.export` / `.import` names that stay session-global. */
    globalSymbols: Set<string>;
    /** Track multiple `+` labels */
    forwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
            unit?: string;
        }[];
    };
    /** Track multiple `-` labels */
    backwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
            unit?: string;
        }[];
    };
    padUnit: number;
    padbyte: number[];
    structs: Map<string, StructDefinition>;
    currentStruct: StructDefinition | null;
    savedPCStack: number[];
    /** Initialize fill pattern */
    fillbyte: number[];
    baseImage: Uint8Array;
    static crcTable: number[] | null;
    includedFiles: Map<string, IncludedFileInfo>;
    includeStack: string[];
    includePaths: string[];
    macroLabelInstance: number;
    inMacroExpansion: boolean;
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    currentGlobalParentLabel: string;
    labelParents: Map<string, string | null>;
    requireStaticLabelLookup: boolean;
    readonly passProgramCache: Map<string, RuntimeNode[]>;
    directiveRegistry: DirectiveRegistry;
    architectureRegistry: ArchitectureRegistry;
    readonly environment: AssemblerEnvironment;
    readonly targetId: string;
    readonly targetOptions: Readonly<Record<string, unknown>>;
    readonly syntaxProfile: SyntaxProfile;
    readonly coreDirectiveGroups: readonly CoreDirectiveGroup[];
    readonly pluginState: PluginSessionStateStore;
    readonly pluginAddressSpace: PluginTargetAddressSpace;
    readonly pluginOutputFormat: PluginTargetOutputFormat;
    readonly activeLifecycles: readonly ActiveLifecycle[];
    readonly cursorAddress: CursorAddressFacade;
    readonly fileProvider: AssemblyFileProvider;
    readonly frontEndService: AssemblyFrontEndService;
    readonly programModelBuilder: ProgramModelBuilder;
    readonly commandLoweringService: CommandLoweringService;
    readonly incrementalProgramParseState: IncrementalProgramParseState;
    readonly services: AssemblerServiceBag;
    readonly stageExecutionStates: Map<AssemblyStageName, StageExecutionState>;
    readonly diagnostics: AssemblyDiagnostic[];
    readonly symbolDefinitions: AssemblySymbolDefinition[];
    readonly symbolReferences: AssemblySymbolReference[];
    readonly includeEdges: AssemblyIncludeEdge[];
    readonly collectSourceMetadata: boolean;
    /** When false, `incsrc`/`include` record an edge but do not parse the included file. */
    followIncludes: boolean;
    activeStageExecutionState: StageExecutionState | null;
    analysisErrorRecoveryEnabled: boolean;
    runtimePassthroughRewriteEnabled: boolean;
    sessionDisposed: boolean;
    get defineEngine(): DefineEngine;
    get directiveRuntime(): DirectiveRuntimeService;
    get addressWidth(): number;
    get availableArchitectures(): ReadonlySet<string>;
    get targetDisplayName(): string;
    get frontEndCommandService(): FrontEndCommandService;
    get includeSource(): IncludeSourceService;
    get macroEngine(): MacroEngine;
    get symbolScope(): SymbolScopeService;
    get outputWriter(): OutputWriterService;
    get structEngine(): StructEngine;
    get currentAddress(): number;
    /**
     * Records current address.
     */
    recordCurrentAddress(): void;
    /**
     * Sets write position.
     * @param {number} address The address.
     */
    setWritePosition(address: number): void;
    /**
     * Enters struct definition.
     * @param {number} base The base.
     */
    enterStructDefinition(base: number): void;
    /**
     * Restores struct definition.
     */
    restoreStructDefinition(): void;
    /**
     * Synchronizes write starts.
     */
    syncWriteStarts(): void;
    /**
     * Increments bytes written.
     * @param {number} num The num.
     */
    incrementBytesWritten(num: number): void;
    get mode(): "layout" | "emit";
    get canEmitBytes(): boolean;
    get canFinalize(): boolean;
    get enforceResolvedLabels(): boolean;
    get isDefinitionCollectionStage(): boolean;
    /**
     * Reports whether structured tracing is active for this assembly session.
     * @returns {boolean} Whether a trace listener is installed.
     */
    get isTracing(): boolean;
    /**
     * Traces write.
     * @param {Omit<AssemblerTraceWriteEvent, "type">} event The event.
     */
    traceWrite(event: Omit<AssemblerTraceWriteEvent, "type">): void;
    /**
     * Installs or clears the structured trace listener.
     * @param {AssemblerTraceListener | null} listener The listener to receive trace events.
     */
    setTraceListener(listener: AssemblerTraceListener | null): void;
    /**
     * Clears accumulated diagnostics and symbol definitions.
     */
    clearAnalysisArtifacts(): void;
    /**
     * Records a directed include-graph edge if it has not already been recorded.
     * Includes execute once per pass, so edges are de-duplicated by file pair.
     * @param {string} fromFile The file issuing the include directive.
     * @param {string} toFile The resolved path of the included file.
     */
    recordIncludeEdge(fromFile: string, toFile: string): void;
    /**
     * Returns the current source location.
     * @param {SourceSpan} [span] Optional source span override.
     * @returns {AssemblySourceLocation} The current source location.
     */
    getCurrentSourceLocation(span?: SourceSpan): AssemblySourceLocation;
    /**
     * Converts and records an unknown error.
     * @param {unknown} error The error to normalize.
     * @param {SourceSpan} [span] Optional source span override.
     * @param {string} [stage] Optional stage name.
     * @returns {AssemblyDiagnostic} The recorded diagnostic.
     */
    reportErrorDiagnostic(error: unknown, span?: SourceSpan, stage?: AssemblyStageName): AssemblyDiagnostic;
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
    recordSymbolDefinition(kind: AssemblySymbolKind, name: string, options?: {
        file?: string;
        line?: number;
        span?: SourceSpan;
        value?: number | string;
        containerName?: string;
    }): void;
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
    recordSymbolReference(kind: AssemblySymbolReferenceKind, name: string, options?: {
        file?: string;
        line?: number;
        span?: SourceSpan;
        containerName?: string;
    }): void;
    /**
     * Collects expression references.
     * @param {ExpressionNode | undefined} expression The expression.
     * @param {SourceSpan} [fallbackSpan] The fallback span.
     */
    collectExpressionReferences(expression: ExpressionNode | undefined, fallbackSpan?: SourceSpan): void;
    /**
     * Records one reference per struct-path segment so `obj.timer` can target
     * the struct root and the field independently.
     * @param {ReferenceExpressionNode} expression The struct-rooted reference.
     * @param {SourceSpan} [fallbackSpan] The fallback span.
     */
    collectStructReferenceSegments(expression: ReferenceExpressionNode, fallbackSpan?: SourceSpan): void;
    /**
     * Returns the immediate struct/extension name a member should nest under.
     * Strips `[...]` so `obj[19].ext.index` yields `ext` for `index`.
     * Define roots (`!obj_arthur.flags2`) resolve through the define value
     * (`obj_start+obj[0]`) to the actual struct name.
     * @param {ReferenceExpressionNode} object The object of a member access.
     * @returns {string | undefined} The container name.
     */
    private structSegmentContainerName;
    /**
     * Finds a known struct name in a define's expansion, walking nested defines.
     * @param {string | undefined} name The define name.
     * @param {Set<string>} [seen] Define names already visited.
     * @returns {string | undefined} The struct name, if any.
     */
    private structNameFromDefine;
    /**
     * Walks an expression right-to-left looking for a known struct identifier.
     * `obj_start+obj[0]` yields `obj`.
     * @param {ExpressionNode} node The expression to search.
     * @param {Set<string>} seen Define names already visited.
     * @returns {string | undefined} The struct name, if any.
     */
    private structNameFromExpression;
    /**
     * Splits a hierarchical label (`_018049_8053`) into parent + sublabel
     * segments so each part can be targeted independently.
     * @param {string} name The identifier text.
     * @returns {{ name: string; containerName?: string }[] | undefined} Segments, if this is a known sublabel.
     */
    private hierarchicalLabelReferences;
    /**
     * Collects command references.
     * @param {NormalizedCommand} command The command.
     */
    collectCommandReferences(command: NormalizedCommand): void;
    /**
     * Runs a staged analysis pass and captures the first diagnostic instead of throwing.
     * @param {ProgramModel} program The program model to analyze.
     * @param {ProgramAnalysisOptions} [options] Optional analysis options.
     * @param {boolean} [options.followIncludes] Whether to follow includes.
     * @param {Array<AssemblyStageName>} [options.stages] Optional stages to run.
     * @param {boolean} [options.collectSourceMetadata] Whether to collect source metadata.
     * @returns {AssemblyAnalysisResult} The accumulated diagnostics and symbols.
     */
    collectProgramAnalysis(program: ProgramModel, options?: ProgramAnalysisOptions): AssemblyAnalysisResult;
    /**
     * Creates an isolated assembler session suitable for editor-style analysis.
     * This keeps batch assembly state and tooling state from leaking into each
     * other while still sharing the same file provider and directive registry.
     * @returns {Assembler} A configured analysis session.
     */
    createToolingSession(): Assembler;
    /**
     * Creates directive handlers bound to a fresh session's family capabilities.
     * @param {Assembler} session The session that should receive directive calls.
     * @returns {DirectiveRegistry} A registry bound to the provided session.
     */
    cloneDirectiveRegistryForSession(session: Assembler): DirectiveRegistry;
    /**
     * Analyzes program.
     * @param {ProgramModel} program The program.
     * @returns {AssemblyAnalysisResult} The result.
     */
    analyzeProgram(program: ProgramModel): AssemblyAnalysisResult;
    /**
     * Builds and analyzes raw source without throwing on the first error.
     * @param {string} source The source to analyze.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @param {ProgramAnalysisOptions} [options] Optional analysis options.
     * @returns {AssemblyAnalysisResult & { program: ProgramModel }} The analysis result and program model.
     */
    analyzeSource(source: string, sourceFile?: string, startLine?: number, options?: ProgramAnalysisOptions): AssemblyAnalysisResult & {
        program: ProgramModel;
    };
    /**
     * Analyzes workspace.
     * @param {Array<{ source: string; sourceFile: string; startLine?: number }>} documents The documents.
     * @param {ProgramAnalysisOptions} [options] Optional analysis options.
     * @returns {Array<AssemblyAnalysisResult & { program: ProgramModel; sourceFile: string }>} The result.
     */
    analyzeWorkspace(documents: Array<{
        source: string;
        sourceFile: string;
        startLine?: number;
    }>, options?: ProgramAnalysisOptions): Array<AssemblyAnalysisResult & {
        program: ProgramModel;
        sourceFile: string;
    }>;
    /**
     * Loads base-image data.
     */
    seedOutputFromBaseImage(): void;
    /**
     * Creates cursor address facade.
     * @returns {CursorAddressFacade} The result.
     */
    private createCursorAddressFacade;
    /**
     * Creates services.
     * @returns {AssemblerServiceBag} The result.
     */
    private createServices;
    constructor(options: AssemblerOptions);
    runLifecycleHook(hookName: string, invoke: (lifecycle: SessionLifecycle) => void): void;
    runBeforeDirective(keyword: string, words: readonly string[], raw: string): "continue" | "handled";
    /**
     * Resolves ambiguous `endif` handling through active dialect lifecycles.
     * @param {"for" | "while"} [loopType] The innermost loop type.
     * @param {number} [loopStartLine] The innermost loop start line.
     * @param {number} [ifStartLine] The innermost conditional start line.
     * @returns {boolean} Whether `endif` should close the innermost while loop.
     */
    shouldEndifCloseInnermostWhile(loopType?: "for" | "while", loopStartLine?: number, ifStartLine?: number): boolean;
    selectArchitecture(architecture: string, sourceAlias?: string): void;
    beforeWrite(logicalAddress: number, width: number): void;
    dispose(): void;
    /**
     * Reads little endian.
     * @param {Uint8Array} bytes The bytes.
     * @param {number} pos The pos.
     * @param {number} width The width.
     * @returns {number | undefined} The result.
     */
    readLittleEndian(bytes: Uint8Array, pos: number, width: number): number | undefined;
    /**
     * Checks whether it can read byte range.
     * @param {number} sourceLength The source length.
     * @param {number} position The position.
     * @param {number} size The size.
     * @returns {number} The result.
     */
    canReadByteRange(sourceLength: number, position: number, size: number): number;
    /**
     * Reads byte range.
     * @param {Uint8Array} source The source.
     * @param {number} position The position.
     * @param {number} size The size.
     * @param {number | undefined} defaultValue The default value.
     * @param {string} errorMessage The error message.
     * @returns {number} The result.
     */
    readByteRange(source: Uint8Array, position: number, size: number, defaultValue: number | undefined, errorMessage: string): number;
    /**
     * Resolves readable path.
     * @param {string} filename The filename.
     * @returns {string | undefined} The result.
     */
    resolveReadablePath(filename: string): string | undefined;
    /**
     * Resolves expression host label.
     * @param {string} identifier The identifier.
     * @returns {number | string} The result.
     */
    resolveExpressionHostLabel(identifier: string): number | string;
    /**
     * Gets expression object size.
     * @param {string} identifier The identifier.
     * @param {boolean} [baseOnly] Whether to return only the base object size.
     * @returns {number} The result.
     */
    getExpressionObjectSize(identifier: string, baseOnly?: boolean): number;
    /**
     * Looks up define value.
     * @param {string} varName The var name.
     * @returns {string | undefined} The result.
     */
    lookupDefineValue(varName: string): string | undefined;
    get currentMacroSourceFile(): string | undefined;
    /**
     * Checks whether it can read the base image.
     * @param {number} position The position.
     * @param {number} size The size.
     * @returns {number} The result.
     */
    canReadBaseImage(position: number, size: number): number;
    /**
     * Reads the base image.
     * @param {number} position The position.
     * @param {number} size The size.
     * @param {number} [defaultValue] The default value.
     * @returns {number} The result.
     */
    readBaseImage(position: number, size: number, defaultValue?: number): number;
    /**
     * Checks whether it can read expression file.
     * @param {string} filename The filename.
     * @param {number} position The position.
     * @param {number} size The size.
     * @returns {number} The result.
     */
    canReadExpressionFile(filename: string, position: number, size: number): number;
    /**
     * Reads expression file.
     * @param {string} filename The filename.
     * @param {number} position The position.
     * @param {number} size The size.
     * @param {number} [defaultValue] The default value.
     * @returns {number} The result.
     */
    readExpressionFile(filename: string, position: number, size: number, defaultValue?: number): number;
    /**
     * Installs the active target's expression contributions into this session.
     * @param {readonly string[]} setIds Resolved expression-set contribution IDs.
     */
    installExpressionFunctions(setIds: readonly string[]): void;
    readonly expressionHost: ExpressionHost;
    /**
     * Advances the logical program counter.
     * @param {number} num Number of logical address units to advance.
     */
    step(num: number): void;
    /**
     * Writes a single architecture byte to output.
     * @param {number} num Byte value to write.
     */
    writeArchitectureByte(num: number): void;
    /**
     * Fills a section of output data with a value.
     * @param {number} start The starting address.
     * @param {number} value The value to fill with.
     * @param {number} length The length of the section to fill.
     */
    fillOutputBytes(start: number, value: number, length: number): void;
    /**
     * Creates ephemeral stage execution state.
     * @param {AssemblyStageName} stage The stage.
     * @returns {StageExecutionState} The result.
     */
    createEphemeralStageExecutionState(stage: AssemblyStageName): StageExecutionState;
    /**
     * Synchronizes active stage execution state.
     * @param {AssemblyStageName} stage The stage.
     */
    syncActiveStageExecutionState(stage: AssemblyStageName): void;
    /**
     * Gets active stage capabilities.
     * @returns {StageExecutionCapabilities} The result.
     */
    getActiveStageCapabilities(): StageExecutionCapabilities;
    get traceStage(): AssemblyStageName;
    /**
     * Lays out instruction.
     * @param {string[] | LoweredInstruction} input The input.
     * @returns {boolean} The result.
     */
    layoutInstruction(input: string[] | LoweredInstruction): boolean;
    /**
     * Emits instruction.
     * @param {string[] | LoweredInstruction} input The input.
     * @returns {boolean} The result.
     */
    emitInstruction(input: string[] | LoweredInstruction): boolean;
    /**
     * Picks the appropriate instruction handler based on architecture.
     * @param {string[] | LoweredInstruction} input The instruction to pick.
     * @returns {boolean} True if the instruction was handled, false otherwise.
     */
    asblock_pick(input: string[] | LoweredInstruction): boolean;
    /**
     * Resolves active architecture.
     * @returns {{ name: string; definition?: ArchitectureDefinition }} The result.
     */
    resolveActiveArchitecture(): {
        name: string;
        definition?: ArchitectureDefinition;
    };
    /**
     * Classifies operand for active architecture.
     * @param {string} operand The operand.
     * @returns {LoweredOperand} The classified operand.
     */
    classifyOperandForActiveArchitecture(operand: string): LoweredOperand;
    /**
     * Resolves target-specific directive prefixes without teaching the registry a dialect.
     * @param {string} keyword Source directive keyword.
     * @returns {string} Canonical registry keyword.
     */
    canonicalizeDirectiveKeyword(keyword: string): string;
    /**
     * Returns whether the active syntax profile treats a token as a named label.
     * @param {string} candidate Candidate token.
     * @returns {boolean} Whether the token is a named label.
     */
    isNamedLabelToken(candidate: string): boolean;
    /**
     * Writes 1, 2, 3, or 4 bytes to output.
     * @param {number} num - The byte to write.
     */
    write1(num: number): void;
    /**
     * Writes 2.
     * @param {number} num The num.
     */
    write2(num: number): void;
    /**
     * Writes 3.
     * @param {number} num The num.
     */
    write3(num: number): void;
    /**
     * Writes 4.
     * @param {number} num The num.
     */
    write4(num: number): void;
    /**
     * Reads 1, 2, or 3 bytes from the configured output image.
     * @param {number} logicalPosition The logical address to read from.
     * @returns {number} The byte read from the output image.
     */
    read1(logicalPosition: number): number;
    /**
     * Reads 2.
     * @param {number} logicalPosition The logical address.
     * @returns {number} The result.
     */
    read2(logicalPosition: number): number;
    /**
     * Reads 3.
     * @param {number} logicalPosition The logical address.
     * @returns {number} The result.
     */
    read3(logicalPosition: number): number;
    /**
     * Rewrites raw command.
     * @param {string} command The command.
     * @returns {string} The result.
     */
    rewriteRawCommand(command: string): string;
    /**
     * Creates normalized command from raw.
     * @param {string} command The command.
     * @param {string} sourceFile The source file.
     * @param {number} sourceLine The source line.
     * @param {boolean} [allowEmpty] The allow empty.
     * @returns {NormalizedCommand | null} The result.
     */
    createNormalizedCommandFromRaw(command: string, sourceFile: string, sourceLine: number, allowEmpty?: boolean): NormalizedCommand | null;
    /**
     * Applies a `!name =` assignment without routing it through the incremental if-tree.
     * @param {string} command The define assignment command.
     * @returns {boolean} `true` when the define engine handled the command.
     */
    applyDefineAssignment(command: string): boolean;
    /**
     * Asar `'X' = $nn` / `"X" = $nn` table entries, including `''' = $2A` for apostrophe.
     * @param {string} command Raw command text.
     * @returns {boolean} `true` when the line was a character mapping.
     */
    tryHandleCharacterMapping(command: string): boolean;
    /**
     * Preprocesses normalized command.
     * @param {NormalizedCommand} state The state.
     * @returns {CommandPreprocessResult} The result.
     */
    preprocessNormalizedCommand(state: NormalizedCommand): CommandPreprocessResult;
    /**
     * Prepares normalized command for dispatch.
     * @param {NormalizedCommand} state The state.
     * @returns {boolean} The result.
     */
    prepareNormalizedCommandForDispatch(state: NormalizedCommand): boolean;
    /**
     * Processes a command from an internal re-entrant source.
     * @param {string} command - The command to process.
     * @param {boolean} [preprocessed] Whether comments and continuations were already normalized.
     */
    processCommand(command: string, preprocessed?: boolean): void;
    /**
     * Processes normalized command.
     * @param {NormalizedCommand} state The state.
     * @param {boolean} [rewriteRaw] The rewrite raw.
     */
    processNormalizedCommand(state: NormalizedCommand, rewriteRaw?: boolean): void;
    /**
     * Gets or create lowered program.
     * @param {StageExecutionState} stageState The stage state.
     * @param {ProgramModel} program The program.
     * @returns {LoweredProgram} The result.
     */
    getOrCreateLoweredProgram(stageState: StageExecutionState, program: ProgramModel): LoweredProgram;
    /**
     * Dispatches lowered node.
     * @param {LoweredCommand} lowered The lowered.
     */
    dispatchLoweredNode(lowered: LoweredCommand): void;
    /**
     * Parses a function definition of the form:
     *   function name(param1, param2...) = expression
     * Possibly spanning multiple lines joined by backslashes.
     * @param {string} defLine - The function definition line.
     */
    parseFunctionDefinition(defLine: string): void;
    /**
     * Adds a mapping of the current address to the source line number.
     * @param {number} address The logical address to add to the mapping.
     */
    addAddressToLine(address: number): void;
    /**
     * Evaluates a range expression and returns the result.
     * @param {string} expr The expression to evaluate.
     * @returns {number} The result of the expression.
     */
    evaluateRangeExpression(expr: string | ExpressionNode): number;
    /**
     * Sets the paths to search for included files.
     * @param {string[]} paths The paths to search for included files.
     */
    setIncludePaths(paths: string[]): void;
    /**
     * Evaluates an expression for conditionals (if, while).
     * @param {string} expression - The expression to evaluate.
     * @returns {boolean} True if the expression is true, false otherwise.
     */
    evaluateExpression(expression: string | ExpressionNode): boolean;
    /**
     * Parses string input into an expression node and resolves nested references/defines.
     * @param {string | ExpressionNode} expression The expression source or parsed node.
     * @returns {ExpressionNode} The resolved expression tree.
     */
    resolveExpressionInput(expression: string | ExpressionNode): ExpressionNode;
    /**
     * Recursively resolves define references and nested reference-expression nodes.
     * @param {ExpressionNode} expression The expression node to resolve.
     * @returns {ExpressionNode} The resolved expression node.
     */
    resolveExpressionNode(expression: ExpressionNode): ExpressionNode;
    /**
     * Resolves reference-style expressions such as identifiers, define references,
     * member access, and indexed access into either simpler reference nodes or
     * raw/math expressions when defines collapse them further.
     * @param {ReferenceExpressionNode} expression The reference expression to resolve.
     * @returns {ExpressionNode} The resolved expression tree.
     */
    resolveReferenceExpressionNode(expression: ReferenceExpressionNode): ExpressionNode;
    /**
     * Resolves a reference expression all the way to a numeric value.
     * @param {ReferenceExpressionNode} expression The reference expression to evaluate.
     * @param {boolean} [requireStatic] Whether labels must be static.
     * @returns {number} The numeric value of the reference.
     */
    evaluateReferenceExpressionNode(expression: ReferenceExpressionNode, requireStatic?: boolean): number;
    /**
     * Resolves a reference expression to either a numeric value or a normalized
     * label/struct lookup target, depending on how far the expression collapses.
     * @param {ReferenceExpressionNode} expression The reference expression to resolve.
     * @param {boolean} [requireStatic] Whether labels must be static.
     * @returns {number | string} The resolved numeric value.
     */
    resolveReferenceLabelValue(expression: ReferenceExpressionNode, requireStatic?: boolean): number | string;
    /**
     * Resolves an already-normalized reference string as either a struct member/base
     * or a plain label lookup.
     * @param {string} normalizedReference The normalized reference text.
     * @param {boolean} [requireStatic] Whether labels must be static.
     * @returns {number} The resolved numeric address/value.
     */
    resolveNormalizedReferenceLabelValue(normalizedReference: string, requireStatic?: boolean): number;
    /**
     * Renders an index expression for a normalized reference string.
     * @param {ExpressionNode} indexExpression The index expression to render.
     * @returns {string} The rendered numeric or source-like index text.
     */
    resolveReferenceIndexText(indexExpression: ExpressionNode): string;
    /**
     * Renders a reference expression after resolving any nested index expressions.
     * @param {ReferenceExpressionNode} expression The reference expression to render.
     * @returns {string} The normalized reference text.
     */
    renderResolvedReferenceExpression(expression: ReferenceExpressionNode): string;
    /**
     * Re-runs `resolvedefines()` across a rendered reference expression and reparses
     * it only when define expansion materially changes the text.
     * @param {ReferenceExpressionNode} expression The reference expression to expand.
     * @returns {ExpressionNode | undefined} The reparsed expression, if expansion changed it.
     */
    tryResolveExpandedReferenceExpression(expression: ReferenceExpressionNode): ExpressionNode | undefined;
    /**
     * Resolves standalone relative-label tokens used in define contexts.
     * @param {string} input The token to resolve.
     * @returns {string | undefined} The resolved address string, if applicable.
     */
    tryResolveRelativeLabelToken(input: string): string | undefined;
    /**
     * Resolves direct `!name` define references that are not assignments.
     * @param {string} input The token to resolve.
     * @returns {string | undefined} The resolved define value, if applicable.
     */
    tryResolveDirectDefineReference(input: string): string | undefined;
    /**
     * Resolves macro-label references such as `?label` or `#+?label`.
     * @param {string} input The token to resolve.
     * @returns {string | undefined} The resolved macro-label value, if applicable.
     */
    tryResolveMacroLabelReference(input: string): string | undefined;
    /**
     * Resolves bare label-like tokens before the generic character-by-character
     * define scanner runs.
     * @param {string} input The token to resolve.
     * @returns {string | undefined} The resolved label value, if applicable.
     */
    tryResolveBareLabelReference(input: string): string | undefined;
    /**
     * Resolves all define replacements in a given string.
     * @param {string} input The string to resolve defines in.
     * @returns {string} The string with defines resolved.
     */
    resolvedefines(input: string): string;
    /**
     * Handles activate stage.
     * @param {AssemblyStageName} stage The stage.
     */
    activateStage(stage: AssemblyStageName): void;
    /**
     * Completes the current pass, performing any necessary cleanup.
     */
    finishPass(): void;
    /**
     * Sets the current file being processed.
     * @param {string} filename - The filename to set.
     */
    setCurrentFile(filename: string): void;
    /**
     * Sets the current line number.
     * @param {number} line - The line number to set.
     */
    setCurrentLine(line: number): void;
    /**
     * Gets stage descriptor.
     * @param {AssemblyStageName} stage The stage.
     * @returns {Pick<StageExecutionState, "stage" | "capabilities">} The result.
     */
    getStageDescriptor(stage: AssemblyStageName): Pick<StageExecutionState, "stage" | "capabilities">;
    /**
     * Clones relative labels.
     * @param {{ [depth: number]: { addr: number; macroInstance?: number }[] }} source The source.
     * @returns {{ [depth: number]: { addr: number; macroInstance?: number }[]; }} The result.
     */
    cloneRelativeLabels(source: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    }): {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    /**
     * Creates stage execution state.
     * @param {AssemblyStageName} stage The stage.
     * @returns {StageExecutionState} The result.
     */
    createStageExecutionState(stage: AssemblyStageName): StageExecutionState;
    /**
     * Applies stage execution state.
     * @param {StageExecutionState} stageState The stage state.
     */
    applyStageExecutionState(stageState: StageExecutionState): void;
    /**
     * Captures stage execution state.
     * @param {StageExecutionState} stageState The stage state.
     */
    captureStageExecutionState(stageState: StageExecutionState): void;
    /**
     * Gets or create stage execution state.
     * @param {AssemblyStageName} stage The stage.
     * @returns {StageExecutionState} The result.
     */
    getOrCreateStageExecutionState(stage: AssemblyStageName): StageExecutionState;
    /**
     * Builds program model.
     * @param {string} source The source.
     * @param {string} [sourceFile] The source file.
     * @param {number} [startLine] The start line.
     * @returns {ProgramModel} The result.
     */
    buildProgramModel(source: string, sourceFile?: string, startLine?: number): ProgramModel;
    /**
     * Runs stage.
     * @param {AssemblyStageName} stage The stage.
     * @param {ProgramModel} program The program.
     * @returns {StageExecutionState} The result.
     */
    runStage(stage: AssemblyStageName, program: ProgramModel): StageExecutionState;
    /**
     * Handles assemble program.
     * @param {ProgramModel} program The program.
     */
    assembleProgram(program: ProgramModel): void;
    /**
     * Handles assemble source.
     * @param {string} source The source.
     * @param {string} [sourceFile] The source file.
     * @param {number} [startLine] The start line.
     * @returns {ProgramModel} The result.
     */
    assembleSource(source: string, sourceFile?: string, startLine?: number): ProgramModel;
    /**
     * Writes a repeated byte into the output buffer.
     * @param {number} start The starting address of the block to write.
     * @param {number} value The byte value to write.
     * @param {number} [length] The length of the block to write.
     */
    writeOutputBytes(start: number, value: number, length?: number): void;
    /**
     * Expands the output buffer and fills it with a specified byte.
     * @param {number} newSize The new output size.
     * @param {number} fillByte The byte used for the new range.
     */
    expandOutput(newSize: number, fillByte: number): void;
    /** Runs the active output-format finalizer. */
    finalizeOutput(): void;
    /**
     * Returns the compiled binary output.
     * @returns {Uint8Array} The compiled binary output.
     */
    getBinaryOutput: () => Uint8Array;
    /**
     * Lowers completed runtime nodes and executes them through the production executor.
     * @param {ExecutableNode[]} nodes The runtime nodes to lower and execute.
     */
    lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void;
    /**
     * Resolves for loop bounds.
     * @param {LoweredLoopNode} forBlock The for block.
     * @returns {{ variable?: string; start?: number; end?: number; }} The result.
     */
    resolveForLoopBounds(forBlock: LoweredLoopNode): {
        variable?: string;
        start?: number;
        end?: number;
    };
    /**
     * Executes for loop iterations.
     * @param {LoweredLoopNode} forBlock The for block.
     * @param {() => void} executeBody The execute body.
     */
    executeForLoopIterations(forBlock: LoweredLoopNode, executeBody: () => void): void;
    /**
     * Executes lowered loop.
     * @param {LoweredLoopNode} loopBlock The loop block.
     */
    executeLoweredLoop(loopBlock: LoweredLoopNode): void;
    /**
     * Executes lowered for loop.
     * @param {LoweredLoopNode} forBlock The for block.
     */
    executeLoweredForLoop(forBlock: LoweredLoopNode): void;
    /**
     * Executes while loop commands.
     * @param {LoweredLoopNode} whileBlock The while block.
     * @param {TCommand[]} commands The commands.
     * @param {(command: TCommand) => string | null} getDefineTarget The get define target.
     * @param {(command: TCommand) => void} executeCommand The execute command.
     */
    executeWhileLoopCommands<TCommand>(whileBlock: LoweredLoopNode, commands: TCommand[], getDefineTarget: (command: TCommand) => string | null, executeCommand: (command: TCommand) => void): void;
    /**
     * Executes lowered while loop.
     * @param {LoweredLoopNode} whileBlock The while block.
     */
    executeLoweredWhileLoop(whileBlock: LoweredLoopNode): void;
    /**
     * Gets lowered node span.
     * @param {LoweredExecutableNode} node The node.
     * @returns {SourceSpan | undefined} The result.
     */
    getLoweredNodeSpan(node: LoweredExecutableNode): SourceSpan | undefined;
    /**
     * Executes a tree or lowered node while routing analysis-mode failures into diagnostics.
     * @param {TNode} node The node to execute.
     * @param {(node: TNode) => SourceSpan | undefined} getSpan Resolves the node span for diagnostics.
     * @param {(node: TNode) => void} executeNode Executes the node with its native dispatcher.
     */
    executeWithAnalysisRecovery<TNode>(node: TNode, getSpan: (node: TNode) => SourceSpan | undefined, executeNode: (node: TNode) => void): void;
    /**
     * Executes lowered node with recovery.
     * @param {LoweredExecutableNode} node The node.
     */
    executeLoweredNodeWithRecovery(node: LoweredExecutableNode): void;
    /**
     * Executes lowered node.
     * @param {LoweredExecutableNode} node The node.
     */
    executeLoweredNode(node: LoweredExecutableNode): void;
    /**
     * Executes lowered node stream.
     * @param {LoweredExecutableNode[]} nodes The nodes.
     */
    executeLoweredNodeStream(nodes: LoweredExecutableNode[]): void;
    /**
     * Drains and executes any completed nodes still buffered in the incremental parser.
     * This protects re-entrant command sources, such as macro expansion, from leaving
     * finished typed roots stranded until the next top-level line arrives.
     */
    flushCompletedIncrementalNodes(): void;
    /**
     * Executes conditional branches.
     * @param {Array<{ kind: "if" | "elseif" | "else"; conditionNode?: ExpressionNode; commands: TCommand[]; }>} branches The branches.
     * @param {(commands: TCommand[]) => void} executeCommands The execute commands.
     */
    executeConditionalBranches<TCommand>(branches: Array<{
        kind: "if" | "elseif" | "else";
        conditionNode?: ExpressionNode;
        commands: TCommand[];
    }>, executeCommands: (commands: TCommand[]) => void): void;
}
export {};
//# sourceMappingURL=assembler.d.ts.map