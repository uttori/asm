import { normalizeAddressForWidth } from "./address-width.js";
import { AddressToLineMapping } from "./addressToLine.js";
import { ArchitectureRegistry, type ArchitectureDefinition } from "./architecture-registry.js";
import type { ArchitectureEncoder, ExpressionHost } from "./architecture-types.js";
import type {
  AssemblerTraceCommandEvent,
  AssemblerTraceListener,
  AssemblerTraceWriteEvent,
} from "./debug-tracing.js";
import {
  type AssemblyAnalysisResult,
  type AssemblyDiagnostic,
  type AssemblyIncludeEdge,
  type AssemblySourceLocation,
  type AssemblySymbolDefinition,
  type AssemblySymbolKind,
  type AssemblySymbolReference,
  type AssemblySymbolReferenceKind,
  createAssemblySourceLocation,
  diagnosticFromError,
  rememberErrorSource,
} from "./diagnostics.js";
import { CORE_DIRECTIVE_GROUPS, type CoreDirectiveGroup } from "./directive-groups.js";
import { inheritCoreDataHandler, isCoreDataDirective } from "./directives/data.js";
import { DirectiveRegistry, createDirectiveRegistry } from "./directives/registry.js";
import { NodeAssemblyFileProvider, type AssemblyFileProvider } from "./file-provider.js";
import {
  withAstQualification,
  withSourceSyntax,
  withTypedExecution,
  incrementInternalCounter,
  measureInternalPhase,
} from "./internal-instrumentation.js";
import type { ConditionalBranchNode, ExecutableNode, LoopNode } from "./ir/assembly-tree.js";
import { assetCallGuard, parseAssetCall } from "./ir/asset-call.js";
import { parseDataList } from "./ir/data-node.js";
import {
  inheritExpressionOccurrence,
  isReferenceExpressionNode,
  parseExpressionAtSite,
  parseExpressionNode,
  renderExpressionNode,
  type ExpressionNode,
  type ReferenceExpressionNode,
} from "./ir/expression-node.js";
import {
  compileLinkExpression,
  linkBinary,
  linkConstant,
  requireLinkConstant,
  type LinkExpression,
  type LinkExpressionContext,
} from "./ir/link-expression.js";
import {
  cloneNormalizedCommand,
  createNormalizedCommand,
  classifyCommand,
  type NormalizedCommand,
} from "./ir/normalized-command.js";
import { bindInstructionOperands, OperandTemplateBindingError } from "./ir/parsed-operand.js";
import { referencePath, type ReferenceResolution } from "./ir/reference-path.js";
import { ReferencePlanner } from "./ir/reference-plan.js";
import { InstructionResolutionFrame } from "./ir/resolved-instruction.js";
import {
  fragmentText,
  sourceFragment,
  sliceSourceFragment,
  type SourceFragment,
} from "./ir/source-fragment.js";
import { materializeNumericData } from "./ir/statement-node.js";
import {
  syntaxRecord,
  syntaxString,
  syntaxArray,
  syntaxOptional,
  syntaxExpression,
} from "./ir/syntax-codec.js";
import { MathCore } from "./mathcore.js";
import { OperandResolver } from "./operand-resolver.js";
import { PLUGIN_API_VERSION } from "./plugin/contracts.js";
import type { AssemblyStageName } from "./plugin/contracts.js";
import {
  type AssemblerEnvironment,
  type LifecycleContribution,
  type OwnedContribution,
  type SessionLifecycle,
  type TargetAddressSpace as PluginTargetAddressSpace,
  type TargetOutputFormat as PluginTargetOutputFormat,
  PluginError,
  PluginSessionStateStore,
  type PluginStateSnapshot,
} from "./plugin/index.js";
import { clonePluginSyntax } from "./plugin/syntax-snapshot.js";
import type {
  AssemblyModule,
  AssemblyModuleOptions,
  AssemblySectionOptions,
  RelocatableSource,
  RelocationEncoding,
} from "./relocatable.js";
import { AsarModuleLayout } from "./services/asar-module-layout.js";
import {
  AssemblyFrontEndService,
  type AssemblyFrontEndHost,
} from "./services/assembly-front-end-service.js";
import { AssemblyOutputBuffer } from "./services/assembly-output-buffer.js";
import { AssetAssemblyService } from "./services/asset-assembly-service.js";
import {
  CommandLoweringService,
  type LoweredCommand,
  type LoweredStatement,
  type LoweredExecutableNode,
  type LoweredLoopNode,
  type LoweredProgram,
} from "./services/command-lowering-service.js";
import { isBareLabelReference } from "./services/command-text-service.js";
import { DefineEngine } from "./services/define-engine.js";
import {
  DirectiveRuntimeService,
  type PushPcStackEntry,
} from "./services/directive-runtime-service.js";
import { FrontEndCommandService } from "./services/front-end-command-service.js";
import { IncludeSourceService, type IncludedFileInfo } from "./services/include-source-service.js";
import { MacroEngine, type MacroDefinition } from "./services/macro-engine.js";
import { ModuleAssembly } from "./services/module-assembly.js";
import { ModuleFileProvider } from "./services/module-file-provider.js";
import { OutputWriterService } from "./services/output-writer-service.js";
import { createPluginSessionCapabilities } from "./services/plugin-session-capabilities.js";
import {
  ProgramModelBuilder,
  type IncrementalProgramParseState,
  type ProgramModel,
} from "./services/program-model-builder.js";
import { StructEngine, type StructDefinition } from "./services/struct-engine.js";
import {
  parseStructInitializerEntries,
  structInitializerStart,
} from "./services/struct-initializer.js";
import { getStructMetadata } from "./services/struct-metadata.js";
import {
  SymbolScopeService,
  parseUnnamedLabelReference,
  type LabelEntry,
} from "./services/symbol-scope-service.js";
import { createTextSpan, sourceLineStarts, type SourceSpan } from "./source-location.js";
import type { SourceOrigin } from "./source-provenance.js";
import { ASAR_SYNTAX_PROFILE, type SyntaxProfile } from "./syntax-profile.js";

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
  forwardLabels: { [depth: number]: { addr: number; macroInstance?: number; unit?: string }[] };
  backwardLabels: { [depth: number]: { addr: number; macroInstance?: number; unit?: string }[] };
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

/** Constructed service instances shared by the assembler facade and internal dispatchers. */
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

/** Narrow write-position API exposed to directives without the full assembler surface. */
type CursorAddressFacade = {
  recordCurrentAddress(): void;
  setWritePosition(address: number): void;
  syncWriteStarts(): void;
  incrementBytesWritten(num: number): void;
};
/**
 * Source context stack used to associate low-level byte writes with the
 * currently executing normalized command, even when directives recurse.
 */
type TraceCommandContext = Pick<
  AssemblerTraceCommandEvent,
  "file" | "line" | "raw" | "normalized" | "origin"
>;

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

const TOOLING_ANALYSIS_STAGES: readonly AssemblyStageName[] = ["collectDefinitions"];

/** One activated plugin lifecycle with optional directive keyword filtering. */
type ActiveLifecycle = {
  record: OwnedContribution<LifecycleContribution>;
  instance: SessionLifecycle;
  /** Session-local lookup; the frozen contribution retains the portable array declaration. */
  directiveKeywords?: ReadonlySet<string>;
};

/**
 * Mutable, synchronous build session. Share its frozen environment with other sessions, not its state.
 * Use assembleSource/assembleProgram for builds and analyzeSource for recovering diagnostics.
 * Dispose the session before its plugin manager or loader. Use a fresh session after a failed build.
 * Public runtime fields and service methods support directives and tooling and require stage invariants.
 */
export class Assembler {
  /** Section-relative output owner, absent for ordinary absolute assembly. */
  readonly moduleAssembly?: ModuleAssembly;
  /** Source adapters are session-local and never participate in the absolute execution path. */
  private readonly moduleOptions?: AssemblyModuleOptions;
  private readonly asarModuleLayout?: AsarModuleLayout;
  private readonly moduleFiles?: ModuleFileProvider;
  private moduleRangeKind: import("./relocatable.js").AssemblyModuleRange["kind"] = "data";
  private moduleAssetRemaining = 0;
  /** A synchronous assignment borrows the existing scope writer while replacing only its numeric binding. */
  private moduleAssignmentValue?: LinkExpression;

  /** Stable symbol-scope identity, independent of include basenames or final placement. */
  /** Stable module id when section-relative assembly is enabled. */
  get moduleIdentity(): string | undefined {
    return this.moduleAssembly?.id;
  }
  /** Active section name when writing relocatable module bytes. */
  get moduleSection(): string | undefined {
    return this.moduleAssembly?.position().section;
  }
  /** The current logical target address. */
  public currentTargetAddress: number = 0;
  /** The current logical target base address. */
  public currentTargetBaseAddress: number = 0;
  /** The current target start address. `startpos` */
  public currentTargetStartAddress: number = 0;
  /** The current target base start address. `realstartpos` */
  public currentTargetBaseStartAddress: number = 0;
  /** Total bytes emitted in the active stage cursor. */
  public bytes: number = 0;

  /** Saved base addresses for nested `pushbase`/`pullbase` pairs. */
  public pushBaseStack: number[] = [];

  private readonly outputBuffer = new AssemblyOutputBuffer();
  /**
   * Mutable output; large contiguous session-owned images may use typed views. Reacquire a view after
   * growing writes; assigned arrays retain their growth behavior and assigned typed arrays stay fixed.
   */
  /** Live output buffer view; reacquire after growth when using typed arrays. */
  get outputBytes(): number[] | Uint8Array {
    return this.outputBuffer.bytes;
  }
  /** Replaces the entire output buffer backing store. */
  set outputBytes(value: number[] | Uint8Array) {
    this.outputBuffer.replace(value);
  }
  /** Byte used when expanding a sparse output range. */
  public outputFillByte: number = 0;

  /** Stack of active `while` and typed `for` loop frames. */
  public whileStatus: WhileTracker[] = [];

  /** Saved namespace prefixes for nested namespace directives. */
  public namespaceStack: string[] = [];
  /** Active namespace prefix applied to newly defined symbols. */
  public currentNamespace: string = "";
  /** Whether dotted namespace segments accumulate on a nesting path. */
  public namespaceNestingEnabled: boolean = false;
  /** Path segments accumulated when namespace nesting is enabled. */
  public namespaceNestingPath: string[] = [];

  // Current macro tracking
  /** Name of the macro currently being expanded, if any. */
  public currentMacroName: string = "";
  /** Variadic argument count for the active macro expansion. */
  public currentVariadicCount: number | undefined = undefined;
  /** Captured variadic argument strings for the active macro expansion. */
  public currentVariadicArgs: string[] = [];

  /** Macro definitions registered during this session. */
  public macros: Map<string, MacroDefinition> = new Map();

  /** Shared numeric expression evaluator for directives and operands. */
  public mathCore: MathCore;
  /** Operand parser and evaluator bound to this session's symbol state. */
  public operandResolver: OperandResolver;

  /** Byte-to-source metadata collected when {@link collectSourceMetadata} is enabled. */
  public addressToLineMapping: AddressToLineMapping = new AddressToLineMapping();
  /** Path of the source file currently being executed. */
  public currentFile: string = "";
  /** Zero-based line index within {@link currentFile}. */
  public currentLine: number = 0;
  /** Invocation-local provenance. Buffered nodes snapshot it before this scope ends. */
  private currentSourceOrigin?: SourceOrigin;
  /** Optional sink for structured tracing used by tests and ad-hoc debug scripts. */
  private traceListener: AssemblerTraceListener | null = null;
  /** Active command contexts so nested byte writes inherit the right source line. */
  private readonly traceCommandStack: TraceCommandContext[] = [];

  /** Textual define bindings established by define directives. */
  public defines: Map<string, string> = new Map();
  /** Bare numeric values exposed only while executing typed `for` loops. */
  private readonly activeLoopVariables: Map<string, number> = new Map();

  // Character mapping support
  /** Character-to-byte mappings for the active text table. */
  public characterMappings: Map<string, number> = new Map();
  /** Name of the character table currently selected. */
  public currentTable: string | null = null;
  /** Saved character mapping tables for nested table directives. */
  public tableStack: Map<string, number>[] = [];

  /** Canonical architecture id selected for encoding. */
  public arch: string = "";

  /** Saved program counters for nested `pushpc`/`pullpc` pairs. */
  public pushpcStack: PushPcStackEntry[] = [];
  /** Nesting depth counter paired with {@link pushpcStack}. */
  public pushpcnum: number = 0;

  /** Primary label value table for the active stage. */
  public labelTable: Map<string, LabelEntry> = new Map();
  /** ca65 `.export` / `.import` names that stay session-global. */
  public globalSymbols: Set<string> = new Set();

  /** Track multiple `+` labels */
  public forwardLabels: {
    [depth: number]: { addr: number; macroInstance?: number; unit?: string }[];
  } = {};
  /** Track multiple `-` labels */
  public backwardLabels: {
    [depth: number]: { addr: number; macroInstance?: number; unit?: string }[];
  } = {};

  /** Repeat unit size for pad directives in bytes. */
  public padUnit: number = 1;
  /** Fill pattern bytes cycled during pad emission. */
  public padbyte: number[] = [];

  /** Struct definitions registered during this session. */
  public structs: Map<string, StructDefinition> = new Map();
  /** Struct currently being defined, if any. */
  public currentStruct: StructDefinition | null = null;
  /** Saved PCs while defining struct layouts in place. */
  public savedPCStack: number[] = [];

  /** Initialize fill pattern */
  public fillbyte: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  /** Optional base ROM image copied at session construction. */
  public baseImage: Uint8Array;

  // Add a static property to hold our CRC table.
  /** Lazily initialized CRC table shared by include fingerprinting. */
  public static crcTable: number[] | null = null;

  /** Metadata for files already included in this session. */
  public includedFiles: Map<string, IncludedFileInfo> = new Map();
  /** Stack of include paths for nested include directives. */
  public includeStack: string[] = [];
  /** Search paths consulted when resolving include targets. */
  public includePaths: string[] = ["./"];

  /** Monotonic id distinguishing anonymous labels across macro expansions. */
  public macroLabelInstance: number = 0; // Tracks the current macro instance
  /** Whether execution is inside a macro expansion body. */
  public inMacroExpansion: boolean = false; // Flag to track if we're inside a macro expansion

  /** Most recently defined parent label for local label resolution. */
  public currentParentLabel: string = ""; // Track the most recent parent label
  /** Whether {@link currentParentLabel} was declared as global. */
  public currentParentIsGlobal: boolean = false; // Track if the parent label is global
  /** Active top-level parent used to resolve single-dot local labels. */
  public currentGlobalParentLabel: string = ""; // Track the active top-level parent for single-dot labels
  /** Explicit parent links for labels that do not encode ancestry in their names. */
  public labelParents: Map<string, string | null> = new Map(); // Track explicit label ancestry without relying on underscores

