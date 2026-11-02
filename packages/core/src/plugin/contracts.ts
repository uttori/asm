import type { InstructionDescriptor, MathValue } from "../architecture-types.js";
import type {
  ArchitectureDecoder,
  ArchitectureInstructionSpecification,
} from "../decoder-types.js";
import type { CoreDirectiveGroup } from "../directive-groups.js";
import type { NormalizedCommand } from "../ir/normalized-command.js";
import type { SyntaxGrammar, SyntaxValue } from "../ir/source-syntax.js";
import type { DirectiveDescriptor } from "../lsp/directive-catalog.js";
import type { SyntaxProfile } from "../syntax-profile.js";
import type { PluginSessionCapabilities } from "./session-capabilities.js";

/** Contract revision required by PluginManager. Independent of npm package versions. */
export const PLUGIN_API_VERSION = 2 as const;

/** Ordered build passes: collect symbols, determine addresses, then emit final bytes. */
export type AssemblyStageName = "collectDefinitions" | "resolveLayout" | "emitProgram";

/** Plugin identity and dependencies validated before activation. */
export interface AssemblerPluginManifest {
  /** Globally unique lowercase ID, beginning with a letter. Dots and hyphens separate segments. */
  id: string;
  /** Human-readable display name; must be a non-empty string. */
  name: string;
  /** Exact semantic version of this plugin. */
  version: string;
  /** Must equal PLUGIN_API_VERSION; any other value rejects the plugin as incompatible. */
  apiVersion: typeof PLUGIN_API_VERSION;
  /** Optional human-readable summary. Must be a string when present. */
  description?: string;
  /** Dependencies must be active or present in the same activation batch. */
  requires?: ReadonlyArray<{
    /** Manifest ID of the required plugin. */
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
  /** Identity checked and frozen by the manager before options are validated or activate runs. */
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
  activate(
    context: PluginActivationContext<Options>,
    options: Readonly<Options>,
  ): void | PluginDisposable | Promise<void | PluginDisposable>;
}

/**
 * Preserve the plugin's option type without runtime validation.
 * @param plugin Definition to expose as the module's default export.
 * @returns The same plugin object, retaining its option type.
 */
export function definePlugin<Options>(plugin: AssemblerPlugin<Options>): AssemblerPlugin<Options> {
  return plugin;
}

/** Host-owned diagnostic sink. Omitted manager loggers discard messages. */
export interface PluginLogger {
  /** Verbose tracing. Plugin-facing loggers prefix the message with `[pluginId]`. */
  debug(message: string, details?: Readonly<Record<string, unknown>>): void;
  /** Informational progress. Plugin-facing loggers prefix the message with `[pluginId]`. */
  info(message: string, details?: Readonly<Record<string, unknown>>): void;
  /** Recoverable problem. Plugin-facing loggers prefix the message with `[pluginId]`. */
  warn(message: string, details?: Readonly<Record<string, unknown>>): void;
  /** Failure report; logging does not throw or abort. Plugin-facing loggers prefix `[pluginId]`. */
  error(message: string, details?: Readonly<Record<string, unknown>>): void;
}

declare const sessionStateBrand: unique symbol;

/** Typed slot token returned during registration. Keep it to access each session's live value. */
export interface SessionStateKey<T> {
  /** Contribution ID of the registered session-state slot. */
  readonly id: string;
  /**
   * Compile-time slot type. The property is absent at runtime; hosts select the
   * value by `id`, and the brand keeps two slots with the same id string distinct.
   */
  readonly [sessionStateBrand]?: T;
}

/** Canonical target identity and target-normalized options for a newly created session. */
export interface SessionCreationContext {
  /** Canonical target contribution ID, never an alias. */
  readonly targetId: string;
  /** Options returned by the target's createOptions, frozen for the session. */
  readonly targetOptions: Readonly<Record<string, unknown>>;
}

/**
 * Mutable data isolated per session and assembly stage. Factories run for every registered slot,
 * including slots from plugins whose target was not selected. Store cloneable data here.
 * Plugin-wide external resources belong in the activation disposable.
 */
export interface SessionStateContribution<T> {
  /** Globally unique namespaced contribution ID; becomes the returned key's `id`. */
  id: string;
  /** Build the initial live value once per session, before any lifecycle hook runs. */
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

/** Processor syntax and factories. IDs are namespaced. Aliases resolve within each target. */
export interface ArchitectureContribution {
  /** Pure processor-owned grammar shared by execution and tooling, including analysis-only targets. */
  operandGrammar: import("../ir/resolved-instruction.js").ArchitectureOperandGrammar;
  /** Globally unique namespaced contribution ID, referenced by target `architectures`. */
  id: string;
  /** Alternative case-insensitive names; must not collide with other architectures in a target. */
  aliases?: readonly string[];
  /** Human-readable processor name for editor pickers and diagnostics. */
  displayName: string;
  /** Unhandled mnemonics either fail assembly or fall through to other statement handling. */
  unknownInstructionBehavior: "throw" | "returnFalse";
  /** Receives only state/options; evaluation and writes are borrowed per instruction. Omit only for decoder-only use, which cannot create assembly sessions. */
  createTypedEncoder?(
    context: ArchitectureFactoryContext,
  ): import("../ir/resolved-instruction.js").TypedArchitectureEncoder;
  /** Optional architecture-owned decoder. Formatting remains a separate concern. */
  createDecoder?(context: ArchitectureDecoderFactoryContext): ArchitectureDecoder;
  /** Machine-readable forms used by decoders, editor tooling, and conformance tests. */
  instructionSpecifications?: readonly ArchitectureInstructionSpecification[];
  /** Editor descriptors returned by the tooling catalog for targets listing this architecture. */
  instructions: readonly InstructionDescriptor[];
}

/** Factory metadata and state. Evaluation and emission are borrowed only during typed instruction dispatch. */
export interface ArchitectureFactoryContext {
  /** Canonical ID of the session's target. */
  readonly targetId: string;
  /** Target-normalized session options, frozen. */
  readonly options: Readonly<Record<string, unknown>>;
  /** Live session state shared with the target's other contributions. */
  readonly state: SessionStateStore;
}

/** Decoder factories share the same session metadata and state contract. */
export type ArchitectureDecoderFactoryContext = ArchitectureFactoryContext;

/** Per-session target services use normalized target options and shared session state. */
export interface TargetFactoryContext {
  /** Canonical ID of the session's target. */
  readonly targetId: string;
  /** Target-normalized session options, frozen. */
  readonly options: Readonly<Record<string, unknown>>;
  /** Live session state shared with the target's other contributions. */
  readonly state: SessionStateStore;
}

/** Creates the logical-address to output-offset mapping for each session. */
export interface AddressSpaceContribution {
  /** Globally unique namespaced contribution ID, referenced by target `addressSpace`. */
  id: string;
  /** Called once per session that selects a target using this address space. */
  create(context: TargetFactoryContext): TargetAddressSpace;
}

/** Target mapping policy. Logical addresses and physical offsets are byte addresses. */
export interface TargetAddressSpace {
  /** Logical address width in bits. */
  readonly addressWidth: number;
  /** Initial logical address before a source origin directive. */
  readonly defaultOrigin: number;
  /** Map the current base address to the logical address checked and recorded for the next write. */
  normalizeForWrite(address: number): number;
  /** Advance by a byte count, applying target bank/wrap rules. */
  advance(address: number, amount: number): number;
  /** Map a logical address to a zero-based output offset; a negative result means unmapped. */
  toOutputOffset(address: number): number;
  /** Inverse of toOutputOffset for a zero-based output offset. */
  fromOutputOffset(offset: number): number;
  /** Reject a write by throwing before output mutation. Width is a byte count. */
  validateWrite?(address: number, width: number): void;
}

/** Live output at finalization. The formatter may patch bytes or update session state. */
export interface OutputFinalizationContext {
  /** Live session state. */
  readonly state: SessionStateStore;
  /** Live session output, mutable in place during finalization. */
  readonly outputBytes: number[] | Uint8Array;
}

/** Live session bytes supplied when materializing the target's binary representation. */
export interface OutputReadContext {
  /** Live session state. */
  readonly state: SessionStateStore;
  /** Live session output; not a copy. */
  readonly outputBytes: number[] | Uint8Array;
}

/** Creates per-session finalization and binary output behavior. */
export interface OutputFormatContribution {
  /** Globally unique namespaced contribution ID, referenced by target `outputFormat`. */
  id: string;
  /** Called once per session that selects a target using this output format. */
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
  /** Live session state, identical to the factory's store. */
  readonly state: SessionStateStore;
  /** Detached occurrence metadata for diagnostics. Semantic input is the validated payload. */
  readonly command: Pick<NormalizedCommand, "keyword" | "source">;
}

/** Creates a handler bound to one session. The session remains owned and disposed by its host. */
export interface DirectiveFactoryContext {
  /** Canonical ID of the session's target. */
  readonly targetId: string;
  /** Live session state. */
  readonly state: SessionStateStore;
  /** Borrowed session capabilities; valid only during the bind call. */
  readonly session: PluginSessionCapabilities;
}

/** Runtime syntax and editor descriptions. Keywords must not collide within a target. */
export interface DirectiveContribution {
  /** Globally unique namespaced ID, distinct from every other contribution ID. */
  id: string;
  /** Non-empty list of case-insensitive source keywords handled by this directive. */
  keywords: readonly string[];
  /** Typed directives execute after ordered source expansion, once per active assembly stage. */
  phase: "lowered";
  /** Required pure grammar and session binding; undefined binding preserves existing keyword ownership. */
  syntax: DirectiveSyntaxContribution;
  /** Editor descriptors merged into the target's directive catalog. */
  tooling: readonly DirectiveDescriptor[];
}

/** Named group selected by a target. Unselected groups do not install handlers. */
export interface DirectiveSetContribution {
  /** Globally unique namespaced contribution ID, referenced by target `directiveSets`. */
  id: string;
  /** Directives installed when a target selects this set. */
  directives: readonly DirectiveContribution[];
  /** Extra editor descriptors not tied to one directive; listed before per-directive tooling. */
  tooling?: readonly DirectiveDescriptor[];
}

/** Borrowed file bytes; providers may not retain or mutate the source. */
export interface AssetSource {
  /** Raw file contents. */
  readonly bytes: Uint8Array;
  /** Declared or extension-derived media type of the bytes. */
  readonly mediaType: string;
}

/** Named conversion result. The assembler emits only the selected output. */
export interface AssetFormatResult {
  /** Output name used when no explicit output is requested; must be a key of `outputs`. */
  readonly primaryOutput: string;
  /** Every produced output by name. The assembler copies the bytes into its own ownership. */
  readonly outputs: Readonly<Record<string, { readonly bytes: Uint8Array }>>;
}

/** One authoring representation, independently of the native output codec. IDs are stable across editor integrations. */
export interface AssetSourceRepresentation {
  /** Stable representation identity, unique within its format. */
  readonly id: string;
  /** Media type assigned to files with this representation's extensions. */
  readonly mediaType: string;
  /** Lowercase filename suffixes including the dot; the first is the generated default. */
  readonly extensions: readonly string[];
}

/** A resource key identifies bytes passed to converters; relativeTo names an already discovered resource key. */
export interface AssetResourceDependency {
  /** Name under which the resource is supplied to converters; unique within one asset build. */
  readonly key: string;
  /** Resource path, resolved relative to `relativeTo` or the assembly call. */
  readonly path: string;
  /** Omission resolves from the assembly call; nested sidecars resolve from their declaring file. */
  readonly relativeTo?: string;
  /** Explicit type for representation resources whose extensions are supplied by a codec plugin. */
  readonly mediaType?: string;
}

/** Synchronous, target-scoped conversion from supplied bytes. */
export interface AssetFormatContribution {
  /** Globally unique namespaced contribution ID. */
  readonly id: string;
  /** Valid semantic version of the conversion behavior. */
  readonly version: string;
  /** Short names resolved per target; must be unambiguous among formats on that target. */
  readonly aliases?: readonly string[];
  /** Canonical target IDs; omission makes the globally named format available on all targets. */
  readonly targets?: readonly string[];
  /** Discoverable option names; the converter remains the final validator of nested values. */
  readonly optionSchema?: Readonly<
    Record<string, { readonly summary: string; readonly valueSyntax?: string }>
  >;
  /** Authoring file kinds this format accepts, for editors and resource media-type lookup. */
  readonly sourceRepresentations?: readonly AssetSourceRepresentation[];
  /**
   * Discover the complete closure incrementally. Inputs are owned callback copies, fixed for this build.
   * Return the same requests on each invocation plus new requests unlocked by supplied resources.
   * Discovery stops when no new keys appear; recursive/cyclic declarations and more than 1024 resources fail.
   */
  readonly resourceDependencies?: (
    source: AssetSource,
    options: Readonly<Record<string, unknown>>,
    resources: Readonly<Record<string, AssetSource>>,
  ) => readonly AssetResourceDependency[];
  /** Return every external resource path the converter will read. */
  readonly resourcePaths?: (options: Readonly<Record<string, unknown>>) => readonly string[];
  /** Convert borrowed source bytes and discovered resources into named outputs; must not retain inputs. */
  convert(
    source: AssetSource,
    options: Readonly<Record<string, unknown>>,
    resources: Readonly<Record<string, AssetSource>>,
  ): AssetFormatResult;
}

/** Schema for one transform option. Transform options are closed: unspecified keys fail validation. */
export interface AssetTransformOptionField {
  /** Accepted value kind; `enum` requires an `enum` list. */
  readonly type: "string" | "integer" | "boolean" | "enum";
  /** Whether the option must be supplied. Omission means optional. */
  readonly required?: boolean;
  /** Inclusive finite lower bound for numeric values. */
  readonly minimum?: number;
  /** Inclusive finite upper bound for numeric values. */
  readonly maximum?: number;
  /** Allowed values for `enum` options. */
  readonly enum?: readonly (string | number | boolean)[];
  /** A string option naming a provider resource to snapshot before encoding. */
  readonly resource?: boolean;
}

/** Lossless byte transform applied after one named output is selected. */
export interface AssetTransformContribution {
  /** Globally unique namespaced contribution ID. */
  readonly id: string;
  /** Valid semantic version of the encoding behavior. */
  readonly version: string;
  /** Short names resolved per target; must be unambiguous among transforms on that target. */
  readonly aliases?: readonly string[];
  /** Canonical target IDs; omission makes the transform available on all targets. */
  readonly targets?: readonly string[];
  /** Closed option schema checked at activation; unlisted option keys fail validation. */
  readonly optionSchema?: Readonly<Record<string, AssetTransformOptionField>>;
  /** Validate all options before resource discovery or byte conversion. */
  readonly validateOptions?: (options: Readonly<Record<string, unknown>>) => void;
  /** Declare companion files such as compression dictionaries for snapshot tracking. */
  readonly resourcePaths?: (options: Readonly<Record<string, unknown>>) => readonly string[];
  /** Encode the selected output bytes; `decode` must reproduce the input exactly. */
  encode(
    bytes: Uint8Array,
    options: Readonly<Record<string, unknown>>,
    resources?: Readonly<Record<string, AssetSource>>,
  ): Uint8Array;
  /** Decode within the exact previous-stage length before verification. */
  decode(
    bytes: Uint8Array,
    options: Readonly<Record<string, unknown>>,
    maxOutputBytes: number,
    resources?: Readonly<Record<string, AssetSource>>,
  ): Uint8Array;
}

/** Editor signature metadata. Implementations must validate their accepted argument values. */
export interface ExpressionFunctionSignature {
  /** Parameter names shown by editors; the count is the default arity. */
  readonly parameters: readonly string[];
  /** Fewest accepted arguments. Defaults to the parameter count. */
  readonly minimumArguments?: number;
  /** Most accepted arguments. Defaults to the parameter count, or unbounded when only the minimum is set. */
  readonly maximumArguments?: number;
}

/** Target mapping and read access supplied to a contributed expression function. */
export interface ExpressionFunctionContext {
  /** Live session state. */
  readonly state: SessionStateStore;
  /** The session target's logical-address mapping. */
  readonly addresses: {
    /** Map a logical address to a zero-based output offset; negative means unmapped. */
    toOutputOffset(address: number): number;
    /** Map a zero-based output offset to its logical address. */
    fromOutputOffset(offset: number): number;
  };
  /** Read-only access to the base image, or the live output when no base image is supplied. */
  readonly output: {
    /** Tests a physical byte offset in the base image (or output if absent). Returns 1 or 0. */
    canRead(position: number, size: number): number;
    /** Read at a logical address through the target mapping, little-endian. An unavailable range throws unless a fallback is supplied. */
    read(position: number, size: number, defaultValue?: number): number;
  };
}

/** Synchronous expression callback. Names and aliases must be unique within the target. */
export interface ExpressionFunctionContribution {
  /** Case-insensitive function name used in source expressions. */
  name: string;
  /** Additional case-insensitive names for the same function. */
  aliases?: readonly string[];
  /** Arity bounds enforced before evaluate runs, plus editor parameter names. */
  signature: ExpressionFunctionSignature;
  /** One-line description shown by editors. */
  summary: string;
  /** Compute the result from evaluated arguments. Thrown errors become PLUGIN_HOOK_FAILED. */
  evaluate(context: ExpressionFunctionContext, args: readonly MathValue[]): MathValue;
}

/** Named group of expression functions selected by a target. */
export interface ExpressionSetContribution {
  /** Globally unique namespaced contribution ID, referenced by target `expressionSets`. */
  id: string;
  /** Functions installed when a target selects this set. */
  functions: readonly ExpressionFunctionContribution[];
}

/** Borrowed session and live state. Hooks must not dispose or recursively assemble the session. */
export interface SessionLifecycleContext {
  /** Live session state. */
  readonly state: SessionStateStore;
  /** Borrowed session capabilities; valid only during the hook call. */
  readonly session: PluginSessionCapabilities;
}

/** The stage entering or leaving execution. Analysis may run only a subset of stages. */
export interface StageLifecycleContext extends SessionLifecycleContext {
  /** Stage that is starting or ending. */
  readonly stage: AssemblyStageName;
}

/** Directive command before its registered handler executes. */
export interface DirectiveMiddlewareContext extends SessionLifecycleContext {
  /** Directive keyword as matched against beforeDirectiveKeywords. */
  readonly keyword: string;
  /** Prepared statement or contribution payload; never a word-array execution alternative. */
  readonly syntax?: import("../ir/source-syntax.js").SourceSyntax;
  /** Detached occurrence metadata, including provenance, for diagnostics and attribution. */
  readonly source: NormalizedCommand["source"];
}

/** Architecture IDs are canonical. SourceAlias retains the spelling used for selection. */
export interface ArchitectureSelectionContext extends SessionLifecycleContext {
  /** Canonical ID of the prior architecture; undefined on the first selection. */
  readonly previousArchitecture?: string;
  /** Canonical ID of the newly selected architecture. */
  readonly architecture: string;
  /** Spelling used by the source or caller to select the architecture. */
  readonly sourceAlias: string;
}

/** Dialect-specific ambiguity at endif. Start-line indices are zero-based. */
export interface EndifResolutionContext extends SessionLifecycleContext {
  /** Kind of the innermost open loop; undefined when no loop is open. */
  readonly loopType?: "for" | "while";
  /** Start line of the innermost open loop. */
  readonly loopStartLine?: number;
  /** Start line of the innermost open conditional. */
  readonly ifStartLine?: number;
}

/** Pending write after address-space validation. Width is a byte count. */
export interface WriteValidationContext extends SessionLifecycleContext {
  /** Normalized logical byte address of the first written byte. */
  readonly logicalAddress: number;
  /** Number of bytes about to be written. */
  readonly width: number;
}

/** Output and session immediately before the output-format finalizer. */
export interface LifecycleOutputFinalizationContext extends OutputFinalizationContext {
  /** Borrowed session capabilities; valid only during the hook call. */
  readonly session: PluginSessionCapabilities;
}

/**
 * Synchronous hooks run in contribution registration order, except disposal which reverses it.
 * Hook exceptions become PluginError. Disposal attempts all hooks and aggregates failures.
 */
export interface SessionLifecycle {
  /** Runs once after the session and its state slots are created. */
  onSessionCreated?(context: SessionLifecycleContext): void;
  /** Also runs for collectDefinitions during construction, before the first explicit assembly/analysis pass. */
  onStageStart?(context: StageLifecycleContext): void;
  /** First handled result skips later middleware and the directive handler. */
  beforeDirective?(context: DirectiveMiddlewareContext): "continue" | "handled";
  /** Runs after the session switches architecture, including the initial default selection. */
  onArchitectureSelected?(context: ArchitectureSelectionContext): void;
  /** Last defined answer wins. Undefined defers, and no answer means false. */
  shouldEndifCloseInnermostWhile?(context: EndifResolutionContext): boolean | undefined;
  /** Runs after TargetAddressSpace.validateWrite; throw to reject the write before output changes. */
  beforeWrite?(context: WriteValidationContext): void;
  /** Runs when a stage finishes executing. */
  onStageEnd?(context: StageLifecycleContext): void;
  /** Runs after emission and before TargetOutputFormat.finalize; may patch live output. */
  beforeOutputFinalize?(context: LifecycleOutputFinalizationContext): void;
  /** Runs before state-slot disposal, so live state is still available. */
  onSessionDispose?(context: SessionLifecycleContext): void;
}

/** Creates hooks for one session. Included only when referenced by the selected target. */
export interface LifecycleContribution {
  /** Globally unique namespaced contribution ID, referenced by target `lifecycle`. */
  id: string;
  /**
   * Canonical lowercase keywords observed by beforeDirective. Omitted means all; an empty
   * list disables directive middleware only. Filtering precedes capability borrowing and snapshots.
   */
  beforeDirectiveKeywords?: readonly string[];
  /** Called once per session whose target selects this lifecycle. */
  create(context: TargetFactoryContext): SessionLifecycle;
}

/** Links processor, mapping, output, and language contributions into a build/tooling target. */
export interface TargetContribution {
  /** Globally unique namespaced contribution ID; the canonical target identity. */
  id: string;
  /** Alternative case-insensitive names; must be unique across all targets. */
  aliases?: readonly string[];
  /** Human-readable name for host pickers and diagnostics. */
  displayName: string;
  /** Architecture ID or alias selected at session start; must be listed in `architectures`. */
  defaultArchitecture: string;
  /** Canonical architecture contribution IDs available for this target. */
  architectures: readonly string[];
  /** Address-space contribution ID; must exist when the environment freezes. */
  addressSpace: string;
  /** Output-format contribution ID; must exist when the environment freezes. */
  outputFormat: string;
  /** Directive-set contribution IDs installed for this target; keywords must not collide. */
  directiveSets: readonly string[];
  /** Core directive families enabled for runtime and tooling. Omitted means all. */
  coreDirectiveGroups?: readonly CoreDirectiveGroup[];
  /** Expression-set contribution IDs installed for this target; names must not collide. */
  expressionSets: readonly string[];
  /** Selected lifecycle IDs. Execution follows registration order, not this array's order. */
  lifecycle: readonly string[];
  /** Source grammar policy. Omitted targets retain the legacy Asar-compatible profile. */
  syntaxProfile?: SyntaxProfile;
  /** Select grammar from normalized per-session options; does not mutate the registered default profile. */
  createSyntaxProfile?(options: Readonly<Record<string, unknown>>): SyntaxProfile;
  /** Suggested output suffix, including its leading dot. Core does not write files. */
  defaultOutputExtension: string;
  /** Validate/default Assembler targetOptions. Output is shallow-copied and frozen per session. */
  createOptions?(configured: unknown): Readonly<Record<string, unknown>>;
  /** Lower target configuration into portable linker inputs without running assembly or allocating output. */
  createLinkRecipe?(context: TargetFactoryContext): import("../relocatable.js").AssemblyLinkRecipe;
  /** Optional link capability. Hosts must reject missing policies rather than silently skipping target checks. */
  createLinkTarget?(): import("../linker/types.js").LinkTargetPolicy;
  /** Lower explicit source-layout hints using current mapper/container state; the resulting recipe remains replaceable. */
  createSourceLinkRecipe?(
    context: TargetFactoryContext,
    sections: readonly import("../relocatable.js").AddressedAssemblySection[],
  ): import("../relocatable.js").AssemblyLinkRecipe;
}

/**
 * Registration capability valid only until activate resolves. Contributions are frozen in place
 * on commit. Their IDs must be globally unique, lowercase, and contain a namespace dot.
 */
export interface PluginActivationContext<Options = unknown> {
  /** Manifest ID of the plugin being activated. */
  readonly pluginId: string;
  /** Host logger that prefixes every message with `[pluginId]`. */
  readonly logger: PluginLogger;
  /** Validated, deeply frozen options; the same object passed to activate. */
  readonly options: Readonly<Options>;

