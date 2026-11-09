import type { ArchitectureContribution, AssetFormatContribution, AssetTransformContribution, AssemblerPluginManifest, DirectiveSetContribution, ExpressionSetContribution, LifecycleContribution, OutputFormatContribution, SessionStateContribution, TargetContribution, TargetSummary, ToolingCatalog, AddressSpaceContribution } from "./contracts.js";
/**
 * A plugin contribution plus the owner metadata recorded at registration time.
 * `registrationOrder` is the global sequence used to sort lifecycles and similar lists.
 */
export interface OwnedContribution<T> {
    /** Owning plugin manifest identifier. */
    readonly pluginId: string;
    /** Stable contribution id within the plugin. */
    readonly contributionId: string;
    /** Global registration sequence used for deterministic ordering. */
    readonly registrationOrder: number;
    /** Frozen contribution payload after plugin validation. */
    readonly value: Readonly<T>;
}
/**
 * Frozen bags of contributions collected by `PluginManager` before
 * {@link AssemblerEnvironment} validates targets and builds lookup maps.
 */
export interface EnvironmentContributions {
    /** Registered plugin manifests in load order. */
    readonly manifests: readonly AssemblerPluginManifest[];
    /** Session-state schema contributions keyed during freeze. */
    readonly sessionStates: readonly OwnedContribution<SessionStateContribution<unknown>>[];
    /** CPU architecture definitions contributed by plugins. */
    readonly architectures: readonly OwnedContribution<ArchitectureContribution>[];
    /** Address-space layout models referenced by targets. */
    readonly addressSpaces: readonly OwnedContribution<AddressSpaceContribution>[];
    /** Output encoders selectable per target. */
    readonly outputFormats: readonly OwnedContribution<OutputFormatContribution>[];
    /** Directive bundles merged into the core registry. */
    readonly directiveSets: readonly OwnedContribution<DirectiveSetContribution>[];
    /** Optional asset format plugins registered before environment freeze. */
    readonly assetFormats?: readonly OwnedContribution<AssetFormatContribution>[];
    /** Optional asset transform plugins registered before environment freeze. */
    readonly assetTransforms?: readonly OwnedContribution<AssetTransformContribution>[];
    /** Expression function libraries exposed to the math evaluator. */
    readonly expressionSets: readonly OwnedContribution<ExpressionSetContribution>[];
    /** Lifecycle hooks invoked around assembly sessions. */
    readonly lifecycles: readonly OwnedContribution<LifecycleContribution>[];
    /** Target profiles wiring architectures, outputs, and defaults. */
    readonly targets: readonly OwnedContribution<TargetContribution>[];
}
/**
 * Frozen, validated view of every plugin contribution after `PluginManager.freeze()`.
 *
 * Construction checks that each target's address space, output format, architectures,
 * directive/expression sets, and lifecycles exist, that aliases and keywords do not
 * collide, and that `defaultArchitecture` / `defaultOutputExtension` are well-formed.
 */
