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
/** Conditional branch node executed with normalized commands in the runtime buffer. */
type RuntimeConditionalNode = ConditionalBranchNode;
/** Executable front-end node stored in pass-local program caches. */
type RuntimeNode = NormalizedCommand | LoopNode | RuntimeConditionalNode;
/** Whether instruction encoding runs for sizing only or emits bytes. */
type StageExecutionMode = "layout" | "emit";
/** Stage-specific limits on emission, finalization, and label enforcement. */
type StageExecutionCapabilities = {
    instructionMode: StageExecutionMode;
    canEmitBytes: boolean;
    canFinalize: boolean;
    enforceResolvedLabels: boolean;
    isDefinitionCollectionStage: boolean;
};
/** Logical and physical write cursor snapshotted between assembly stages. */
type StageCursorState = {
    currentTargetAddress: number;
    currentTargetBaseAddress: number;
    currentTargetStartAddress: number;
    currentTargetBaseStartAddress: number;
    bytes: number;
};
/** Label tables and anonymous label stacks isolated per assembly stage. */
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
/** Namespace and macro expansion control snapshotted between assembly stages. */
type StageControlState = {
    namespaceStack: string[];
    currentNamespace: string;
    namespaceNestingEnabled: boolean;
    namespaceNestingPath: string[];
    inMacroExpansion: boolean;
    macroLabelInstance: number;
};
/** Full mutable snapshot restored when entering or leaving an assembly stage. */
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
/** Narrow write-position API exposed to directives without the full assembler surface. */
type CursorAddressFacade = {
    recordCurrentAddress(): void;
    setWritePosition(address: number): void;
    syncWriteStarts(): void;
    incrementBytesWritten(num: number): void;
};
/** Active `while` or typed `for` loop frame on the runtime control stack. */
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
    /** Stable module id when section-relative assembly is enabled. */
    get moduleIdentity(): string | undefined;
    /** Active section name when writing relocatable module bytes. */
    get moduleSection(): string | undefined;
    /** The current logical target address. */
    currentTargetAddress: number;
    /** The current logical target base address. */
    currentTargetBaseAddress: number;
    /** The current target start address. `startpos` */
    currentTargetStartAddress: number;
    /** The current target base start address. `realstartpos` */
    currentTargetBaseStartAddress: number;
    /** Total bytes emitted in the active stage cursor. */
    bytes: number;
    /** Saved base addresses for nested `pushbase`/`pullbase` pairs. */
    pushBaseStack: number[];
    private readonly outputBuffer;
    /**
     * Mutable output; large contiguous session-owned images may use typed views. Reacquire a view after
     * growing writes; assigned arrays retain their growth behavior and assigned typed arrays stay fixed.
     */
    /** Live output buffer view; reacquire after growth when using typed arrays. */
    get outputBytes(): number[] | Uint8Array;
    /** Replaces the entire output buffer backing store. */
    set outputBytes(value: number[] | Uint8Array);
    /** Byte used when expanding a sparse output range. */
    outputFillByte: number;
    /** Stack of active `while` and typed `for` loop frames. */
    whileStatus: WhileTracker[];
    /** Saved namespace prefixes for nested namespace directives. */
    namespaceStack: string[];
    /** Active namespace prefix applied to newly defined symbols. */
    currentNamespace: string;
    /** Whether dotted namespace segments accumulate on a nesting path. */
    namespaceNestingEnabled: boolean;
    /** Path segments accumulated when namespace nesting is enabled. */
    namespaceNestingPath: string[];
    /** Name of the macro currently being expanded, if any. */
    currentMacroName: string;
    /** Variadic argument count for the active macro expansion. */
    currentVariadicCount: number | undefined;
    /** Captured variadic argument strings for the active macro expansion. */
    currentVariadicArgs: string[];
    /** Macro definitions registered during this session. */
    macros: Map<string, MacroDefinition>;
    /** Shared numeric expression evaluator for directives and operands. */
    mathCore: MathCore;
    /** Operand parser and evaluator bound to this session's symbol state. */
    operandResolver: OperandResolver;
    /** Byte-to-source metadata collected when {@link collectSourceMetadata} is enabled. */
    addressToLineMapping: AddressToLineMapping;
    /** Path of the source file currently being executed. */
    currentFile: string;
    /** Zero-based line index within {@link currentFile}. */
    currentLine: number;
    /** Invocation-local provenance. Buffered nodes snapshot it before this scope ends. */
    private currentSourceOrigin?;
    /** Optional sink for structured tracing used by tests and ad-hoc debug scripts. */
    private traceListener;
    /** Active command contexts so nested byte writes inherit the right source line. */
    private readonly traceCommandStack;
    /** Textual define bindings established by define directives. */
    defines: Map<string, string>;
    /** Bare numeric values exposed only while executing typed `for` loops. */
    private readonly activeLoopVariables;
    /** Character-to-byte mappings for the active text table. */
    characterMappings: Map<string, number>;
    /** Name of the character table currently selected. */
    currentTable: string | null;
    /** Saved character mapping tables for nested table directives. */
    tableStack: Map<string, number>[];
    /** Canonical architecture id selected for encoding. */
    arch: string;
    /** Saved program counters for nested `pushpc`/`pullpc` pairs. */
    pushpcStack: PushPcStackEntry[];
    /** Nesting depth counter paired with {@link pushpcStack}. */
    pushpcnum: number;
    /** Primary label value table for the active stage. */
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
    /** Repeat unit size for pad directives in bytes. */
    padUnit: number;
    /** Fill pattern bytes cycled during pad emission. */
    padbyte: number[];
    /** Struct definitions registered during this session. */
    structs: Map<string, StructDefinition>;
    /** Struct currently being defined, if any. */
    currentStruct: StructDefinition | null;
    /** Saved PCs while defining struct layouts in place. */
    savedPCStack: number[];
    /** Initialize fill pattern */
    fillbyte: number[];
    /** Optional base ROM image copied at session construction. */
    baseImage: Uint8Array;
    /** Lazily initialized CRC table shared by include fingerprinting. */
    static crcTable: number[] | null;
    /** Metadata for files already included in this session. */
    includedFiles: Map<string, IncludedFileInfo>;
    /** Stack of include paths for nested include directives. */
    includeStack: string[];
    /** Search paths consulted when resolving include targets. */
    includePaths: string[];
    /** Monotonic id distinguishing anonymous labels across macro expansions. */
    macroLabelInstance: number;
    /** Whether execution is inside a macro expansion body. */
    inMacroExpansion: boolean;
    /** Most recently defined parent label for local label resolution. */
    currentParentLabel: string;
    /** Whether {@link currentParentLabel} was declared as global. */
    currentParentIsGlobal: boolean;
    /** Active top-level parent used to resolve single-dot local labels. */
    currentGlobalParentLabel: string;
    /** Explicit parent links for labels that do not encode ancestry in their names. */
    labelParents: Map<string, string | null>;
    /** When true, label reads must resolve to defined values immediately. */
    requireStaticLabelLookup: boolean;
    /** Session syntax values indexed by opaque builder identities, with source keys owned by the builder. */
    readonly passProgramCache: Map<string, RuntimeNode[]>;
    /** Directive handlers registered for this session's target and plugins. */
    directiveRegistry: DirectiveRegistry;
    /** Architecture encoder registry bound to the active target. */
    architectureRegistry: ArchitectureRegistry;
    /** Frozen plugin environment shared across sessions. */
    readonly environment: AssemblerEnvironment;
    /** Resolved target contribution id for this session. */
    readonly targetId: string;
    /** Validated target options frozen at construction. */
    readonly targetOptions: Readonly<Record<string, unknown>>;
    /** Active syntax profile controlling label and directive normalization. */
    readonly syntaxProfile: SyntaxProfile;
    /** Core directive groups exposed to plugins for this session. */
    readonly coreDirectiveGroups: readonly CoreDirectiveGroup[];
    /** Mutable plugin-owned session state store. */
    readonly pluginState: PluginSessionStateStore;
    /** Target address-space policy used for writes and label widths. */
    readonly pluginAddressSpace: PluginTargetAddressSpace;
    /** Target output format policy for container sizing and checksum rules. */
    readonly pluginOutputFormat: PluginTargetOutputFormat;
    private readonly activeLifecycles;
    /** Facade exposing cursor write helpers to directives. */
    readonly cursorAddress: CursorAddressFacade;
    /** Synchronous file provider used for includes and expression file reads. */
    readonly fileProvider: AssemblyFileProvider;
    /** Binary/resource dependencies and converted bytes owned by the active build. */
    readonly assetAssembly: AssetAssemblyService;
    /** Tooling-only path discovery avoids conversion on edit bursts. */
    /** When true, asset includes record edges without converting bytes. */
    deferAssetConversion: boolean;
    /** Front-end parser and command factory for this session. */
    readonly frontEndService: AssemblyFrontEndService;
    /** Incremental program model builder backing editor tooling. */
    readonly programModelBuilder: ProgramModelBuilder;
    /** Lowers normalized commands into executable runtime nodes. */
    readonly commandLoweringService: CommandLoweringService;
    /** Mutable parse state reused across incremental program builds. */
    readonly incrementalProgramParseState: IncrementalProgramParseState;
    private readonly services;
    /** Cached mutable snapshots for each executed assembly stage. */
    readonly stageExecutionStates: Map<AssemblyStageName, StageExecutionState>;
    /** Diagnostics accumulated during the current or most recent build. */
    readonly diagnostics: AssemblyDiagnostic[];
    /** Symbol definitions recorded for tooling and cross-reference analysis. */
    readonly symbolDefinitions: AssemblySymbolDefinition[];
    /** Symbol references recorded for tooling and cross-reference analysis. */
    readonly symbolReferences: AssemblySymbolReference[];
    /** Pure occurrence plans replay against the current scope instead of caching resolved references. */
    private readonly referencePlanner;
    /** Static records need replay only when the same deduplication fields or analysis epoch change. */
    private readonly stableReferences;
    private referenceEpoch;
    /** Include graph edges recorded for tooling analysis. */
    readonly includeEdges: AssemblyIncludeEdge[];
    /** Whether byte-to-source metadata is collected during emission. */
    readonly collectSourceMetadata: boolean;
    /** When false, `incsrc`/`include` record an edge but do not parse the included file. */
    followIncludes: boolean;
    private activeStageExecutionState;
    private analysisErrorRecoveryEnabled;
    private sessionDisposed;
    /** Nesting permits target hooks triggered synchronously by another plugin capability. */
    private borrowPluginCapabilities;
    /** Define directive engine for this session. */
    get defineEngine(): DefineEngine;
    /** Runtime dispatcher for structural directives. */
    get directiveRuntime(): DirectiveRuntimeService;
    /** Active logical address width in bytes from the target address space. */
    get addressWidth(): number;
    /** Architecture ids available on the active target. */
    get availableArchitectures(): ReadonlySet<string>;
    /** Human-readable target name for diagnostics. */
    get targetDisplayName(): string;
    /** Shared front-end command parsing service. */
    get frontEndCommandService(): FrontEndCommandService;
    /** Include and incsrc handling service. */
    get includeSource(): IncludeSourceService;
    /** Macro definition and expansion engine. */
    get macroEngine(): MacroEngine;
    /** Label and symbol scope service. */
    get symbolScope(): SymbolScopeService;
    /** Byte-oriented output writer bound to the session buffer. */
    get outputWriter(): OutputWriterService;
    /** Struct definition and initializer engine. */
    get structEngine(): StructEngine;
    /** Alias for {@link currentTargetAddress} used by legacy directive helpers. */
    get currentAddress(): number;
    /**
     * Records current address.
     */
    recordCurrentAddress(): void;
    /** Record raw input consumption at its actual output location, including incbin arrow seeks. */
    recordBinarySlice(file: string, start: number, end: number, bytes: Uint8Array): void;
    /**
     * Sets write position.
     * @param address The address.
     */
    setWritePosition(address: number): void;
    /**
     * Enters struct definition.
     * @param base The base.
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
     * @param num The num.
     */
    incrementBytesWritten(num: number): void;
    /** Whether the active stage sizes instructions without emitting bytes. */
    get mode(): "layout" | "emit";
    /** Whether byte writes are permitted in the active stage. */
    get canEmitBytes(): boolean;
    /** Whether the active stage may finalize output and enforce completion checks. */
    get canFinalize(): boolean;
    /** Whether unresolved labels are errors in the active stage. */
    get enforceResolvedLabels(): boolean;
    /** Whether the active stage collects definitions without emitting program bytes. */
    get isDefinitionCollectionStage(): boolean;
    /**
     * Reports whether structured tracing is active for this assembly session.
     * @returns Whether a trace listener is installed.
     */
    get isTracing(): boolean;
    /**
     * Traces write.
     * @param event The event.
     */
    traceWrite(event: Omit<AssemblerTraceWriteEvent, "type">): void;
    /**
     * Installs or clears the structured trace listener.
     * @param listener The listener to receive trace events.
     */
    setTraceListener(listener: AssemblerTraceListener | null): void;
    /**
     * Clears accumulated diagnostics and symbol definitions.
     */
    clearAnalysisArtifacts(): void;
    /**
     * Records a directed include-graph edge if it has not already been recorded.
     * Includes execute once per pass, so edges are de-duplicated by file pair.
     * @param fromFile The file issuing the include directive.
     * @param toFile The resolved path of the included file.
     */
    recordIncludeEdge(fromFile: string, toFile: string): void;
    /**
     * Returns the current source location.
     * @param [span] Optional source span override.
     * @returns The current source location.
     */
    getCurrentSourceLocation(span?: SourceSpan): AssemblySourceLocation;
    /**
     * Converts and records an unknown error.
     * @param error The error to normalize.
     * @param [span] Optional source span override.
     * @param [stage] Optional stage name.
     * @returns The recorded diagnostic.
     */
    reportErrorDiagnostic(error: unknown, span?: SourceSpan, stage?: AssemblyStageName): AssemblyDiagnostic;
    /**
     * Records a symbol definition if it has not already been recorded.
     * @param kind The symbol kind.
     * @param name The symbol name.
     * @param [options] Optional symbol metadata.
     * @param [options.file] Optional source file override.
     * @param [options.line] Optional source line override.
     * @param [options.span] Optional precise source span.
     * @param [options.value] Optional resolved symbol value.
     * @param [options.containerName] Optional owning container name.
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
     * @param kind The reference kind.
     * @param name The reference name.
     * @param [options] Optional reference metadata.
     * @param [options.file] Optional source file override.
     * @param [options.line] Optional source line override.
     * @param [options.span] Optional precise source span.
     * @param [options.containerName] Optional owning container name.
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
     * @param expression The expression.
     * @param [fallbackSpan] The fallback span.
     */
    collectExpressionReferences(expression: ExpressionNode | undefined, fallbackSpan?: SourceSpan): void;
    /**
     * Records one reference per struct-path segment so `obj.timer` can target
     * the struct root and the field independently.
     * @param expression The struct-rooted reference.
     * @param [fallbackSpan] The fallback span.
     */
    collectStructReferenceSegments(expression: ReferenceExpressionNode, fallbackSpan?: SourceSpan): void;
    /**
     * Returns the immediate struct/extension name a member should nest under.
     * Strips `[...]` so `obj[19].ext.index` yields `ext` for `index`.
     * Define roots (`!obj_arthur.flags2`) resolve through the define value
     * (`obj_start+obj[0]`) to the actual struct name.
     * @param object The object of a member access.
     * @returns The container name.
     */
    private structSegmentContainerName;
    /**
     * Finds a known struct name in a define's expansion, walking nested defines.
     * @param name The define name.
     * @param [seen] Define names already visited.
     * @returns The struct name, if any.
     */
    private structNameFromDefine;
    /**
     * Walks an expression right-to-left looking for a known struct identifier.
     * `obj_start+obj[0]` yields `obj`.
     * @param node The expression to search.
     * @param seen Define names already visited.
     * @returns The struct name, if any.
     */
    private structNameFromExpression;
    /**
     * Splits a hierarchical label (`_018049_8053`) into parent + sublabel
     * segments so each part can be targeted independently.
     * @param name The identifier text.
     * @returns Segments, if this is a known sublabel.
     */
    private hierarchicalLabelReferences;
    /**
     * Collects command references.
     * @param command The command.
     */
    collectCommandReferences(command: NormalizedCommand): void;
    /** Walk portable directive payloads, collecting expression nodes without interpreting enum/path strings. */
    private collectSyntaxReferences;
    /**
     * Runs a staged analysis pass and captures the first diagnostic instead of throwing.
     * @param program The program model to analyze.
     * @param [options] Optional analysis options.
     * @param [options.followIncludes] Whether to follow includes.
     * @param [options.stages] Optional stages to run.
     * @param [options.collectSourceMetadata] Whether to collect source metadata.
     * @returns The accumulated diagnostics and symbols.
     */
    collectProgramAnalysis(program: ProgramModel, options?: ProgramAnalysisOptions): AssemblyAnalysisResult;
    /**
     * Creates an isolated assembler session suitable for editor-style analysis.
     * This keeps batch assembly state and tooling state from leaking into each
     * other while still sharing the same file provider and directive registry.
     * @returns A configured analysis session.
     */
    createToolingSession(): Assembler;
    /**
     * Creates directive handlers bound to a fresh session's family capabilities.
     * @param session The session that should receive directive calls.
     * @returns A registry bound to the provided session.
     */
    cloneDirectiveRegistryForSession(session: Assembler): DirectiveRegistry;
    /**
     * Runs tooling analysis on an already-built program in an isolated session.
     * @param program Parsed program model to analyze.
     */
    analyzeProgram(program: ProgramModel): AssemblyAnalysisResult;
    /**
     * Builds and analyzes raw source without throwing on the first error.
     * @param source The source to analyze.
     * @param [sourceFile] Optional source file override.
     * @param [startLine] Optional starting line number.
     * @param [options] Optional analysis options.
     * @returns The analysis result and program model.
     */
    analyzeSource(source: string, sourceFile?: string, startLine?: number, options?: ProgramAnalysisOptions): AssemblyAnalysisResult & {
        program: ProgramModel;
    };
    /**
     * Analyzes multiple source documents sequentially in fresh tooling sessions.
     * @param documents Source buffers with paths and optional start lines.
     * @param options Analysis options applied to each document.
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
    /**
     * Aligns the module write cursor within the active section.
     * @param boundary Byte alignment boundary.
     * @param fill Fill byte used for padding when emitting.
     */
    alignModule(boundary: number, fill?: number): void;
    /** Write a typed field through the ordinary byte writer, retaining an independent symbolic record. */
    writeRelocation(expression: LinkExpression, encoding: RelocationEncoding): void;
    /** Numeric scalar directives and struct fields share exactly the encoder relocation contract. */
    writeExpression(expression: ExpressionNode, width: 1 | 2 | 3 | 4, endianness?: "little" | "big"): void;
    /** Records one emitted module byte against the current range kind, including asset tails. */
    recordModuleWrite(): void;
    /** Addressed record layouts acquire a section base only when they are actually initialized there. */
    recordModuleStructBase(name: string, base: number): void;
    /** Module syntax is registered only for object sessions, preserving absolute grammar identities. */
    private registerModuleDirectives;
    /** ORG/BASE adaptation is registered only for explicitly opted-in object sessions. */
    private registerAsarModuleLayout;
    /** Returns a detached producer result. No ROM finalizer or linker has run on its section bytes. */
    getAssemblyModule(): AssemblyModule;
    /**
     * Invokes a named hook on every active plugin lifecycle in registration order.
     * @param hookName Hook label used when wrapping plugin errors.
     * @param invoke Callback receiving each lifecycle instance.
     */
    runLifecycleHook(hookName: string, invoke: (lifecycle: SessionLifecycle) => void): void;
    /**
     * Runs plugin `beforeDirective` middleware until one handler consumes the directive.
     * @param keyword Canonical directive keyword being dispatched.
     * @param command Normalized command under dispatch.
     * @param syntax Parsed syntax snapshot when already available.
     */
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
     * @param [loopType] The innermost loop type.
     * @param [loopStartLine] The innermost loop start line.
     * @param [ifStartLine] The innermost conditional start line.
     * @returns Whether `endif` should close the innermost while loop.
     */
    shouldEndifCloseInnermostWhile(loopType?: "for" | "while", loopStartLine?: number, ifStartLine?: number): boolean;
    /**
     * Selects the session architecture and notifies plugin lifecycles.
     * @param architecture Architecture id or alias to activate.
     * @param sourceAlias Original alias text preserved for lifecycle hooks.
     */
    selectArchitecture(architecture: string, sourceAlias?: string): void;
    /**
     * Validates and notifies plugins before a multi-byte write at a logical address.
     * @param logicalAddress Target logical address of the write.
     * @param width Write width in bytes.
     */
    beforeWrite(logicalAddress: number, width: number): void;
    /**
     * Records one emitted byte against the active command source.
     * @param logicalAddress Logical byte address.
     * @param outputOffset Physical output offset, or a negative value when unmapped.
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
    /**
     * Reads an unsigned little-endian integer from a byte slice.
     * @param bytes Source buffer.
     * @param pos Starting byte index.
     * @param width Width in bytes, at most four.
     */
    readLittleEndian(bytes: Uint8Array, pos: number, width: number): number | undefined;
    /**
     * Check a byte interval after truncating its position and size to integers.
     * @param sourceLength Available source bytes.
     * @param position Zero-based byte offset.
     * @param size Requested byte count, which may be zero.
     * @returns Numeric 1 or 0 for use by assembly expressions.
     */
    canReadByteRange(sourceLength: number, position: number, size: number): number;
    /**
     * Read an unsigned little-endian value after truncating offset and width.
     * @param source Borrowed input bytes, never modified.
     * @param position Zero-based byte offset.
     * @param size Width in bytes, used by the 1–4-byte expression readers.
     * @param defaultValue Returned for an out-of-bounds read when supplied.
     * @param errorMessage Error thrown for an out-of-bounds read without a default.
     * @returns Unsigned value or the supplied default.
     */
    readByteRange(source: Uint8Array, position: number, size: number, defaultValue: number | undefined, errorMessage: string): number;
    /**
     * Resolves an include or expression path against session search paths.
     * @param filename Candidate path from source.
     */
    resolveReadablePath(filename: string): string | undefined;
    /**
     * Resolves a label identifier for expression evaluation, including loop bindings.
     * @param identifier Label or symbol text from an expression.
     */
    resolveExpressionHostLabel(identifier: string): number | string;
    /**
     * Returns the byte size of a struct or label object referenced in an expression.
     * @param identifier Object or label name.
     * @param baseOnly When true, ignore trailing field selectors.
     */
    getExpressionObjectSize(identifier: string, baseOnly?: boolean): number;
    /**
     * Looks up a textual define or active typed `for` loop counter by name.
     * @param varName Define or loop variable name.
     */
    lookupDefineValue(varName: string): string | undefined;
    /** Source file path of the macro currently being expanded, when applicable. */
    get currentMacroSourceFile(): string | undefined;
    /**
     * Returns how many bytes can be read from the base or output image at a logical address.
     * @param position Logical start address.
     * @param size Requested read width in bytes.
     */
    canReadBaseImage(position: number, size: number): number;
    /**
     * Reads an unsigned integer from the base or output image at a logical address.
     * @param position Logical start address.
     * @param size Read width in bytes.
     * @param defaultValue Value returned when the read is out of bounds.
     */
    readBaseImage(position: number, size: number, defaultValue?: number): number;
    /**
     * Returns how many bytes can be read from a resolved expression file path.
     * @param filename Path token from an expression.
     * @param position Byte offset within the file.
     * @param size Requested read width in bytes.
     */
    canReadExpressionFile(filename: string, position: number, size: number): number;
    /**
     * Reads an unsigned integer from a file resolved for expression evaluation.
     * @param filename Path token from an expression.
     * @param position Byte offset within the file.
     * @param size Read width in bytes.
     * @param defaultValue Value returned when the path or range is invalid.
     */
    readExpressionFile(filename: string, position: number, size: number, defaultValue?: number): number;
    /**
     * Installs the active target's expression contributions into this session.
     * @param setIds Resolved expression-set contribution IDs.
     */
    installExpressionFunctions(setIds: readonly string[]): void;
    /** Expression evaluation callbacks wired to this session's symbol and output state. */
    readonly expressionHost: ExpressionHost;
    /**
     * Advances the logical program counter.
     * @param num Number of logical address units to advance.
     */
    step(num: number): void;
    /**
     * Writes a single architecture byte to output.
     * @param num Byte value to write.
     */
    writeArchitectureByte(num: number): void;
    /**
     * Fills a section of output data with a value.
     * @param start The starting address.
     * @param value The value to fill with.
     * @param length The length of the section to fill.
     */
    fillOutputBytes(start: number, value: number, length: number): void;
    /** Store one already-validated emitted byte, preserving sparse gap fill and public fill overrides. */
    writeOutputByte(offset: number, value: number): void;
    /**
     * Builds a throwaway stage snapshot from the live session without caching it.
     * @param stage Assembly stage whose descriptor seeds the snapshot.
     */
    createEphemeralStageExecutionState(stage: AssemblyStageName): StageExecutionState;
    /**
     * Synchronizes active stage execution state.
     * @param stage The stage.
     */
    syncActiveStageExecutionState(stage: AssemblyStageName): void;
    /** Returns capabilities for the active stage, defaulting to definition collection. */
    getActiveStageCapabilities(): StageExecutionCapabilities;
    /** Assembly stage currently driving execution and tracing. */
    get traceStage(): AssemblyStageName;
    /** Public word entry; all source forms use the shared parser and typed execution contracts. */
    asblock_pick(words: string[]): boolean;
    /**
     * Resolves the canonical architecture name and registry definition for {@link arch}.
     */
    resolveActiveArchitecture(): {
        name: string;
        definition?: ArchitectureDefinition;
    };
    /**
     * Resolves target-specific directive prefixes without teaching the registry a dialect.
     * @param keyword Source directive keyword.
     * @returns Canonical registry keyword.
     */
    canonicalizeDirectiveKeyword(keyword: string): string;
    /**
     * Returns whether the active syntax profile treats a token as a named label.
     * @param candidate Candidate token.
     * @returns Whether the token is a named label.
     */
    isNamedLabelToken(candidate: string): boolean;
    /**
     * Writes 1, 2, 3, or 4 bytes to output.
     * @param num The byte to write.
     */
    write1(num: number): void;
    /**
     * Writes 2.
     * @param num The num.
     */
    write2(num: number): void;
    /**
     * Writes 3.
     * @param num The num.
     */
    write3(num: number): void;
    /**
     * Writes 4.
     * @param num The num.
     */
    write4(num: number): void;
    /**
     * Reads 1, 2, or 3 bytes from the configured output image.
     * @param logicalPosition The logical address to read from.
     * @returns The byte read from the output image.
     */
    read1(logicalPosition: number): number;
    /**
     * Reads a little-endian 16-bit value from the output image at a logical address.
     * @param logicalPosition Logical address to read.
     */
    read2(logicalPosition: number): number;
    /**
     * Reads a little-endian 24-bit value from the output image at a logical address.
     * @param logicalPosition Logical address to read.
     */
    read3(logicalPosition: number): number;
    /**
     * Parses one raw source line into a normalized command via the front-end service.
     * @param command Raw line text.
     * @param sourceFile Containing file path.
     * @param sourceLine Zero-based line index.
     * @param allowEmpty When true, empty lines produce a command node instead of null.
     */
    createNormalizedCommandFromRaw(command: string, sourceFile: string, sourceLine: number, allowEmpty?: boolean): NormalizedCommand | null;
    /**
     * Applies a `!name =` assignment without routing it through the incremental if-tree.
     * @param command The define assignment command.
     * @returns `true` when the define engine handled the command.
     */
    applyDefineAssignment(command: string): boolean;
    /**
     * Asar `'X' = $nn` / `"X" = $nn` table entries, including `''' = $2A` for apostrophe.
     * @param command Raw command text.
     * @returns `true` when the line was a character mapping.
     */
    tryHandleCharacterMapping(command: string): boolean;
    /** Scope expansion metadata and restore caller positions even when nested expansion fails. */
    withSourceOrigin(origin: SourceOrigin, execute: () => void): void;
    /** Include origins are execution-local; the same cached file can be reached from many callers. */
    withIncludeSource(file: string, execute: () => void, fromFile?: string): void;
    /**
     * Processes a command from an internal re-entrant source.
     * @param command The command to process.
     * @param [preprocessed] Whether comments and continuations were already normalized.
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
    /**
     * Lowers a program once per stage state and caches the result on that state.
     * @param stageState Stage snapshot owning the lowered program cache.
     * @param program Parsed program to lower.
     */
    getOrCreateLoweredProgram(stageState: StageExecutionState, program: ProgramModel): LoweredProgram;
    /**
     * Dispatches lowered node.
     * @param lowered The lowered.
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
     * @param defLine The function definition line.
     */
    parseFunctionDefinition(defLine: string): void;
    /**
     * Adds a mapping of the current address to the source line number.
     * @param address The logical address to add to the mapping.
     */
    addAddressToLine(address: number): void;
    /**
     * Evaluates a range expression and returns the result.
     * @param expr The expression to evaluate.
     * @returns The result of the expression.
     */
    evaluateRangeExpression(expr: string | ExpressionNode): number;
    /**
     * Replace include search paths before assembly. Retains the array without copying.
     * @param paths Provider-specific search paths. Node resolves relative paths from cwd.
     */
    setIncludePaths(paths: string[]): void;
    /**
     * Evaluates an expression for conditionals (if, while).
     * @param expression The expression to evaluate.
     * @returns True if the expression is true, false otherwise.
     */
    evaluateExpression(expression: string | ExpressionNode): boolean;
    /**
     * Evaluate an assertion, or defer it when skipped asset bytes make its inputs provisional.
     * Literal arithmetic and expanded numeric defines remain checkable during editor analysis.
     * @param expression Assertion condition.
     * @returns The condition result, or undefined until a build resolves the layout.
     */
    evaluateAssertion(expression: string | ExpressionNode): boolean | undefined;
    /**
     * Parses string input into an expression node and resolves nested references/defines.
     * @param expression The expression source or parsed node.
     * @returns The resolved expression tree.
     */
    resolveExpressionInput(expression: string | ExpressionNode): ExpressionNode;
    /**
     * Recursively resolves define references and nested reference-expression nodes.
     * @param expression The expression node to resolve.
     * @returns The resolved expression node.
     */
    resolveExpressionNode(expression: ExpressionNode): ExpressionNode;
    /**
     * Resolves reference-style expressions such as identifiers, define references,
     * member access, and indexed access into either simpler reference nodes or
     * raw/math expressions when defines collapse them further.
     * @param expression The reference expression to resolve.
     * @returns The resolved expression tree.
     */
    resolveReferenceExpressionNode(expression: ReferenceExpressionNode): ExpressionNode;
    /**
     * Resolves a reference expression all the way to a numeric value.
     * @param expression The reference expression to evaluate.
     * @param [requireStatic] Whether labels must be static.
     * @returns The numeric value of the reference.
     */
    evaluateReferenceExpressionNode(expression: ReferenceExpressionNode, requireStatic?: boolean): number;
    /**
     * Resolves a reference expression to either a numeric value or a normalized
     * label/struct lookup target, depending on how far the expression collapses.
     * @param expression The reference expression to resolve.
     * @param [requireStatic] Whether labels must be static.
     * @returns The resolved numeric value.
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
     * @param input The token to resolve.
     * @returns The resolved address string, if applicable.
     */
    tryResolveRelativeLabelToken(input: string): string | undefined;
    /**
     * Resolves direct `!name` define references that are not assignments.
     * @param input The token to resolve.
     * @returns The resolved define value, if applicable.
     */
    tryResolveDirectDefineReference(input: string): string | undefined;
    /**
     * Resolves macro-label references such as `?label` or `#+?label`.
     * @param input The token to resolve.
     * @returns The resolved macro-label value, if applicable.
     */
    tryResolveMacroLabelReference(input: string): string | undefined;
    /**
     * Resolves bare label-like tokens before the generic character-by-character
     * define scanner runs.
     * @param input The token to resolve.
     * @returns The resolved label value, if applicable.
     */
    tryResolveBareLabelReference(input: string): string | undefined;
    /**
     * Resolves all define replacements in a given string.
     * @param input The string to resolve defines in.
     * @returns The string with defines resolved.
     */
    resolvedefines(input: string): string;
    /** Bind source-valued defines without converting symbol references into numeric source text. */
    resolveDefineFragment(fragment: SourceFragment): SourceFragment;
    /**
     * Handles activate stage.
     * @param stage The stage.
     */
    activateStage(stage: AssemblyStageName): void;
    /**
     * Completes the current pass, performing any necessary cleanup.
     */
    finishPass(): void;
    /**
     * Sets the current file being processed.
     * @param filename The filename to set.
     */
    setCurrentFile(filename: string): void;
    /**
     * Sets the current line number.
     * @param line The line number to set.
     */
    setCurrentLine(line: number): void;
    /**
     * Maps a stage name to its execution capabilities without mutating session state.
     * @param stage Assembly stage identifier.
     */
    getStageDescriptor(stage: AssemblyStageName): Pick<StageExecutionState, "stage" | "capabilities">;
    /**
     * Deep-copies anonymous forward/backward label stacks for stage isolation.
     * @param source Label stacks keyed by relative depth.
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
     * Builds a fresh stage snapshot seeded from the previous stage when applicable.
     * @param stage Assembly stage to initialize.
     */
    createStageExecutionState(stage: AssemblyStageName): StageExecutionState;
    /**
     * Applies stage execution state.
     * @param stageState The stage state.
     */
    applyStageExecutionState(stageState: StageExecutionState): void;
    /**
     * Captures stage execution state.
     * @param stageState The stage state.
     */
    captureStageExecutionState(stageState: StageExecutionState): void;
    /**
     * Returns a cached stage snapshot, creating it on first use.
     * @param stage Assembly stage key.
     */
    getOrCreateStageExecutionState(stage: AssemblyStageName): StageExecutionState;
    /**
     * Parses source into a program model using the session front-end grammar.
     * @param source Raw assembly source text.
     * @param sourceFile Path attributed to the buffer.
     * @param startLine Zero-based line offset for embedded fragments.
     */
    buildProgramModel(source: string, sourceFile?: string, startLine?: number): ProgramModel;
    /**
     * Executes one assembly stage against a parsed program, updating session state in place.
     * @param stage Stage to run.
     * @param program Program whose grammar must match the current front-end identity.
     */
    runStage(stage: AssemblyStageName, program: ProgramModel): StageExecutionState;
    /**
     * Run definition collection, layout resolution, and byte emission synchronously in that order.
     * Throws at the first unrecovered failure. Partial state/output is not a successful binary.
     * @param program Parsed source model produced for this target's syntax.
     */
    assembleProgram(program: ProgramModel): void;
    /**
     * Parse and run all three assembly stages. Includes are read through the configured provider.
     * Throws on failure. Read the finalized bytes with getBinaryOutput after success.
     * @param source Assembly source text, not a filename.
     * @param [sourceFile] Source identity and include-resolution base. Defaults to currentFile.
     * @param [startLine] Zero-based line offset. Defaults to zero.
     * @returns Parsed model used for this build.
     */
    assembleSource(source: string, sourceFile?: string, startLine?: number): ProgramModel;
    /**
     * Writes a repeated byte into the output buffer.
     * @param start The starting address of the block to write.
     * @param value The byte value to write.
     * @param [length] The length of the block to write.
     */
    writeOutputBytes(start: number, value: number, length?: number): void;
    /**
     * Expands the output buffer and fills it with a specified byte.
     * @param newSize The new output size.
     * @param fillByte The byte used for the new range.
     */
    expandOutput(newSize: number, fillByte: number): void;
    /** Runs the active output-format finalizer. */
    finalizeOutput(): void;
    /**
     * Materialize the target format's current bytes without assembling or finalizing again.
     * @returns Output whose ownership depends on the formatter. Copy before retaining or mutating independently.
     */
    getBinaryOutput: () => Uint8Array;
    /**
     * Lowers completed runtime nodes and executes them through the production executor.
     * @param nodes The runtime nodes to lower and execute.
     */
    lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void;
    /**
     * Evaluates numeric start and end bounds for a lowered `for` loop header.
     * @param forBlock Lowered loop node carrying parsed and cached bounds.
     */
    resolveForLoopBounds(forBlock: LoweredLoopNode): {
        variable?: string;
        start?: number;
        end?: number;
    };
    /**
     * Executes for loop iterations.
     * @param forBlock The for block.
     * @param executeBody The execute body.
     */
    executeForLoopIterations(forBlock: LoweredLoopNode, executeBody: () => void): void;
    /**
     * Executes lowered loop.
     * @param loopBlock The loop block.
     */
    executeLoweredLoop(loopBlock: LoweredLoopNode): void;
    /**
     * Executes lowered for loop.
     * @param forBlock The for block.
     */
    executeLoweredForLoop(forBlock: LoweredLoopNode): void;
    /**
     * Executes while loop commands.
     * @param whileBlock The while block.
     * @param commands The commands.
     * @param getDefineTarget The get define target.
     * @param executeCommand The execute command.
     */
    executeWhileLoopCommands<TCommand>(whileBlock: LoweredLoopNode, commands: TCommand[], getDefineTarget: (command: TCommand) => string | null, executeCommand: (command: TCommand) => void): void;
    /**
     * Executes lowered while loop.
     * @param whileBlock The while block.
     */
    executeLoweredWhileLoop(whileBlock: LoweredLoopNode): void;
    /**
     * Returns the normalized source span for diagnostics on a lowered executable node.
     * @param node Lowered command or loop header node.
     */
    getLoweredNodeSpan(node: LoweredExecutableNode): SourceSpan | undefined;
    /**
     * Executes a tree or lowered node while routing analysis-mode failures into diagnostics.
     * @param node The node to execute.
     * @param getSpan Resolves the node span for diagnostics.
     * @param executeNode Executes the node with its native dispatcher.
     */
    executeWithAnalysisRecovery<TNode>(node: TNode, getSpan: (node: TNode) => SourceSpan | undefined, executeNode: (node: TNode) => void): void;
    /**
     * Executes lowered node with recovery.
     * @param node The node.
     */
    executeLoweredNodeWithRecovery(node: LoweredExecutableNode): void;
    /**
     * Executes lowered node.
     * @param node The node.
     */
    executeLoweredNode(node: LoweredExecutableNode): void;
    /**
     * Executes lowered node stream.
     * @param nodes The nodes.
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
     * @param branches The branches.
     * @param executeCommands The execute commands.
     */
    executeConditionalBranches<TCommand>(branches: Array<{
        kind: "if" | "elseif" | "else";
        conditionNode?: ExpressionNode;
        commands: TCommand[];
    }>, executeCommands: (commands: TCommand[]) => void): void;
}
export {};
//# sourceMappingURL=assembler.d.ts.map