  /** Register a per-session slot and return its typed access token. */
  registerSessionState<T>(contribution: SessionStateContribution<T>): SessionStateKey<T>;
  /** Register a processor; available to targets that list its ID. */
  registerArchitecture(contribution: ArchitectureContribution): void;
  /** Register a logical-to-output address mapping. */
  registerAddressSpace(contribution: AddressSpaceContribution): void;
  /** Register a finalization and binary output format. */
  registerOutputFormat(contribution: OutputFormatContribution): void;
  /** Register a named directive group; its directive IDs share the global ID namespace. */
  registerDirectiveSet(contribution: DirectiveSetContribution): void;
  /** Register an asset conversion format. */
  registerAssetFormat(contribution: AssetFormatContribution): void;
  /** Register a reversible asset byte transform. */
  registerAssetTransform(contribution: AssetTransformContribution): void;
  /** Register a named group of expression functions. */
  registerExpressionSet(contribution: ExpressionSetContribution): void;
  /** Register session lifecycle hooks; global registration order sets hook order. */
  registerLifecycle(contribution: LifecycleContribution): void;
  /** Register a target; its references are validated when the environment freezes. */
  registerTarget(contribution: TargetContribution): void;
}

/** Read-only editor description with aliases normalized to an array. */
export interface ExpressionFunctionDescriptor {
  /** Primary function name. */
  readonly name: string;
  /** Alternative names; empty when none are declared. */
  readonly aliases: readonly string[];
  /** Parameter names and arity bounds. */
  readonly signature: ExpressionFunctionSignature;
  /** One-line description. */
  readonly summary: string;
}

/** Processor identity for target-scoped editor selection. */
export interface ArchitectureSummary {
  /** Canonical architecture contribution ID. */
  readonly id: string;
  /** Alternative names; empty when none are declared. */
  readonly aliases: readonly string[];
  /** Human-readable processor name. */
  readonly displayName: string;
}

/** Target identity and defaults for host pickers and output naming. */
export interface TargetSummary {
  /** Canonical target contribution ID. */
  readonly id: string;
  /** Alternative names; empty when none are declared. */
  readonly aliases: readonly string[];
  /** Human-readable target name. */
  readonly displayName: string;
  /** Architecture ID or alias selected at session start. */
  readonly defaultArchitecture: string;
  /** Suggested output suffix, including its leading dot. */
  readonly defaultOutputExtension: string;
}

/** Read-only target catalog. Instruction lookup accepts target-scoped IDs or aliases. */
export interface ToolingCatalog {
  /** Returns an empty array when the architecture is unavailable in this target. */
  getInstructions(architecture: string): readonly InstructionDescriptor[];
  /** Enabled core directives plus target-contributed tooling, deduplicated by keyword with later entries winning. */
  getDirectives(): readonly DirectiveDescriptor[];
  /** Functions from the target's expression sets, in set order. */
  getExpressionFunctions(): readonly ExpressionFunctionDescriptor[];
  /** Architectures listed by the target, in target order. */
  getArchitectures(): readonly ArchitectureSummary[];
  /** Lists every target in the environment, not just this catalog's target. */
  getTargets(): readonly TargetSummary[];
}

/** Bound execution owns effects; the host borrows capabilities only during factory/execute calls. */
export interface BoundDirectiveSyntax {
  /** Apply one validated payload for the current stage. Called once per occurrence per active stage. */
  execute(payload: SyntaxValue, context: DirectiveExecutionContext): void;
}
/** Undefined binding leaves the previous core/target registration active for this session. */
export interface DirectiveSyntaxContribution extends SyntaxGrammar {
  /** Create the session-bound executor, or return undefined to leave the keyword's prior owner active. */
  bind(context: DirectiveFactoryContext): BoundDirectiveSyntax | undefined;
}
