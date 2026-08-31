import type { ArchitectureContribution, AssemblerPluginManifest, DirectiveSetContribution, ExpressionSetContribution, LifecycleContribution, OutputFormatContribution, SessionStateContribution, TargetContribution, TargetSummary, ToolingCatalog, AddressSpaceContribution } from "./contracts.js";
/**
 * A plugin contribution plus the owner metadata recorded at registration time.
 * `registrationOrder` is the global sequence used to sort lifecycles and similar lists.
 */
export interface OwnedContribution<T> {
    readonly pluginId: string;
    readonly contributionId: string;
    readonly registrationOrder: number;
    readonly value: Readonly<T>;
}
/**
 * Frozen bags of contributions collected by `PluginManager` before
 * {@link AssemblerEnvironment} validates targets and builds lookup maps.
 */
export interface EnvironmentContributions {
    readonly manifests: readonly AssemblerPluginManifest[];
    readonly sessionStates: readonly OwnedContribution<SessionStateContribution<unknown>>[];
    readonly architectures: readonly OwnedContribution<ArchitectureContribution>[];
    readonly addressSpaces: readonly OwnedContribution<AddressSpaceContribution>[];
    readonly outputFormats: readonly OwnedContribution<OutputFormatContribution>[];
    readonly directiveSets: readonly OwnedContribution<DirectiveSetContribution>[];
    readonly expressionSets: readonly OwnedContribution<ExpressionSetContribution>[];
    readonly lifecycles: readonly OwnedContribution<LifecycleContribution>[];
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
    readonly manifests: readonly AssemblerPluginManifest[];
    readonly sessionStates: readonly OwnedContribution<SessionStateContribution<unknown>>[];
    /**
     * Indexes contributions, checks target alias uniqueness, then validates every target.
     * @param {EnvironmentContributions} contributions Manager-collected plugin graph.
     * @throws {PluginError} On alias collisions or an invalid target graph.
     */
    constructor(contributions: EnvironmentContributions);
    /**
     * Resolves a target contribution id or alias to the canonical target id.
     * @param {string} idOrAlias Target id or alias (case-insensitive).
     * @returns {string | undefined} Canonical target id, or `undefined` if unknown.
     */
    resolveTargetId(idOrAlias: string): string | undefined;
    /**
     * Looks up a target by id or alias.
     * @param {string} idOrAlias Target id or alias (case-insensitive).
     * @returns {Readonly<TargetContribution> | undefined} The target, if registered.
     */
    getTarget(idOrAlias: string): Readonly<TargetContribution> | undefined;
    /**
     * Frozen summaries of every registered target (for LSP/UI pickers).
     * @returns {readonly TargetSummary[]} Id, aliases, display name, defaults.
     */
    getTargetSummaries(): readonly TargetSummary[];
    /**
     * Resolves an architecture id or alias in the context of a target.
     * @param {string} targetId Target id or alias.
     * @param {string} idOrAlias Architecture contribution id or alias.
     * @returns {string | undefined} Canonical architecture id, or `undefined`.
     */
    resolveArchitectureId(targetId: string, idOrAlias: string): string | undefined;
    /**
     * Looks up an architecture contribution by canonical id (not alias).
     * @param {string} id Architecture contribution id.
     * @returns {Readonly<ArchitectureContribution> | undefined} The architecture, if registered.
     */
    getArchitecture(id: string): Readonly<ArchitectureContribution> | undefined;
    /**
     * Looks up an address-space contribution by id.
     * @param {string} id Address-space contribution id.
     * @returns {Readonly<AddressSpaceContribution> | undefined} The contribution, if registered.
     */
    getAddressSpace(id: string): Readonly<AddressSpaceContribution> | undefined;
    /**
     * Looks up an output-format contribution by id.
     * @param {string} id Output-format contribution id.
     * @returns {Readonly<OutputFormatContribution> | undefined} The contribution, if registered.
     */
    getOutputFormat(id: string): Readonly<OutputFormatContribution> | undefined;
    /**
     * Looks up a directive-set contribution by id.
     * @param {string} id Directive-set contribution id.
     * @returns {Readonly<DirectiveSetContribution> | undefined} The contribution, if registered.
     */
    getDirectiveSet(id: string): Readonly<DirectiveSetContribution> | undefined;
    /**
     * Looks up an expression-set contribution by id.
     * @param {string} id Expression-set contribution id.
     * @returns {Readonly<ExpressionSetContribution> | undefined} The contribution, if registered.
     */
    getExpressionSet(id: string): Readonly<ExpressionSetContribution> | undefined;
    /**
     * Looks up a lifecycle contribution by id.
     * @param {string} id Lifecycle contribution id.
     * @returns {Readonly<LifecycleContribution> | undefined} The contribution, if registered.
     */
    getLifecycle(id: string): Readonly<LifecycleContribution> | undefined;
    /**
     * Returns the plugin id that registered a contribution (any kind except session state).
     * @param {string} id Contribution id (case-insensitive).
     * @returns {string | undefined} Owning plugin id, or `undefined` if unknown.
     */
    getContributionOwner(id: string): string | undefined;
    /**
     * Lifecycle contributions wired to a target, sorted by registration order.
     * @param {string} targetId Target id or alias.
     * @returns {readonly OwnedContribution<LifecycleContribution>[]} Frozen, ordered records.
     * @throws {PluginError} If `targetId` does not resolve (`PLUGIN_TARGET_INVALID`).
     */
    getTargetLifecycles(targetId: string): readonly OwnedContribution<LifecycleContribution>[];
    /**
     * Builds the LSP/editor catalog for a target (instructions, directives, expressions).
     * @param {string} targetId Target id or alias.
     * @returns {ToolingCatalog} Frozen per-target tooling view.
     * @throws {PluginError} If `targetId` does not resolve (`PLUGIN_TARGET_INVALID`).
     */
    getToolingCatalog(targetId: string): ToolingCatalog;
}
//# sourceMappingURL=environment.d.ts.map