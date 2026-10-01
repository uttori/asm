import type { ArchitectureEncoder, ArchitectureEncoderContext, InstructionDescriptor, LoweredOperand, MathValue, OperandResolutionContext } from "../architecture-types.js";
import type { Assembler } from "../assembler.js";
import type { ArchitectureDecoder, ArchitectureInstructionSpecification } from "../decoder-types.js";
import type { CoreDirectiveGroup } from "../directive-groups.js";
import type { DirectiveDescriptor } from "../lsp/directive-catalog.js";
import type { SyntaxProfile } from "../syntax-profile.js";
/** Contract revision required by PluginManager. Independent of npm package versions. */
export declare const PLUGIN_API_VERSION: 1;
/** Ordered build passes: collect symbols, determine addresses, then emit final bytes. */
export type AssemblyStageName = "collectDefinitions" | "resolveLayout" | "emitProgram";
/** Plugin identity and dependencies validated before activation. */
export interface AssemblerPluginManifest {
    /** Globally unique lowercase ID, beginning with a letter. Dots and hyphens separate segments. */
    id: string;
    name: string;
    /** Exact semantic version of this plugin. */
    version: string;
    apiVersion: typeof PLUGIN_API_VERSION;
    description?: string;
    /** Dependencies must be active or present in the same activation batch. */
    requires?: ReadonlyArray<{
        pluginId: string;
        /** Semver range accepted for the dependency. */
        version: string;
    }>;
}
/** Plugin-wide resources owned by the manager, separate from assembler session state. */
export interface PluginDisposable {
    /** Called once by the manager, including rollback when contribution validation fails after activation returns. */
    dispose(): void | Promise<void>;
}
/** Default module export consumed by hosts. Importing a module is outside the activation transaction. */
export interface AssemblerPlugin<Options = unknown> {
    manifest: AssemblerPluginManifest;
    /**
     * Validate unknown input and supply defaults, or throw to reject configuration.
     * The returned object graph is frozen in place. Return owned data, not shared mutable objects.
     * Without this hook, only absent or empty options are accepted.
     */
    validateOptions?(configured: unknown): Options;
    /**
     * Register contributions before resolving. Registrations commit together for this plugin.
     * Release resources yourself if activation throws before returning a disposable.
     */
    activate(context: PluginActivationContext<Options>, options: Readonly<Options>): void | PluginDisposable | Promise<void | PluginDisposable>;
}
/**
 * Preserve the plugin's option type without runtime validation.
 * @param {AssemblerPlugin<Options>} plugin Definition to expose as the module's default export.
 * @returns {AssemblerPlugin<Options>} The same plugin object, retaining its option type.
 */
export declare function definePlugin<Options>(plugin: AssemblerPlugin<Options>): AssemblerPlugin<Options>;
/** Host-owned diagnostic sink. Omitted manager loggers discard messages. */
export interface PluginLogger {
    debug(message: string, details?: Readonly<Record<string, unknown>>): void;
    info(message: string, details?: Readonly<Record<string, unknown>>): void;
    warn(message: string, details?: Readonly<Record<string, unknown>>): void;
    error(message: string, details?: Readonly<Record<string, unknown>>): void;
}
declare const sessionStateBrand: unique symbol;
/** Typed slot token returned during registration. Keep it to access each session's live value. */
export interface SessionStateKey<T> {
    readonly id: string;
    readonly [sessionStateBrand]: T;
}
/** Canonical target identity and target-normalized options for a newly created session. */
export interface SessionCreationContext {
    readonly targetId: string;
    readonly targetOptions: Readonly<Record<string, unknown>>;
}
/**
 * Mutable data isolated per session and assembly stage. Factories run for every registered slot,
 * including slots from plugins whose target was not selected. Store cloneable data here.
 * Plugin-wide external resources belong in the activation disposable.
 */
