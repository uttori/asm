import type { CursorAddressFacade } from "./assembler-internals.js";
import type {
  ArchitectureEncoder,
  ArchitectureEncoderContext,
  ExpressionHost,
  LoweredInstruction,
  LoweredOperand,
} from "./architecture-types.js";
import { AddressToLineMapping } from "./addressToLine.js";
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
} from "./diagnostics.js";
import type {
  ConditionalBranchNode,
  ExecutableNode,
  LoopNode,
  MacroDefinitionNode,
} from "./ir/assembly-tree.js";
import {
  isReferenceExpressionNode,
  parseExpressionNode,
  renderExpressionNode,
  renderReferenceExpressionNode,
  type ExpressionNode,
  type ReferenceExpressionNode,
} from "./ir/expression-node.js";
import {
  cloneNormalizedCommand,
  setCommandKind,
  setCommandWords,
  type NormalizedCommand,
} from "./ir/normalized-command.js";
import { MathCore } from "./mathcore.js";
import { OperandResolver } from "./operand-resolver.js";
import { ArchitectureRegistry, type ArchitectureDefinition } from "./architecture-registry.js";
import { DirectiveRegistry, createDirectiveRegistry } from "./directives/registry.js";
import { DefineEngine } from "./services/define-engine.js";
import {
  DirectiveRuntimeService,
  type PushPcStackEntry,
} from "./services/directive-runtime-service.js";
import {
  AssemblyFrontEndService,
  type AssemblyFrontEndHost,
} from "./services/assembly-front-end-service.js";
import {
  CommandLoweringService,
  type LoweredCommand,
  type LoweredExecutableNode,
  type LoweredLoopNode,
  type LoweredProgram,
} from "./services/command-lowering-service.js";
import { FrontEndCommandService } from "./services/front-end-command-service.js";
import { IncludeSourceService, type IncludedFileInfo } from "./services/include-source-service.js";
import { MacroEngine, type MacroDefinition } from "./services/macro-engine.js";
import {
  ProgramModelBuilder,
  type IncrementalProgramParseState,
  type ProgramModel,
} from "./services/program-model-builder.js";
import { OutputWriterService } from "./services/output-writer-service.js";
import { StructEngine, type StructDefinition } from "./services/struct-engine.js";
import { SymbolScopeService, type LabelEntry } from "./services/symbol-scope-service.js";
import {
  getDefineVariable,
  isBareLabelReference,
  splitInlineCommands,
} from "./services/command-text-service.js";
import type { SourceSpan } from "./source-location.js";
import { NodeAssemblyFileProvider, type AssemblyFileProvider } from "./file-provider.js";
import { incrementInternalCounter, measureInternalPhase } from "./internal-instrumentation.js";
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
import type { AssemblyStageName } from "./plugin/contracts.js";

let debug = (..._args: unknown[]): void => {};
/* c8 ignore next */
// if (process.env.UTTORI_DATA_DEBUG || true) {
try {
  const { default: d } = await import("debug");
  debug = d("Assembler");
} catch {}
// }

