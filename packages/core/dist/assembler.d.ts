import { AddressToLineMapping } from "./addressToLine.js";
import { ArchitectureRegistry, type ArchitectureDefinition } from "./architecture-registry.js";
import type { ExpressionHost } from "./architecture-types.js";
import type { AssemblerTraceListener, AssemblerTraceWriteEvent } from "./debug-tracing.js";
import { type AssemblyAnalysisResult, type AssemblyDiagnostic, type AssemblyIncludeEdge, type AssemblySourceLocation, type AssemblySymbolDefinition, type AssemblySymbolKind, type AssemblySymbolReference, type AssemblySymbolReferenceKind } from "./diagnostics.js";
import { type CoreDirectiveGroup } from "./directive-groups.js";
import { DirectiveRegistry } from "./directives/registry.js";
import { type AssemblyFileProvider } from "./file-provider.js";
import type { ConditionalBranchNode, ExecutableNode, LoopNode } from "./ir/assembly-tree.js";
import { type ExpressionNode, type ReferenceExpressionNode } from "./ir/expression-node.js";
import { type LinkExpression } from "./ir/link-expression.js";
import { type NormalizedCommand } from "./ir/normalized-command.js";
import { type ReferenceResolution } from "./ir/reference-path.js";
import { type SourceFragment } from "./ir/source-fragment.js";
import { MathCore } from "./mathcore.js";
import { OperandResolver } from "./operand-resolver.js";
import type { AssemblyStageName } from "./plugin/contracts.js";
import { type AssemblerEnvironment, type SessionLifecycle, type TargetAddressSpace as PluginTargetAddressSpace, type TargetOutputFormat as PluginTargetOutputFormat, PluginSessionStateStore, type PluginStateSnapshot } from "./plugin/index.js";
import type { AssemblyModule, AssemblyModuleOptions, AssemblySectionOptions, RelocationEncoding } from "./relocatable.js";
import { AssemblyFrontEndService } from "./services/assembly-front-end-service.js";
import { AssetAssemblyService } from "./services/asset-assembly-service.js";
import { CommandLoweringService, type LoweredCommand, type LoweredExecutableNode, type LoweredLoopNode, type LoweredProgram } from "./services/command-lowering-service.js";
import { DefineEngine } from "./services/define-engine.js";
import { DirectiveRuntimeService, type PushPcStackEntry } from "./services/directive-runtime-service.js";
import { FrontEndCommandService } from "./services/front-end-command-service.js";
import { IncludeSourceService, type IncludedFileInfo } from "./services/include-source-service.js";
import { MacroEngine, type MacroDefinition } from "./services/macro-engine.js";
import { ModuleAssembly } from "./services/module-assembly.js";
import { OutputWriterService } from "./services/output-writer-service.js";
import { ProgramModelBuilder, type IncrementalProgramParseState, type ProgramModel } from "./services/program-model-builder.js";
import { StructEngine, type StructDefinition } from "./services/struct-engine.js";
import { SymbolScopeService, type LabelEntry } from "./services/symbol-scope-service.js";
import { type SourceSpan } from "./source-location.js";
import type { SourceOrigin } from "./source-provenance.js";
import { type SyntaxProfile } from "./syntax-profile.js";
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
    /** Reclaimable execution cache. Full builds discard completed plans; direct runStage results retain them. */
    loweredProgram: LoweredProgram | null;
};
type CursorAddressFacade = {
    recordCurrentAddress(): void;
    setWritePosition(address: number): void;
    syncWriteStarts(): void;
    incrementBytesWritten(num: number): void;
};
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
/** Required target selection plus host services for one mutable assembly session. */
export type AssemblerOptions = {
    /** Produce section-relative records without allocating or finalizing a ROM. Read them with getAssemblyModule(). */
    module?: AssemblyModuleOptions;
    /** Frozen plugin environment shared by build and tooling sessions. */
    environment: AssemblerEnvironment;
    /** Target contribution ID or alias. */
    target: string;
    /** Architecture ID or alias within the target. Defaults to the target's defaultArchitecture. */
    architecture?: string;
    /** Validated by the target's createOptions hook. Nonempty options require that hook. */
    targetOptions?: unknown;
    /** Base image copied at construction. Source/output directives determine the resulting patch extent. */
    baseImage?: number[] | Uint8Array;
    /** Borrowed synchronous provider. Defaults to NodeAssemblyFileProvider and is not disposed by the session. */
    fileProvider?: AssemblyFileProvider;
    /** Collect byte-to-source metadata for debug maps. Defaults to true. */
    collectSourceMetadata?: boolean;
};
/** Controls recovery-oriented analysis performed in an isolated temporary session. */
export type ProgramAnalysisOptions = {
    /** Assembly stages to run. Tooling defaults to definitions-only. */
    stages?: readonly AssemblyStageName[];
    /** When false, include directives record an edge without parsing the target. Defaults to true. */
    followIncludes?: boolean;
    /** Resolve asset paths without converting bytes; state-dependent assertions after assets wait for a build. */
    deferAssetConversion?: boolean;
};
/**
 * Mutable, synchronous build session. Share its frozen environment with other sessions, not its state.
 * Use assembleSource/assembleProgram for builds and analyzeSource for recovering diagnostics.
 * Dispose the session before its plugin manager or loader. Use a fresh session after a failed build.
 * Public runtime fields and service methods support directives and tooling and require stage invariants.
 */