export interface SessionStateContribution<T> {
    id: string;
    create(context: SessionCreationContext): T;
    /** Copy all mutable descendants needed to isolate stage snapshots. Do not mutate the input. */
    clone(value: T): T;
    /** Prepare the live stage value before lifecycle onStageStart. Omission preserves its contents. */
    resetForStage?(value: T, stage: AssemblyStageName): void;
    /** Releases the current live value at session disposal. Discarded snapshots are not disposed individually. */
    dispose?(value: T): void;
}
/** Session-scoped access shared by encoders, directives, expressions, and lifecycle hooks. */
export interface SessionStateStore {
    /** Returns the live mutable value, not a copy. Throws PluginError for an inactive slot. */
    get<T>(slot: SessionStateKey<T>): T;
}
/** Session expression and symbol resolution available while classifying an operand. */
export interface OperandClassificationContext {
    readonly operands: OperandResolutionContext;
}
/** Processor syntax and factories. IDs are namespaced. Aliases resolve within each target. */
export interface ArchitectureContribution {
    id: string;
    aliases?: readonly string[];
    displayName: string;
    unknownInstructionBehavior: "throw" | "returnFalse";
    splitOperands(text: string): string[];
    /** Unresolved expression fragments used by navigation/rename; omit addressing punctuation and registers without evaluating symbols. */
    referenceExpressions?(operandText: string): readonly string[];
    classifyOperand(context: OperandClassificationContext, operand: string): LoweredOperand;
    /** Per-session encoder. May be omitted for analysis. Assembler requires encoders for every target architecture. */
    createEncoder?(context: ArchitectureFactoryContext): ArchitectureEncoder;
    /** Optional architecture-owned decoder. Formatting remains a separate concern. */
    createDecoder?(context: ArchitectureDecoderFactoryContext): ArchitectureDecoder;
    /** Machine-readable forms used by decoders, editor tooling, and conformance tests. */
    instructionSpecifications?: readonly ArchitectureInstructionSpecification[];
    instructions: readonly InstructionDescriptor[];
}
/** Encoder capabilities bound to one assembler session. Do not retain beyond that session. */
export interface ArchitectureFactoryContext extends ArchitectureEncoderContext {
    readonly targetId: string;
    readonly options: Readonly<Record<string, unknown>>;
    readonly state: SessionStateStore;
}
/** Decoder inputs owned by the host. Options and state follow the selected target's contract. */
export interface ArchitectureDecoderFactoryContext {
    readonly targetId: string;
    readonly options: Readonly<Record<string, unknown>>;
    readonly state: SessionStateStore;
}
/** Per-session target services use normalized target options and shared session state. */
export interface TargetFactoryContext {
    readonly targetId: string;
    readonly options: Readonly<Record<string, unknown>>;
    readonly state: SessionStateStore;
}
/** Creates the logical-address to output-offset mapping for each session. */
export interface AddressSpaceContribution {
    id: string;
    create(context: TargetFactoryContext): TargetAddressSpace;
}
/** Target mapping policy. Logical addresses and physical offsets are byte addresses. */
export interface TargetAddressSpace {
    /** Logical address width in bits. */
    readonly addressWidth: number;
    /** Initial logical address before a source origin directive. */
    readonly defaultOrigin: number;
    normalizeForWrite(address: number): number;
    /** Advance by a byte count, applying target bank/wrap rules. */
    advance(address: number, amount: number): number;
    toOutputOffset(address: number): number;
    fromOutputOffset(offset: number): number;
    /** Reject a write by throwing before output mutation. Width is a byte count. */
    validateWrite?(address: number, width: number): void;
}
/** Live output at finalization. The formatter may patch bytes or update session state. */
export interface OutputFinalizationContext {
    readonly state: SessionStateStore;
    readonly outputBytes: number[] | Uint8Array;
}
/** Live session bytes supplied when materializing the target's binary representation. */
export interface OutputReadContext {
    readonly state: SessionStateStore;
    readonly outputBytes: number[] | Uint8Array;
}
/** Creates per-session finalization and binary output behavior. */
export interface OutputFormatContribution {
    id: string;
    create(context: TargetFactoryContext): TargetOutputFormat;
}
/** Target-owned serialization, including headers, checksums, or padding. */
export interface TargetOutputFormat {
    /** Runs after emission and beforeOutputFinalize hooks. May mutate live output. */
    finalize(context: OutputFinalizationContext): void;
    /** May return a view of session data. Consumers that need independent ownership must copy it. */
    getOutput(context: OutputReadContext): Uint8Array;
}
/** The same live state store supplied to the directive factory. */
export interface DirectiveExecutionContext {
    readonly state: SessionStateStore;
}
/** Synchronous directive execution. Words include the keyword, and raw retains the command text. */
export type DirectiveHandler = (context: DirectiveExecutionContext, words: readonly string[], raw: string) => void;
/** Creates a handler bound to one session. The session remains owned and disposed by its host. */
export interface DirectiveFactoryContext {
    readonly targetId: string;
    readonly state: SessionStateStore;
    readonly session: Assembler;
}
/** Runtime syntax and editor descriptions. Keywords must not collide within a target. */
export interface DirectiveContribution {
    id: string;
    keywords: readonly string[];
    /** Preprocess handles source before lowering. Lowered handles executable commands in each stage. */
    phase: "preprocess" | "lowered";
    createHandler(context: DirectiveFactoryContext): DirectiveHandler;
    tooling: readonly DirectiveDescriptor[];
}
/** Named group selected by a target. Unselected groups do not install handlers. */
export interface DirectiveSetContribution {
    id: string;
    directives: readonly DirectiveContribution[];
    tooling?: readonly DirectiveDescriptor[];
}
/** Borrowed file bytes; providers may not retain or mutate the source. */
export interface AssetSource {
    readonly bytes: Uint8Array;
    readonly mediaType: string;
}
/** Named conversion result. The assembler emits only the selected output. */
export interface AssetFormatResult {
    readonly primaryOutput: string;
    readonly outputs: Readonly<Record<string, {
        readonly bytes: Uint8Array;
    }>>;
}
/** Synchronous, target-scoped conversion from supplied bytes. */
export interface AssetFormatContribution {
    readonly id: string;
    readonly version: string;
    readonly aliases?: readonly string[];
    /** Canonical target IDs; omission makes the globally named format available on all targets. */
    readonly targets?: readonly string[];
    /** Discoverable option names; the converter remains the final validator of nested values. */
    readonly optionSchema?: Readonly<Record<string, {
        readonly summary: string;
        readonly valueSyntax?: string;
    }>>;
    /** Return every external resource path the converter will read. */
    readonly resourcePaths?: (options: Readonly<Record<string, unknown>>) => readonly string[];
    convert(source: AssetSource, options: Readonly<Record<string, unknown>>, resources: Readonly<Record<string, AssetSource>>): AssetFormatResult;
}
/** Lossless byte transform applied after one named output is selected. */
export interface AssetTransformOptionField {
    readonly type: "string" | "integer" | "boolean" | "enum";
    readonly required?: boolean;
    readonly minimum?: number;
    readonly maximum?: number;
    readonly enum?: readonly (string | number | boolean)[];
    /** A string option naming a provider resource to snapshot before encoding. */
    readonly resource?: boolean;
}
/** Transform options are closed: unspecified keys fail validation. */
export interface AssetTransformContribution {
    readonly id: string;
    readonly version: string;
    readonly aliases?: readonly string[];
    readonly targets?: readonly string[];
    readonly optionSchema?: Readonly<Record<string, AssetTransformOptionField>>;
    /** Validate all options before resource discovery or byte conversion. */
    readonly validateOptions?: (options: Readonly<Record<string, unknown>>) => void;
    /** Declare companion files such as compression dictionaries for snapshot tracking. */
    readonly resourcePaths?: (options: Readonly<Record<string, unknown>>) => readonly string[];
    encode(bytes: Uint8Array, options: Readonly<Record<string, unknown>>, resources?: Readonly<Record<string, AssetSource>>): Uint8Array;
    /** Decode within the exact previous-stage length before verification. */
    decode(bytes: Uint8Array, options: Readonly<Record<string, unknown>>, maxOutputBytes: number, resources?: Readonly<Record<string, AssetSource>>): Uint8Array;
}
/** Editor signature metadata. Implementations must validate their accepted argument values. */
export interface ExpressionFunctionSignature {
    readonly parameters: readonly string[];
    readonly minimumArguments?: number;
    readonly maximumArguments?: number;
}
/** Target mapping and read access supplied to a contributed expression function. */
export interface ExpressionFunctionContext {
    readonly state: SessionStateStore;
    readonly addresses: {
        toOutputOffset(address: number): number;
        fromOutputOffset(offset: number): number;
    };
    readonly output: {
        /** Tests a physical byte offset in the base image (or output if absent). Returns 1 or 0. */
        canRead(position: number, size: number): number;
        /** Read at a logical address through the target mapping, little-endian. An unavailable range throws unless a fallback is supplied. */
        read(position: number, size: number, defaultValue?: number): number;
    };
}
/** Synchronous expression callback. Names and aliases must be unique within the target. */
export interface ExpressionFunctionContribution {
    name: string;
    aliases?: readonly string[];
    signature: ExpressionFunctionSignature;
    summary: string;
    evaluate(context: ExpressionFunctionContext, args: readonly MathValue[]): MathValue;
}
/** Named group of expression functions selected by a target. */
export interface ExpressionSetContribution {
    id: string;
    functions: readonly ExpressionFunctionContribution[];
}
/** Borrowed session and live state. Hooks must not dispose or recursively assemble the session. */
export interface SessionLifecycleContext {
    readonly state: SessionStateStore;
    readonly session: Assembler;
}
/** The stage entering or leaving execution. Analysis may run only a subset of stages. */
export interface StageLifecycleContext extends SessionLifecycleContext {
    readonly stage: AssemblyStageName;
}
/** Directive command before its registered handler executes. */
export interface DirectiveMiddlewareContext extends SessionLifecycleContext {
    readonly keyword: string;
    readonly words: readonly string[];
    readonly raw: string;
}
/** Architecture IDs are canonical. SourceAlias retains the spelling used for selection. */
export interface ArchitectureSelectionContext extends SessionLifecycleContext {
    readonly previousArchitecture?: string;
    readonly architecture: string;
    readonly sourceAlias: string;
}
/** Dialect-specific ambiguity at endif. Start-line indices are zero-based. */
export interface EndifResolutionContext extends SessionLifecycleContext {
    readonly loopType?: "for" | "while";
    readonly loopStartLine?: number;
    readonly ifStartLine?: number;
}
/** Pending write after address-space validation. Width is a byte count. */
export interface WriteValidationContext extends SessionLifecycleContext {
    readonly logicalAddress: number;
    readonly width: number;
}
/** Output and session immediately before the output-format finalizer. */
export interface LifecycleOutputFinalizationContext extends OutputFinalizationContext {
    readonly session: Assembler;
}
/**
 * Synchronous hooks run in contribution registration order, except disposal which reverses it.
 * Hook exceptions become PluginError. Disposal attempts all hooks and aggregates failures.
 */
