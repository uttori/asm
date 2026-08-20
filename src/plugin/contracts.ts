import type {
  ArchitectureEncoder,
  ArchitectureEncoderContext,
  InstructionDescriptor,
  LoweredOperand,
  MathValue,
  OperandResolutionContext,
} from "../architecture-types.js";
import type { DirectiveDescriptor } from "../lsp/directive-catalog.js";

export const PLUGIN_API_VERSION = 1 as const;

export type AssemblyStageName = "collectDefinitions" | "resolveLayout" | "emitProgram";

export interface AssemblerPluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: typeof PLUGIN_API_VERSION;
  description?: string;
  requires?: ReadonlyArray<{
    pluginId: string;
    version: string;
  }>;
}

export interface PluginDisposable {
  dispose(): void | Promise<void>;
}

export interface AssemblerPlugin<Options = unknown> {
  manifest: AssemblerPluginManifest;
  validateOptions?(configured: unknown): Options;
  activate(
    context: PluginActivationContext<Options>,
    options: Readonly<Options>,
  ): void | PluginDisposable | Promise<void | PluginDisposable>;
}

export function definePlugin<Options>(plugin: AssemblerPlugin<Options>): AssemblerPlugin<Options> {
  return plugin;
}

export interface PluginLogger {
  debug(message: string, details?: Readonly<Record<string, unknown>>): void;
  info(message: string, details?: Readonly<Record<string, unknown>>): void;
  warn(message: string, details?: Readonly<Record<string, unknown>>): void;
  error(message: string, details?: Readonly<Record<string, unknown>>): void;
}

declare const sessionStateBrand: unique symbol;

export interface SessionStateKey<T> {
  readonly id: string;
  readonly [sessionStateBrand]: T;
}

export interface SessionCreationContext {
  readonly targetId: string;
  readonly targetOptions: Readonly<Record<string, unknown>>;
}

export interface SessionStateContribution<T> {
  id: string;
  create(context: SessionCreationContext): T;
  clone(value: T): T;
  resetForStage?(value: T, stage: AssemblyStageName): void;
  dispose?(value: T): void;
}

export interface SessionStateStore {
  get<T>(slot: SessionStateKey<T>): T;
}

export interface OperandClassificationContext {
  readonly operands: OperandResolutionContext;
}

export interface ArchitectureContribution {
  id: string;
  aliases?: readonly string[];
  displayName: string;
  unknownInstructionBehavior: "throw" | "returnFalse";
  splitOperands(text: string): string[];
  classifyOperand(context: OperandClassificationContext, operand: string): LoweredOperand;
  createEncoder(context: ArchitectureEncoderContext): ArchitectureEncoder;
  instructions: readonly InstructionDescriptor[];
}

export interface TargetFactoryContext {
  readonly targetId: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly state: SessionStateStore;
}

export interface AddressSpaceContribution {
  id: string;
  create(context: TargetFactoryContext): TargetAddressSpace;
}

export interface TargetAddressSpace {
  readonly addressWidth: number;
  readonly defaultOrigin: number;
  normalizeForWrite(address: number): number;
  advance(address: number, amount: number): number;
  toOutputOffset(address: number): number;
  fromOutputOffset(offset: number): number;
  validateWrite?(address: number, width: number): void;
}

export interface OutputFinalizationContext {
  readonly state: SessionStateStore;
  readonly outputBytes: number[] | Uint8Array;
}

export interface OutputReadContext {
  readonly state: SessionStateStore;
  readonly outputBytes: number[] | Uint8Array;
}

export interface OutputFormatContribution {
  id: string;
  create(context: TargetFactoryContext): TargetOutputFormat;
}

export interface TargetOutputFormat {
  finalize(context: OutputFinalizationContext): void;
  getOutput(context: OutputReadContext): Uint8Array;
}

export interface DirectiveExecutionContext {
  readonly state: SessionStateStore;
}

export type DirectiveHandler = (
  context: DirectiveExecutionContext,
  words: readonly string[],
  raw: string,
) => void;

export interface DirectiveFactoryContext {
  readonly targetId: string;
  readonly state: SessionStateStore;
}

export interface DirectiveContribution {
  id: string;
  keywords: readonly string[];
  phase: "preprocess" | "lowered";
  createHandler(context: DirectiveFactoryContext): DirectiveHandler;
  tooling: readonly DirectiveDescriptor[];
}