  /** When true, label reads must resolve to defined values immediately. */
  public requireStaticLabelLookup: boolean = false;
  /** Session syntax values indexed by opaque builder identities, with source keys owned by the builder. */
  readonly passProgramCache: Map<string, RuntimeNode[]> = new Map();
  /** Directive handlers registered for this session's target and plugins. */
  directiveRegistry: DirectiveRegistry;
  /** Architecture encoder registry bound to the active target. */
  architectureRegistry: ArchitectureRegistry;
  /** Frozen plugin environment shared across sessions. */
  public readonly environment: AssemblerEnvironment;
  /** Resolved target contribution id for this session. */
  public readonly targetId: string;
  /** Validated target options frozen at construction. */
  public readonly targetOptions: Readonly<Record<string, unknown>>;
  /** Active syntax profile controlling label and directive normalization. */
  public readonly syntaxProfile: SyntaxProfile;
  /** Core directive groups exposed to plugins for this session. */
  public readonly coreDirectiveGroups: readonly CoreDirectiveGroup[];
  /** Mutable plugin-owned session state store. */
  public readonly pluginState: PluginSessionStateStore;
  /** Target address-space policy used for writes and label widths. */
  public readonly pluginAddressSpace: PluginTargetAddressSpace;
  /** Target output format policy for container sizing and checksum rules. */
  public readonly pluginOutputFormat: PluginTargetOutputFormat;
  private readonly activeLifecycles: readonly ActiveLifecycle[];
  /** Facade exposing cursor write helpers to directives. */
  readonly cursorAddress: CursorAddressFacade;
  /** Synchronous file provider used for includes and expression file reads. */
  readonly fileProvider: AssemblyFileProvider;
  /** Binary/resource dependencies and converted bytes owned by the active build. */
  readonly assetAssembly = new AssetAssemblyService(this);
  /** Tooling-only path discovery avoids conversion on edit bursts. */
  /** When true, asset includes record edges without converting bytes. */
  deferAssetConversion = false;
  /** Once an active asset is skipped, subsequent layout values cannot validate assertions in this pass. */
  #hasDeferredAssetLayout = false;
  /** Front-end parser and command factory for this session. */
  readonly frontEndService: AssemblyFrontEndService;
  /** Incremental program model builder backing editor tooling. */
  readonly programModelBuilder: ProgramModelBuilder;
  /** Lowers normalized commands into executable runtime nodes. */
  readonly commandLoweringService: CommandLoweringService;
  /** Mutable parse state reused across incremental program builds. */
  readonly incrementalProgramParseState: IncrementalProgramParseState;
  private readonly services: AssemblerServiceBag;
  /** Cached mutable snapshots for each executed assembly stage. */
  public readonly stageExecutionStates: Map<AssemblyStageName, StageExecutionState> = new Map();
  /** Diagnostics accumulated during the current or most recent build. */
  public readonly diagnostics: AssemblyDiagnostic[] = [];
  /** Symbol definitions recorded for tooling and cross-reference analysis. */
  public readonly symbolDefinitions: AssemblySymbolDefinition[] = [];
  /** Symbol references recorded for tooling and cross-reference analysis. */
  public readonly symbolReferences: AssemblySymbolReference[] = [];
  /** Deduplication index for {@link symbolDefinitions} — O(1) vs. the former O(n) `.some()` scan. */
  readonly #symbolDefinitionKeys = new Set<string>();
  /** Deduplication index for {@link symbolReferences} — O(1) vs. the former O(n) `.some()` scan. */
  readonly #symbolReferenceKeys = new Set<string>();
  /** Pure occurrence plans replay against the current scope instead of caching resolved references. */
  private readonly referencePlanner = new ReferencePlanner();
  /** Static records need replay only when the same deduplication fields or analysis epoch change. */
  private readonly stableReferences = new WeakMap<
    object,
    {
      epoch: number;
      file: string;
      line: number;
      kind: AssemblySymbolReferenceKind;
      name: string;
      span?: SourceSpan;
    }
  >();
  private referenceEpoch = 0;
  /** Deduplication index for {@link includeEdges} — O(1) vs. O(n) `.some()` scan. */
  readonly #includeEdgeKeys = new Set<string>();
  /** Include graph edges recorded for tooling analysis. */
  public readonly includeEdges: AssemblyIncludeEdge[] = [];
  /** Whether byte-to-source metadata is collected during emission. */
  public readonly collectSourceMetadata: boolean;
  /** When false, `incsrc`/`include` record an edge but do not parse the included file. */
  public followIncludes = true;
  private activeStageExecutionState: StageExecutionState | null = null;
  private analysisErrorRecoveryEnabled = false;
  private sessionDisposed = false;
  #pluginBorrowDepth = 0;
  readonly #pluginCapabilities = createPluginSessionCapabilities(this, () => {
    if (this.#pluginBorrowDepth === 0) {
      throw new Error("Plugin capabilities are only valid during a synchronous callback.");
    }
  });

  /** Nesting permits target hooks triggered synchronously by another plugin capability. */
  private borrowPluginCapabilities<T>(callback: () => T): T {
    this.#pluginBorrowDepth++;
    try {
      return callback();
    } finally {
      this.#pluginBorrowDepth--;
    }
  }

  /** Define directive engine for this session. */
  get defineEngine(): DefineEngine {
    return this.services.defineEngine;
  }

  /** Runtime dispatcher for structural directives. */
  get directiveRuntime(): DirectiveRuntimeService {
    return this.services.directiveRuntime;
  }

  /** Active logical address width in bytes from the target address space. */
  get addressWidth(): number {
    return this.pluginAddressSpace.addressWidth;
  }

  /** Architecture ids available on the active target. */
  get availableArchitectures(): ReadonlySet<string> {
    return new Set(this.environment.getTarget(this.targetId)?.architectures ?? []);
  }

  /** Human-readable target name for diagnostics. */
  get targetDisplayName(): string {
    return this.environment.getTarget(this.targetId)?.displayName ?? this.targetId;
  }

  /** Shared front-end command parsing service. */
  get frontEndCommandService(): FrontEndCommandService {
    return this.services.frontEndCommandService;
  }

  /** Include and incsrc handling service. */
  get includeSource(): IncludeSourceService {
    return this.services.includeSource;
  }

  /** Macro definition and expansion engine. */
  get macroEngine(): MacroEngine {
    return this.services.macroEngine;
  }

  /** Label and symbol scope service. */
  get symbolScope(): SymbolScopeService {
    return this.services.symbolScope;
  }

  /** Byte-oriented output writer bound to the session buffer. */
  get outputWriter(): OutputWriterService {
    return this.services.outputWriter;
  }

  /** Struct definition and initializer engine. */
  get structEngine(): StructEngine {
    return this.services.structEngine;
  }

  // Core assembler wrapper helpers

  /** Alias for {@link currentTargetAddress} used by legacy directive helpers. */
  get currentAddress(): number {
    return this.currentTargetAddress;
  }

  /**
   * Records current address.
   */
  recordCurrentAddress(): void {
    this.addAddressToLine(
      normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth),
    );
  }

  /** Record raw input consumption at its actual output location, including incbin arrow seeks. */
  recordBinarySlice(file: string, start: number, end: number, bytes: Uint8Array): void {
    if (this.traceStage !== "emitProgram" || !this.collectSourceMetadata) {
      return;
    }
    const mapping = this.addressToLineMapping;
    mapping.registerDependencySnapshot(file, bytes);
    if (this.moduleAssembly) {
      this.moduleAssetRemaining = end - start;
      this.moduleAssembly.assets.push({
        ...this.moduleAssembly.position(),
        size: end - start,
        source: this.moduleSource(),
        inputPath: file,
        format: "raw",
        part: "bytes",
        inputStart: start,
        inputEnd: end,
      });
    }
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
   * @param address The address.
   */
  setWritePosition(address: number): void {
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
   * @param base The base.
   */
  enterStructDefinition(base: number): void {
    this.savedPCStack.push(this.currentTargetAddress);
    this.cursorAddress.setWritePosition(base);
  }

  /**
   * Restores struct definition.
   */
  restoreStructDefinition(): void {
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
  syncWriteStarts(): void {
    this.currentTargetStartAddress = this.currentTargetAddress;
    this.currentTargetBaseStartAddress = this.currentTargetBaseAddress;
  }

  /**
   * Increments bytes written.
   * @param num The num.
   */
  incrementBytesWritten(num: number): void {
    this.bytes += num;
  }

  /** Whether the active stage sizes instructions without emitting bytes. */
  get mode(): "layout" | "emit" {
    return this.getActiveStageCapabilities().instructionMode;
  }

  /** Whether byte writes are permitted in the active stage. */
  get canEmitBytes(): boolean {
    return this.getActiveStageCapabilities().canEmitBytes;
  }

  /** Whether the active stage may finalize output and enforce completion checks. */
  get canFinalize(): boolean {
    return this.getActiveStageCapabilities().canFinalize;
  }

  /** Whether unresolved labels are errors in the active stage. */
  get enforceResolvedLabels(): boolean {
    return this.getActiveStageCapabilities().enforceResolvedLabels;
  }

  /** Whether the active stage collects definitions without emitting program bytes. */
  get isDefinitionCollectionStage(): boolean {
    return this.getActiveStageCapabilities().isDefinitionCollectionStage;
  }

  /**
   * Reports whether structured tracing is active for this assembly session.
   * @returns Whether a trace listener is installed.
   */
  get isTracing(): boolean {
    return this.traceListener !== null;
  }

  /**
   * Traces write.
   * @param event The event.
   */
  traceWrite(event: Omit<AssemblerTraceWriteEvent, "type">): void {
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
   * @param listener The listener to receive trace events.
   */
  setTraceListener(listener: AssemblerTraceListener | null): void {
    this.traceListener = listener;
  }

  /**
   * Clears accumulated diagnostics and symbol definitions.
   */
  clearAnalysisArtifacts(): void {
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
   * @param fromFile The file issuing the include directive.
   * @param toFile The resolved path of the included file.
   */
  recordIncludeEdge(fromFile: string, toFile: string): void {
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
   * @param [span] Optional source span override.
   * @returns The current source location.
   */
  getCurrentSourceLocation(span?: SourceSpan): AssemblySourceLocation {
    return createAssemblySourceLocation(
      this.currentFile,
      this.currentLine,
      span,
      this.currentSourceOrigin,
    );
  }

  /**
   * Converts and records an unknown error.
   * @param error The error to normalize.
   * @param [span] Optional source span override.
   * @param [stage] Optional stage name.
   * @returns The recorded diagnostic.
   */
  reportErrorDiagnostic(
    error: unknown,
    span?: SourceSpan,
    stage?: AssemblyStageName,
  ): AssemblyDiagnostic {
    const diagnostic = diagnosticFromError(error, this.getCurrentSourceLocation(span), stage);
    this.diagnostics.push(diagnostic);
    return diagnostic;
  }

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
  recordSymbolDefinition(
    kind: AssemblySymbolKind,
    name: string,
    options: {
      file?: string;
      line?: number;
      span?: SourceSpan;
      value?: number | string;
      containerName?: string;
    } = {},
  ): void {
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
    let binding = this.moduleAssembly?.symbols.get(name)?.value;
    if (this.moduleAssembly && !binding) {
      const qualified = this.symbolScope.resolveLabelBinding(name)?.name;
      if (qualified) {
        binding = this.moduleAssembly.symbols.get(qualified)?.value;
      }
    }
    const relocatable =
      binding?.kind === "section"
        ? { section: binding.section, offset: binding.offset }
        : undefined;
    let value = options.value;
    if (this.moduleAssembly && binding && binding.kind !== "constant") {
      // Numeric compatibility placeholders are never final addresses in hover or outline metadata.
      value = undefined;
    }
    this.symbolDefinitions.push({
      ...(relocatable ? { relocatable } : {}),
      name,
      kind,
      location: createAssemblySourceLocation(file, line, options.span, this.currentSourceOrigin),
      value,
      containerName: options.containerName,
    });
  }

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
  recordSymbolReference(
    kind: AssemblySymbolReferenceKind,
    name: string,
    options: { file?: string; line?: number; span?: SourceSpan; containerName?: string } = {},
  ): void {
    if (!this.collectSourceMetadata) {
      return;
    }
    const file = options.file ?? this.currentFile;
    const line = options.line ?? options.span?.line ?? this.currentLine;
    // Distinct occurrences on one line must survive for rename. Coarse legacy
    // references still deduplicate by line when no physical span is available.
    const columns =
      options.span?.line === undefined ? "" : `${options.span.start}:${options.span.end}`;
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
  private recordStableSymbolReference(
    owner: object,
    kind: AssemblySymbolReferenceKind,
    name: string,
    span?: SourceSpan,
  ): void {
    if (!this.collectSourceMetadata) {
      return;
    }
    const line = span?.line ?? this.currentLine;
    const cached = this.stableReferences.get(owner);
    if (
      cached?.epoch === this.referenceEpoch &&
      cached.file === this.currentFile &&
      cached.line === line &&
      cached.kind === kind &&
      cached.name === name &&
      cached.span === span
    ) {
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
   * @param expression The expression.
   * @param [fallbackSpan] The fallback span.
   */
  collectExpressionReferences(
    expression: ExpressionNode | undefined,
    fallbackSpan?: SourceSpan,
  ): void {
    if (!expression) {
      return;
    }

    for (const reference of this.referencePlanner.expression(expression)) {
      switch (reference.type) {
        case "defineReference":
          if (reference.name || reference.content) {
            this.recordStableSymbolReference(
              reference,
              "define",
              reference.braced ? (reference.content ?? "") : (reference.name ?? ""),
              reference.span?.line === undefined ? undefined : reference.span,
            );
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
          } else {
            this.recordStableSymbolReference(
              reference,
              "label",
              reference.name,
              reference.span?.line === undefined ? undefined : reference.span,
            );
          }
          break;
        }
        case "member":
        case "index":
          this.collectStructReferenceSegments(reference, fallbackSpan);
          break;
        case "call":
          this.recordStableSymbolReference(
            reference,
            "function",
            reference.callee.name,
            reference.callee.span ?? reference.span ?? fallbackSpan,
          );
          break;
      }
    }
  }

  /**
   * Records one reference per struct-path segment so `obj.timer` can target
   * the struct root and the field independently.
   * @param expression The struct-rooted reference.
   * @param [fallbackSpan] The fallback span.
   */
  collectStructReferenceSegments(
    expression: ReferenceExpressionNode,
    fallbackSpan?: SourceSpan,
  ): void {
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
   * @param object The object of a member access.
   * @returns The container name.
   */
  private structSegmentContainerName(object: ReferenceExpressionNode): string | undefined {
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
   * @param name The define name.
   * @param [seen] Define names already visited.
   * @returns The struct name, if any.
   */
  private structNameFromDefine(
    name: string | undefined,
    seen: Set<string> = new Set(),
  ): string | undefined {
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
   * @param node The expression to search.
   * @param seen Define names already visited.
   * @returns The struct name, if any.
   */
  private structNameFromExpression(node: ExpressionNode, seen: Set<string>): string | undefined {
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
        return (
          this.structNameFromExpression(node.right, seen) ??
          this.structNameFromExpression(node.left, seen)
        );
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
   * @param name The identifier text.
   * @returns Segments, if this is a known sublabel.
   */
  private hierarchicalLabelReferences(
    name: string,
  ): { name: string; containerName?: string }[] | undefined {
    if (!name.includes("_") || !this.labelTable.has(name)) {
      return undefined;
    }
    const chain = this.symbolScope.getHierarchyChain(name);
    if (chain.length < 2 || chain[chain.length - 1] !== name) {
      return undefined;
    }
    const segments: { name: string; containerName?: string }[] = [];
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
   * @param command The command.
   */
  collectCommandReferences(command: NormalizedCommand): void {
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
        this.collectExpressionReferences(
          this.frontEndService.parseAssemblyExpression(reference),
          fallbackSpan,
        );
      } else {
        const index = reference.match(/\[([^\]]+)]$/)?.[1];
        if (index) {
          this.collectExpressionReferences(
            this.frontEndService.parseAssemblyExpression(index),
            fallbackSpan,
          );
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
          span: createTextSpan(
            raw,
            literalStart + field.start,
            literalStart + field.start + field.name.length,
            command.source.line,
            lineStarts,
          ),
        });
        for (const expression of field.expressions) {
          this.collectExpressionReferences(
            parseExpressionAtSite(expression.text, "assembler", {
              text: raw,
              offset: literalStart + expression.start,
              line: command.source.line,
              lineStarts,
            }),
            fallbackSpan,
          );
        }
      }
      return;
    }
    if (command.keyword.toLowerCase() === "datastructs") {
      if (command.words[1]) {
        this.collectExpressionReferences(
          this.frontEndService.parseAssemblyExpression(command.words[1]),
          fallbackSpan,
        );
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
        this.collectExpressionReferences(
          this.frontEndService.parseAssemblyExpression(arg),
          fallbackSpan,
        );
      }
    }

    if (parsed.includeTarget?.target) {
      this.recordSymbolReference(
        "include",
        parsed.includeTarget.target.replace(/^["'`](.*)["'`]$/, "$1"),
        {
          span: command.source.tokenSpans[1] ?? fallbackSpan,
        },
      );
    }

    const instructionCandidate =
      command.kind === "opcodeCandidate" &&
      !this.directiveRegistry.has(this.canonicalizeDirectiveKeyword(command.keyword));
    if (instructionCandidate && parsed.opcodeOperands?.mnemonic) {
      this.recordStableSymbolReference(
        command,
        "instruction",
        parsed.opcodeOperands.mnemonic,
        command.source.tokenSpans[0] ?? fallbackSpan,
      );
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
  private collectSyntaxReferences(payload: unknown, fallbackSpan: SourceSpan): void {
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
   * @param program The program model to analyze.
   * @param [options] Optional analysis options.
   * @param [options.followIncludes] Whether to follow includes.
   * @param [options.stages] Optional stages to run.
   * @param [options.collectSourceMetadata] Whether to collect source metadata.
   * @returns The accumulated diagnostics and symbols.
   */
  collectProgramAnalysis(
    program: ProgramModel,
    options: ProgramAnalysisOptions = {},
  ): AssemblyAnalysisResult {
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
    } catch (error) {
      this.reportErrorDiagnostic(error, undefined, this.activeStageExecutionState?.stage);
    } finally {
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
   * @returns A configured analysis session.
   */
  createToolingSession(): Assembler {
    const session = measureInternalPhase(
      "sessionConstruct",
      () =>
        new Assembler({
          environment: this.environment,
          ...(this.moduleOptions ? { module: this.moduleOptions } : {}),
          target: this.targetId,
          architecture: this.arch,
          targetOptions: this.targetOptions,
          baseImage: this.baseImage,
          fileProvider: this.fileProvider,
        }),
    );
    session.includePaths = [...this.includePaths];
    session.followIncludes = this.followIncludes;
    measureInternalPhase("pluginStateClone", () =>
      session.pluginState.restore(this.pluginState.cloneSnapshot()),
    );
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
   * @param session The session that should receive directive calls.
   * @returns A registry bound to the provided session.
   */
  cloneDirectiveRegistryForSession(session: Assembler): DirectiveRegistry {
    const operandResolver = session.operandResolver;
    const runtime = session.directiveRuntime;
    const registry = createDirectiveRegistry(
      {
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
      },
      session.coreDirectiveGroups,
      session.syntaxProfile.directivePrefixes,
    );
    registry.registerImmutableTyped(
      "includeasset",
      ({ text }) => {
        const call = parseAssetCall(text);
        if (!call) {
          throw new Error("includeAsset requires call syntax: includeAsset(path, format, ...).");
        }
        return call;
      },
      assetCallGuard,
      (call) => {
        const active = session;
        if (active.deferAssetConversion) {
          // Editor analysis discovers dependencies while exact byte counts wait for an explicit build.
          // This keeps PNG/WAVE codecs out of the synchronous edit path.
          active.assetAssembly.discoverDependencies(call);
          active.#hasDeferredAssetLayout = true;
          return;
        }
        const bytes = active.assetAssembly.materialize(call);
        if (active.moduleAssembly) {
          active.moduleAssetRemaining = bytes.length;
        }
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
        if (active.moduleAssembly && active.traceStage === "emitProgram" && asset) {
          active.moduleAssembly.assets.push({
            ...active.moduleAssembly.position(startAddress),
            size: asset.size,
            source: active.moduleSource(),
            inputPath: asset.sourcePath,
            format: asset.format,
            part: asset.part,
            conversion: asset.conversion,
          });
        }
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
      },
    );
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
          bound = session.borrowPluginCapabilities(() =>
            grammar.bind({
              targetId: session.targetId,
              state: session.pluginState,
              session: session.#pluginCapabilities,
            }),
          );
          if (bound && typeof bound.execute !== "function") {
            throw new Error("Typed directive binding requires execute().");
          }
        } catch (cause) {
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
              session.borrowPluginCapabilities(() =>
                bound.execute(payload, {
                  state: session.pluginState,
                  command: clonePluginSyntax({
                    keyword: command.keyword,
                    source: command.source,
                  }),
                }),
              );
            } catch (cause) {
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
      const wrapped: typeof handler = (words, raw, command) => {
        // Direct registry calls enter the same parser before hooks observe the directive.
        command ??= createNormalizedCommand(
          raw,
          raw || words.join(" "),
          [...words],
          session.currentFile,
          session.currentLine,
          false,
        );
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

  /**
   * Runs tooling analysis on an already-built program in an isolated session.
   * @param program Parsed program model to analyze.
   */
  analyzeProgram(program: ProgramModel): AssemblyAnalysisResult {
    const session = this.createToolingSession();
    try {
      return session.collectProgramAnalysis(program);
    } finally {
      session.dispose();
    }
  }

  /**
   * Builds and analyzes raw source without throwing on the first error.
   * @param source The source to analyze.
   * @param [sourceFile] Optional source file override.
   * @param [startLine] Optional starting line number.
   * @param [options] Optional analysis options.
   * @returns The analysis result and program model.
   */
  analyzeSource(
    source: string,
    sourceFile = this.currentFile,
    startLine = 0,
    options: ProgramAnalysisOptions = {},
  ): AssemblyAnalysisResult & { program: ProgramModel } {
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
    } finally {
      session.dispose();
    }
  }

  /**
   * Analyzes multiple source documents sequentially in fresh tooling sessions.
   * @param documents Source buffers with paths and optional start lines.
   * @param options Analysis options applied to each document.
   */
  analyzeWorkspace(
    documents: Array<{ source: string; sourceFile: string; startLine?: number }>,
    options: ProgramAnalysisOptions = {},
  ): Array<AssemblyAnalysisResult & { program: ProgramModel; sourceFile: string }> {
    const results: Array<AssemblyAnalysisResult & { program: ProgramModel; sourceFile: string }> =
      [];
    for (const document of documents) {
      const session = this.createToolingSession();
      try {
        const program = session.buildProgramModel(
          document.source,
          document.sourceFile,
          document.startLine ?? 0,
        );
        const result = session.collectProgramAnalysis(program, options);
        results.push({
          sourceFile: document.sourceFile,
          program,
          ...result,
        });
      } finally {
        session.dispose();
      }
    }
    return results;
  }

  /**
   * Loads base-image data.
   */
  seedOutputFromBaseImage(): void {
    const seedSize = 512 * 1024;
    if (this.baseImage.length === 0) {
      return;
    }

    this.outputBuffer.seed(this.baseImage.subarray(0, seedSize));
  }

  private createServices(): AssemblerServiceBag {
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
  constructor(
    options: Omit<AssemblerOptions, "environment"> & {
      environment?: AssemblerOptions["environment"];
    },
  ) {
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
    if (options.module) {
      if (
        options.module.sourceAdapter !== undefined &&
        !["asar", "ca65"].includes(options.module.sourceAdapter)
      ) {
        throw new Error("Unknown module source adapter.");
      }
      this.moduleOptions = Object.freeze({ ...options.module });
      if (options.baseImage?.length) {
        throw new Error("Relocatable modules cannot patch a base image.");
      }
      this.moduleAssembly = new ModuleAssembly(options.module.id, target.addressSpace);
    }
    this.coreDirectiveGroups = target.coreDirectiveGroups ?? CORE_DIRECTIVE_GROUPS;
    const configuredTargetOptions = options.targetOptions;
    if (!target.createOptions && configuredTargetOptions !== undefined) {
      const emptyObject =
        typeof configuredTargetOptions === "object" &&
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
    this.pluginState = measureInternalPhase(
      "pluginStateCreate",
      () =>
        new PluginSessionStateStore(this.environment.sessionStates, {
          targetId,
          targetOptions: this.targetOptions,
        }),
    );
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
    } catch (cause) {
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
    } catch (cause) {
      throw new PluginError(`Output-format factory '${target.outputFormat}' failed.`, {
        code: "PLUGIN_ACTIVATION_FAILED",
        pluginId: this.environment.getContributionOwner(target.outputFormat),
        contributionId: target.outputFormat,
        targetId,
        cause,
      });
    }
    if (options.module?.sourceAdapter === "asar") {
      if (!target.createSourceLinkRecipe) {
        throw new Error(`Target '${targetId}' does not support the Asar source-layout adapter.`);
      }
      this.asarModuleLayout = new AsarModuleLayout(this.moduleAssembly!, this.pluginAddressSpace);
    } else if (options.module?.sourceAdapter === "ca65" && !target.createLinkRecipe) {
      throw new Error(`Target '${targetId}' does not provide ca65 linker configuration.`);
    }
    const requestedArchitecture = options.architecture ?? target.defaultArchitecture;
    const architectureId = this.environment.resolveArchitectureId(targetId, requestedArchitecture);
    if (!architectureId) {
      throw new PluginError(
        `Architecture '${requestedArchitecture}' is unavailable for target '${targetId}'.`,
        {
          code: "PLUGIN_TARGET_INVALID",
          targetId,
          contributionId: requestedArchitecture,
        },
      );
    }
    this.arch = architectureId;
    this.baseImage = options.baseImage ? Uint8Array.from(options.baseImage) : new Uint8Array();
    const files = options.fileProvider ?? new NodeAssemblyFileProvider();
    this.moduleFiles = options.module ? new ModuleFileProvider(files) : undefined;
    this.fileProvider = this.moduleFiles ?? files;
    this.collectSourceMetadata =
      options.module !== undefined || (options.collectSourceMetadata ?? true);
    this.cursorAddress = {
      recordCurrentAddress: () => this.recordCurrentAddress(),
      setWritePosition: (address: number) => this.setWritePosition(address),
      syncWriteStarts: () => this.syncWriteStarts(),
      incrementBytesWritten: (num: number) => this.incrementBytesWritten(num),
    };
    this.mathCore = new MathCore();
    this.mathCore.host = this.expressionHost;
    if (this.moduleAssembly) {
      this.mathCore.linkContext = () => this.linkExpressionContext();
    }
    this.installExpressionFunctions(target.expressionSets);
    this.services = this.createServices();
    const readCurrentFile = (): string => this.currentFile;
    const readCurrentLine = (): number => this.currentLine;
    const readInMacroExpansion = (): boolean => this.inMacroExpansion;
    const readIsDefinitionCollectionStage = (): boolean => this.isDefinitionCollectionStage;
    const readSyntaxProfile = (): SyntaxProfile => this.syntaxProfile;
    const readCollectSourceMetadata = (): boolean => this.collectSourceMetadata;
    const frontEndHost: AssemblyFrontEndHost = {
      passProgramCache: this.passProgramCache,
      parsePluginSyntax: (command) =>
        isCoreDataDirective(
          this.directiveRegistry,
          this.canonicalizeDirectiveKeyword(command.keyword),
        )
          ? undefined
          : this.directiveRegistry.parseSyntax(command),
      grammarIdentity: () =>
        `api${PLUGIN_API_VERSION}:${this.targetId}:${this.syntaxProfile.id}:${target.architectures.map((id) => `${id}@${this.environment.getArchitecture(id)?.operandGrammar.version}`).join(",")}:${this.directiveRegistry.grammarIdentity}`,
      resolveVariadicPlaceholders: (command: string) =>
        this.macroEngine.resolveVariadicPlaceholders(command),
      shouldEndifCloseInnermostWhile: (
        loopType?: "for" | "while",
        loopStartLine?: number,
        ifStartLine?: number,
      ) => this.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
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
      resolveReference: (node) => {
        if (!this.moduleAssembly) {
          return this.resolveStructuredReference(node, this.requireStaticLabelLookup);
        }
        try {
          return {
            kind: "resolved",
            value: requireLinkConstant(
              this.compileLinkExpression(node),
              "Numeric assembly operand",
            ),
          };
        } catch (cause) {
          return {
            kind: "error",
            error: cause instanceof Error ? cause : new Error(String(cause)),
          };
        }
      },
      evaluateMath: (input) => this.mathCore.math(input),
      shouldDeferExpressionEvaluation: () =>
        !this.getActiveStageCapabilities().enforceResolvedLabels,
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
        throw new PluginError(
          `Architecture contribution '${contributionId}' does not provide a typed encoder.`,
          {
            code: "PLUGIN_TARGET_INVALID",
            targetId,
            contributionId,
          },
        );
      }
      let encoder: ArchitectureEncoder;
      try {
        const typed = contribution.createTypedEncoder({
          targetId,
          options: this.targetOptions,
          state: this.pluginState,
        });

        // oxlint-disable-next-line typescript/no-unnecessary-condition -- Plugin factories are untrusted runtime code; a missing encoder must fail as a contribution error.
        if (!typed || typeof typed.estimate !== "function" || typeof typed.encode !== "function") {
          throw new Error("Typed encoder must provide estimate and encode operations.");
        }
        encoder = {
          typed,
          // Keep catalog discovery available through the public architecture adapter during cutover.
          getInstructionCatalog: () => [...contribution.instructions],
          beginPass: typed.beginPass?.bind(typed),
        };
      } catch (cause) {
        throw new PluginError(`Architecture factory '${contributionId}' failed.`, {
          code: "PLUGIN_ACTIVATION_FAILED",
          pluginId: this.environment.getContributionOwner(contributionId),
          contributionId,
          targetId,
          cause,
        });
      }
      this.architectureRegistry.register(
        {
          name: contribution.id,
          encoder,
          operandGrammar: contribution.operandGrammar,
          instructions:
            contribution.instructions.length > 0 ? contribution.instructions : undefined,
          unknownInstructionBehavior: contribution.unknownInstructionBehavior,
        },
        [...(contribution.aliases ?? [])],
      );
    }
    this.directiveRegistry = measureInternalPhase("directiveRegistryClone", () =>
      this.cloneDirectiveRegistryForSession(this),
    );
    if (this.moduleAssembly) {
      this.registerModuleDirectives();
    }
    this.commandLoweringService = new CommandLoweringService(this);
    this.services.frontEnd = this.frontEndService;
    this.services.lowering = this.commandLoweringService;
    this.activeLifecycles = this.environment.getTargetLifecycles(targetId).map((record) => {
      try {
        return {
          record,
          instance: record.value.create(targetFactoryContext),
          directiveKeywords:
            record.value.beforeDirectiveKeywords === undefined
              ? undefined
              : new Set(record.value.beforeDirectiveKeywords),
        };
      } catch (cause) {
        throw new PluginError(`Lifecycle factory '${record.contributionId}' failed.`, {
          code: "PLUGIN_ACTIVATION_FAILED",
          pluginId: record.pluginId,
          contributionId: record.contributionId,
          targetId,
          cause,
        });
      }
    });
    measureInternalPhase("onSessionCreated", () =>
      this.runLifecycleHook("onSessionCreated", (lifecycle) =>
        lifecycle.onSessionCreated?.({
          state: this.pluginState,
          session: this.#pluginCapabilities,
        }),
      ),
    );
    this.selectArchitecture(this.arch, this.arch);
    measureInternalPhase("constructorActivateStage", () =>
      this.activateStage("collectDefinitions"),
    );
    incrementInternalCounter("assemblerConstructions");
  }

  /** Bind symbolic operands through the same local/namespace rules as numeric assembly. */
  private linkExpressionContext(): LinkExpressionContext {
    const module = this.moduleAssembly;
    if (!module) {
      throw new Error("Assembler is not producing a relocatable module.");
    }
    return {
      current: () => module.location(),
      literal: (expression) => this.mathCore.evaluateExpressionNode(expression),
      bind: (expression) => this.resolveExpressionInput(expression),
      call: (expression, compile) => {
        const expanded = this.mathCore.bindLinkFunction(
          expression.callee.name,
          expression.arguments,
        );
        if (expanded) {
          return compile(expanded);
        }
        const name = expression.callee.name.toLowerCase();
        if (["defined", "sizeof", "objectsize", "datasize"].includes(name)) {
          const values = expression.arguments.map((argument) => {
            if (argument.type === "string" || argument.type === "sourceText") {
              return argument.value;
            }
            if (argument.type === "identifier") {
              return argument.name;
            }
            return requireLinkConstant(compile(argument), `${name} argument`);
          });
          return linkConstant(this.mathCore.callBuiltInFunction(name, values));
        }
        return undefined;
      },
      reference: (expression) => {
        if (expression.type === "relativeReference") {
          const resolved = this.resolveStructuredReference(expression, false);
          if (resolved.kind === "error") {
            throw resolved.error;
          }
          if (resolved.kind !== "resolved") {
            throw new Error(`Unresolved relative label '${expression.text}'.`);
          }
          return module.location(resolved.value);
        }
        if (expression.type === "identifier") {
          const loopValue = this.activeLoopVariables.get(expression.name);
          if (loopValue !== undefined) {
            return linkConstant(loopValue);
          }
          const binding = this.symbolScope.resolveLabelBinding(expression.name);
          if (binding) {
            return module.reference(binding.name);
          }
          let name = this.symbolScope.qualifySymbolName(expression.name);
          if (name.startsWith(".") && this.currentParentLabel) {
            name = `${this.currentParentLabel}_${name.replace(/^\.+/, "")}`;
          } else if (this.currentNamespace && !this.globalSymbols.has(name)) {
            name = `${this.currentNamespace}_${name}`;
          }
          return module.reference(name);
        }
        // Structured members add a constant displacement to their section-owned base.
        // Evaluating their numeric offset never discards the base's relocatable identity.
        const root = (
          node: import("./ir/expression-node.js").ReferenceExpressionNode,
        ): string | undefined => {
          if (node.type === "identifier") {
            return node.name;
          }
          if (node.type === "index") {
            requireLinkConstant(this.compileLinkExpression(node.index), "Structure index");
          }
          if (node.type === "member" || node.type === "index") {
            return root(node.object);
          }
          return undefined;
        };
        const name = root(expression);
        const binding = name ? this.symbolScope.resolveLabelBinding(name) : undefined;
        const resolved = this.resolveStructuredReference(expression, false);
        if (resolved.kind === "error") {
          throw resolved.error;
        }
        if (resolved.kind !== "resolved") {
          throw new Error("Structured link reference is not defined.");
        }
        if (binding) {
          return linkBinary(
            "+",
            module.reference(binding.name),
            linkConstant(resolved.value - binding.entry.value),
          );
        }
        if (name && module.symbols.has(name)) {
          const base = this.structs.get(name)?.base;
          if (base !== undefined) {
            return linkBinary("+", module.reference(name), linkConstant(resolved.value - base));
          }
        }
        return linkConstant(resolved.value);
      },
    };
  }

  /** Preserve pure expanded syntax; this API never substitutes an unresolved address with zero. */
  compileLinkExpression(expression: ExpressionNode): LinkExpression {
    return compileLinkExpression(expression, this.linkExpressionContext());
  }

  /** Authored addresses influence compatibility encoding choices, never the stored relocation expression. */
  private previewSourceExpression(expression: ExpressionNode): number | undefined {
    if (!this.asarModuleLayout) {
      return undefined;
    }
    try {
      return this.moduleAssembly!.probe(() =>
        this.asarModuleLayout!.preview(this.compileLinkExpression(expression)),
      );
    } catch {
      // Unknown imports and expressions without an authored address retain normal native sizing.
      return undefined;
    }
  }

  private moduleSource(): RelocatableSource {
    return { file: this.currentFile, line: this.currentLine + 1, architecture: this.arch };
  }

  /** Called by symbol scopes after canonical qualification, including macro/namespace aliases. */
  recordLabelBinding(
    name: string,
    entry: import("./services/symbol-scope-service.js").LabelEntry,
  ): void {
    if (this.moduleAssignmentValue) {
      this.moduleAssembly?.defineExpression(name, this.moduleAssignmentValue, this.moduleSource());
    } else {
      this.moduleAssembly?.define(name, entry.value, entry.isStatic, this.moduleSource());
    }
  }

  /** Record a source alias without losing a cross-section or external dependency. */
  assignModuleSymbol(name: string, expression: ExpressionNode): void {
    if (!this.moduleAssembly) {
      throw new Error("Symbolic assignments require module assembly.");
    }
    const value = this.compileLinkExpression(expression);
    // Scope aliases must follow the same namespace, local-label, and macro rules as absolute equates.
    // The callback records the symbolic value for every canonical name chosen by the scope writer.
    this.moduleAssignmentValue = value;
    try {
      this.symbolScope.setLabel(name, value.kind === "constant" ? value.value : 0, true);
    } finally {
      this.moduleAssignmentValue = undefined;
    }
    this.recordSymbolDefinition("label", name, {
      ...(value.kind === "constant" ? { value: value.value } : {}),
      containerName: this.currentNamespace || undefined,
    });
  }

  /** Bind external visibility through the same module symbol table used by native declarations. */
  declareModuleSymbol(name: string, visibility: "import" | "export"): void {
    if (!this.moduleAssembly) {
      throw new Error("Import/export requires module assembly.");
    }
    this.globalSymbols.add(name);
    this.moduleAssembly.declare(name, visibility, this.moduleSource());
  }

  /** Export a definition that was declared before its ca65 export directive qualified it globally. */
  exportModuleSymbol(name: string): void {
    if (!this.moduleAssembly) {
      throw new Error("Export requires module assembly.");
    }
    const local = this.symbolScope.resolveLabelBinding(name);
    if (local && local.name !== name) {
      const value = this.moduleAssembly.reference(local.name);
      this.moduleAssembly.defineExpression(name, value, this.moduleSource());
    }
    this.declareModuleSymbol(name, "export");
  }

  /** Target adapters expose region/load/run policy independently of any new linker implementation. */
  getLinkRecipe(): import("./relocatable.js").AssemblyLinkRecipe | undefined {
    const target = this.environment.getTarget(this.targetId);
    const context = {
      targetId: this.targetId,
      options: this.targetOptions,
      state: this.pluginState,
    };
    if (this.asarModuleLayout) {
      return target?.createSourceLinkRecipe?.(context, this.asarModuleLayout.contributions());
    }
    return target?.createLinkRecipe?.(context);
  }

  /** Finalization is explicitly borrowed by a linker after it has applied every relocation. */
  finalizeLinkedOutput(bytes: Uint8Array): Uint8Array {
    const output = bytes.slice();
    this.pluginOutputFormat.finalize({ state: this.pluginState, outputBytes: output });
    return this.pluginOutputFormat
      .getOutput({ state: this.pluginState, outputBytes: output })
      .slice();
  }

  /** Switch sections without applying ROM mapper normalization to their relative byte cursors. */
  selectModuleSection(options: AssemblySectionOptions): void {
    if (!this.moduleAssembly) {
      throw new Error("Section declarations require relocatable module assembly.");
    }
    this.setWritePosition(this.moduleAssembly.selectSection(options));
  }

  /** BSS reservations never acquire initialized bytes; initialized sections can request explicit fill. */
  reserveModuleBytes(count: number, fill?: number): void {
    if (!this.moduleAssembly) {
      throw new Error("Module reservation requires section-relative assembly.");
    }
    if (!Number.isSafeInteger(count) || count < 0 || count > 0x1000000) {
      throw new Error("Invalid module reservation size.");
    }
    const start = this.currentTargetAddress;
    if (this.moduleAssembly.sectionKind === "bss" || fill === undefined) {
      this.step(count);
    } else {
      for (let index = 0; index < count; index++) {
        this.write1(fill);
      }
    }
    this.moduleAssembly.recordRange(this.moduleSource(), "reservation", count, start);
  }

  /**
   * Aligns the module write cursor within the active section.
   * @param boundary Byte alignment boundary.
   * @param fill Fill byte used for padding when emitting.
   */
  alignModule(boundary: number, fill = 0): void {
    if (!this.moduleAssembly) {
      throw new Error("Module alignment requires section-relative assembly.");
    }
    this.reserveModuleBytes(this.moduleAssembly.requireAlignment(boundary), fill);
  }

  /** Write a typed field through the ordinary byte writer, retaining an independent symbolic record. */
  writeRelocation(expression: LinkExpression, encoding: RelocationEncoding): void {
    if (!this.moduleAssembly) {
      throw new Error("Symbolic fields require relocatable module assembly.");
    }
    this.outputWriter.writeBytes(
      this.moduleAssembly.field(expression, encoding, this.moduleSource()),
    );
  }

  /** Numeric scalar directives and struct fields share exactly the encoder relocation contract. */
  writeExpression(
    expression: ExpressionNode,
    width: 1 | 2 | 3 | 4,
    endianness: "little" | "big" = "little",
  ): void {
    if (this.moduleAssembly) {
      this.writeRelocation(this.compileLinkExpression(expression), {
        width,
        endianness,
        truncate: true,
      });
    } else {
      this.outputWriter.writeValue(this.operandResolver.getnum(expression), width, endianness);
    }
  }

  /** Records one emitted module byte against the current range kind, including asset tails. */
  recordModuleWrite(): void {
    let kind = this.moduleRangeKind;
    if (this.moduleAssetRemaining > 0) {
      kind = "asset";
      this.moduleAssetRemaining--;
    }
    this.moduleAssembly?.recordRange(this.moduleSource(), kind, 1, this.currentTargetAddress);
  }

  /** Addressed record layouts acquire a section base only when they are actually initialized there. */
  recordModuleStructBase(name: string, base: number): void {
    const module = this.moduleAssembly;
    if (!module) {
      return;
    }
    const value = module.location(base);
    const existing = module.symbols.get(name)?.value;
    if (
      existing?.kind === "section" &&
      (existing.section !== this.moduleSection || existing.offset !== base)
    ) {
      throw new Error(`Record '${name}' is initialized in conflicting sections.`);
    }
    // Repeated table rows share a base definition rather than defining a new module symbol.
    if (!module.isDefinedThisStage(name)) {
      module.defineExpression(name, value, this.moduleSource());
    }
  }

  /** Module syntax is registered only for object sessions, preserving absolute grammar identities. */
  private registerModuleDirectives(): void {
    for (const keyword of ["org", "base", "pushbase", "pullbase", "pushpc", "pullpc"]) {
      if (this.asarModuleLayout) {
        continue;
      }
      this.directiveRegistry.registerImmutableTyped(
        keyword,
        () => ({}),
        syntaxRecord({}),
        () => {
          throw new Error(
            `${keyword.toUpperCase()} requires absolute placement; use relocatable sections and a link recipe.`,
          );
        },
      );
    }
    if (this.asarModuleLayout) {
      this.registerAsarModuleLayout();
    }
    this.directiveRegistry.registerImmutableTyped(
      "section",
      ({ text }) => {
        const entries = parseDataList(text.replace(/^\S+\s*/, ""));
        const nameNode = entries.at(0)?.expression;
        const kindNode = entries.at(1)?.expression;
        if (entries.length > 3) {
          throw new Error("SECTION accepts name, kind, and alignment.");
        }
        return {
          name: sectionName(nameNode),
          kind: kindNode ? sectionName(kindNode) : "code",
          alignment: entries.at(2)?.expression,
        };
      },
      syntaxRecord({
        name: syntaxString,
        kind: syntaxString,
        alignment: syntaxOptional(syntaxExpression),
      }),
      ({ name, kind, alignment }) => {
        if (kind !== "code" && kind !== "data" && kind !== "bss") {
          throw new Error(`Invalid section kind '${kind}'.`);
        }
        const count = alignment
          ? requireLinkConstant(this.compileLinkExpression(alignment), "Section alignment")
          : undefined;
        this.selectModuleSection({ name, kind, alignment: count });
      },
    );
    for (const visibility of ["import", "export"] as const) {
      this.directiveRegistry.registerImmutableTyped(
        visibility,
        ({ text }) => ({
          names: parseDataList(text.replace(/^\S+\s*/, "")).map(({ expression }) => {
            if (expression.type !== "identifier") {
              throw new Error(`${visibility} requires symbol names.`);
            }
            return expression.name;
          }),
        }),
        syntaxRecord({ names: syntaxArray(syntaxString) }),
        ({ names }) => {
          for (const name of names) {
            if (visibility === "export") {
              this.exportModuleSymbol(name);
            } else {
              this.declareModuleSymbol(name, visibility);
            }
          }
        },
      );
    }
    this.directiveRegistry.registerImmutableTyped(
      "reserve",
      ({ text }) => ({ count: parseDataList(text.replace(/^\S+\s*/, ""))[0]?.expression }),
      syntaxRecord({ count: syntaxExpression }),
      ({ count }) => {
        const bytes = requireLinkConstant(this.compileLinkExpression(count), "Reservation size");
        const offset = this.currentTargetAddress;
        this.step(bytes);
        this.moduleAssembly!.recordRange(this.moduleSource(), "reservation", bytes, offset);
      },
    );
  }

  /** ORG/BASE adaptation is registered only for explicitly opted-in object sessions. */
  private registerAsarModuleLayout(): void {
    const layout = this.asarModuleLayout!;
    for (const keyword of ["org", "base"] as const) {
      this.directiveRegistry.registerImmutableTyped(
        keyword,
        ({ words }) => {
          if (words.length !== 2) {
            throw new Error(`${keyword.toUpperCase()} requires one address.`);
          }
          const off = keyword === "base" && words[1].toLowerCase() === "off";
          return { expression: off ? undefined : parseExpressionNode(words[1]) };
        },
        syntaxRecord({ expression: syntaxOptional(syntaxExpression) }),
        ({ expression }) => {
          const value = expression
            ? requireLinkConstant(
                this.compileLinkExpression(expression),
                `${keyword.toUpperCase()} address`,
              )
            : undefined;
          if (value !== undefined && (value < 0 || value >= 2 ** this.addressWidth)) {
            throw new Error(`Invalid ${keyword.toUpperCase()} address.`);
          }
          const cursor = keyword === "org" ? layout.org(value!) : layout.base(value);
          this.setWritePosition(cursor);
        },
      );
    }
    const actions = {
      pushpc: () => layout.pushPc(),
      pullpc: () => this.setWritePosition(layout.pullPc()),
      pushbase: () => layout.pushBase(),
      pullbase: () => this.setWritePosition(layout.pullBase()),
    };
    for (const [keyword, execute] of Object.entries(actions)) {
      this.directiveRegistry.registerImmutableTyped(keyword, () => ({}), syntaxRecord({}), execute);
    }
    this.directiveRegistry.registerImmutableTyped(
      "pad",
      ({ words }) => {
        if (words.length > 2) {
          throw new Error("PAD accepts at most one address.");
        }
        return { address: words[1] ? parseExpressionNode(words[1]) : undefined };
      },
      syntaxRecord({ address: syntaxOptional(syntaxExpression) }),
      ({ address }) => {
        const current = layout.currentAddress("run");
        let count = 0x10000 - (current & 0xffff);
        if (address) {
          const target = requireLinkConstant(this.compileLinkExpression(address), "PAD address");
          const end = this.pluginAddressSpace.toOutputOffset(target);
          const start = this.pluginAddressSpace.toOutputOffset(current);
          if (start < 0 || end < 0) {
            throw new Error("PAD source addresses must map to ROM storage.");
          }
          count = Math.max(0, end - start);
        }
        if (!Number.isSafeInteger(count) || count > 0x1000000) {
          throw new Error("PAD extent exceeds the module limit.");
        }
        for (let index = 0; index < count; index++) {
          this.write1(this.padbyte[index % this.padUnit]);
        }
      },
    );
  }

  /** Returns a detached producer result. No ROM finalizer or linker has run on its section bytes. */
  getAssemblyModule(): AssemblyModule {
    if (!this.moduleAssembly) {
      throw new Error("Assembler is not producing a relocatable module.");
    }
    this.asarModuleLayout?.contributions();
    // Metadata identities must describe the consumed snapshots, including virtual assets,
    // rather than rereading paths after conversion or retaining files from an earlier build.
    const paths = new Set(this.moduleFiles?.snapshots.keys());
    for (const [file, bytes] of this.moduleFiles?.snapshots ?? []) {
      this.addressToLineMapping.registerDependencySnapshot(file, bytes);
    }
    return this.moduleAssembly.snapshot(
      this.targetId,
      this.targetOptions,
      this.addressToLineMapping.fileList
        .filter(({ name }) => paths.has(name))
        .map(({ name, sha256, size, crc }) => ({ path: name, sha256, size, crc32: crc })),
    );
  }

  /**
   * Invokes a named hook on every active plugin lifecycle in registration order.
   * @param hookName Hook label used when wrapping plugin errors.
   * @param invoke Callback receiving each lifecycle instance.
   */
  runLifecycleHook(hookName: string, invoke: (lifecycle: SessionLifecycle) => void): void {
    for (const { record, instance } of this.activeLifecycles) {
      try {
        this.borrowPluginCapabilities(() => invoke(instance));
      } catch (cause) {
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

  /**
   * Runs plugin `beforeDirective` middleware until one handler consumes the directive.
   * @param keyword Canonical directive keyword being dispatched.
   * @param command Normalized command under dispatch.
   * @param syntax Parsed syntax snapshot when already available.
   */
  runBeforeDirective(
    keyword: string,
    command: NormalizedCommand,
    syntax = command.syntax ?? this.directiveRegistry.parseSyntax(command),
  ): "continue" | "handled" {
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
        } else if (
          syntax?.kind === "sequence" &&
          syntax.following.kind === "numericDataFragment" &&
          syntax.following.statement.literalData
        ) {
          observedSyntax = {
            ...syntax,
            following: {
              ...syntax.following,
              statement: materializeNumericData(syntax.following.statement),
            },
          };
        }
        const result = this.borrowPluginCapabilities(() =>
          instance.beforeDirective!({
            state: this.pluginState,
            session: this.#pluginCapabilities,
            keyword,
            source: clonePluginSyntax(command.source),
            syntax: observedSyntax ? clonePluginSyntax(observedSyntax) : undefined,
          }),
        );
        if (result === "handled") {
          return "handled";
        }
      } catch (cause) {
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
   * @param [loopType] The innermost loop type.
   * @param [loopStartLine] The innermost loop start line.
   * @param [ifStartLine] The innermost conditional start line.
   * @returns Whether `endif` should close the innermost while loop.
   */
  shouldEndifCloseInnermostWhile(
    loopType?: "for" | "while",
    loopStartLine?: number,
    ifStartLine?: number,
  ): boolean {
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

  /**
   * Selects the session architecture and notifies plugin lifecycles.
   * @param architecture Architecture id or alias to activate.
   * @param sourceAlias Original alias text preserved for lifecycle hooks.
   */
  selectArchitecture(architecture: string, sourceAlias = architecture): void {
    const resolved = this.environment.resolveArchitectureId(this.targetId, architecture);
    if (!resolved) {
      throw new PluginError(
        `Architecture ${architecture} is unavailable for target ${this.targetDisplayName}.`,
        {
          code: "PLUGIN_TARGET_INVALID",
          targetId: this.targetId,
          contributionId: architecture,
        },
      );
    }
    const previousArchitecture = this.arch || undefined;
    this.arch = resolved;
    this.runLifecycleHook("onArchitectureSelected", (lifecycle) =>
      lifecycle.onArchitectureSelected?.({
        state: this.pluginState,
        session: this.#pluginCapabilities,
        previousArchitecture,
        architecture: resolved,
        sourceAlias,
      }),
    );
  }

  /**
   * Validates and notifies plugins before a multi-byte write at a logical address.
   * @param logicalAddress Target logical address of the write.
   * @param width Write width in bytes.
   */
  beforeWrite(logicalAddress: number, width: number): void {
    this.pluginAddressSpace.validateWrite?.(logicalAddress, width);
    this.runLifecycleHook("beforeWrite", (lifecycle) =>
      lifecycle.beforeWrite?.({
        state: this.pluginState,
        session: this.#pluginCapabilities,
        logicalAddress,
        width,
      }),
    );
  }

  /**
   * Records one emitted byte against the active command source.
   * @param logicalAddress Logical byte address.
   * @param outputOffset Physical output offset, or a negative value when unmapped.
   */
  recordSourceWrite(logicalAddress: number, outputOffset: number): void {
    if (!this.collectSourceMetadata) {
      return;
    }
    const command = this.traceCommandStack.at(-1);
    const target = this.environment.getTarget(this.targetId);
    this.addressToLineMapping.includeByte(
      command?.file ?? this.currentFile,
      (command?.line ?? this.currentLine) + 1,
      this.arch,
      target?.addressSpace ?? "target.logical",
      logicalAddress,
      outputOffset,
    );
  }

  /** Record the actual typed field encoding without splitting or overlapping its row's byte ownership. */
  recordStructField(reference: string, expression: string, offset: number, width: number): void {
    if (!this.collectSourceMetadata || !this.canEmitBytes) {
      return;
    }
    if (this.moduleAssembly) {
      this.moduleAssembly.fields.push({
        ...this.moduleAssembly.position(this.currentTargetAddress + offset),
        reference,
        expression,
        size: width,
        source: this.moduleSource(),
      });
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
  dispose(): void {
    if (this.sessionDisposed) {
      return;
    }
    this.sessionDisposed = true;
    this.operandResolver.clearParsedOperands();
    const errors: unknown[] = [];
    for (const { record, instance } of [...this.activeLifecycles].toReversed()) {
      try {
        this.borrowPluginCapabilities(() =>
          instance.onSessionDispose?.({
            state: this.pluginState,
            session: this.#pluginCapabilities,
          }),
        );
      } catch (cause) {
        errors.push(
          new PluginError("Lifecycle hook 'onSessionDispose' failed.", {
            code: "PLUGIN_HOOK_FAILED",
            pluginId: record.pluginId,
            contributionId: record.contributionId,
            targetId: this.targetId,
            cause,
          }),
        );
      }
    }
    try {
      this.pluginState.dispose();
    } catch (error) {
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
      throw new AggregateError(
        errors,
        "One or more assembler session resources failed to dispose.",
      );
    }
  }

  /**
   * Reads an unsigned little-endian integer from a byte slice.
   * @param bytes Source buffer.
   * @param pos Starting byte index.
   * @param width Width in bytes, at most four.
   */
  readLittleEndian(bytes: Uint8Array, pos: number, width: number): number | undefined {
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
   * @param sourceLength Available source bytes.
   * @param position Zero-based byte offset.
   * @param size Requested byte count, which may be zero.
   * @returns Numeric 1 or 0 for use by assembly expressions.
   */
  canReadByteRange(sourceLength: number, position: number, size: number): number {
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
   * @param source Borrowed input bytes, never modified.
   * @param position Zero-based byte offset.
   * @param size Width in bytes, used by the 1–4-byte expression readers.
   * @param defaultValue Returned for an out-of-bounds read when supplied.
   * @param errorMessage Error thrown for an out-of-bounds read without a default.
   * @returns Unsigned value or the supplied default.
   */
  readByteRange(
    source: Uint8Array,
    position: number,
    size: number,
    defaultValue: number | undefined,
    errorMessage: string,
  ): number {
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
   * Resolves an include or expression path against session search paths.
   * @param filename Candidate path from source.
   */
  resolveReadablePath(filename: string): string | undefined {
    return this.fileProvider.resolvePath(filename, {
      currentFile: this.currentFile,
      includePaths: this.includePaths,
      macroSourceFile: this.currentMacroSourceFile,
    });
  }

  /**
   * Resolves a label identifier for expression evaluation, including loop bindings.
   * @param identifier Label or symbol text from an expression.
   */
  resolveExpressionHostLabel(identifier: string): number | string {
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

  /**
   * Returns the byte size of a struct or label object referenced in an expression.
   * @param identifier Object or label name.
   * @param baseOnly When true, ignore trailing field selectors.
   */
  getExpressionObjectSize(identifier: string, baseOnly = false): number {
    if (baseOnly && (identifier === "..." || identifier === "…")) {
      if (this.inMacroExpansion && this.currentVariadicCount !== undefined) {
        return this.currentVariadicCount;
      }
      return 0;
    }
    return this.symbolScope.getObjectSize(identifier, baseOnly);
  }

  /**
   * Looks up a textual define or active typed `for` loop counter by name.
   * @param varName Define or loop variable name.
   */
  lookupDefineValue(varName: string): string | undefined {
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

  /** Source file path of the macro currently being expanded, when applicable. */
  get currentMacroSourceFile(): string | undefined {
    if (!this.inMacroExpansion || !this.currentMacroName) {
      return undefined;
    }
    return this.macros.get(this.currentMacroName)?.sourceFile;
  }

  /**
   * Returns how many bytes can be read from the base or output image at a logical address.
   * @param position Logical start address.
   * @param size Requested read width in bytes.
   */
  canReadBaseImage(position: number, size: number): number {
    const sourceLength =
      this.baseImage.length > 0 ? this.baseImage.length : this.outputBytes.length;
    return this.canReadByteRange(sourceLength, position, size);
  }

  /**
   * Reads an unsigned integer from the base or output image at a logical address.
   * @param position Logical start address.
   * @param size Read width in bytes.
   * @param defaultValue Value returned when the read is out of bounds.
   */
  readBaseImage(position: number, size: number, defaultValue?: number): number {
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
    return this.readByteRange(
      sourceBytes,
      pcPos,
      size,
      defaultValue,
      `read${Math.trunc(size)} out of bounds at ${pos}`,
    );
  }

  /**
   * Returns how many bytes can be read from a resolved expression file path.
   * @param filename Path token from an expression.
   * @param position Byte offset within the file.
   * @param size Requested read width in bytes.
   */
  canReadExpressionFile(filename: string, position: number, size: number): number {
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
   * Reads an unsigned integer from a file resolved for expression evaluation.
   * @param filename Path token from an expression.
   * @param position Byte offset within the file.
   * @param size Read width in bytes.
   * @param defaultValue Value returned when the path or range is invalid.
   */
  readExpressionFile(
    filename: string,
    position: number,
    size: number,
    defaultValue?: number,
  ): number {
    const pos = Math.trunc(position);
    const resolvedPath = this.resolveReadablePath(filename);
    if (!resolvedPath) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Could not read file: ${filename}`);
    }
    const fileBytes = this.fileProvider.readFile(resolvedPath);
    return this.readByteRange(
      fileBytes,
      pos,
      size,
      defaultValue,
      `readfile${Math.trunc(size)} out of bounds at ${pos}`,
    );
  }

  /**
   * Installs the active target's expression contributions into this session.
   * @param setIds Resolved expression-set contribution IDs.
   */
  installExpressionFunctions(setIds: readonly string[]): void {
    for (const setId of setIds) {
      const set = this.environment.getExpressionSet(setId);
      if (!set) {
        continue;
      }
      const pluginId = this.environment.getContributionOwner(setId);
      for (const expressionFunction of set.functions) {
        const minimumArguments =
          expressionFunction.signature.minimumArguments ??
          expressionFunction.signature.parameters.length;
        const maximumArguments =
          expressionFunction.signature.maximumArguments ??
          (expressionFunction.signature.minimumArguments === undefined
            ? expressionFunction.signature.parameters.length
            : Number.POSITIVE_INFINITY);
        this.mathCore.registerExpressionFunction(
          [expressionFunction.name, ...(expressionFunction.aliases ?? [])],
          {
            minimumArguments,
            maximumArguments,
            evaluate: (args) => {
              try {
                return expressionFunction.evaluate(
                  {
                    state: this.pluginState,
                    addresses: {
                      toOutputOffset: (address) => this.outputWriter.toOutputOffset(address),
                      fromOutputOffset: (offset) => this.outputWriter.fromOutputOffset(offset),
                    },
                    output: {
                      canRead: (position, size) => this.canReadBaseImage(position, size),
                      read: (position, size, defaultValue) =>
                        this.readBaseImage(position, size, defaultValue),
                    },
                  },
                  args,
                );
              } catch (cause) {
                throw new PluginError(`Expression function '${expressionFunction.name}' failed.`, {
                  code: "PLUGIN_HOOK_FAILED",
                  pluginId,
                  contributionId: set.id,
                  targetId: this.targetId,
                  cause,
                });
              }
            },
          },
        );
      }
    }
  }

  /** Expression evaluation callbacks wired to this session's symbol and output state. */
  readonly expressionHost: ExpressionHost = {
    resolveReference: (reference) =>
      this.resolveStructuredReference(reference, this.requireStaticLabelLookup),
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
    getExpressionObjectSize: (identifier, baseOnly) =>
      this.getExpressionObjectSize(identifier, baseOnly),
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
    readFile: (filename, position, size, defaultValue) =>
      this.readExpressionFile(filename, position, size, defaultValue),
    canReadBaseImage: (position, size) => this.canReadBaseImage(position, size),
    readBaseImage: (position, size, defaultValue) =>
      this.readBaseImage(position, size, defaultValue),
  };

  /**
   * Advances the logical program counter.
   * @param num Number of logical address units to advance.
   */
  step(num: number): void {
    this.outputWriter.step(num);
  }

  /**
   * Writes a single architecture byte to output.
   * @param num Byte value to write.
   */
  writeArchitectureByte(num: number): void {
    this.outputWriter.write1(num);
  }

  /**
   * Fills a section of output data with a value.
   * @param start The starting address.
   * @param value The value to fill with.
   * @param length The length of the section to fill.
   */
  fillOutputBytes(start: number, value: number, length: number): void {
    this.outputBuffer.fill(start, value, length);
  }

  /** Store one already-validated emitted byte, preserving sparse gap fill and public fill overrides. */
  writeOutputByte(offset: number, value: number): void {
    const length = this.outputBuffer.length;
    if (offset > length) {
      this.fillOutputBytes(length, this.outputFillByte, offset - length);
    }
    this.outputBuffer.write(offset, value);
  }

  /**
   * Builds a throwaway stage snapshot from the live session without caching it.
   * @param stage Assembly stage whose descriptor seeds the snapshot.
   */
  createEphemeralStageExecutionState(stage: AssemblyStageName): StageExecutionState {
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
   * @param stage The stage.
   */
  syncActiveStageExecutionState(stage: AssemblyStageName): void {
    const descriptor = this.getStageDescriptor(stage);
    if (!this.activeStageExecutionState) {
      this.activeStageExecutionState = this.createEphemeralStageExecutionState(stage);
      return;
    }
    this.activeStageExecutionState.stage = descriptor.stage;
    this.activeStageExecutionState.capabilities = descriptor.capabilities;
  }

  /** Returns capabilities for the active stage, defaulting to definition collection. */
  getActiveStageCapabilities(): StageExecutionCapabilities {
    this.activeStageExecutionState ??=
      this.createEphemeralStageExecutionState("collectDefinitions");
    return this.activeStageExecutionState.capabilities;
  }

  /** Assembly stage currently driving execution and tracing. */
  get traceStage(): AssemblyStageName {
    return this.activeStageExecutionState?.stage ?? "collectDefinitions";
  }

  /** Public word entry; all source forms use the shared parser and typed execution contracts. */
  asblock_pick(words: string[]): boolean {
    if (words.length === 0) {
      return true;
    }
    const raw = words.join(" ");
    const command = this.createNormalizedCommandFromRaw(
      raw,
      this.currentFile,
      this.currentLine,
      true,
    );
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

  /**
   * Resolves the canonical architecture name and registry definition for {@link arch}.
   */
  resolveActiveArchitecture(): { name: string; definition?: ArchitectureDefinition } {
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
   * @param keyword Source directive keyword.
   * @returns Canonical registry keyword.
   */
  canonicalizeDirectiveKeyword(keyword: string): string {
    const normalized = keyword.toLowerCase();
    for (const prefix of this.syntaxProfile.directivePrefixes) {
      if (
        normalized.startsWith(prefix) &&
        this.directiveRegistry.has(normalized.slice(prefix.length))
      ) {
        return normalized.slice(prefix.length);
      }
    }
    return normalized;
  }

  /**
   * Returns whether the active syntax profile treats a token as a named label.
   * @param candidate Candidate token.
   * @returns Whether the token is a named label.
   */
  isNamedLabelToken(candidate: string): boolean {
    if (candidate === ":") {
      return false;
    }
    return (
      candidate.endsWith(":") || (this.syntaxProfile.leadingDotLabels && candidate.startsWith("."))
    );
  }

  /**
   * Writes 1, 2, 3, or 4 bytes to output.
   * @param num The byte to write.
   */
  write1(num: number): void {
    this.outputWriter.write1(num);
  }

  /**
   * Writes 2.
   * @param num The num.
   */
  write2(num: number): void {
    this.outputWriter.write2(num);
  }

  /**
   * Writes 3.
   * @param num The num.
   */
  write3(num: number): void {
    this.outputWriter.write3(num);
  }

  /**
   * Writes 4.
   * @param num The num.
   */
  write4(num: number): void {
    this.outputWriter.write4(num);
  }

  /**
   * Reads 1, 2, or 3 bytes from the configured output image.
   * @param logicalPosition The logical address to read from.
   * @returns The byte read from the output image.
   */
  read1(logicalPosition: number): number {
    const addr = this.outputWriter.toOutputOffset(logicalPosition);
    if (addr < 0 || addr + 1 > this.outputBytes.length) {
      return -1;
    }
    return this.outputBytes[addr];
  }

  /**
   * Reads a little-endian 16-bit value from the output image at a logical address.
   * @param logicalPosition Logical address to read.
   */
  read2(logicalPosition: number): number {
    const addr = this.outputWriter.toOutputOffset(logicalPosition);
    if (addr < 0 || addr + 2 > this.outputBytes.length) {
      return -1;
    }
    return this.outputBytes[addr] | (this.outputBytes[addr + 1] << 8);
  }

  /**
   * Reads a little-endian 24-bit value from the output image at a logical address.
   * @param logicalPosition Logical address to read.
   */
  read3(logicalPosition: number): number {
    const addr = this.outputWriter.toOutputOffset(logicalPosition);
    if (addr < 0 || addr + 3 > this.outputBytes.length) {
      return -1;
    }
    return (
      this.outputBytes[addr] |
      (this.outputBytes[addr + 1] << 8) |
      (this.outputBytes[addr + 2] << 16)
    );
  }

  /**
   * Parses one raw source line into a normalized command via the front-end service.
   * @param command Raw line text.
   * @param sourceFile Containing file path.
   * @param sourceLine Zero-based line index.
   * @param allowEmpty When true, empty lines produce a command node instead of null.
   */
  createNormalizedCommandFromRaw(
    command: string,
    sourceFile: string,
    sourceLine: number,
    allowEmpty: boolean = false,
  ): NormalizedCommand | null {
    return this.frontEndService.createNormalizedCommandFromRaw(
      command,
      sourceFile,
      sourceLine,
      allowEmpty,
    );
  }

  /**
   * Applies a `!name =` assignment without routing it through the incremental if-tree.
   * @param command The define assignment command.
   * @returns `true` when the define engine handled the command.
   */
  applyDefineAssignment(command: string): boolean {
    const commandNode = this.createNormalizedCommandFromRaw(
      command,
      this.currentFile,
      this.currentLine,
      true,
    );
    if (!commandNode) {
      return false;
    }
    return this.defineEngine.handleCommand(commandNode);
  }

  /**
   * Asar `'X' = $nn` / `"X" = $nn` table entries, including `''' = $2A` for apostrophe.
   * @param command Raw command text.
   * @returns `true` when the line was a character mapping.
   */
  tryHandleCharacterMapping(command: string): boolean {
    const parsed = this.createNormalizedCommandFromRaw(
      command,
      this.currentFile,
      this.currentLine,
      true,
    );
    if (parsed?.parsed.declaration?.kind !== "character") {
      return false;
    }
    this.executeLoweredNode(this.commandLoweringService.lowerExecutableNode(parsed));
    return true;
  }

  /** Scope expansion metadata and restore caller positions even when nested expansion fails. */
  withSourceOrigin(origin: SourceOrigin, execute: () => void): void {
    const previous = this.currentSourceOrigin;
    const file = this.currentFile;
    const line = this.currentLine;
    this.currentSourceOrigin = origin;
    try {
      execute();
    } catch (error) {
      const occurrence = origin.kind === "macro" ? origin.template : origin.location;
      rememberErrorSource(
        error,
        createAssemblySourceLocation(occurrence.file, occurrence.line, occurrence.span, origin),
      );
      throw error;
    } finally {
      this.currentSourceOrigin = previous;
      this.currentFile = file;
      this.currentLine = line;
    }
  }

  /** Include origins are execution-local; the same cached file can be reached from many callers. */
  withIncludeSource(file: string, execute: () => void, fromFile = this.currentFile): void {
    this.withSourceOrigin(
      {
        kind: "include",
        file,
        location: { file: fromFile, line: this.currentLine },
        parent: this.currentSourceOrigin,
      },
      execute,
    );
  }

  /**
   * Processes a command from an internal re-entrant source.
   * @param command The command to process.
   * @param [preprocessed] Whether comments and continuations were already normalized.
   */
  processCommand(command: string, preprocessed = false, template?: NormalizedCommand): void {
    this.processSourceFragment(
      sourceFragment(command, [{ file: this.currentFile, line: this.currentLine, text: command }]),
      preprocessed,
      template,
    );
  }

  /** Physical fragments retained only while the frontend buffers one multiline statement. */
  private pendingGeneratedFragment?: SourceFragment;

  /** Execute an attributed generated fragment through the shared incremental frontend. */
  processSourceFragment(
    fragment: SourceFragment,
    preprocessed = false,
    template?: NormalizedCommand,
  ): void {
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

      const consume = (text: string, file: string, line: number): ExecutableNode[] => {
        let normalized: NormalizedCommand | undefined;
        if (this.currentSourceOrigin) {
          // Stable template syntax can be shared. Variadic indexes and dialect rewrites still
          // bind at dispatch time; their generated spelling must pass through normalization.
          if (
            template?.command === text &&
            !/\?|\.{3}|…/.test(text) &&
            !this.syntaxProfile.rewriteCommand
          ) {
            normalized = cloneNormalizedCommand(template);
            normalized.kind = classifyCommand(normalized.command, normalized.words);
          } else {
            const occurrence =
              this.currentSourceOrigin.kind === "macro"
                ? this.currentSourceOrigin.template
                : { file, line };
            normalized = this.frontEndService.parseFragmentCommand(
              text,
              occurrence.file,
              occurrence.line,
            );
          }
          normalized.source = { ...normalized.source, origin: this.currentSourceOrigin };
        }
        // Attach only the selected fragment extent. Parser/cache identity remains syntax-only.
        normalized ??= this.frontEndService.parseFragmentCommand(text, file, line);
        const offset = fragmentText(fragment).indexOf(text);
        // A buffered multiline statement or profile rewrite may have a different spelling.
        // Keep its parsed text authoritative while retaining the contributing input occurrences.
        const selected =
          offset >= 0
            ? sliceSourceFragment(fragment, offset, offset + text.length)
            : sourceFragment(
                text,
                fragment.segments.flatMap((part) => part.origins),
              );
        let origin = normalized.source.origin;
        if (origin?.kind === "macro") {
          origin = { ...origin, fragment: selected };
        }
        normalized.source = { ...normalized.source, origin, fragment: selected };
        // Control-stack ordering uses the call-site sequence, independently of physical body spans.
        return this.frontEndService.parseGeneratedCommand(
          this.incrementalProgramParseState,
          text,
          file,
          line,
          normalized,
        );
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
      } else {
        const sourceFile = this.currentFile;
        const sourceLine = this.currentLine;
        const processedCommands = this.frontEndService.preprocessSourcedBlockCommands(command);
        this.pendingGeneratedFragment = this.frontEndService.commandBuffer ? fragment : undefined;
        const splitCommands = this.frontEndService.splitSourcedInlineCommands(processedCommands);

        for (const splitCommand of splitCommands) {
          const nodes = consume(
            splitCommand.text.trim(),
            sourceFile,
            sourceLine + splitCommand.line,
          );
          this.lowerAndExecuteRuntimeNodes(nodes);
        }
      }
      this.flushCompletedIncrementalNodes();
    });
  }

  /** Public normalized-source entry: the shared parser owns streaming captures and control flow. */
  processNormalizedCommand(command: NormalizedCommand, rewriteRaw = true): void {
    if (rewriteRaw) {
      this.processSourceFragment(
        command.source.fragment ?? sourceFragment(command.source.raw, [command.source]),
      );
      return;
    }
    this.frontEndService.parseCommandSyntax(command);
    const nodes = this.frontEndService.parseGeneratedCommand(
      this.incrementalProgramParseState,
      command.command,
      command.source.file,
      command.source.line,
      command,
    );
    this.lowerAndExecuteRuntimeNodes(nodes);
    this.flushCompletedIncrementalNodes();
  }

  /** Execute typed syntax with current scope and the same source ownership as directive dispatch. */
  private executeStatement(node: LoweredStatement): void {
    if (node.kind === "label") {
      this.frontEndCommandService.executeLabelStatement(node.statement);
      if (node.statement.trailing) {
        this.lowerAndExecuteRuntimeNodes([node.statement.trailing]);
      }
    } else if (node.kind === "assignment") {
      this.frontEndCommandService.executeAssignmentStatement(node.statement);
    } else {
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
  private executeAttributedCommand(command: NormalizedCommand, dispatch: () => void): void {
    const startPC = normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth);
    if (this.collectSourceMetadata) {
      this.collectCommandReferences(command);
    }

    const traceListener = this.traceListener;
    const traceContext: TraceCommandContext = {
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
    } finally {
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
      this.addAddressToLine(
        normalizeAddressForWidth(this.currentTargetBaseAddress, this.addressWidth),
      );
    }
  }

  /**
   * Lowers a program once per stage state and caches the result on that state.
   * @param stageState Stage snapshot owning the lowered program cache.
   * @param program Parsed program to lower.
   */
  getOrCreateLoweredProgram(
    stageState: StageExecutionState,
    program: ProgramModel,
  ): LoweredProgram {
    stageState.loweredProgram ??= measureInternalPhase("lowerProgram", () =>
      this.commandLoweringService.lowerProgram(program),
    );
    return stageState.loweredProgram;
  }

  /**
   * Dispatches lowered node.
   * @param lowered The lowered.
   */
  dispatchLoweredNode(lowered: LoweredCommand): void {
    if (lowered.kind === "pluginSyntax") {
      this.executeAttributedCommand(lowered.command, () => {
        const keyword = this.canonicalizeDirectiveKeyword(lowered.command.keyword);
        if (this.runBeforeDirective(keyword, lowered.command, lowered.statement) === "handled") {
          return;
        }
        try {
          this.directiveRegistry.executeSyntax(lowered.statement, lowered.command);
        } catch (cause) {
          // Core syntax uses the same transport contract, but retains native diagnostic identity.
          if (lowered.statement.contributionId.startsWith("core.directive.")) {
            throw cause;
          }
          if (cause instanceof PluginError) {
            throw cause;
          }
          const detail = cause instanceof Error ? ` ${cause.message}` : "";
          throw new PluginError(
            `Directive '${lowered.statement.contributionId}' failed.${detail}`,
            {
              code: "PLUGIN_HOOK_FAILED",
              contributionId: lowered.statement.contributionId,
              targetId: this.targetId,
              cause,
            },
          );
        }
      });
      return;
    }
    // Architecture selection can change in source order after the program was lowered.
    const instruction = withSourceSyntax(() =>
      this.commandLoweringService.lowerCommand(lowered.command),
    );
    if (instruction.kind !== "typedInstruction") {
      throw new Error("Expected a typed instruction.");
    }
    this.executeTypedInstruction(instruction);
    lowered.resolved = instruction.resolved;
  }

  /** Classification retains its stage-entry ordering; no prepared values enter the syntax cache. */
  prepareTypedInstruction(
    node: import("./services/command-lowering-service.js").LoweredTypedInstruction,
  ): void {
    const definition = this.resolveActiveArchitecture().definition;
    if (!definition?.encoder.typed?.prepare) {
      return;
    }
    let operands;
    let bindingFailure: import("./ir/resolved-instruction.js").OperandBindingFailure | undefined;
    try {
      operands = bindInstructionOperands(
        node.instruction.operands,
        (fragment) => this.resolveDefineFragment(fragment),
        (text) => definition.operandGrammar.parse(node.instruction.mnemonic, text),
      );
    } catch (cause) {
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
      withTypedExecution(() => definition.encoder.typed.prepare!(frame));
      node.prepared = frame.snapshot();
    } finally {
      frame.close();
    }
  }

  /** Preserve binding diagnostics as data without retaining exception/session objects in a receipt. */
  private operandBindingFailure(
    cause: unknown,
  ): import("./ir/resolved-instruction.js").OperandBindingFailure {
    return {
      reason: cause instanceof OperandTemplateBindingError ? cause.reason : "other",
      message: cause instanceof Error ? cause.message : String(cause),
    };
  }

  /** Every borrowed evaluation capability expires with its instruction's stage frame. */
  private createInstructionFrame(
    instruction: import("./ir/resolved-instruction.js").ParsedInstruction,
    preparation?: import("./ir/resolved-instruction.js").ResolvedInstruction,
    bindingFailure?: import("./ir/resolved-instruction.js").OperandBindingFailure,
  ): InstructionResolutionFrame {
    // Method syntax avoids per-instruction name wrappers while captured session access permits detached calls.
    // oxlint-disable-next-line typescript/no-this-alias -- Detached method callbacks avoid hot-path transpiler name wrappers.
    const session = this;
    const identity = session.activeStageExecutionState ?? {};
    return new InstructionResolutionFrame(
      instruction,
      {
        bindingFailure,
        sourceAdapter: session.moduleOptions?.sourceAdapter,
        previewSource: (expression: ExpressionNode) => session.previewSourceExpression(expression),
        withSourcePreview: <T>(operation: (advance: (bytes: number) => void) => T) =>
          session.moduleAssembly!.withPreviewCursor(operation),
        ...(session.moduleAssembly
          ? {
              compileLink: (expression: ExpressionNode) =>
                session.compileLinkExpression(expression),
              sectionPosition: () => session.moduleAssembly!.position(),
            }
          : {}),
        evaluate(expression) {
          const preview = session.previewSourceExpression(expression);
          if (preview !== undefined) {
            return preview;
          }
          return session.operandResolver.getnum(expression);
        },
        evaluateMath(expression) {
          const preview = session.previewSourceExpression(expression);
          if (preview !== undefined) {
            return preview;
          }
          return session.mathCore.math(expression);
        },
        reference(expression, address) {
          const resolved = session.resolveStructuredReference(
            expression,
            session.requireStaticLabelLookup,
            address,
          );
          const preview = session.previewSourceExpression(expression);
          if (preview !== undefined && resolved.kind === "resolved") {
            return { ...resolved, value: preview };
          }
          return resolved;
        },
        error(message) {
          return new Error(`${message} (${session.currentFile}:${session.currentLine + 1})`);
        },
        currentAddress() {
          if (session.asarModuleLayout) {
            try {
              return session.asarModuleLayout.currentAddress("run");
            } catch {
              /* ORG may follow initial declarations. */
            }
          }
          return session.currentTargetAddress;
        },
        stage() {
          return session.traceStage;
        },
        stageIdentity() {
          return session.activeStageExecutionState ?? identity;
        },
      },
      preparation,
    );
  }

  /** Bind templates at the source boundary, then lend a fresh frame for exactly one stage invocation. */
  private executeTypedInstruction(
    node: import("./services/command-lowering-service.js").LoweredTypedInstruction,
  ): boolean {
    const definition = this.resolveActiveArchitecture().definition;
    const encoder = definition?.encoder.typed;
    const grammar = definition?.operandGrammar;
    if (!encoder || !grammar) {
      throw new Error("Typed architecture has no operand grammar or encoder.");
    }
    if (this.moduleAssembly && !encoder.supportsRelocatable) {
      throw new Error(`Architecture '${this.arch}' does not support relocatable operands.`);
    }
    let operands;
    let bindingFailure: import("./ir/resolved-instruction.js").OperandBindingFailure | undefined;
    try {
      operands = bindInstructionOperands(
        node.instruction.operands,
        (fragment) => this.resolveDefineFragment(fragment),
        (text) => grammar.parse(node.instruction.mnemonic, text),
      );
    } catch (cause) {
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
    const frame = this.createInstructionFrame(
      { ...node.instruction, operands },
      node.prepared,
      bindingFailure,
    );
    const previousRangeKind = this.moduleRangeKind;
    this.moduleRangeKind = "instruction";
    const assertLive = (): void => {
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
      } else {
        // oxlint-disable-next-line typescript/no-this-alias -- Capabilities remain callable detached from their method object.
        const session = this;
        const handled = withTypedExecution(() =>
          encoder.encode(frame, {
            emission: {
              writeRelocation(expression, encoding) {
                assertLive();
                session.writeRelocation(expression, encoding);
              },
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
          }),
        );
        if (handled) {
          node.resolved = frame.snapshot();
          if (this.moduleAssembly && this.canEmitBytes) {
            this.moduleAssembly.instructions.push({
              ...this.moduleAssembly.position(address),
              size: this.bytes - beforeBytes,
              source: this.moduleSource(),
              form: node.resolved.form,
              state: node.resolved.state,
            });
          }
          if (capture) {
            const operandText = node.command.parsed.opcodeOperands?.operandText ?? "";
            // Match the legacy numeric observer: one finite value per displayed expression,
            // even when a compound instruction reads the same operand more than once.
            // Width probes are preparatory reads, not emitted instruction operands.
            const observations = node.resolved.values
              .filter((value) => value.point !== "classification")
              .map((value) => ({
                expression:
                  value.displayText ?? operandText.slice(value.span.start, value.span.end),
                value: value.value,
              }))
              .filter(
                (value, index, all) =>
                  Number.isFinite(value.value) &&
                  all.findIndex(
                    (other) => other.expression === value.expression && other.value === value.value,
                  ) === index,
              );
            this.addressToLineMapping.instructions.push({
              fileIdx: this.addressToLineMapping.getFileIndex(node.source.file),
              line: node.source.line + 1,
              architecture: this.arch,
              addressSpace:
                this.environment.getTarget(this.targetId)?.addressSpace ?? "target.logical",
              address,
              size: this.bytes - beforeBytes,
              ...(outputOffset >= 0 ? { outputOffset } : {}),
              // Spelling is attribution only; values come from observations, never another evaluation.
              operands: observations,
            });
          }
        } else if (definition.unknownInstructionBehavior !== "returnFalse") {
          throw new Error(`Unknown instruction: ${node.instruction.mnemonic}`);
        }
        return handled;
      }
    } finally {
      frame.close();
      this.moduleRangeKind = previousRangeKind;
    }
  }

  /**
   * Parses a function definition of the form:
   *   function name(param1, param2...) = expression
   * Possibly spanning multiple lines joined by backslashes.
   * @param defLine The function definition line.
   */
  parseFunctionDefinition(defLine: string): void {
    this.mathCore.parseFunctionDefinition(defLine);
    const functionName = defLine.match(/^function\s+([_a-z]\w*)\s*\(/i)?.[1];
    if (functionName) {
      this.recordSymbolDefinition("function", functionName);
    }
  }

  /**
   * Adds a mapping of the current address to the source line number.
   * @param address The logical address to add to the mapping.
   */
  addAddressToLine(address: number): void {
    incrementInternalCounter("addressMappings");
    if (!this.collectSourceMetadata) {
      return;
    }
    this.addressToLineMapping.includeMapping(this.currentFile, this.currentLine + 1, address);
  }

  /**
   * Evaluates a range expression and returns the result.
   * @param expr The expression to evaluate.
   * @returns The result of the expression.
   */
  evaluateRangeExpression(expr: string | ExpressionNode): number {
    const resolvedExpr = this.resolveExpressionInput(expr);
    if (isReferenceExpressionNode(resolvedExpr)) {
      return this.evaluateReferenceExpressionNode(resolvedExpr, true);
    }
    return this.mathCore.math(resolvedExpr);
  }

  /**
   * Replace include search paths before assembly. Retains the array without copying.
   * @param paths Provider-specific search paths. Node resolves relative paths from cwd.
   */
  setIncludePaths(paths: string[]): void {
    this.includePaths = paths;
  }

  /**
   * Evaluates an expression for conditionals (if, while).
   * @param expression The expression to evaluate.
   * @returns True if the expression is true, false otherwise.
   */
  evaluateExpression(expression: string | ExpressionNode): boolean {
    let resolvedExpr: ExpressionNode | undefined;
    let result: number;
    try {
      // Resolve inside the guarded block so failures from define/label/static checks
      // are reported with the same contextual wrapper as math failures.
      resolvedExpr = this.resolveExpressionInput(expression);
      result = isReferenceExpressionNode(resolvedExpr)
        ? this.evaluateReferenceExpressionNode(resolvedExpr)
        : this.mathCore.math(resolvedExpr);
    } catch (e: unknown) {
      const originalExpr =
        typeof expression === "string" ? expression : renderExpressionNode(expression);
      const resolvedText = resolvedExpr ? renderExpressionNode(resolvedExpr) : "<unresolved>";
      throw new Error(
        `Error evaluating expression "${originalExpr}" (resolved to "${resolvedText}"): ${e instanceof Error ? e.message : JSON.stringify(e)}`,
        { cause: e },
      );
    }
    // In our assembler, a condition is true if the result is nonzero.
    return result !== 0;
  }

  /**
   * Evaluate an assertion, or defer it when skipped asset bytes make its inputs provisional.
   * Literal arithmetic and expanded numeric defines remain checkable during editor analysis.
   * @param expression Assertion condition.
   * @returns The condition result, or undefined until a build resolves the layout.
   */
  evaluateAssertion(expression: string | ExpressionNode): boolean | undefined {
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
   * @param expression The expression source or parsed node.
   * @returns The resolved expression tree.
   */
  resolveExpressionInput(expression: string | ExpressionNode): ExpressionNode {
    const parsed =
      typeof expression === "string"
        ? this.frontEndService.parseAssemblyExpression(expression.trim())
        : expression;
    return this.resolveExpressionNode(parsed);
  }

  /**
   * Recursively resolves define references and nested reference-expression nodes.
   * @param expression The expression node to resolve.
   * @returns The resolved expression node.
   */
  resolveExpressionNode(expression: ExpressionNode): ExpressionNode {
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
          const fragment = this.resolveDefineFragment(
            sourceFragment(expression.text, [
              {
                file: this.currentFile,
                line: this.currentLine,
                text: expression.text,
                span: expression.span,
              },
            ]),
          );
          const text = fragmentText(fragment);
          if (text === expression.text) {
            throw new Error(`Unbound expression template: ${text}`);
          }
          return inheritExpressionOccurrence(
            this.resolveExpressionNode(this.frontEndService.parseFragmentExpression(text)),
            expression,
          );
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
   * @param expression The reference expression to resolve.
   * @returns The resolved expression tree.
   */
  resolveReferenceExpressionNode(expression: ReferenceExpressionNode): ExpressionNode {
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
        return inheritExpressionOccurrence(
          this.resolveExpressionNode(this.frontEndService.parseFragmentExpression(value)),
          expression,
        );
      }
      case "member": {
        const object = this.resolveReferenceExpressionNode(expression.object);
        if (!isReferenceExpressionNode(object)) {
          return inheritExpressionOccurrence(
            this.bindReferenceSuffix(object, expression),
            expression,
          );
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
          return inheritExpressionOccurrence(
            this.bindReferenceSuffix(object, expression),
            expression,
          );
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
   * @param expression The reference expression to evaluate.
   * @param [requireStatic] Whether labels must be static.
   * @returns The numeric value of the reference.
   */
  evaluateReferenceExpressionNode(
    expression: ReferenceExpressionNode,
    requireStatic = false,
  ): number {
    const resolved = this.resolveReferenceLabelValue(expression, requireStatic);
    if (typeof resolved === "number") {
      return resolved;
    }
    throw new Error(`Reference '${resolved}' did not resolve to a numeric value.`);
  }

  /**
   * Resolves a reference expression to either a numeric value or a normalized
   * label/struct lookup target, depending on how far the expression collapses.
   * @param expression The reference expression to resolve.
   * @param [requireStatic] Whether labels must be static.
   * @returns The resolved numeric value.
   */
  resolveReferenceLabelValue(
    expression: ReferenceExpressionNode,
    requireStatic = false,
  ): number | string {
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
  resolveStructuredReference(
    expression: ReferenceExpressionNode,
    requireStatic = false,
    relativeAddress?: number,
  ): ReferenceResolution {
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
      const structValue = this.structEngine.resolveStructPath(path, (node) =>
        this.mathCore.math(this.resolveExpressionNode(node)),
      );
      if (structValue !== undefined) {
        return { kind: "resolved", value: structValue };
      }
      // Flat symbol tables need a key, not a second grammar pass. Member separators remain lexical.
      let name = path.root;
      for (const segment of path.segments) {
        if (segment.kind === "member") {
          name += `.${segment.name}`;
        } else {
          name += `[${this.mathCore.math(this.resolveExpressionNode(segment.expression))}]`;
        }
      }
      const value = this.symbolScope.tryGetLabelValue(name, requireStatic);
      if (value !== undefined) {
        return { kind: "resolved", value };
      }
      return { kind: "missing", name, deferred: this.isDefinitionCollectionStage };
    } catch (error) {
      return { kind: "error", error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  /** A textual define suffix binds to its final operand; it does not introduce an implicit group. */
  private bindReferenceSuffix(
    object: ExpressionNode,
    suffix: Extract<ReferenceExpressionNode, { type: "member" | "index" }>,
  ): ExpressionNode {
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
   * @param input The token to resolve.
   * @returns The resolved address string, if applicable.
   */
  tryResolveRelativeLabelToken(input: string): string | undefined {
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
    } catch (error) {
      if (!this.enforceResolvedLabels) {
        return "$0000";
      }
      throw error;
    }
  }

  /**
   * Resolves direct `!name` define references that are not assignments.
   * @param input The token to resolve.
   * @returns The resolved define value, if applicable.
   */
  tryResolveDirectDefineReference(input: string): string | undefined {
    if (
      !input.startsWith("!") ||
      input.includes(" ") ||
      input.includes("=") ||
      input.includes("{")
    ) {
      return undefined;
    }

    const varName = input.substring(1);
    return this.lookupDefineValue(varName);
  }

  /**
   * Resolves macro-label references such as `?label` or `#+?label`.
   * @param input The token to resolve.
   * @returns The resolved macro-label value, if applicable.
   */
  tryResolveMacroLabelReference(input: string): string | undefined {
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
   * @param input The token to resolve.
   * @returns The resolved label value, if applicable.
   */
  tryResolveBareLabelReference(input: string): string | undefined {
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
   * @param input The string to resolve defines in.
   * @returns The string with defines resolved.
   */
  resolvedefines(input: string): string {
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
  resolveDefineFragment(fragment: SourceFragment): SourceFragment {
    const input = fragmentText(fragment);
    if (!input) {
      return fragment;
    }
    // Trim each comparison operand as before, but keep definition and invocation contributors.
    if (input.includes("!=")) {
      const segments: SourceFragment["segments"][number][] = [];
      let start = 0;
      for (const part of input.split("!=")) {
        const left = start + part.length - part.trimStart().length;
        const right = start + part.trimEnd().length;
        segments.push(
          ...this.resolveDefineFragment(sliceSourceFragment(fragment, left, right)).segments,
        );
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
   * @param stage The stage.
   */
  activateStage(stage: AssemblyStageName): void {
    this.syncActiveStageExecutionState(stage);
    if (this.moduleAssembly) {
      if (stage === "collectDefinitions") {
        this.moduleFiles?.beginBuild();
      }
      this.moduleAssembly.beginStage(stage);
      this.asarModuleLayout?.beginStage();
      this.moduleAssetRemaining = 0;
      this.setWritePosition(0);
    }
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
    this.runLifecycleHook("onStageStart", (lifecycle) =>
      lifecycle.onStageStart?.({
        state: this.pluginState,
        session: this.#pluginCapabilities,
        stage,
      }),
    );
  }

  /**
   * Completes the current pass, performing any necessary cleanup.
   */
  finishPass(): void {
    this.structEngine.data.finish();
    if (/^(?:datastruct\b|\[)/i.test(this.frontEndService.commandBuffer.trimStart())) {
      throw new Error("Unclosed dataStruct initializer at end of source.");
    }
    if (/^includeasset\s*\(/i.test(this.frontEndService.commandBuffer.trimStart())) {
      throw new Error("Unclosed includeAsset call at end of source.");
    }
    const stage = this.activeStageExecutionState?.stage ?? "collectDefinitions";
    this.runLifecycleHook("onStageEnd", (lifecycle) =>
      lifecycle.onStageEnd?.({ state: this.pluginState, session: this.#pluginCapabilities, stage }),
    );
    if (this.getActiveStageCapabilities().canFinalize && !this.moduleAssembly) {
      this.runLifecycleHook("beforeOutputFinalize", (lifecycle) =>
        lifecycle.beforeOutputFinalize?.({
          state: this.pluginState,
          session: this.#pluginCapabilities,
          outputBytes: this.outputBytes,
        }),
      );
    }
    this.outputWriter.finishPass();
    this.moduleAssembly?.finish();
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
   * @param filename The filename to set.
   */
  setCurrentFile(filename: string): void {
    this.currentFile = filename;
    this.currentLine = 0;
    this.programModelBuilder.resetIncrementalParseState(this.incrementalProgramParseState);
  }

  /**
   * Sets the current line number.
   * @param line The line number to set.
   */
  setCurrentLine(line: number): void {
    this.currentLine = line;
  }

  /**
   * Maps a stage name to its execution capabilities without mutating session state.
   * @param stage Assembly stage identifier.
   */
  getStageDescriptor(
    stage: AssemblyStageName,
  ): Pick<StageExecutionState, "stage" | "capabilities"> {
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
   * Deep-copies anonymous forward/backward label stacks for stage isolation.
   * @param source Label stacks keyed by relative depth.
   */
  cloneRelativeLabels(source: { [depth: number]: { addr: number; macroInstance?: number }[] }): {
    [depth: number]: { addr: number; macroInstance?: number }[];
  } {
    const clone: { [depth: number]: { addr: number; macroInstance?: number }[] } = {};
    for (const [depth, entries] of Object.entries(source)) {
      clone[Number(depth)] = entries.map((entry) => Object.assign({}, entry));
    }
    return clone;
  }

  /**
   * Builds a fresh stage snapshot seeded from the previous stage when applicable.
   * @param stage Assembly stage to initialize.
   */
  createStageExecutionState(stage: AssemblyStageName): StageExecutionState {
    const descriptor = this.getStageDescriptor(stage);
    let previousStage: AssemblyStageName | undefined;
    if (stage === "resolveLayout") {
      previousStage = "collectDefinitions";
    } else if (stage === "emitProgram") {
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
        labelTable: new Map(
          Array.from(symbolSeed.labelTable.entries()).map(([key, value]) => [key, { ...value }]),
        ),
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
   * @param stageState The stage state.
   */
  applyStageExecutionState(stageState: StageExecutionState): void {
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
   * @param stageState The stage state.
   */
  captureStageExecutionState(stageState: StageExecutionState): void {
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
   * Returns a cached stage snapshot, creating it on first use.
   * @param stage Assembly stage key.
   */
  getOrCreateStageExecutionState(stage: AssemblyStageName): StageExecutionState {
    const existing = this.stageExecutionStates.get(stage);
    if (existing) {
      return existing;
    }
    const created = this.createStageExecutionState(stage);
    this.stageExecutionStates.set(stage, created);
    return created;
  }

  /**
   * Parses source into a program model using the session front-end grammar.
   * @param source Raw assembly source text.
   * @param sourceFile Path attributed to the buffer.
   * @param startLine Zero-based line offset for embedded fragments.
   */
  buildProgramModel(source: string, sourceFile = this.currentFile, startLine = 0): ProgramModel {
    return withSourceSyntax(() =>
      measureInternalPhase("buildProgramModel", () => {
        const program = this.frontEndService.parseSource(source, sourceFile, startLine);
        return program;
      }),
    );
  }

  /**
   * Executes one assembly stage against a parsed program, updating session state in place.
   * @param stage Stage to run.
   * @param program Program whose grammar must match the current front-end identity.
   */
  runStage(stage: AssemblyStageName, program: ProgramModel): StageExecutionState {
    if (
      program.grammarIdentity !== undefined &&
      program.grammarIdentity !== this.frontEndService.grammarIdentity
    ) {
      throw new Error("Source grammar changed; parse the source again before execution.");
    }
    return withAstQualification(() =>
      measureInternalPhase(stage, () => {
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
        const loweredProgram = withSourceSyntax(() =>
          this.getOrCreateLoweredProgram(stageState, program),
        );
        measureInternalPhase("executeProgram", () =>
          this.executeLoweredNodeStream(loweredProgram.nodes),
        );
        measureInternalPhase("finishPass", () => this.finishPass());
        this.captureStageExecutionState(stageState);
        return stageState;
      }),
    );
  }

  /**
   * Run definition collection, layout resolution, and byte emission synchronously in that order.
   * Throws at the first unrecovered failure. Partial state/output is not a successful binary.
   * @param program Parsed source model produced for this target's syntax.
   */
  assembleProgram(program: ProgramModel): void {
    const definitions = this.runStage("collectDefinitions", program);
    // Later stages seed symbol/plugin snapshots, not lowered instructions and their prepared values.
    // Full builds can reclaim these caches immediately; direct runStage calls retain durable results.
    definitions.loweredProgram = null;
    const layout = this.runStage("resolveLayout", program);
    layout.loweredProgram = null;
    this.runStage("emitProgram", program);
    if (this.moduleAssembly && program.sourceText !== undefined) {
      this.addressToLineMapping.registerDependencySnapshot(
        program.sourceFile,
        new TextEncoder().encode(program.sourceText),
      );
    }
  }

  /**
   * Parse and run all three assembly stages. Includes are read through the configured provider.
   * Throws on failure. Read the finalized bytes with getBinaryOutput after success.
   * @param source Assembly source text, not a filename.
   * @param [sourceFile] Source identity and include-resolution base. Defaults to currentFile.
   * @param [startLine] Zero-based line offset. Defaults to zero.
   * @returns Parsed model used for this build.
   */
  assembleSource(source: string, sourceFile = this.currentFile, startLine = 0): ProgramModel {
    const program = this.buildProgramModel(source, sourceFile, startLine);
    this.assembleProgram(program);
    if (this.moduleAssembly) {
      this.moduleFiles?.recordSource(sourceFile, new TextEncoder().encode(source));
    }
    return program;
  }

  /**
   * Writes a repeated byte into the output buffer.
   * @param start The starting address of the block to write.
   * @param value The byte value to write.
   * @param [length] The length of the block to write.
   */
  writeOutputBytes(start: number, value: number, length: number = 1): void {
    if (this.moduleAssembly) {
      throw new Error("ROM buffer patching requires linked output.");
    }
    if (typeof start !== "number" || typeof value !== "number" || typeof length !== "number") {
      throw new Error("writeOutputBytes requires a number for start, value, and length");
    }
    this.outputBuffer.fill(start, value, length);
  }

  /**
   * Expands the output buffer and fills it with a specified byte.
   * @param newSize The new output size.
   * @param fillByte The byte used for the new range.
   */
  expandOutput(newSize: number, fillByte: number): void {
    if (this.moduleAssembly) {
      throw new Error("ROM expansion requires linked output.");
    }
    if (typeof newSize !== "number" || typeof fillByte !== "number") {
      throw new Error("expandOutput requires a number for newSize and fillByte");
    }
    if (newSize > this.outputBytes.length) {
      this.writeOutputBytes(this.outputBytes.length, fillByte, newSize - this.outputBytes.length);
    }
  }

  /** Runs the active output-format finalizer. */
  finalizeOutput(): void {
    if (this.moduleAssembly) {
      throw new Error("ROM finalization requires linked output.");
    }
    this.pluginOutputFormat.finalize({
      state: this.pluginState,
      outputBytes: this.outputBytes,
    });
  }

  /**
   * Materialize the target format's current bytes without assembling or finalizing again.
   * @returns Output whose ownership depends on the formatter. Copy before retaining or mutating independently.
   */
  getBinaryOutput = (): Uint8Array => {
    if (this.moduleAssembly) {
      throw new Error(
        "Relocatable assembly produces a module; use getAssemblyModule() and link it before requesting ROM bytes.",
      );
    }
    return this.pluginOutputFormat.getOutput({
      state: this.pluginState,
      outputBytes: this.outputBytes,
    });
  };

  /**
   * Lowers completed runtime nodes and executes them through the production executor.
   * @param nodes The runtime nodes to lower and execute.
   */
  lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void {
    const loweredNodes = nodes.map((node) => this.commandLoweringService.lowerExecutableNode(node));
    for (const node of loweredNodes) {
      this.executeWithAnalysisRecovery(
        node,
        (current) => this.getLoweredNodeSpan(current),
        (current) => this.executeLoweredNode(current),
      );
    }
  }

  /**
   * Evaluates numeric start and end bounds for a lowered `for` loop header.
   * @param forBlock Lowered loop node carrying parsed and cached bounds.
   */
  resolveForLoopBounds(forBlock: LoweredLoopNode): {
    variable?: string;
    start?: number;
    end?: number;
  } {
    const parsedForLoop = forBlock.header?.parsed.forLoop;
    const variable = forBlock.variable ?? parsedForLoop?.variable;
    let start: number | undefined = forBlock.start;
    let end: number | undefined = forBlock.end;

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
   * @param forBlock The for block.
   * @param executeBody The execute body.
   */
  executeForLoopIterations(forBlock: LoweredLoopNode, executeBody: () => void): void {
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
    } else {
      this.defines.delete(variable);
    }
    if (originalLoopValue !== undefined) {
      this.activeLoopVariables.set(variable, originalLoopValue);
    } else {
      this.activeLoopVariables.delete(variable);
    }
  }

  /**
   * Executes lowered loop.
   * @param loopBlock The loop block.
   */
  executeLoweredLoop(loopBlock: LoweredLoopNode): void {
    if (loopBlock.loopType === "for") {
      this.executeLoweredForLoop(loopBlock);
    } else {
      this.executeLoweredWhileLoop(loopBlock);
    }
  }

  /**
   * Executes lowered for loop.
   * @param forBlock The for block.
   */
  executeLoweredForLoop(forBlock: LoweredLoopNode): void {
    this.executeForLoopIterations(forBlock, () => this.executeLoweredNodeStream(forBlock.commands));
  }

  /**
   * Executes while loop commands.
   * @param whileBlock The while block.
   * @param commands The commands.
   * @param getDefineTarget The get define target.
   * @param executeCommand The execute command.
   */
  executeWhileLoopCommands<TCommand>(
    whileBlock: LoweredLoopNode,
    commands: TCommand[],
    getDefineTarget: (command: TCommand) => string | null,
    executeCommand: (command: TCommand) => void,
  ): void {
    const conditionNode =
      whileBlock.conditionNode ?? whileBlock.header?.parsed.condition?.expression;
    if (!conditionNode) {
      return;
    }

    let iteration = 0;
    const MAX_ITERATIONS = 10000;
    const loopVars = new Set<string>();
    const originalValues = new Map<string, string | undefined>();

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
      } else {
        this.defines.delete(varName);
      }
    }
  }

  /**
   * Executes lowered while loop.
   * @param whileBlock The while block.
   */
  executeLoweredWhileLoop(whileBlock: LoweredLoopNode): void {
    this.executeWhileLoopCommands(
      whileBlock,
      whileBlock.commands,
      (cmd) =>
        cmd.kind === "operation" &&
        cmd.operation.kind === "defineAssignment" &&
        cmd.operation.operator === "=" &&
        !cmd.operation.dynamic &&
        /^[A-Z_a-z]/.test(cmd.operation.name)
          ? cmd.operation.name
          : null,
      (cmd) => this.executeLoweredNodeWithRecovery(cmd),
    );
  }

  /**
   * Returns the normalized source span for diagnostics on a lowered executable node.
   * @param node Lowered command or loop header node.
   */
  getLoweredNodeSpan(node: LoweredExecutableNode): SourceSpan | undefined {
    if ("source" in node) {
      return node.source.normalizedSpan;
    }
    return node.header?.source.normalizedSpan;
  }

  /**
   * Executes a tree or lowered node while routing analysis-mode failures into diagnostics.
   * @param node The node to execute.
   * @param getSpan Resolves the node span for diagnostics.
   * @param executeNode Executes the node with its native dispatcher.
   */
  executeWithAnalysisRecovery<TNode>(
    node: TNode,
    getSpan: (node: TNode) => SourceSpan | undefined,
    executeNode: (node: TNode) => void,
  ): void {
    if (!this.analysisErrorRecoveryEnabled) {
      executeNode(node);
      return;
    }

    try {
      executeNode(node);
    } catch (error) {
      this.reportErrorDiagnostic(error, getSpan(node), this.activeStageExecutionState?.stage);
    }
  }

  /**
   * Executes lowered node with recovery.
   * @param node The node.
   */
  executeLoweredNodeWithRecovery(node: LoweredExecutableNode): void {
    const command =
      node.kind === "loop" || node.kind === "conditional" || node.kind === "capture"
        ? node.header
        : node.command;
    const previous = this.currentSourceOrigin;
    this.currentSourceOrigin = command?.source.origin ?? previous;
    try {
      this.executeWithAnalysisRecovery(
        node,
        (currentNode) => this.getLoweredNodeSpan(currentNode),
        (currentNode) => this.executeLoweredNode(currentNode),
      );
    } catch (error) {
      if (this.currentSourceOrigin) {
        rememberErrorSource(error, this.getCurrentSourceLocation(this.getLoweredNodeSpan(node)));
      }
      throw error;
    } finally {
      this.currentSourceOrigin = previous;
    }
  }

  /**
   * Executes lowered node.
   * @param node The node.
   */
  executeLoweredNode(node: LoweredExecutableNode): void {
    const sourceCommand =
      node.kind === "loop" || node.kind === "conditional" || node.kind === "capture"
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
      this.executeLoweredNodeWithRecovery(
        this.commandLoweringService.lowerExecutableNode(node.header),
      );
      const scope = node.captureKind === "struct" ? "struct" : undefined;
      for (const command of node.commands) {
        if (
          node.captureKind === "dataStructs" &&
          (!("source" in command) || command.parsed.declaration?.kind !== "dataStructRow")
        ) {
          throw new Error("dataStructs accepts only indexed records: [index] = { field = value }.");
        }
        this.executeLoweredNodeWithRecovery(
          this.commandLoweringService.lowerExecutableNode(command, scope),
        );
      }
      if (node.footer) {
        if (node.captureKind === "struct") {
          // Closing a struct restores its cursor without emitting an executable command trace.
          this.currentFile = node.footer.source.file;
          this.currentLine = node.footer.source.line;
          this.structEngine.handleStructMode(node.footer);
        } else {
          this.executeLoweredNodeWithRecovery(
            this.commandLoweringService.lowerExecutableNode(node.footer),
          );
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
      } else {
        // Bare invocation candidates retain their source envelope even when they bind to a directive/opcode.
        this.executeAttributedCommand(node.command, () =>
          this.dispatchLoweredNode(this.commandLoweringService.lowerCommand(node.command)),
        );
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
      const fragment = this.macroEngine.resolveVariadicFragment(
        input,
        origin?.kind === "macro" ? origin.arguments : [],
      );
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
          this.characterMappings.set(
            declaration.character,
            this.operandResolver.getnum(declaration.expression),
          );
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
      } else {
        this.dispatchLoweredNode(this.commandLoweringService.lowerCommand(node.command));
      }
      return;
    }

    if (node.kind === "typedInstruction") {
      if (this.collectSourceMetadata) {
        this.collectCommandReferences(node.command);
      }
    }

    if (node.kind === "loop") {
      this.executeLoweredLoop(node);
      return;
    }

    if (node.kind === "conditional") {
      this.executeConditionalBranches(node.branches, (commands) =>
        this.executeLoweredNodeStream(commands),
      );
      return;
    }

    if (
      node.kind === "pluginSyntax" &&
      !node.command.keyword.startsWith(".") &&
      !["unknown", "opcodeCandidate", "directive"].includes(node.command.kind)
    ) {
      // Declaration-shaped directives retain both declaration and directive trace envelopes.
      this.executeAttributedCommand(node.command, () => this.dispatchLoweredNode(node));
      return;
    }
    this.dispatchLoweredNode(node);
  }

  /**
   * Executes lowered node stream.
   * @param nodes The nodes.
   */
  executeLoweredNodeStream(nodes: LoweredExecutableNode[]): void {
    for (const node of nodes) {
      this.executeLoweredNodeWithRecovery(node);
    }
  }

  /**
   * Drains and executes any completed nodes still buffered in the incremental parser.
   * This protects re-entrant command sources, such as macro expansion, from leaving
   * finished typed roots stranded until the next top-level line arrives.
   */
  flushCompletedIncrementalNodes(): void {
    const ready = this.programModelBuilder.drainCompletedRoots(this.incrementalProgramParseState);
    if (ready.length > 0) {
      this.lowerAndExecuteRuntimeNodes(ready);
    }
  }

  /**
   * Executes conditional branches.
   * @param branches The branches.
   * @param executeCommands The execute commands.
   */
  executeConditionalBranches<TCommand>(
    branches: Array<{
      kind: "if" | "elseif" | "else";
      conditionNode?: ExpressionNode;
      commands: TCommand[];
    }>,
    executeCommands: (commands: TCommand[]) => void,
  ): void {
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
      } finally {
        this.requireStaticLabelLookup = false;
      }
      if (branchConditionMatched) {
        executeCommands(branch.commands);
        return;
      }
    }
  }
}

/** Section declarations accept literal strings or bare names, never layout-dependent expressions. */
function sectionName(node: ExpressionNode | undefined): string {
  if (node?.type === "string") {
    return node.value;
  }
  if (node?.type === "identifier") {
    return node.name;
  }
  throw new Error("Section name and kind must be literal names.");
}