export interface SessionLifecycle {
    onSessionCreated?(context: SessionLifecycleContext): void;
    /** Also runs for collectDefinitions during construction, before the first explicit assembly/analysis pass. */
    onStageStart?(context: StageLifecycleContext): void;
    /** First handled result skips later middleware and the directive handler. */
    beforeDirective?(context: DirectiveMiddlewareContext): "continue" | "handled";
    onArchitectureSelected?(context: ArchitectureSelectionContext): void;
    /** Last defined answer wins. Undefined defers, and no answer means false. */
    shouldEndifCloseInnermostWhile?(context: EndifResolutionContext): boolean | undefined;
    beforeWrite?(context: WriteValidationContext): void;
    onStageEnd?(context: StageLifecycleContext): void;
    beforeOutputFinalize?(context: LifecycleOutputFinalizationContext): void;
    /** Runs before state-slot disposal, so live state is still available. */
    onSessionDispose?(context: SessionLifecycleContext): void;
}
/** Creates hooks for one session. Included only when referenced by the selected target. */
export interface LifecycleContribution {
    id: string;
    create(context: TargetFactoryContext): SessionLifecycle;
}
/** Links processor, mapping, output, and language contributions into a build/tooling target. */
export interface TargetContribution {
    id: string;
    aliases?: readonly string[];
    displayName: string;
    defaultArchitecture: string;
    /** Canonical architecture contribution IDs available for this target. */
    architectures: readonly string[];
    addressSpace: string;
    outputFormat: string;
    directiveSets: readonly string[];
    /** Core directive families enabled for runtime and tooling. Omitted means all. */
    coreDirectiveGroups?: readonly CoreDirectiveGroup[];
    expressionSets: readonly string[];
    /** Selected lifecycle IDs. Execution follows registration order, not this array's order. */
    lifecycle: readonly string[];
    /** Source grammar policy. Omitted targets retain the legacy Asar-compatible profile. */
    syntaxProfile?: SyntaxProfile;
    /** Suggested output suffix, including its leading dot. Core does not write files. */
    defaultOutputExtension: string;
    /** Validate/default Assembler targetOptions. Output is shallow-copied and frozen per session. */
    createOptions?(configured: unknown): Readonly<Record<string, unknown>>;
}
/**
 * Registration capability valid only until activate resolves. Contributions are frozen in place
 * on commit. Their IDs must be globally unique, lowercase, and contain a namespace dot.
 */