type RuntimeConditionalNode = ConditionalBranchNode;
export type RuntimeNode = NormalizedCommand | LoopNode | RuntimeConditionalNode;
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
  forwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] };
  backwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] };
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
export type StageExecutionState = {
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
// Source context stack used to associate low-level byte writes with the
// currently executing normalized command, even when directives recurse.
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

type ActiveLifecycle = {
  record: OwnedContribution<LifecycleContribution>;
  instance: SessionLifecycle;
};

export class Assembler {
  /** The current logical target address. */
  public currentTargetAddress: number = 0;
  /** The current logical target base address. */
  public currentTargetBaseAddress: number = 0;
  /** The current target start address. `startpos` */
  public currentTargetStartAddress: number = 0;
  /** The current target base start address. `realstartpos` */
  public currentTargetBaseStartAddress: number = 0;
  public bytes: number = 0;

  public pushBaseStack: number[] = [];

  /** Mutable bytes produced by this assembly session. */
  public outputBytes: number[] | Uint8Array = [];
  /** Byte used when expanding a sparse output range. */
  public outputFillByte: number = 0;

  public whileStatus: WhileTracker[] = [];

  public namespaceStack: string[] = [];
  public currentNamespace: string = "";
  public namespaceNestingEnabled: boolean = false;
  public namespaceNestingPath: string[] = [];

  // Current macro tracking
  public inMacroDefinition: boolean = false;
  public currentMacroName: string = "";
  public currentMacroParams: string[] = [];
  public currentMacroBody: NormalizedCommand[] = [];
  public currentVariadicCount: number | undefined = undefined;
  public currentVariadicArgs: string[] = [];

  public macros: Map<string, MacroDefinition> = new Map();

  public mathCore: MathCore;
  public operandResolver: OperandResolver;

  public addressToLineMapping: AddressToLineMapping = new AddressToLineMapping();
  public currentFile: string = "";
  public currentLine: number = 0;
  /** Optional sink for structured tracing used by tests and ad-hoc debug scripts. */
  public traceListener: AssemblerTraceListener | null = null;
  /** Active command contexts so nested byte writes inherit the right source line. */
  public traceCommandStack: TraceCommandContext[] = [];

  public defines: Map<string, string> = new Map();

  // Character mapping support
  public characterMappings: Map<string, number> = new Map();
  public currentTable: string | null = null;
  public tableStack: Map<string, number>[] = [];

  public inFunctionDefinition: boolean = false;
  public functionDefinitionLines: string[] = [];

  public arch: string = "";

  public pushpcStack: PushPcStackEntry[] = [];
  public pushpcnum: number = 0;

  public labelTable: Map<string, LabelEntry> = new Map();

  /** Track multiple `+` labels */
  public forwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] } = {};
  /** Track multiple `-` labels */
  public backwardLabels: { [depth: number]: { addr: number; macroInstance?: number }[] } = {};

  public padUnit: number = 1;
  public padbyte: number[] = [];

  public structs: Map<string, StructDefinition> = new Map();
  public currentStruct: StructDefinition | null = null;
  public savedPCStack: number[] = [];

  /** Initialize fill pattern */
  public fillbyte: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  public baseImage: Uint8Array;

  // Add a static property to hold our CRC table.
  public static crcTable: number[] | null = null;

  public includedFiles: Map<string, IncludedFileInfo> = new Map();
  public includeStack: string[] = [];
  public includePaths: string[] = ["./"];

  public macroLabelInstance: number = 0; // Tracks the current macro instance
  public inMacroExpansion: boolean = false; // Flag to track if we're inside a macro expansion

  public currentParentLabel: string = ""; // Track the most recent parent label
  public currentParentIsGlobal: boolean = false; // Track if the parent label is global
  public currentGlobalParentLabel: string = ""; // Track the active top-level parent for single-dot labels
  public labelParents: Map<string, string | null> = new Map(); // Track explicit label ancestry without relying on underscores

  public requireStaticLabelLookup: boolean = false;
  readonly passProgramCache: Map<string, RuntimeNode[]> = new Map();
  directiveRegistry: DirectiveRegistry;
  architectureRegistry: ArchitectureRegistry;
  public readonly environment: AssemblerEnvironment;
  public readonly targetId: string;
  public readonly targetOptions: Readonly<Record<string, unknown>>;
  public readonly pluginState: PluginSessionStateStore;
  public readonly pluginAddressSpace: PluginTargetAddressSpace;
  public readonly pluginOutputFormat: PluginTargetOutputFormat;
  readonly activeLifecycles: readonly ActiveLifecycle[];
  readonly cursorAddress: CursorAddressFacade;
  readonly fileProvider: AssemblyFileProvider;
  readonly frontEndService: AssemblyFrontEndService;
  readonly programModelBuilder: ProgramModelBuilder;
  readonly commandLoweringService: CommandLoweringService;
  readonly incrementalProgramParseState: IncrementalProgramParseState;
  public readonly services: AssemblerServiceBag;
  public readonly stageExecutionStates: Map<AssemblyStageName, StageExecutionState> = new Map();
  public readonly diagnostics: AssemblyDiagnostic[] = [];
  public readonly symbolDefinitions: AssemblySymbolDefinition[] = [];
  public readonly symbolReferences: AssemblySymbolReference[] = [];
  public readonly includeEdges: AssemblyIncludeEdge[] = [];
  public readonly collectSourceMetadata: boolean;
  activeStageExecutionState: StageExecutionState | null = null;
  analysisErrorRecoveryEnabled = false;
  runtimePassthroughRewriteEnabled = false;
  sessionDisposed = false;

  get defineEngine(): DefineEngine {
    return this.services.defineEngine;
  }

  get directiveRuntime(): DirectiveRuntimeService {
    return this.services.directiveRuntime;
  }

  get addressWidth(): number {
    return this.pluginAddressSpace.addressWidth;
  }

  get availableArchitectures(): ReadonlySet<string> {
    return new Set(this.environment.getTarget(this.targetId)?.architectures ?? []);
  }

  get targetDisplayName(): string {
    return this.environment.getTarget(this.targetId)?.displayName ?? this.targetId;
  }

  get frontEndCommandService(): FrontEndCommandService {
    return this.services.frontEndCommandService;
  }

  get includeSource(): IncludeSourceService {
    return this.services.includeSource;
  }

  get macroEngine(): MacroEngine {
    return this.services.macroEngine;
  }

  get symbolScope(): SymbolScopeService {
    return this.services.symbolScope;
  }

  get outputWriter(): OutputWriterService {
    return this.services.outputWriter;
  }

  get structEngine(): StructEngine {
    return this.services.structEngine;
  }

  // Core assembler wrapper helpers

  get currentAddress(): number {
    return this.currentTargetAddress;
  }

  /**
   * Records current address.
   */
  recordCurrentAddress(): void {
    this.addAddressToLine(this.currentTargetBaseAddress & 0xffffff);
  }

  /**
   * Sets write position.
   * @param {number} address The address.
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
   * @param {number} base The base.
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
   * @param {number} num The num.
   */
  incrementBytesWritten(num: number): void {
    this.bytes += num;
  }

  get mode(): "layout" | "emit" {
    return this.getActiveStageCapabilities().instructionMode;
  }

  get canEmitBytes(): boolean {
    return this.getActiveStageCapabilities().canEmitBytes;
  }

  get canFinalize(): boolean {
    return this.getActiveStageCapabilities().canFinalize;
  }

  get enforceResolvedLabels(): boolean {
    return this.getActiveStageCapabilities().enforceResolvedLabels;
  }

  get isDefinitionCollectionStage(): boolean {
    return this.getActiveStageCapabilities().isDefinitionCollectionStage;
  }

  /**
   * Reports whether structured tracing is active for this assembly session.
   * @returns {boolean} Whether a trace listener is installed.
   */
  get isTracing(): boolean {
    return this.traceListener !== null;
  }

  /**
   * Traces write.
   * @param {Omit<AssemblerTraceWriteEvent, "type">} event The event.
   */
  traceWrite(event: Omit<AssemblerTraceWriteEvent, "type">): void {
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
  }

  /**
   * Records a directed include-graph edge if it has not already been recorded.
   * Includes execute once per pass, so edges are de-duplicated by file pair.
   * @param {string} fromFile The file issuing the include directive.
   * @param {string} toFile The resolved path of the included file.
   */
  recordIncludeEdge(fromFile: string, toFile: string): void {
    if (!this.collectSourceMetadata) {
      return;
    }
    if (!fromFile || !toFile) {
      return;
    }
    const duplicate = this.includeEdges.some(
      (edge) => edge.fromFile === fromFile && edge.toFile === toFile,
    );
    if (duplicate) {
      return;
    }
    this.includeEdges.push({ fromFile, toFile });
  }

  /**
   * Returns the current source location.
   * @param {SourceSpan} [span] Optional source span override.
   * @returns {AssemblySourceLocation} The current source location.
   */
  getCurrentSourceLocation(span?: SourceSpan): AssemblySourceLocation {
    return createAssemblySourceLocation(this.currentFile, this.currentLine, span);
  }

  /**
   * Converts and records an unknown error.
   * @param {unknown} error The error to normalize.
   * @param {SourceSpan} [span] Optional source span override.
   * @param {string} [stage] Optional stage name.
   * @returns {AssemblyDiagnostic} The recorded diagnostic.
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
   * @param {AssemblySymbolKind} kind The symbol kind.
   * @param {string} name The symbol name.
   * @param {{ file?: string; line?: number; span?: SourceSpan; value?: number | string; containerName?: string }} [options] Optional symbol metadata.
   * @param {string} [options.file] Optional source file override.
   * @param {number} [options.line] Optional source line override.
   * @param {SourceSpan} [options.span] Optional precise source span.
   * @param {number | string} [options.value] Optional resolved symbol value.
   * @param {string} [options.containerName] Optional owning container name.
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
    const duplicate = this.symbolDefinitions.some(
      (entry) =>
        entry.kind === kind &&
        entry.name === name &&
        entry.location.file === file &&
        entry.location.line === line &&
        entry.containerName === options.containerName,
    );
    if (duplicate) {
      return;
    }

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
  recordSymbolReference(
    kind: AssemblySymbolReferenceKind,
    name: string,
    options: { file?: string; line?: number; span?: SourceSpan; containerName?: string } = {},
  ): void {
    if (!this.collectSourceMetadata) {
      return;
    }
    const file = options.file ?? this.currentFile;
    const line = options.line ?? this.currentLine;
    const duplicate = this.symbolReferences.some(
      (entry) =>
        entry.kind === kind &&
        entry.name === name &&
        entry.location.file === file &&
        entry.location.line === line &&
        entry.containerName === options.containerName,
    );
    if (duplicate) {
      return;
    }

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
  collectExpressionReferences(
    expression: ExpressionNode | undefined,
    fallbackSpan?: SourceSpan,
  ): void {
    if (!expression) {
      return;
    }

    switch (expression.type) {
      case "defineReference":
        if (expression.name || expression.content) {
          this.recordSymbolReference(
            "define",
            expression.braced ? (expression.content ?? "") : (expression.name ?? ""),
            {
              span: expression.span ?? fallbackSpan,
            },
          );
        }
        return;
      case "identifier":
        this.recordSymbolReference("label", expression.name, {
          span: expression.span ?? fallbackSpan,
        });
        return;
      case "member":
      case "index":
        this.recordSymbolReference("label", renderReferenceExpressionNode(expression), {
          span: expression.span ?? fallbackSpan,
        });
        if (expression.type === "index") {
          this.collectExpressionReferences(expression.index, fallbackSpan);
        }
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
   * Collects command references.
   * @param {NormalizedCommand} command The command.
   */
  collectCommandReferences(command: NormalizedCommand): void {
    incrementInternalCounter("referenceCollections");
    if (!this.collectSourceMetadata) {
      return;
    }
    const fallbackSpan = command.source.normalizedSpan;
    const parsed = command.parsed;

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
      this.recordSymbolReference(
        "include",
        parsed.includeTarget.target.replace(/^["'`](.*)["'`]$/, "$1"),
        {
          span: command.source.tokenSpans[1] ?? fallbackSpan,
        },
      );
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
   * @returns {AssemblyAnalysisResult} The accumulated diagnostics and symbols.
   */
  collectProgramAnalysis(program: ProgramModel): AssemblyAnalysisResult {
    this.clearAnalysisArtifacts();
    this.analysisErrorRecoveryEnabled = true;
    try {
      this.assembleProgram(program);
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
    };
  }

  /**
   * Creates an isolated assembler session suitable for editor-style analysis.
   * This keeps batch assembly state and tooling state from leaking into each
   * other while still sharing the same file provider and directive registry.
   * @returns {Assembler} A configured analysis session.
   */
  createToolingSession(): Assembler {
    const session = new Assembler({
      environment: this.environment,
      target: this.targetId,
      architecture: this.arch,
      targetOptions: this.targetOptions,
      baseImage: this.baseImage,
      fileProvider: this.fileProvider,
    });
    session.includePaths = [...this.includePaths];
    session.pluginState.restore(this.pluginState.cloneSnapshot());
    session.outputFillByte = this.outputFillByte;
    session.padbyte = [...this.padbyte];
    session.fillbyte = [...this.fillbyte];
    session.padUnit = this.padUnit;
    session.arch = this.arch;
    return session;
  }

  /**
   * Creates directive handlers bound to a fresh session's family capabilities.
   * @param {Assembler} session The session that should receive directive calls.
   * @returns {DirectiveRegistry} A registry bound to the provided session.
   */
  cloneDirectiveRegistryForSession(session: Assembler): DirectiveRegistry {
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
    });
    const target = session.environment.getTarget(session.targetId);
    for (const setId of target?.directiveSets ?? []) {
      const set = session.environment.getDirectiveSet(setId);
      if (!set) continue;
      const pluginId = session.environment.getContributionOwner(setId);
      for (const directive of set.directives) {
        let handler;
        try {
          handler = directive.createHandler({
            targetId: session.targetId,
            state: session.pluginState,
            session,
          });
        } catch (cause) {
          throw new PluginError(`Directive factory '${directive.id}' failed.`, {
            code: "PLUGIN_ACTIVATION_FAILED",
            pluginId,
            contributionId: directive.id,
            targetId: session.targetId,
            cause,
          });
        }
        registry.register(
          [...directive.keywords],
          undefined,
          (_context, words, raw) => {
            try {
              handler({ state: session.pluginState }, words, raw);
            } catch (cause) {
              throw new PluginError(`Directive '${directive.id}' failed.`, {
                code: "PLUGIN_HOOK_FAILED",
                pluginId,
                contributionId: directive.id,
                targetId: session.targetId,
                cause,
              });
            }
          },
          directive.phase,
        );
      }
    }
    for (const [keyword, handler] of registry.handlers) {
      registry.handlers.set(keyword, (words, raw, command) => {
        if (session.runBeforeDirective(keyword, words, raw) === "handled") return;
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
   * @param {string} source The source to analyze.
   * @param {string} [sourceFile] Optional source file override.
   * @param {number} [startLine] Optional starting line number.
   * @returns {AssemblyAnalysisResult & { program: ProgramModel }} The analysis result and program model.
   */
  analyzeSource(
    source: string,
    sourceFile = this.currentFile,
    startLine = 0,
  ): AssemblyAnalysisResult & { program: ProgramModel } {
    const session = this.createToolingSession();
    try {
      const program = session.buildProgramModel(source, sourceFile, startLine);
      return {
        program,
        ...session.collectProgramAnalysis(program),
      };
    } finally {
      session.dispose();
    }
  }

  /**
   * Analyzes workspace.
   * @param {Array<{ source: string; sourceFile: string; startLine?: number }>} documents The documents.
   * @returns {Array<AssemblyAnalysisResult & { program: ProgramModel; sourceFile: string }>} The result.
   */
  analyzeWorkspace(
    documents: Array<{ source: string; sourceFile: string; startLine?: number }>,
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
        const result = session.collectProgramAnalysis(program);
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
    if (!this.baseImage || this.baseImage.length === 0) {
      return;
    }

    for (let i = 0; i < Math.min(seedSize, this.baseImage.length); i++) {
      this.outputBytes[i] = this.baseImage[i];
    }
  }

  /**
   * Creates cursor address facade.
   * @returns {CursorAddressFacade} The result.
   */
  createCursorAddressFacade(): CursorAddressFacade {
    return {
      recordCurrentAddress: () => this.recordCurrentAddress(),
      setWritePosition: (address: number) => this.setWritePosition(address),
      syncWriteStarts: () => this.syncWriteStarts(),
      incrementBytesWritten: (num: number) => this.incrementBytesWritten(num),
    };
  }

  /**
   * Creates services.
   * @returns {AssemblerServiceBag} The result.
   */
  createServices(): AssemblerServiceBag {
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

  constructor(options: AssemblerOptions) {
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
    this.pluginState = new PluginSessionStateStore(this.environment.sessionStates, {
      targetId,
      targetOptions: this.targetOptions,
    });
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
    this.fileProvider = options.fileProvider ?? new NodeAssemblyFileProvider();
    this.collectSourceMetadata = options.collectSourceMetadata ?? true;
    this.cursorAddress = this.createCursorAddressFacade();
    this.mathCore = new MathCore();
    this.mathCore.host = this.expressionHost;
    this.installExpressionFunctions(target.expressionSets);
    this.services = this.createServices();
    const frontEndHost = {
      passProgramCache: this.passProgramCache,
      resolveVariadicPlaceholders: (command: string) =>
        this.macroEngine.resolveVariadicPlaceholders(command),
      shouldEndifCloseInnermostWhile: (
        loopType?: "for" | "while",
        loopStartLine?: number,
        ifStartLine?: number,
      ) => this.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
    } as AssemblyFrontEndHost;
    Object.defineProperties(frontEndHost, {
      currentFile: { get: (): string => this.currentFile },
      currentLine: { get: (): number => this.currentLine },
      inMacroExpansion: { get: (): boolean => this.inMacroExpansion },
      isDefinitionCollectionStage: { get: (): boolean => this.isDefinitionCollectionStage },
    });
    this.frontEndService = new AssemblyFrontEndService(frontEndHost);
    this.programModelBuilder = this.frontEndService.programModelBuilder;
    this.incrementalProgramParseState = this.programModelBuilder.createIncrementalParseState();
    this.operandResolver = new OperandResolver({
      resolveDefines: (input) => this.resolvedefines(input),
      isStructReference: (input) => this.structEngine.hasStructReference(input),
      resolveStructLabel: (input) => this.structEngine.resolveStructLabel(input),
      tryResolveLabel: (input, requireStatic) =>
        this.symbolScope.tryGetLabelValue(input, requireStatic),
      resolveLabel: (input, requireStatic) => this.symbolScope.getLabelValue(input, requireStatic),
      evaluateMath: (input) => this.mathCore.math(input),
      shouldDeferExpressionEvaluation: () =>
        !this.getActiveStageCapabilities().enforceResolvedLabels,
      getCurrentAddress: () => this.currentTargetAddress,
      requireStaticLabelLookup: () => this.requireStaticLabelLookup,
    });
    const encoderContext: ArchitectureEncoderContext = {
      operands: this.operandResolver,
      emission: {
        write1: (value) => this.write1(value),
        write2: (value) => this.write2(value),
        write3: (value) => this.write3(value),
        writeByte: (value) => this.write1(value),
        writeBytes: (values) => this.outputWriter.writeBytes(values),
        writeValue: (value, width, endianness) =>
          this.outputWriter.writeValue(value, width, endianness),
      },
      sizing: {
        getCurrentAddress: () => this.currentTargetAddress,
      },
      branches: {
        enforceResolvedLabels: () => this.enforceResolvedLabels,
        findNextLabel: (label, referenceAddress) =>
          this.symbolScope.findNextLabel(label, referenceAddress),
        findPreviousLabel: (label, referenceAddress) =>
          this.symbolScope.findPreviousLabel(label, referenceAddress),
      },
      diagnostics: {
        error: (message) => new Error(message),
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
      let encoder: ArchitectureEncoder;
      try {
        encoder = contribution.createEncoder({
          ...encoderContext,
          targetId,
          options: this.targetOptions,
          state: this.pluginState,
        });
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
          instructions:
            contribution.instructions.length > 0 ? contribution.instructions : undefined,
          classifyOperand: (resolver, operand) =>
            contribution.classifyOperand({ operands: resolver }, operand),
          splitOperands: contribution.splitOperands,
          unknownInstructionBehavior: contribution.unknownInstructionBehavior,
        },
        [...(contribution.aliases ?? [])],
      );
    }
    this.directiveRegistry = this.cloneDirectiveRegistryForSession(this);
    this.commandLoweringService = new CommandLoweringService(this);
    this.services.frontEnd = this.frontEndService;
    this.services.lowering = this.commandLoweringService;
    this.activeLifecycles = this.environment.getTargetLifecycles(targetId).map((record) => {
      try {
        return { record, instance: record.value.create(targetFactoryContext) };
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
    this.runLifecycleHook("onSessionCreated", (lifecycle) =>
      lifecycle.onSessionCreated?.({ state: this.pluginState, session: this }),
    );
    this.selectArchitecture(this.arch, this.arch);
    this.activateStage("collectDefinitions");
  }

  runLifecycleHook(hookName: string, invoke: (lifecycle: SessionLifecycle) => void): void {
    for (const { record, instance } of this.activeLifecycles) {
      try {
        invoke(instance);
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

  runBeforeDirective(
    keyword: string,
    words: readonly string[],
    raw: string,
  ): "continue" | "handled" {
    let result: "continue" | "handled" = "continue";
    this.runLifecycleHook("beforeDirective", (lifecycle) => {
      if (
        result === "continue" &&
        lifecycle.beforeDirective?.({
          state: this.pluginState,
          session: this,
          keyword,
          words,
          raw,
        }) === "handled"
      ) {
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
  shouldEndifCloseInnermostWhile(
    loopType?: "for" | "while",
    loopStartLine?: number,
    ifStartLine?: number,
  ): boolean {
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
        session: this,
        previousArchitecture,
        architecture: resolved,
        sourceAlias,
      }),
    );
  }

  beforeWrite(logicalAddress: number, width: number): void {
    this.pluginAddressSpace.validateWrite?.(logicalAddress, width);
    this.runLifecycleHook("beforeWrite", (lifecycle) =>
      lifecycle.beforeWrite?.({
        state: this.pluginState,
        session: this,
        logicalAddress,
        width,
      }),
    );
  }

  dispose(): void {
    if (this.sessionDisposed) return;
    this.sessionDisposed = true;
    const errors: unknown[] = [];
    for (const { record, instance } of [...this.activeLifecycles].reverse()) {
      try {
        instance.onSessionDispose?.({ state: this.pluginState, session: this });
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
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        "One or more assembler session resources failed to dispose.",
      );
    }
  }

  /**
   * Reads little endian.
   * @param {Uint8Array} bytes The bytes.
   * @param {number} pos The pos.
   * @param {number} width The width.
   * @returns {number | undefined} The result.
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
   * Checks whether it can read byte range.
   * @param {number} sourceLength The source length.
   * @param {number} position The position.
   * @param {number} size The size.
   * @returns {number} The result.
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
   * Reads byte range.
   * @param {Uint8Array} source The source.
   * @param {number} position The position.
   * @param {number} size The size.
   * @param {number | undefined} defaultValue The default value.
   * @param {string} errorMessage The error message.
   * @returns {number} The result.
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
   * Resolves readable path.
   * @param {string} filename The filename.
   * @returns {string | undefined} The result.
   */
  resolveReadablePath(filename: string): string | undefined {
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
  resolveExpressionHostLabel(identifier: string): number | string {
    const parsed = parseExpressionNode(identifier.trim());
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
  getExpressionObjectSize(identifier: string, baseOnly = false): number {
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

  get currentMacroSourceFile(): string | undefined {
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
  canReadBaseImage(position: number, size: number): number {
    const sourceLength =
      this.baseImage && this.baseImage.length > 0 ? this.baseImage.length : this.outputBytes.length;
    return this.canReadByteRange(sourceLength, position, size);
  }

  /**
   * Reads the base image.
   * @param {number} position The position.
   * @param {number} size The size.
   * @param {number} [defaultValue] The default value.
   * @returns {number} The result.
   */
  readBaseImage(position: number, size: number, defaultValue?: number): number {
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
    return this.readByteRange(
      sourceBytes,
      pcPos,
      size,
      defaultValue,
      `read${Math.trunc(size)} out of bounds at ${pos}`,
    );
  }

  /**
   * Checks whether it can read expression file.
   * @param {string} filename The filename.
   * @param {number} position The position.
   * @param {number} size The size.
   * @returns {number} The result.
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
   * Reads expression file.
   * @param {string} filename The filename.
   * @param {number} position The position.
   * @param {number} size The size.
   * @param {number} [defaultValue] The default value.
   * @returns {number} The result.
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
   * @param {readonly string[]} setIds Resolved expression-set contribution IDs.
   */
  installExpressionFunctions(setIds: readonly string[]): void {
    for (const setId of setIds) {
      const set = this.environment.getExpressionSet(setId);
      if (!set) continue;
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

  readonly expressionHost: ExpressionHost = {
    resolveLabel: (identifier) => this.resolveExpressionHostLabel(identifier),
    convertLogicalToOutputOffset: (address) => this.outputWriter.toOutputOffset(address),
    convertOutputOffsetToLogical: (offset) => this.outputWriter.fromOutputOffset(offset),
    getCurrentAddress: () => this.currentTargetAddress,
    getCurrentBaseAddress: () => this.currentTargetBaseAddress,
    isDefined: (identifier) => {
      if (this.defines.has(identifier)) return 1;
      if (this.structs.has(identifier)) return 1;
      return this.symbolScope.hasLabelInScope(identifier) ? 1 : 0;
    },
    getExpressionObjectSize: (identifier, baseOnly) =>
      this.getExpressionObjectSize(identifier, baseOnly),
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
   * @param {number} num Number of logical address units to advance.
   */
  step(num: number): void {
    this.outputWriter.step(num);
  }

  /**
   * Writes a single architecture byte to output.
   * @param {number} num Byte value to write.
   */
  writeArchitectureByte(num: number): void {
    this.outputWriter.write1(num);
  }

  /**
   * Fills a section of output data with a value.
   * @param {number} start The starting address.
   * @param {number} value The value to fill with.
   * @param {number} length The length of the section to fill.
   */
  fillOutputBytes(start: number, value: number, length: number): void {
    debug("fillOutputBytes", start, value, length);
    for (let i = 0; i < length; i++) {
      this.outputBytes[start + i] = value & 0xff;
    }
  }

  /**
   * Creates ephemeral stage execution state.
   * @param {AssemblyStageName} stage The stage.
   * @returns {StageExecutionState} The result.
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
   * @param {AssemblyStageName} stage The stage.
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

  /**
   * Gets active stage capabilities.
   * @returns {StageExecutionCapabilities} The result.
   */
  getActiveStageCapabilities(): StageExecutionCapabilities {
    if (!this.activeStageExecutionState) {
      this.activeStageExecutionState =
        this.createEphemeralStageExecutionState("collectDefinitions");
    }
    return this.activeStageExecutionState.capabilities;
  }

  get traceStage(): AssemblyStageName {
    return this.activeStageExecutionState?.stage ?? "collectDefinitions";
  }

  /**
   * Lays out instruction.
   * @param {string[] | LoweredInstruction} input The input.
   * @returns {boolean} The result.
   */
  layoutInstruction(input: string[] | LoweredInstruction): boolean {
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
  emitInstruction(input: string[] | LoweredInstruction): boolean {
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
  asblock_pick(input: string[] | LoweredInstruction): boolean {
    debug("asblock_pick", Array.isArray(input) ? input : input.words);
    debug("asblock_pick arch", this.arch);
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
   * Classifies operand for active architecture.
   * @param {string} operand The operand.
   * @returns {LoweredOperand} The classified operand.
   */
  classifyOperandForActiveArchitecture(operand: string): LoweredOperand {
    const architecture = this.resolveActiveArchitecture();
    if (!architecture.definition) {
      return this.operandResolver.lowerOperand(operand);
    }
    return architecture.definition.classifyOperand(this.operandResolver, operand);
  }

  /**
   * Writes 1, 2, 3, or 4 bytes to output.
   * @param {number} num - The byte to write.
   */
  write1(num: number): void {
    this.outputWriter.write1(num);
  }

  /**
   * Writes 2.
   * @param {number} num The num.
   */
  write2(num: number): void {
    this.outputWriter.write2(num);
  }

  /**
   * Writes 3.
   * @param {number} num The num.
   */
  write3(num: number): void {
    this.outputWriter.write3(num);
  }

  /**
   * Writes 4.
   * @param {number} num The num.
   */
  write4(num: number): void {
    this.outputWriter.write4(num);
  }

  /**
   * Reads 1, 2, or 3 bytes from the configured output image.
   * @param {number} logicalPosition The logical address to read from.
   * @returns {number} The byte read from the output image.
   */
  read1(logicalPosition: number): number {
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
  read2(logicalPosition: number): number {
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
   * Handles assembleblock.
   * @param {string} block The block.
   */
  assembleblock(block: string): void {
    // debug('assembleblock', block);
    if (!block.trim()) {
      return;
    }

    const processedCommands = this.frontEndService.preprocessBlockCommands(block);
    block = processedCommands.join("\n");

    const splitCommands = splitInlineCommands(processedCommands);
    if (block.includes("\n") && this.incrementalProgramParseState.roots.length === 0) {
      const nodes = this.getOrBuildPassProgram(splitCommands, this.currentFile, this.currentLine);
      this.lowerAndExecuteRuntimeNodes(nodes);
      return;
    }

    for (const command of splitCommands) {
      const nodes = this.programModelBuilder.consumeIncrementalCommand(
        this.incrementalProgramParseState,
        command.trim(),
        this.currentFile,
        this.currentLine,
      );
      this.lowerAndExecuteRuntimeNodes(nodes);
    }
  }

  /**
   * Rewrites raw command.
   * @param {string} command The command.
   * @returns {string} The result.
   */
  rewriteRawCommand(command: string): string {
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
   * @param {string} command The define assignment command.
   * @returns {boolean} `true` when the define engine handled the command.
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
   * @param {string} command Raw command text.
   * @returns {boolean} `true` when the line was a character mapping.
   */
  tryHandleCharacterMapping(command: string): boolean {
    const trimmed = command.trim();
    const singleQuoted = /^'([\s\S])'\s*=\s*(.+)$/.exec(trimmed);
    const doubleQuoted = /^"([\s\S])"\s*=\s*(.+)$/.exec(trimmed);
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
  preprocessNormalizedCommand(state: NormalizedCommand): CommandPreprocessResult {
    // Asar `'X' = $nn` inside a macro is body text, not a define-time side effect.
    // Applying it here would leak the last font table into later
    // identity `db` data and leave invoke as `cleartable` only.
    if (!this.inMacroDefinition && this.tryHandleCharacterMapping(state.command)) {
      setCommandKind(state, "characterMapping");
      return "handled";
    }

    if (
      !this.inMacroDefinition &&
      state.words.length === 3 &&
      state.words[1] === "=" &&
      (state.words[0].startsWith("'") || state.words[0].startsWith('"'))
    ) {
      setCommandKind(state, "characterMapping");
      debug("handleCharacterMapping", state.words);
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
  prepareNormalizedCommandForDispatch(state: NormalizedCommand): boolean {
    if (state.kind === "unknown") {
      setCommandWords(state, state.words, state.command);
      setCommandKind(state, "opcodeCandidate");
    }
    return true;
  }

  /**
   * Processes a single command from `assembleblock`.
   * @param {string} command - The command to process.
   * @param {boolean} [preprocessed] Whether comments and continuations were already normalized.
   */
  processCommand(command: string, preprocessed = false): void {
    debug(
      "processCommand",
      { command },
      this.currentTargetAddress,
      "/",
      this.currentTargetAddress.toString(16),
      `stage ${this.activeStageExecutionState?.stage ?? "collectDefinitions"}`,
    );
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
        const nodes = this.programModelBuilder.consumeIncrementalCommand(
          this.incrementalProgramParseState,
          command.trim(),
          this.currentFile,
          this.currentLine,
        );
        this.lowerAndExecuteRuntimeNodes(nodes);
        this.flushCompletedIncrementalNodes();
        return;
      }
      const splitCommands = splitInlineCommands([command]);
      for (const splitCommand of splitCommands) {
        const nodes = this.programModelBuilder.consumeIncrementalCommand(
          this.incrementalProgramParseState,
          splitCommand.trim(),
          this.currentFile,
          this.currentLine,
        );
        this.lowerAndExecuteRuntimeNodes(nodes);
      }
    } else {
      // Route raw single-command entrypoints through the same typed incremental
      // parser used by line-by-line `assembleblock()`.
      this.assembleblock(command);
    }
    this.flushCompletedIncrementalNodes();
  }

  /**
   * Processes normalized command.
   * @param {NormalizedCommand} state The state.
   * @param {boolean} [rewriteRaw] The rewrite raw.
   */
  processNormalizedCommand(state: NormalizedCommand, rewriteRaw: boolean = true): void {
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
      const requiresVariadicResolution =
        this.inMacroExpansion &&
        !this.isDefinitionCollectionStage &&
        (rewrittenRaw.includes("...") || rewrittenRaw.includes("…"));
      if (rewrittenRaw !== workingState.source.raw || requiresVariadicResolution) {
        incrementInternalCounter("actualReparses");
        const rewrittenState = this.createNormalizedCommandFromRaw(
          rewrittenRaw,
          workingState.source.file,
          workingState.source.line,
          true,
        );
        if (!rewrittenState) {
          return;
        }
        workingState = rewrittenState;
      }
    }

    const preprocessResult = this.preprocessNormalizedCommand(workingState);
    if (preprocessResult === "handled") {
      return;
    }

    // Capture the starting PC (before processing this command)
    const startPC = this.currentTargetBaseAddress & 0xffffff;

    if (!this.prepareNormalizedCommandForDispatch(workingState)) {
      return;
    }

    if (this.collectSourceMetadata) {
      this.collectCommandReferences(workingState);
    }

    const traceListener = this.traceListener;
    if (!traceListener) {
      const lowered = this.commandLoweringService.lowerCommand(workingState);
      this.dispatchLoweredNode(lowered);
    } else {
      const traceContext: TraceCommandContext = {
        file: workingState.source.file,
        line: workingState.source.line,
        raw: workingState.source.raw,
        normalized: workingState.command,
      };

      traceListener({
        type: "command-start",
        stage: this.traceStage,
        arch: this.arch,
        ...traceContext,
        logicalAddress: startPC,
        outputOffset: this.outputWriter.toOutputOffset(startPC),
      });

      // Nested directives can emit additional writes while this command is still
      // active, so keep the current source context on a stack until dispatch ends.
      this.traceCommandStack.push(traceContext);
      try {
        const lowered = this.commandLoweringService.lowerCommand(workingState);
        this.dispatchLoweredNode(lowered);
      } finally {
        this.traceCommandStack.pop();
      }

      const endPC = this.currentTargetBaseAddress & 0xffffff;
      traceListener({
        type: "command-end",
        stage: this.traceStage,
        arch: this.arch,
        ...traceContext,
        logicalAddress: startPC,
        outputOffset: this.outputWriter.toOutputOffset(startPC),
        endLogicalAddress: endPC,
        endOutputOffset: this.outputWriter.toOutputOffset(endPC),
        bytesWritten: endPC - startPC,
      });
    }

    // Determine how many bytes were written in this command.
    const commandSize = (this.currentTargetBaseAddress & 0xffffff) - startPC;
    debug("processCommand bytes written", commandSize);

    if (this.collectSourceMetadata) {
      this.addAddressToLine(this.currentTargetBaseAddress & 0xffffff);
    }
  }

  /**
   * Gets or create lowered program.
   * @param {StageExecutionState} stageState The stage state.
   * @param {ProgramModel} program The program.
   * @returns {LoweredProgram} The result.
   */
  getOrCreateLoweredProgram(
    stageState: StageExecutionState,
    program: ProgramModel,
  ): LoweredProgram {
    if (!stageState.loweredProgram) {
      stageState.loweredProgram = measureInternalPhase("lowerProgram", () =>
        this.commandLoweringService.lowerProgram(program),
      );
    }
    return stageState.loweredProgram;
  }

  /**
   * Dispatches lowered node.
   * @param {LoweredCommand} lowered The lowered.
   */
  dispatchLoweredNode(lowered: LoweredCommand): void {
    if (lowered.kind === "directive") {
      const loweredCommand = (lowered as LoweredCommand & { command?: NormalizedCommand }).command;
      const handledDirective = this.directiveRegistry.dispatch(
        lowered.keyword,
        lowered.words,
        lowered.source.raw,
        loweredCommand,
      );
      if (!handledDirective && lowered.keyword) {
        debug("💥 assembler dispatchLoweredNode unknown directive", lowered.keyword);
      }
      return;
    }

    let instruction = lowered;
    if (lowered.command) {
      const refreshed = this.commandLoweringService.lowerCommand(lowered.command);
      if (refreshed.kind === "instruction") {
        instruction = refreshed;
      }
    }
    const wasOpcode = this.asblock_pick(instruction);
    if (!wasOpcode) {
      debug("💥 assembler dispatchLoweredNode unknown operation", lowered.mnemonic);
    }
  }

  /**
   * Parses a function definition of the form:
   *   function name(param1, param2...) = expression
   * Possibly spanning multiple lines joined by backslashes.
   * @param {string} defLine - The function definition line.
   */
  parseFunctionDefinition(defLine: string): void {
    debug("parseFunctionDefinition", defLine);
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
  addAddressToLine(address: number): void {
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
  evaluateRangeExpression(expr: string | ExpressionNode): number {
    debug("assemlber evaluateRangeExpression", expr);
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
    } catch (error) {}
    // If that fails, assume it's a static label.
    // (Pass 'true' to require that the label be static.)
    return this.symbolScope.getLabelValue(renderExpressionNode(resolvedExpr), true);
  }

  /**
   * Sets the paths to search for included files.
   * @param {string[]} paths The paths to search for included files.
   */
  setIncludePaths(paths: string[]): void {
    this.includePaths = paths;
  }

  /**
   * Evaluates an expression for conditionals (if, while).
   * @param {string} expression - The expression to evaluate.
   * @returns {boolean} True if the expression is true, false otherwise.
   */
  evaluateExpression(expression: string | ExpressionNode): boolean {
    debug("evaluateExpression", expression);
    let resolvedExpr: ExpressionNode | undefined;
    let result: number;
    try {
      // Resolve inside the guarded block so failures from define/label/static checks
      // are reported with the same contextual wrapper as math failures.
      resolvedExpr = this.resolveExpressionInput(expression);
      debug("evaluateExpression resolvedExpr", resolvedExpr);
      result = isReferenceExpressionNode(resolvedExpr)
        ? this.evaluateReferenceExpressionNode(resolvedExpr)
        : this.mathCore.math(resolvedExpr);
    } catch (e: unknown) {
      const originalExpr =
        typeof expression === "string" ? expression : renderExpressionNode(expression);
      const resolvedText = resolvedExpr ? renderExpressionNode(resolvedExpr) : "<unresolved>";
      throw new Error(
        `Error evaluating expression "${originalExpr}" (resolved to "${resolvedText}"): ${e instanceof Error ? e.message : JSON.stringify(e)}`,
      );
    }
    // In our assembler, a condition is true if the result is nonzero.
    debug("evaluateExpression result", result, "=>", result !== 0);
    return result !== 0;
  }

  /**
   * Parses string input into an expression node and resolves nested references/defines.
   * @param {string | ExpressionNode} expression The expression source or parsed node.
   * @returns {ExpressionNode} The resolved expression tree.
   */
  resolveExpressionInput(expression: string | ExpressionNode): ExpressionNode {
    const parsed =
      typeof expression === "string" ? parseExpressionNode(expression.trim()) : expression;
    return this.resolveExpressionNode(parsed);
  }

  /**
   * Recursively resolves define references and nested reference-expression nodes.
   * @param {ExpressionNode} expression The expression node to resolve.
   * @returns {ExpressionNode} The resolved expression node.
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
   * @param {ReferenceExpressionNode} expression The reference expression to resolve.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number | string} The resolved numeric value.
   */
  resolveReferenceLabelValue(
    expression: ReferenceExpressionNode,
    requireStatic = false,
  ): number | string {
    const resolved = this.resolveReferenceExpressionNode(expression);
    if (!isReferenceExpressionNode(resolved)) {
      return this.mathCore.math(resolved);
    }

    return this.resolveNormalizedReferenceLabelValue(
      this.renderResolvedReferenceExpression(resolved),
      requireStatic,
    );
  }

  /**
   * Resolves an already-normalized reference string as either a struct member/base
   * or a plain label lookup.
   * @param {string} normalizedReference The normalized reference text.
   * @param {boolean} [requireStatic] Whether labels must be static.
   * @returns {number} The resolved numeric address/value.
   */
  resolveNormalizedReferenceLabelValue(normalizedReference: string, requireStatic = false): number {
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
  resolveReferenceIndexText(indexExpression: ExpressionNode): string {
    const resolvedIndex = this.resolveExpressionNode(indexExpression);
    try {
      return this.mathCore.math(resolvedIndex).toString();
    } catch {
      return renderExpressionNode(resolvedIndex);
    }
  }

  /**
   * Renders a reference expression after resolving any nested index expressions.
   * @param {ReferenceExpressionNode} expression The reference expression to render.
   * @returns {string} The normalized reference text.
   */
  renderResolvedReferenceExpression(expression: ReferenceExpressionNode): string {
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
  tryResolveExpandedReferenceExpression(
    expression: ReferenceExpressionNode,
  ): ExpressionNode | undefined {
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
  tryResolveRelativeLabelToken(input: string): string | undefined {
    if (input !== "+" && input !== "-" && input !== "?+" && input !== "?-") {
      return undefined;
    }

    debug(`resolvedefines handling relative label: ${input}`);
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
        debug("resolvedefines stage does not enforce labels, returning placeholder");
        return "$0000";
      }
      debug(
        `resolvedefines failed to resolve relative label ${input}: ${error instanceof Error ? error.message : ""} during stage ${this.activeStageExecutionState?.stage ?? "collectDefinitions"}`,
      );
      throw error;
    }
  }

  /**
   * Resolves direct `!name` define references that are not assignments.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved define value, if applicable.
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

    debug("resolvedefines direct variable reference", input);
    const varName = input.substring(1);
    return this.lookupDefineValue(varName);
  }

  /**
   * Resolves macro-label references such as `?label` or `#+?label`.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved macro-label value, if applicable.
   */
  tryResolveMacroLabelReference(input: string): string | undefined {
    const prefixMatch = input.match(/^(#\?|\?|#\?\.|\?\+|\?-)(.*)/);
    if (!prefixMatch) {
      return undefined;
    }

    const prefix = prefixMatch[1];
    const labelName = prefixMatch[2];
    debug("resolvedefines macro label found with prefix", { prefix, labelName });
    return this.symbolScope.getLabelValue(labelName, false).toString();
  }

  /**
   * Resolves bare label-like tokens before the generic character-by-character
   * define scanner runs.
   * @param {string} input The token to resolve.
   * @returns {string | undefined} The resolved label value, if applicable.
   */
  tryResolveBareLabelReference(input: string): string | undefined {
    if (!isBareLabelReference(input)) {
      return undefined;
    }

    // Expressions like `.zone_n-.zone_max` must stay intact so later arithmetic
    // can evaluate both sides instead of collapsing to the first local label.
    debug("resolvedefines checking if input is a label reference", input);
    const labelValue = this.symbolScope.tryGetLabelValue(input, false);
    if (labelValue === undefined) {
      // Preserve legacy definition-pass behavior: unresolved bare candidates,
      // including numeric-only tokens, temporarily collapse to zero.
      if (this.isDefinitionCollectionStage) {
        return "0";
      }
      debug("resolvedefines not a label, continuing");
      return undefined;
    }
    debug("resolvedefines labelValue", labelValue);
    return labelValue.toString();
  }

  /**
   * Resolves all define replacements in a given string.
   * @param {string} input The string to resolve defines in.
   * @returns {string} The string with defines resolved.
   */
  resolvedefines(input: string): string {
    debug("resolvedefines", { input });
    if (!input) {
      debug("resolvedefines input is empty, returning empty string");
      return "";
    }
    // debug("resolvedefines defines", this.defines);
    let result = "";
    let index = 0;

    const resolvedRelativeLabel = this.tryResolveRelativeLabelToken(input);
    if (resolvedRelativeLabel !== undefined) {
      return resolvedRelativeLabel;
    }

    // Special case for expressions with != operator
    // This prevents issues with != being misinterpreted as a define
    if (input.includes("!=")) {
      debug("resolvedefines != operator found in", input);
      // Process each part of the expression separately
      const parts = input.split("!=");
      const resolvedParts = parts.map((part) => this.resolvedefines(part.trim()));
      return resolvedParts.join("!=");
    }

    if ((input.startsWith("sizeof(") || input.startsWith("objectsize(")) && input.endsWith(")")) {
      debug("resolvedefines sizeof found, skipping", input);
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
        debug("resolvedefines double slash", input);
        result += "\\";
        index += 2;
      } else if (char === "\\" && input[index + 1] === "!") {
        debug("resolvedefines \\!define", input);
        result += "!";
        index += 2;
      } else if (char === "!") {
        debug("resolvedefines !define", input);
        let defineName = "";
        index++; // skip the !
        if (input[index] === "{") {
          index++;
          let unprocessedName = "";
          let braces = 1;
          while (index < input.length) {
            if (input[index] === "{") braces++;
            if (input[index] === "}") braces--;
            if (braces === 0) break;
            unprocessedName += input[index++];
          }
          if (braces !== 0) throw new Error("Error: Mismatched braces in define name.");
          index++; // skip the closing }
          defineName = this.resolvedefines(unprocessedName);
          debug("resolvedefines !define defineName", defineName);
        } else {
          // Handle regular define (no braces)
          while (index < input.length && /\w/.test(input[index])) {
            defineName += input[index++];
          }
          debug("resolvedefines !define defineName", defineName);
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
        } else {
          result += value;
        }
      } else {
        result += char;
        index++;
      }
    }

    debug("resolvedefines result =", { result });
    return result;
  }

  /**
   * Handles activate stage.
   * @param {AssemblyStageName} stage The stage.
   */
  activateStage(stage: AssemblyStageName): void {
    debug("🏁 activateStage", stage);
    this.syncActiveStageExecutionState(stage);
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
    this.runLifecycleHook("onStageStart", (lifecycle) =>
      lifecycle.onStageStart?.({ state: this.pluginState, session: this, stage }),
    );
  }

  /**
   * Completes the current pass, performing any necessary cleanup.
   */
  finishPass(): void {
    const stage = this.activeStageExecutionState?.stage ?? "collectDefinitions";
    this.runLifecycleHook("onStageEnd", (lifecycle) =>
      lifecycle.onStageEnd?.({ state: this.pluginState, session: this, stage }),
    );
    if (this.getActiveStageCapabilities().canFinalize) {
      this.runLifecycleHook("beforeOutputFinalize", (lifecycle) =>
        lifecycle.beforeOutputFinalize?.({
          state: this.pluginState,
          session: this,
          outputBytes: this.outputBytes,
        }),
      );
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
  setCurrentFile(filename: string): void {
    debug("setCurrentFile", filename);
    this.currentFile = filename;
    this.currentLine = 0;
    this.programModelBuilder.resetIncrementalParseState(this.incrementalProgramParseState);
  }

  /**
   * Sets the current line number.
   * @param {number} line - The line number to set.
   */
  setCurrentLine(line: number): void {
    // debug('setCurrentLine', line);
    this.currentLine = line;
  }

  /**
   * Gets stage descriptor.
   * @param {AssemblyStageName} stage The stage.
   * @returns {Pick<StageExecutionState, "stage" | "capabilities">} The result.
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
   * Clones relative labels.
   * @param {{ [depth: number]: { addr: number; macroInstance?: number }[] }} source The source.
   * @returns {{ [depth: number]: { addr: number; macroInstance?: number }[]; }} The result.
   */
  cloneRelativeLabels(source: { [depth: number]: { addr: number; macroInstance?: number }[] }): {
    [depth: number]: { addr: number; macroInstance?: number }[];
  } {
    const clone: { [depth: number]: { addr: number; macroInstance?: number }[] } = {};
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
   * @param {StageExecutionState} stageState The stage state.
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
   * @param {StageExecutionState} stageState The stage state.
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
   * Gets or create stage execution state.
   * @param {AssemblyStageName} stage The stage.
   * @returns {StageExecutionState} The result.
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
   * Builds program model.
   * @param {string} source The source.
   * @param {string} [sourceFile] The source file.
   * @param {number} [startLine] The start line.
   * @returns {ProgramModel} The result.
   */
  buildProgramModel(source: string, sourceFile = this.currentFile, startLine = 0): ProgramModel {
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
  runStage(stage: AssemblyStageName, program: ProgramModel): StageExecutionState {
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
      measureInternalPhase("executeProgram", () =>
        this.executeLoweredNodeStream(loweredProgram.nodes),
      );
      measureInternalPhase("finishPass", () => this.finishPass());
      this.captureStageExecutionState(stageState);
      return stageState;
    });
  }

  /**
   * Handles assemble program.
   * @param {ProgramModel} program The program.
   */
  assembleProgram(program: ProgramModel): void {
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
  assembleSource(source: string, sourceFile = this.currentFile, startLine = 0): ProgramModel {
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
  writeOutputBytes(start: number, value: number, length: number = 1): void {
    debug("writeOutputBytes", { start, value, length });
    if (typeof start !== "number" || typeof value !== "number" || typeof length !== "number") {
      throw new Error("writeOutputBytes requires a number for start, value, and length");
    }
    if (value > 0xff) {
      debug("writeOutputBytes 💥 value must be less than 0xFF", value);
    }
    debug(
      "writeOutputBytes before this.outputBytes.length",
      this.outputBytes.length,
      "/",
      this.outputBytes.length.toString(16),
    );
    for (let i = 0; i < length; i++) {
      this.outputBytes[start + i] = value & 0xff;
    }
    debug(
      "writeOutputBytes after this.outputBytes.length",
      this.outputBytes.length,
      "/",
      this.outputBytes.length.toString(16),
    );
  }

  /**
   * Expands the output buffer and fills it with a specified byte.
   * @param {number} newSize The new output size.
   * @param {number} fillByte The byte used for the new range.
   */
  expandOutput(newSize: number, fillByte: number): void {
    debug("expandOutput", { newSize, fillByte });
    if (typeof newSize !== "number" || typeof fillByte !== "number") {
      throw new Error("expandOutput requires a number for newSize and fillByte");
    }
    if (newSize > this.outputBytes.length) {
      this.writeOutputBytes(this.outputBytes.length, fillByte, newSize - this.outputBytes.length);
    } else {
      debug("expandOutput newSize <= this.outputBytes.length, no expansion needed");
    }
  }

  /** Runs the active output-format finalizer. */
  finalizeOutput(): void {
    this.pluginOutputFormat.finalize({
      state: this.pluginState,
      outputBytes: this.outputBytes,
    });
  }

  /**
   * Returns the compiled binary output.
   * @returns {Uint8Array} The compiled binary output.
   */
  getBinaryOutput = (): Uint8Array => {
    return this.pluginOutputFormat.getOutput({
      state: this.pluginState,
      outputBytes: this.outputBytes,
    });
  };

  /**
   * Lowers completed runtime nodes and executes them through the production executor.
   * @param {ExecutableNode[]} nodes The runtime nodes to lower and execute.
   */
  lowerAndExecuteRuntimeNodes(nodes: ExecutableNode[]): void {
    const previousRewrite = this.runtimePassthroughRewriteEnabled;
    this.runtimePassthroughRewriteEnabled = true;
    try {
      const loweredNodes = nodes.map((node) =>
        this.commandLoweringService.lowerExecutableNode(node),
      );
      for (const node of loweredNodes) {
        this.executeWithAnalysisRecovery(
          node,
          (currentNode) => this.getLoweredNodeSpan(currentNode),
          (currentNode) => this.executeLoweredNode(currentNode),
        );
      }
    } finally {
      this.runtimePassthroughRewriteEnabled = previousRewrite;
    }
  }

  /**
   * Resolves for loop bounds.
   * @param {LoweredLoopNode} forBlock The for block.
   * @returns {{ variable?: string; start?: number; end?: number; }} The result.
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
  executeForLoopIterations(forBlock: LoweredLoopNode, executeBody: () => void): void {
    const { variable, start, end } = this.resolveForLoopBounds(forBlock);

    if (!variable || start === undefined || end === undefined) {
      debug("executeForLoopIterations missing loop semantics:", forBlock);
      return;
    }

    // Save the original variable value before we modify it
    const originalValue = this.defines.get(variable);

    // Only process the loop if start < end
    if (start < end) {
      // Loop through the range and process commands for each iteration
      for (let i = start; i < end; i++) {
        // Set our loop counter directly in defines map
        this.defines.set(variable, i.toString());
        executeBody();
      }
    }

    // Restore the original variable value or delete if it didn't exist
    if (originalValue !== undefined) {
      this.defines.set(variable, originalValue);
    } else {
      this.defines.delete(variable);
    }
  }

  /**
   * Executes lowered loop.
   * @param {LoweredLoopNode} loopBlock The loop block.
   */
  executeLoweredLoop(loopBlock: LoweredLoopNode): void {
    debug("executeLoweredLoop", loopBlock);
    if (loopBlock.loopType === "for") {
      this.executeLoweredForLoop(loopBlock);
    } else if (loopBlock.loopType === "while") {
      this.executeLoweredWhileLoop(loopBlock);
    }
  }

  /**
   * Executes lowered for loop.
   * @param {LoweredLoopNode} forBlock The for block.
   */
  executeLoweredForLoop(forBlock: LoweredLoopNode): void {
    debug("executeLoweredForLoop", forBlock);
    this.executeForLoopIterations(forBlock, () => this.executeLoweredNodeStream(forBlock.commands));
  }

  /**
   * Executes while loop commands.
   * @param {LoweredLoopNode} whileBlock The while block.
   * @param {TCommand[]} commands The commands.
   * @param {(command: TCommand) => string | null} getDefineTarget The get define target.
   * @param {(command: TCommand) => void} executeCommand The execute command.
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
      debug("executeWhileLoopCommands missing condition expression", whileBlock);
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

    if (iteration >= MAX_ITERATIONS) {
      debug(
        "executeWhileLoopCommands while loop exceeded maximum iteration limit. Possible infinite loop detected.",
      );
    }

    // Restore original variable values
    for (const [varName, value] of originalValues.entries()) {
      if (value !== undefined) {
        debug(`executeWhileLoopCommands setting ${varName} to ${value}`);
        this.defines.set(varName, value);
      } else {
        debug(`executeWhileLoopCommands delete entry for ${varName}`);
        this.defines.delete(varName);
      }
    }
  }

  /**
   * Executes lowered while loop.
   * @param {LoweredLoopNode} whileBlock The while block.
   */
  executeLoweredWhileLoop(whileBlock: LoweredLoopNode): void {
    debug("executeLoweredWhileLoop", whileBlock);
    this.executeWhileLoopCommands(
      whileBlock,
      whileBlock.commands,
      (cmd) =>
        cmd.kind === "command" && cmd.command.kind === "defineCommand"
          ? (getDefineVariable(cmd.command.command) ?? null)
          : null,
      (cmd) => this.executeLoweredNodeWithRecovery(cmd),
    );
  }

  /**
   * Gets lowered node span.
   * @param {LoweredExecutableNode} node The node.
   * @returns {SourceSpan | undefined} The result.
   */
  getLoweredNodeSpan(node: LoweredExecutableNode): SourceSpan | undefined {
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
   * @param {LoweredExecutableNode} node The node.
   */
  executeLoweredNodeWithRecovery(node: LoweredExecutableNode): void {
    this.executeWithAnalysisRecovery(
      node,
      (currentNode) => this.getLoweredNodeSpan(currentNode),
      (currentNode) => this.executeLoweredNode(currentNode),
    );
  }

  /**
   * Executes lowered node.
   * @param {LoweredExecutableNode} node The node.
   */
  executeLoweredNode(node: LoweredExecutableNode): void {
    const sourceCommand =
      node.kind === "loop" || node.kind === "conditional" ? node.header : node.command;
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
      this.executeConditionalBranches(node.branches, (commands) =>
        this.executeLoweredNodeStream(commands),
      );
      return;
    }

    this.dispatchLoweredNode(node);
  }

  /**
   * Executes lowered node stream.
   * @param {LoweredExecutableNode[]} nodes The nodes.
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
   * @param {Array<{ kind: "if" | "elseif" | "else"; conditionNode?: ExpressionNode; commands: TCommand[]; }>} branches The branches.
   * @param {(commands: TCommand[]) => void} executeCommands The execute commands.
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

  /**
   * Parses command stream to nodes.
   * @param {string[]} commands The commands.
   * @param {string} [sourceFile] The source file.
   * @param {number} [startLine] The start line.
   * @returns {RuntimeNode[]} The result.
   */
  parseCommandStreamToNodes(
    commands: string[],
    sourceFile = this.currentFile,
    startLine = this.currentLine,
  ): RuntimeNode[] {
    return this.programModelBuilder.parseCommandStreamToNodes(commands, sourceFile, startLine);
  }

  /**
   * Gets or build pass program.
   * @param {string[]} commands The commands.
   * @param {string} [sourceFile] The source file.
   * @param {number} [startLine] The start line.
   * @returns {RuntimeNode[]} The result.
   */
  getOrBuildPassProgram(
    commands: string[],
    sourceFile = this.currentFile,
    startLine = this.currentLine,
  ): RuntimeNode[] {
    return this.programModelBuilder.getOrBuildPassProgram(commands, sourceFile, startLine);
  }

  /**
   * Gets macro definition node.
   * @param {string} name The name.
   * @returns {MacroDefinitionNode | undefined} The result.
   */
  getMacroDefinitionNode(name: string): MacroDefinitionNode | undefined {
    const macro = this.macros.get(name);
    if (!macro) {
      return undefined;
    }
    const body: ExecutableNode[] = macro.body.map((entry) => entry);
    return {
      type: "macroDefinition",
      name: macro.name,
      params: [...macro.params],
      variadic: macro.variadic,
      body,
      sourceFile: macro.sourceFile,
    };
  }
}