export interface DirectiveSetContribution {
  id: string;
  directives: readonly DirectiveContribution[];
}

export interface ExpressionFunctionSignature {
  readonly parameters: readonly string[];
  readonly minimumArguments?: number;
  readonly maximumArguments?: number;
}

export interface ExpressionFunctionContext {
  readonly state: SessionStateStore;
  readonly addresses: {
    toOutputOffset(address: number): number;
    fromOutputOffset(offset: number): number;
  };
}

export interface ExpressionFunctionContribution {
  name: string;
  aliases?: readonly string[];
  signature: ExpressionFunctionSignature;
  summary: string;
  evaluate(context: ExpressionFunctionContext, args: readonly MathValue[]): MathValue;
}

export interface ExpressionSetContribution {
  id: string;
  functions: readonly ExpressionFunctionContribution[];
}

export interface SessionLifecycleContext {
  readonly state: SessionStateStore;
}

export interface StageLifecycleContext extends SessionLifecycleContext {
  readonly stage: AssemblyStageName;
}

export interface DirectiveMiddlewareContext extends SessionLifecycleContext {
  readonly keyword: string;
  readonly words: readonly string[];
  readonly raw: string;
}

export interface ArchitectureSelectionContext extends SessionLifecycleContext {
  readonly previousArchitecture?: string;
  readonly architecture: string;
  readonly sourceAlias: string;
}

export interface WriteValidationContext extends SessionLifecycleContext {
  readonly logicalAddress: number;
  readonly width: number;
}

export interface SessionLifecycle {
  onSessionCreated?(context: SessionLifecycleContext): void;
  onStageStart?(context: StageLifecycleContext): void;
  beforeDirective?(context: DirectiveMiddlewareContext): "continue" | "handled";
  onArchitectureSelected?(context: ArchitectureSelectionContext): void;
  beforeWrite?(context: WriteValidationContext): void;
  onStageEnd?(context: StageLifecycleContext): void;
  beforeOutputFinalize?(context: OutputFinalizationContext): void;
  onSessionDispose?(context: SessionLifecycleContext): void;
}

export interface LifecycleContribution {
  id: string;
  create(context: TargetFactoryContext): SessionLifecycle;
}

export interface TargetContribution {
  id: string;
  aliases?: readonly string[];
  displayName: string;
  defaultArchitecture: string;
  architectures: readonly string[];
  addressSpace: string;
  outputFormat: string;
  directiveSets: readonly string[];
  expressionSets: readonly string[];
  lifecycle: readonly string[];
  defaultOutputExtension: string;
  createOptions?(configured: unknown): Readonly<Record<string, unknown>>;
}

export interface PluginActivationContext<Options = unknown> {
  readonly pluginId: string;
  readonly logger: PluginLogger;
  readonly options: Readonly<Options>;

  registerSessionState<T>(contribution: SessionStateContribution<T>): SessionStateKey<T>;
  registerArchitecture(contribution: ArchitectureContribution): void;
  registerAddressSpace(contribution: AddressSpaceContribution): void;
  registerOutputFormat(contribution: OutputFormatContribution): void;
  registerDirectiveSet(contribution: DirectiveSetContribution): void;
  registerExpressionSet(contribution: ExpressionSetContribution): void;
  registerLifecycle(contribution: LifecycleContribution): void;
  registerTarget(contribution: TargetContribution): void;
}

export interface ExpressionFunctionDescriptor {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly signature: ExpressionFunctionSignature;
  readonly summary: string;
}

export interface ArchitectureSummary {
  readonly id: string;
  readonly aliases: readonly string[];
  readonly displayName: string;
}

export interface TargetSummary {
  readonly id: string;
  readonly aliases: readonly string[];
  readonly displayName: string;
  readonly defaultArchitecture: string;
  readonly defaultOutputExtension: string;
}

export interface ToolingCatalog {
  getInstructions(architecture: string): readonly InstructionDescriptor[];
  getDirectives(): readonly DirectiveDescriptor[];
  getExpressionFunctions(): readonly ExpressionFunctionDescriptor[];
  getArchitectures(): readonly ArchitectureSummary[];
  getTargets(): readonly TargetSummary[];
}