export declare class AssemblerEnvironment {
    #private;
    /** Plugin manifests retained for tooling and diagnostics surfacing. */
    readonly manifests: readonly AssemblerPluginManifest[];
    /** Session-state contributions indexed during environment construction. */
    readonly sessionStates: readonly OwnedContribution<SessionStateContribution<unknown>>[];
    /**
     * Indexes contributions, checks target alias uniqueness, then validates every target.
     * Prefer PluginManager.freeze: this constructor retains input records and assumes they were
     * already validated and deeply frozen by the manager. It does not own plugin resources.
     * @param contributions Manager-collected plugin graph.
     * @throws {PluginError} On alias collisions or an invalid target graph.
     */
    constructor(contributions: EnvironmentContributions);
    /**
     * Resolve a globally named or target-scoped short format ID.
     * @param id Full ID or short alias.
     * @param targetId Selected target.
     * @returns Compatible format.
     */
    getAssetFormat(id: string, targetId: string): Readonly<AssetFormatContribution> | undefined;
    /**
     * List formats compatible with a target for editor completion and discovery.
     * @param targetId Selected target.
     * @returns Canonical registrations.
     */
    getAssetFormats(targetId: string): readonly Readonly<AssetFormatContribution>[];
    /**
     * Resolve a globally named or target-scoped short transform ID.
     * @param id Full ID or short alias.
     * @param targetId Selected target.
     * @returns Compatible transform.
     */
    getAssetTransform(id: string, targetId: string): Readonly<AssetTransformContribution> | undefined;
    /**
     * List reversible transforms compatible with a target for editor completion.
     * @param targetId Selected target.
     * @returns Canonical registrations.
     */
    getAssetTransforms(targetId: string): readonly Readonly<AssetTransformContribution>[];
    /**
     * Resolves a target contribution id or alias to the canonical target id.
     * @param idOrAlias Target id or alias (case-insensitive).
     * @returns Canonical target id, or `undefined` if unknown.
     */
    resolveTargetId(idOrAlias: string): string | undefined;
    /**
     * Looks up a target by id or alias.
     * @param idOrAlias Target id or alias (case-insensitive).
     * @returns The target, if registered.
     */
    getTarget(idOrAlias: string): Readonly<TargetContribution> | undefined;
    /**
     * Frozen summaries of every registered target (for LSP/UI pickers).
     * @returns Id, aliases, display name, defaults.
     */
    getTargetSummaries(): readonly TargetSummary[];
    /**
     * Resolves an architecture id or alias in the context of a target.
     * @param targetId Target id or alias.
     * @param idOrAlias Architecture contribution id or alias.
     * @returns Canonical architecture id, or `undefined`.
     */
    resolveArchitectureId(targetId: string, idOrAlias: string): string | undefined;
    /**
     * Looks up an architecture contribution by canonical id (not alias).
     * @param id Architecture contribution id.
     * @returns The architecture, if registered.
     */
    getArchitecture(id: string): Readonly<ArchitectureContribution> | undefined;
    /**
     * Looks up an address-space contribution by id.
     * @param id Address-space contribution id.
     * @returns The contribution, if registered.
     */
    getAddressSpace(id: string): Readonly<AddressSpaceContribution> | undefined;
    /**
     * Looks up an output-format contribution by id.
     * @param id Output-format contribution id.
     * @returns The contribution, if registered.
     */
    getOutputFormat(id: string): Readonly<OutputFormatContribution> | undefined;
    /**
     * Looks up a directive-set contribution by id.
     * @param id Directive-set contribution id.
     * @returns The contribution, if registered.
     */
    getDirectiveSet(id: string): Readonly<DirectiveSetContribution> | undefined;
    /**
     * Looks up an expression-set contribution by id.
     * @param id Expression-set contribution id.
     * @returns The contribution, if registered.
     */
    getExpressionSet(id: string): Readonly<ExpressionSetContribution> | undefined;
    /**
     * Looks up a lifecycle contribution by id.
     * @param id Lifecycle contribution id.
     * @returns The contribution, if registered.
     */
    getLifecycle(id: string): Readonly<LifecycleContribution> | undefined;
    /**
     * Returns the plugin id that registered a contribution (any kind except session state).
     * @param id Contribution id (case-insensitive).
     * @returns Owning plugin id, or `undefined` if unknown.
     */
    getContributionOwner(id: string): string | undefined;
    /**
     * Lifecycle contributions wired to a target, sorted by registration order.
     * @param targetId Target id or alias.
     * @returns Frozen, ordered records.
     * @throws {PluginError} If `targetId` does not resolve (`PLUGIN_TARGET_INVALID`).
     */
    getTargetLifecycles(targetId: string): readonly OwnedContribution<LifecycleContribution>[];
    /**
     * Builds the LSP/editor catalog for a target (instructions, directives, expressions).
     * @param targetId Target id or alias.
     * @returns Frozen per-target tooling view.
     * @throws {PluginError} If `targetId` does not resolve (`PLUGIN_TARGET_INVALID`).
     */
    getToolingCatalog(targetId: string): ToolingCatalog;
}
//# sourceMappingURL=environment.d.ts.map