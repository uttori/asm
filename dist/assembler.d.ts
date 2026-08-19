import { Arch65816 } from "./Arch65816.js";
import { Arch6502 } from "./Arch6502.js";
import { ArchSPC700 } from "./ArchSPC700.js";
import { ArchSuperFX } from "./ArchSuperFX.js";
import type { CursorAddressFacade } from "./assembler-internals.js";
import type { ExpressionHost, LoweredInstruction, LoweredOperand } from "./architecture-types.js";
import { AddressToLineMapping } from "./addressToLine.js";
import type { AssemblerTraceCommandEvent, AssemblerTraceListener, AssemblerTraceWriteEvent } from "./debug-tracing.js";
import { type AssemblyAnalysisResult, type AssemblyDiagnostic, type AssemblyIncludeEdge, type AssemblySourceLocation, type AssemblySymbolDefinition, type AssemblySymbolKind, type AssemblySymbolReference, type AssemblySymbolReferenceKind } from "./diagnostics.js";
import type { ConditionalBranchNode, ExecutableNode, LoopNode, MacroDefinitionNode } from "./ir/assembly-tree.js";
import { type ExpressionNode, type ReferenceExpressionNode } from "./ir/expression-node.js";
import { type NormalizedCommand } from "./ir/normalized-command.js";
import { MathCore } from "./mathcore.js";
import { OperandResolver } from "./operand-resolver.js";
import { type ArchitectureDefinition, type ArchitectureExtension, type ArchitectureRegistry } from "./architecture-registry.js";
import { DirectiveRegistry } from "./directives/registry.js";
import { DefineEngine } from "./services/define-engine.js";
import { DirectiveRuntimeService } from "./services/directive-runtime-service.js";
import { AssemblyFrontEndService } from "./services/assembly-front-end-service.js";
import { CommandLoweringService, type LoweredCommand, type LoweredExecutableNode, type LoweredLoopNode, type LoweredProgram } from "./services/command-lowering-service.js";
import { FrontEndCommandService } from "./services/front-end-command-service.js";
import { IncludeSourceService, type IncludedFileInfo } from "./services/include-source-service.js";
import { MacroEngine } from "./services/macro-engine.js";
import { ProgramModelBuilder, type IncrementalProgramParseState, type ProgramModel } from "./services/program-model-builder.js";
import { RomWriterService } from "./services/rom-writer-service.js";
import { StructEngine } from "./services/struct-engine.js";
import { SymbolScopeService } from "./services/symbol-scope-service.js";
import type { SourceSpan } from "./source-location.js";
import { type AssemblyFileProvider } from "./file-provider.js";
import { type TargetExpressionFeature, type TargetProfile } from "./target-profile.js";
/** Represents a macro definition. */
export type MacroDefinition = {
    /** The name of the macro. */
    name: string;
    /** Fixed parameter names. */
    params: string[];
    /** Whether the macro has a variable number of parameters. */
    variadic: boolean;
    /** Typed commands captured inside the macro body. */
    body: NormalizedCommand[];
    /** The file where this macro was defined. */
    sourceFile?: string;
};
type RuntimeConditionalNode = ConditionalBranchNode;
export type RuntimeNode = NormalizedCommand | LoopNode | RuntimeConditionalNode;
export type AssemblyStageName = "collectDefinitions" | "resolveLayout" | "emitProgram";
export type StageExecutionMode = "layout" | "emit";
export type StageExecutionCapabilities = {
    instructionMode: StageExecutionMode;
    canEmitBytes: boolean;
    canFinalize: boolean;
    enforceResolvedLabels: boolean;
    isDefinitionCollectionStage: boolean;
};
export type StageCursorState = {
    currentTargetAddress: number;
    currentTargetBaseAddress: number;
    currentTargetStartAddress: number;
    currentTargetBaseStartAddress: number;
    bytes: number;
};
export type StageSymbolState = {
    labelTable: Map<string, LabelEntry>;
    forwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    backwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    currentGlobalParentLabel: string;
    labelParents: Map<string, string | null>;
};
export type StageControlState = {
    namespaceStack: string[];
    currentNamespace: string;
    namespaceNestingEnabled: boolean;
    namespaceNestingPath: string[];
    inMacroExpansion: boolean;
    macroLabelInstance: number;
};
export type StageWriteState = {
    inSpcblock: boolean;
    spcblockData: SpcblockData | null;
    spcInlineCompatMode: boolean;
    activeFreespaceStartPc: number | null;
    activeFreespaceContentStartPc: number | null;
};
export type StageExecutionState = {
    stage: AssemblyStageName;
    capabilities: StageExecutionCapabilities;
    cursor: StageCursorState;
    symbols: StageSymbolState;
    control: StageControlState;
    writeState: StageWriteState;
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
    romWriter: RomWriterService;
    structEngine: StructEngine;
    symbolScope: SymbolScopeService;
};
type TraceCommandContext = Pick<AssemblerTraceCommandEvent, "file" | "line" | "raw" | "normalized">;
export type WhileTracker = {
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
export type LabelEntry = {
    value: number;
    isStatic: boolean;
    isMacroLabel?: boolean;
    /** Tracks which macro instance this label belongs to */
    macroInstance?: number;
    /** Whether this label affects the sublabel hierarchy */
    modifiesHierarchy?: boolean;
};
export interface StructDefinition {
    name: string;
    /** The SNES start address for the struct. */
    base: number;
    /** Running offset as member commands are processed. */
    offset: number;
    /** Final size (after alignment, etc.) */
    size: number;
    /** Mapping from member name (without the leading dot) to its offset. */
    labels: Map<string, number>;
    /** Optional alignment (if specified in endstruct). */
    align?: number;
    /** If this struct extends a parent. */
    parent?: string;
    /** Cached maximum child extension size, or zero when there are no extensions. */
    extensionSize: number;
}
export type PushPcStackEntry = {
    currentTargetAddress: number;
    currentTargetStartAddress: number;
    currentTargetBaseAddress: number;
    currentTargetBaseStartAddress: number;
};
export type SpcblockType = "nspc" | "custom";
export type SpcblockData = {
    destination: number;
    type: SpcblockType;
    sizeAddress: number;
    executeAddress: number | null;
    namespaceBackup: string;
};
export type AssemblerOptions = {
    fileProvider?: AssemblyFileProvider;
    collectSourceMetadata?: boolean;
    targetProfile?: TargetProfile;
    architectureExtensions?: readonly ArchitectureExtension[];
};
export declare class Assembler {
    /** The current target address. `snespos` */
    currentTargetAddress: number;
    /** The current target base address. `realsnespos` */
    currentTargetBaseAddress: number;
    /** The current target start address. `startpos` */
    currentTargetStartAddress: number;
    /** The current target base start address. `realstartpos` */
    currentTargetBaseStartAddress: number;
    bytes: number;
    pushBaseStack: number[];
    /** Possible values: lorom, hirom, exlorom, exhirom, sa1rom, sfxrom, bigsa1rom, norom */
    mapper: string;
    /** Disabled after `norom` to match Asar checksum behavior. */
    checksumFixEnabled: boolean;
    /** Header checksum algorithm mode: "asar" (default) or "simple". */
    checksumMode: "asar" | "simple";
    /** Bank crossing policy controlled by `check bankcross ...`. */
    bankCrossCheckMode: "off" | "full" | "half";
    /** Read* functions are enabled when patch-style title check is active. */
    readFunctionsEnabled: boolean;
    /** Controls direct-page shortening for 65816 when no explicit length is given. */
    optimizeDirectPage: boolean;
    sa1banks: number[];
    /** Placeholder for ROM */
    romdata: number[] | Uint8Array;
    defaultFreespaceByte: number;
    activeFreespaceStartPc: number | null;
    activeFreespaceContentStartPc: number | null;
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
    characterMappings: Map<string, number>;
    currentTable: string | null;
    tableStack: Map<string, number>[];
    inFunctionDefinition: boolean;
    functionDefinitionLines: string[];
    arch65816: Arch65816;
    arch6502: Arch6502;
    archSPC700: ArchSPC700;
    archSuperFX: ArchSuperFX;
    arch: string;
    pushpcStack: PushPcStackEntry[];
    pushpcnum: number;
    labelTable: Map<string, LabelEntry>;
    /** Track multiple `+` labels */
    forwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    /** Track multiple `-` labels */
    backwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    padUnit: number;
    padbyte: number[];
    structs: Map<string, StructDefinition>;
    currentStruct: StructDefinition | null;
    savedPCStack: number[];
    /** Initialize fill pattern */
    fillbyte: number[];
    targetRom: Uint8Array;
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
    inSpcblock: boolean;
    spcblockData: SpcblockData | null;
    spcInlineCompatMode: boolean;
    requireStaticLabelLookup: boolean;
    readonly passProgramCache: Map<string, RuntimeNode[]>;
    directiveRegistry: DirectiveRegistry;
    architectureRegistry: ArchitectureRegistry;
    readonly targetProfile: TargetProfile;
    readonly architectureExtensions: readonly ArchitectureExtension[];
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
    activeStageExecutionState: StageExecutionState | null;
    analysisErrorRecoveryEnabled: boolean;
    runtimePassthroughRewriteEnabled: boolean;
    get defineEngine(): DefineEngine;
    get directiveRuntime(): DirectiveRuntimeService;
    get frontEndCommandService(): FrontEndCommandService;
    get includeSource(): IncludeSourceService;
    get macroEngine(): MacroEngine;
    get symbolScope(): SymbolScopeService;
    get romWriter(): RomWriterService;
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
     * Collects command references.
     * @param {NormalizedCommand} command The command.
     */
    collectCommandReferences(command: NormalizedCommand): void;
    /**
     * Runs a staged analysis pass and captures the first diagnostic instead of throwing.
     * @param {ProgramModel} program The program model to analyze.
     * @returns {AssemblyAnalysisResult} The accumulated diagnostics and symbols.
     */
    collectProgramAnalysis(program: ProgramModel): AssemblyAnalysisResult;
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
     * @returns {AssemblyAnalysisResult & { program: ProgramModel }} The analysis result and program model.
     */
    analyzeSource(source: string, sourceFile?: string, startLine?: number): AssemblyAnalysisResult & {
        program: ProgramModel;
    };
    /**
     * Analyzes workspace.
     * @param {Array<{ source: string; sourceFile: string; startLine?: number }>} documents The documents.
     * @returns {Array<AssemblyAnalysisResult & { program: ProgramModel; sourceFile: string }>} The result.
     */
    analyzeWorkspace(documents: Array<{
        source: string;
        sourceFile: string;
        startLine?: number;
    }>): Array<AssemblyAnalysisResult & {
        program: ProgramModel;
        sourceFile: string;
    }>;
    /**
     * Loads test rom data.
     */
    loadTestRomData(): void;
    /**
     * Creates cursor address facade.
     * @returns {CursorAddressFacade} The result.
     */
    createCursorAddressFacade(): CursorAddressFacade;
    /**
     * Creates services.
     * @returns {AssemblerServiceBag} The result.
     */
    createServices(): AssemblerServiceBag;
    constructor(targetRom?: number[] | Uint8Array, options?: AssemblerOptions);
    /**
     * Sets ROM header checksum calculation mode.
     * @param {"asar" | "simple"} mode The checksum mode to use.
     */
    setChecksumMode(mode: "asar" | "simple"): void;
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
     * Checks whether it can read target rom.
     * @param {number} position The position.
     * @param {number} size The size.
     * @returns {number} The result.
     */
    canReadTargetRom(position: number, size: number): number;
    /**
     * Reads target rom.
     * @param {number} position The position.
     * @param {number} size The size.
     * @param {number} [defaultValue] The default value.
     * @returns {number} The result.
     */
    readTargetRom(position: number, size: number, defaultValue?: number): number;
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
     * Rejects target-specific expression functions outside their target profile.
     * @param {TargetExpressionFeature} feature Required target feature.
     * @param {string} functionName User-facing expression function name.
     */
    assertTargetExpressionFeature(feature: TargetExpressionFeature, functionName: string): void;
    readonly expressionHost: ExpressionHost;
    /**
     * Advances memory position while handling bank crossing.
     * @param {number} num The number of bytes to advance.
     */
    step(num: number): void;
    /**
     * Writes a single byte to ROM.
     * @param {number} num - The byte to write.
     */
    write1_65816(num: number): void;
    /**
     * Fills a section of ROM data with a value.
     * @param {number} start The starting address.
     * @param {number} value The value to fill with.
     * @param {number} length The length of the section to fill.
     */
    fillRomData(start: number, value: number, length: number): void;
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
     * Writes 1, 2, 3, or 4 bytes to ROM.
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
     * Reads 1, 2, or 3 bytes from ROM.
     * @param {number} insnespos - The SNES address to read from.
     * @returns {number} The byte read from ROM.
     */
    read1(insnespos: number): number;
    /**
     * Reads 2.
     * @param {number} insnespos The insnespos.
     * @returns {number} The result.
     */
    read2(insnespos: number): number;
    /**
     * Reads 3.
     * @param {number} insnespos The insnespos.
     * @returns {number} The result.
     */
    read3(insnespos: number): number;
    /**
     * Handles assembleblock.
     * @param {string} block The block.
     */
    assembleblock(block: string): void;
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
     * Processes a single command from `assembleblock`.
     * @param {string} command - The command to process.
     */
    processCommand(command: string): void;
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
     * @param {number} address The SNES address to add to the mapping.
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
     * Writes a block of data to ROM.
     * @param {number} start The starting address of the block to write.
     * @param {number} value The byte value to write.
     * @param {number} [length] The length of the block to write.
     */
    writeDataBytes(start: number, value: number, length?: number): void;
    /**
     * Expands ROM size and fills it with a specified byte.
     * @param {number} newSize The new size of the ROM.
     * @param {number} fsByte The byte value to fill the ROM with.
     */
    expandRom(newSize: number, fsByte: number): void;
    /**
     * Updates the header checksum (16-bit) and CRC32.
     * For LoROM, the header is at 0x7FC0; for HiROM (and exhirom) at 0xFFC0.
     */
    updateHeaderAndCRC32(): void;
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
    /**
     * Parses command stream to nodes.
     * @param {string[]} commands The commands.
     * @param {string} [sourceFile] The source file.
     * @param {number} [startLine] The start line.
     * @returns {RuntimeNode[]} The result.
     */
    parseCommandStreamToNodes(commands: string[], sourceFile?: string, startLine?: number): RuntimeNode[];
    /**
     * Gets or build pass program.
     * @param {string[]} commands The commands.
     * @param {string} [sourceFile] The source file.
     * @param {number} [startLine] The start line.
     * @returns {RuntimeNode[]} The result.
     */
    getOrBuildPassProgram(commands: string[], sourceFile?: string, startLine?: number): RuntimeNode[];
    /**
     * Gets macro definition node.
     * @param {string} name The name.
     * @returns {MacroDefinitionNode | undefined} The result.
     */
    getMacroDefinitionNode(name: string): MacroDefinitionNode | undefined;
}
export {};
//# sourceMappingURL=assembler.d.ts.map