export declare class Assembler {
    #private;
    /** Section-relative output owner, absent for ordinary absolute assembly. */
    readonly moduleAssembly?: ModuleAssembly;
    /** Source adapters are session-local and never participate in the absolute execution path. */
    private readonly moduleOptions?;
    private readonly asarModuleLayout?;
    private readonly moduleFiles?;
    private moduleRangeKind;
    private moduleAssetRemaining;
    /** A synchronous assignment borrows the existing scope writer while replacing only its numeric binding. */
    private moduleAssignmentValue?;
    /** Stable symbol-scope identity, independent of include basenames or final placement. */
    get moduleIdentity(): string | undefined;
    get moduleSection(): string | undefined;
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
    private readonly outputBuffer;
    /**
     * Mutable output; large contiguous session-owned images may use typed views. Reacquire a view after
     * growing writes; assigned arrays retain their growth behavior and assigned typed arrays stay fixed.
     */
    get outputBytes(): number[] | Uint8Array;
    set outputBytes(value: number[] | Uint8Array);
    /** Byte used when expanding a sparse output range. */
    outputFillByte: number;
    whileStatus: WhileTracker[];
    namespaceStack: string[];
    currentNamespace: string;
    namespaceNestingEnabled: boolean;
    namespaceNestingPath: string[];
    currentMacroName: string;
    currentVariadicCount: number | undefined;
    currentVariadicArgs: string[];
    macros: Map<string, MacroDefinition>;
    mathCore: MathCore;
    operandResolver: OperandResolver;
    addressToLineMapping: AddressToLineMapping;
    currentFile: string;
    currentLine: number;
    /** Invocation-local provenance. Buffered nodes snapshot it before this scope ends. */
    private currentSourceOrigin?;
    /** Optional sink for structured tracing used by tests and ad-hoc debug scripts. */
    private traceListener;
    /** Active command contexts so nested byte writes inherit the right source line. */
    private readonly traceCommandStack;
    defines: Map<string, string>;
    /** Bare numeric values exposed only while executing typed `for` loops. */
    private readonly activeLoopVariables;
    characterMappings: Map<string, number>;
    currentTable: string | null;
    tableStack: Map<string, number>[];
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
    /** Session syntax values indexed by opaque builder identities, with source keys owned by the builder. */
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
    private readonly activeLifecycles;
    readonly cursorAddress: CursorAddressFacade;
    readonly fileProvider: AssemblyFileProvider;
    /** Binary/resource dependencies and converted bytes owned by the active build. */
    readonly assetAssembly: AssetAssemblyService;
    /** Tooling-only path discovery avoids conversion on edit bursts. */
    deferAssetConversion: boolean;
    readonly frontEndService: AssemblyFrontEndService;
    readonly programModelBuilder: ProgramModelBuilder;
    readonly commandLoweringService: CommandLoweringService;
    readonly incrementalProgramParseState: IncrementalProgramParseState;
    private readonly services;
    readonly stageExecutionStates: Map<AssemblyStageName, StageExecutionState>;
    readonly diagnostics: AssemblyDiagnostic[];
    readonly symbolDefinitions: AssemblySymbolDefinition[];
    readonly symbolReferences: AssemblySymbolReference[];
    /** Pure occurrence plans replay against the current scope instead of caching resolved references. */
    private readonly referencePlanner;
    /** Static records need replay only when the same deduplication fields or analysis epoch change. */
    private readonly stableReferences;
    private referenceEpoch;
    readonly includeEdges: AssemblyIncludeEdge[];
    readonly collectSourceMetadata: boolean;
    /** When false, `incsrc`/`include` record an edge but do not parse the included file. */
    followIncludes: boolean;
    private activeStageExecutionState;
    private analysisErrorRecoveryEnabled;
    private sessionDisposed;
    /** Nesting permits target hooks triggered synchronously by another plugin capability. */
    private borrowPluginCapabilities;
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
    /** Record raw input consumption at its actual output location, including incbin arrow seeks. */
    recordBinarySlice(file: string, start: number, end: number, bytes: Uint8Array): void;
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
     * Avoid rebuilding an already-recorded static occurrence. These fields match reference deduplication;
     * hierarchy and struct-container selection stay outside this shortcut because they can change later.
     */
    private recordStableSymbolReference;
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
    /** Walk portable directive payloads, collecting expression nodes without interpreting enum/path strings. */
    private collectSyntaxReferences;
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
    private createServices;
    /**
     * Resolve the target and instantiate per-session factories. Throws on invalid selection/options
     * or factory failure. Factory construction is not a resource transaction: keep external resources
     * in plugin activation disposables and session state cloneable.
     */
    constructor(options: Omit<AssemblerOptions, "environment"> & {
        environment?: AssemblerOptions["environment"];
    });
    /** Bind symbolic operands through the same local/namespace rules as numeric assembly. */
    private linkExpressionContext;
    /** Preserve pure expanded syntax; this API never substitutes an unresolved address with zero. */
    compileLinkExpression(expression: ExpressionNode): LinkExpression;
    /** Authored addresses influence compatibility encoding choices, never the stored relocation expression. */
    private previewSourceExpression;
    private moduleSource;
    /** Called by symbol scopes after canonical qualification, including macro/namespace aliases. */
    recordLabelBinding(name: string, entry: import("./services/symbol-scope-service.js").LabelEntry): void;
    /** Record a source alias without losing a cross-section or external dependency. */
    assignModuleSymbol(name: string, expression: ExpressionNode): void;
    /** Bind external visibility through the same module symbol table used by native declarations. */
    declareModuleSymbol(name: string, visibility: "import" | "export"): void;
    /** Export a definition that was declared before its ca65 export directive qualified it globally. */
    exportModuleSymbol(name: string): void;
    /** Target adapters expose region/load/run policy independently of any new linker implementation. */
    getLinkRecipe(): import("./relocatable.js").AssemblyLinkRecipe | undefined;
    /** Finalization is explicitly borrowed by a linker after it has applied every relocation. */
    finalizeLinkedOutput(bytes: Uint8Array): Uint8Array;
    /** Switch sections without applying ROM mapper normalization to their relative byte cursors. */
    selectModuleSection(options: AssemblySectionOptions): void;
    /** BSS reservations never acquire initialized bytes; initialized sections can request explicit fill. */
    reserveModuleBytes(count: number, fill?: number): void;
    alignModule(boundary: number, fill?: number): void;
    /** Write a typed field through the ordinary byte writer, retaining an independent symbolic record. */
    writeRelocation(expression: LinkExpression, encoding: RelocationEncoding): void;
    /** Numeric scalar directives and struct fields share exactly the encoder relocation contract. */
    writeExpression(expression: ExpressionNode, width: 1 | 2 | 3 | 4, endianness?: "little" | "big"): void;
    recordModuleWrite(): void;
    /** Addressed record layouts acquire a section base only when they are actually initialized there. */
    recordModuleStructBase(name: string, base: number): void;
    /** Module syntax is registered only for object sessions, preserving absolute grammar identities. */
    private registerModuleDirectives;
    /** ORG/BASE adaptation is registered only for explicitly opted-in object sessions. */
    private registerAsarModuleLayout;
    /** Returns a detached producer result. No ROM finalizer or linker has run on its section bytes. */
    getAssemblyModule(): AssemblyModule;
    runLifecycleHook(hookName: string, invoke: (lifecycle: SessionLifecycle) => void): void;
    runBeforeDirective(keyword: string, command: NormalizedCommand, syntax?: import("./ir/source-syntax.ts").DeclarationSyntax | {
        readonly kind: "label";
        readonly statement: import("./ir/statement-node.js").LabelStatement;
    } | {
        readonly kind: "sequence";
        readonly declaration: import("./ir/statement-node.js").LabelStatement;
        readonly following: NormalizedCommand | import("./ir/source-syntax.ts").NumericDataFragment;
    } | {
        readonly kind: "numericData";
        readonly statement: import("./ir/statement-node.js").NumericDataStatement;
    } | {
        readonly kind: "data";
        readonly width: 1 | 2 | 3 | 4;
        readonly items: readonly import("./ir/source-syntax.ts").DataItemSyntax[];
    } | {
        readonly kind: "resource";
        readonly operation: "include" | "binary" | "asset";
        readonly path: import("./ir/source-syntax.ts").SyntaxToken;
        readonly arguments: readonly import("./ir/source-syntax.ts").DataItemSyntax[];
    } | {
        readonly kind: "template";
        readonly segments: readonly import("./ir/source-syntax.ts").TemplateSegmentSyntax[];
    } | {
        readonly kind: "invocation";
        readonly name: import("./ir/source-syntax.ts").SyntaxToken;
        readonly arguments: readonly import("./ir/source-syntax.ts").SyntaxToken[];
    } | ({
        readonly kind: "plugin";
        readonly contributionId: string;
        readonly grammarVersion: string;
    } & {
        readonly payload: import("./ir/source-syntax.ts").SyntaxValue;
        readonly error?: never;
    }) | ({
        readonly kind: "plugin";
        readonly contributionId: string;
        readonly grammarVersion: string;
    } & {
        readonly error: string;
        readonly payload?: never;
    }) | undefined): "continue" | "handled";
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
    /**
     * Records one emitted byte against the active command source.
     * @param {number} logicalAddress Logical byte address.
     * @param {number} outputOffset Physical output offset, or a negative value when unmapped.
     */
    recordSourceWrite(logicalAddress: number, outputOffset: number): void;
    /** Record the actual typed field encoding without splitting or overlapping its row's byte ownership. */
    recordStructField(reference: string, expression: string, offset: number, width: number): void;
    /**
     * Run lifecycle disposal in reverse registration order, then dispose live state slots.
     * Idempotent. Attempts all cleanup and throws AggregateError for failures. The environment
     * and file provider remain owned by the host. Do not use this session afterward.
     */
    dispose(): void;
    readLittleEndian(bytes: Uint8Array, pos: number, width: number): number | undefined;
    /**
     * Check a byte interval after truncating its position and size to integers.
     * @param {number} sourceLength Available source bytes.
     * @param {number} position Zero-based byte offset.
     * @param {number} size Requested byte count, which may be zero.
     * @returns {number} Numeric 1 or 0 for use by assembly expressions.
     */
    canReadByteRange(sourceLength: number, position: number, size: number): number;
    /**
     * Read an unsigned little-endian value after truncating offset and width.
     * @param {Uint8Array} source Borrowed input bytes, never modified.
     * @param {number} position Zero-based byte offset.
     * @param {number} size Width in bytes, used by the 1–4-byte expression readers.
     * @param {number | undefined} defaultValue Returned for an out-of-bounds read when supplied.
     * @param {string} errorMessage Error thrown for an out-of-bounds read without a default.
     * @returns {number} Unsigned value or the supplied default.
     */
    readByteRange(source: Uint8Array, position: number, size: number, defaultValue: number | undefined, errorMessage: string): number;
    resolveReadablePath(filename: string): string | undefined;
    resolveExpressionHostLabel(identifier: string): number | string;
    getExpressionObjectSize(identifier: string, baseOnly?: boolean): number;
    lookupDefineValue(varName: string): string | undefined;
    get currentMacroSourceFile(): string | undefined;
    canReadBaseImage(position: number, size: number): number;
    readBaseImage(position: number, size: number, defaultValue?: number): number;
    canReadExpressionFile(filename: string, position: number, size: number): number;
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
    /** Store one already-validated emitted byte, preserving sparse gap fill and public fill overrides. */
    writeOutputByte(offset: number, value: number): void;
    createEphemeralStageExecutionState(stage: AssemblyStageName): StageExecutionState;
    /**
     * Synchronizes active stage execution state.
     * @param {AssemblyStageName} stage The stage.
     */
    syncActiveStageExecutionState(stage: AssemblyStageName): void;
    getActiveStageCapabilities(): StageExecutionCapabilities;
    get traceStage(): AssemblyStageName;
    /** Public word entry; all source forms use the shared parser and typed execution contracts. */
    asblock_pick(words: string[]): boolean;
    resolveActiveArchitecture(): {
        name: string;
        definition?: ArchitectureDefinition;
    };
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
    read2(logicalPosition: number): number;
    read3(logicalPosition: number): number;
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
    /** Scope expansion metadata and restore caller positions even when nested expansion fails. */
    withSourceOrigin(origin: SourceOrigin, execute: () => void): void;
    /** Include origins are execution-local; the same cached file can be reached from many callers. */
    withIncludeSource(file: string, execute: () => void, fromFile?: string): void;
    /**
     * Processes a command from an internal re-entrant source.
     * @param {string} command - The command to process.
     * @param {boolean} [preprocessed] Whether comments and continuations were already normalized.
     */
    processCommand(command: string, preprocessed?: boolean, template?: NormalizedCommand): void;
    /** Physical fragments retained only while the frontend buffers one multiline statement. */
    private pendingGeneratedFragment?;
    /** Execute an attributed generated fragment through the shared incremental frontend. */
    processSourceFragment(fragment: SourceFragment, preprocessed?: boolean, template?: NormalizedCommand): void;
    /** Public normalized-source entry: the shared parser owns streaming captures and control flow. */
    processNormalizedCommand(command: NormalizedCommand, rewriteRaw?: boolean): void;
    /** Execute typed syntax with current scope and the same source ownership as directive dispatch. */
    private executeStatement;
    /** Keep nested write attribution and trace event ordering identical for typed and legacy data. */
    private executeAttributedCommand;
    getOrCreateLoweredProgram(stageState: StageExecutionState, program: ProgramModel): LoweredProgram;
    /**
     * Dispatches lowered node.
     * @param {LoweredCommand} lowered The lowered.
     */
    dispatchLoweredNode(lowered: LoweredCommand): void;
    /** Classification retains its stage-entry ordering; no prepared values enter the syntax cache. */
    prepareTypedInstruction(node: import("./services/command-lowering-service.js").LoweredTypedInstruction): void;
    /** Preserve binding diagnostics as data without retaining exception/session objects in a receipt. */
    private operandBindingFailure;
    /** Every borrowed evaluation capability expires with its instruction's stage frame. */
    private createInstructionFrame;
    /** Bind templates at the source boundary, then lend a fresh frame for exactly one stage invocation. */
    private executeTypedInstruction;
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
     * Replace include search paths before assembly. Retains the array without copying.
     * @param {string[]} paths Provider-specific search paths. Node resolves relative paths from cwd.
     */
    setIncludePaths(paths: string[]): void;
    /**
     * Evaluates an expression for conditionals (if, while).
     * @param {string} expression - The expression to evaluate.
     * @returns {boolean} True if the expression is true, false otherwise.
     */
    evaluateExpression(expression: string | ExpressionNode): boolean;
    /**
     * Evaluate an assertion, or defer it when skipped asset bytes make its inputs provisional.
     * Literal arithmetic and expanded numeric defines remain checkable during editor analysis.
     * @param {string | ExpressionNode} expression Assertion condition.
     * @returns {boolean | undefined} The condition result, or undefined until a build resolves the layout.
     */
    evaluateAssertion(expression: string | ExpressionNode): boolean | undefined;
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
     * Resolve structured references with explicit stage deferral. `relativeAddress` selects
     * relative labels at that logical byte address; omission uses the current instruction cursor.
     */
    resolveStructuredReference(expression: ReferenceExpressionNode, requireStatic?: boolean, relativeAddress?: number): ReferenceResolution;
    /** A textual define suffix binds to its final operand; it does not introduce an implicit group. */
    private bindReferenceSuffix;
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
    /** Bind source-valued defines without converting symbol references into numeric source text. */
    resolveDefineFragment(fragment: SourceFragment): SourceFragment;
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
    getStageDescriptor(stage: AssemblyStageName): Pick<StageExecutionState, "stage" | "capabilities">;
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
    getOrCreateStageExecutionState(stage: AssemblyStageName): StageExecutionState;
    buildProgramModel(source: string, sourceFile?: string, startLine?: number): ProgramModel;
    runStage(stage: AssemblyStageName, program: ProgramModel): StageExecutionState;
    /**
     * Run definition collection, layout resolution, and byte emission synchronously in that order.
     * Throws at the first unrecovered failure. Partial state/output is not a successful binary.
     * @param {ProgramModel} program Parsed source model produced for this target's syntax.
     */
    assembleProgram(program: ProgramModel): void;
    /**
     * Parse and run all three assembly stages. Includes are read through the configured provider.
     * Throws on failure. Read the finalized bytes with getBinaryOutput after success.
     * @param {string} source Assembly source text, not a filename.
     * @param {string} [sourceFile] Source identity and include-resolution base. Defaults to currentFile.
     * @param {number} [startLine] Zero-based line offset. Defaults to zero.
     * @returns {ProgramModel} Parsed model used for this build.
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
     * Materialize the target format's current bytes without assembling or finalizing again.
     * @returns {Uint8Array} Output whose ownership depends on the formatter. Copy before retaining or mutating independently.
     */
    getBinaryOutput: () => Uint8Array;
    /**
     * Lowers completed runtime nodes and executes them through the production executor.
     * @param {ExecutableNode[]} nodes The runtime nodes to lower and execute.
     */
    lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void;
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