export interface PluginActivationContext<Options = unknown> {
    readonly pluginId: string;
    readonly logger: PluginLogger;
    readonly options: Readonly<Options>;
    /** Register a per-session slot and return its typed access token. */
    registerSessionState<T>(contribution: SessionStateContribution<T>): SessionStateKey<T>;
    registerArchitecture(contribution: ArchitectureContribution): void;
    registerAddressSpace(contribution: AddressSpaceContribution): void;
    registerOutputFormat(contribution: OutputFormatContribution): void;
    registerDirectiveSet(contribution: DirectiveSetContribution): void;
    registerAssetFormat(contribution: AssetFormatContribution): void;
    registerAssetTransform(contribution: AssetTransformContribution): void;
    registerExpressionSet(contribution: ExpressionSetContribution): void;
    registerLifecycle(contribution: LifecycleContribution): void;
    registerTarget(contribution: TargetContribution): void;
}
/** Read-only editor description with aliases normalized to an array. */
export interface ExpressionFunctionDescriptor {
    readonly name: string;
    readonly aliases: readonly string[];
    readonly signature: ExpressionFunctionSignature;
    readonly summary: string;
}
/** Processor identity for target-scoped editor selection. */
export interface ArchitectureSummary {
    readonly id: string;
    readonly aliases: readonly string[];
    readonly displayName: string;
}
/** Target identity and defaults for host pickers and output naming. */
export interface TargetSummary {
    readonly id: string;
    readonly aliases: readonly string[];
    readonly displayName: string;
    readonly defaultArchitecture: string;
    readonly defaultOutputExtension: string;
}
/** Read-only target catalog. Instruction lookup accepts target-scoped IDs or aliases. */
export interface ToolingCatalog {
    /** Returns an empty array when the architecture is unavailable in this target. */
    getInstructions(architecture: string): readonly InstructionDescriptor[];
    getDirectives(): readonly DirectiveDescriptor[];
    getExpressionFunctions(): readonly ExpressionFunctionDescriptor[];
    getArchitectures(): readonly ArchitectureSummary[];
    /** Lists every target in the environment, not just this catalog's target. */
    getTargets(): readonly TargetSummary[];
}
export {};
//# sourceMappingURL=contracts.d.ts.map