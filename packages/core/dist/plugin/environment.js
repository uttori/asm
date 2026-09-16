import { CORE_DIRECTIVE_GROUPS } from "../directive-groups.js";
import { directiveCatalog } from "../lsp/directive-catalog.js";
import { PluginError } from "./diagnostics.js";
/**
 * Case-folds contribution ids and aliases so lookups are case-insensitive.
 * @param {string} value Id or alias.
 * @returns {string} Lowercased key.
 */
const canonical = (value) => value.toLowerCase();
/**
 * Indexes owned contributions by canonical contribution id.
 * Duplicate ids last-write-win; the manager already rejects duplicates before freeze.
 * @param {readonly OwnedContribution<T>[]} records Contribution records to index.
 * @returns {Map<string, OwnedContribution<T>>} Canonical id → record.
 */
const toMap = (records) => new Map(records.map((record) => [canonical(record.contributionId), record]));
/**
 * Throws a `PLUGIN_TARGET_INVALID` diagnostic for a broken target graph.
 * @param {OwnedContribution<TargetContribution>} target The invalid target record.
 * @param {string} message Human-readable reason appended after the target id.
 * @returns {never} Always throws.
 */
const targetInvalid = (target, message) => {
    throw new PluginError(`Invalid target '${target.contributionId}': ${message}`, {
        code: "PLUGIN_TARGET_INVALID",
        pluginId: target.pluginId,
        contributionId: target.contributionId,
        targetId: target.contributionId,
    });
};
/**
 * Per-target tooling view: instructions, directives, expressions, and summaries
 * filtered to what that target actually wires up.
 */
class ResolvedToolingCatalog {
    target;
    architectures;
    architectureAliases;
    directiveSets;
    expressionSets;
    targets;
    constructor(target, architectures, architectureAliases, directiveSets, expressionSets, targets) {
        this.target = target;
        this.architectures = architectures;
        this.architectureAliases = architectureAliases;
        this.directiveSets = directiveSets;
        this.expressionSets = expressionSets;
        this.targets = targets;
    }
    /**
     * Instruction catalog for an architecture id or alias on this target.
     * Unknown architectures, or ones not listed on the target, yield an empty list.
     * @param {string} architecture Architecture contribution id or alias.
     * @returns {readonly InstructionDescriptor[]} Instruction descriptors, possibly empty.
     */
    getInstructions(architecture) {
        const id = this.architectureAliases.get(canonical(architecture)) ?? canonical(architecture);
        if (!this.target.architectures.some((arch) => canonical(arch) === id)) {
            return [];
        }
        return this.architectures.get(id)?.value.instructions ?? [];
    }
    /**
     * Core directive catalog (filtered by `coreDirectiveGroups`) plus this target's
     * contributed tooling. Later keywords win when a plugin overrides a core name.
     * @returns {readonly DirectiveDescriptor[]} Deduped directive descriptors.
     */
    getDirectives() {
        const enabledCoreGroups = new Set(this.target.coreDirectiveGroups ?? CORE_DIRECTIVE_GROUPS);
        const core = directiveCatalog.filter((descriptor) => enabledCoreGroups.has(descriptor.group));
        const contributed = this.target.directiveSets.flatMap((id) => {
            const set = this.directiveSets.get(canonical(id))?.value;
            return set ? [...(set.tooling ?? []), ...set.directives.flatMap((item) => item.tooling)] : [];
        });
        return Object.freeze([
            ...new Map([...core, ...contributed].map((descriptor) => [canonical(descriptor.keyword), descriptor])).values(),
        ]);
    }
    /**
     * Expression functions contributed by this target's expression sets.
     * @returns {readonly ExpressionFunctionDescriptor[]} Name, aliases, signature, summary.
     */
    getExpressionFunctions() {
        return this.target.expressionSets.flatMap((id) => this.expressionSets.get(canonical(id))?.value.functions.map((item) => ({
            name: item.name,
            aliases: item.aliases ?? [],
            signature: item.signature,
            summary: item.summary,
        })) ?? []);
    }
    /**
     * Architectures listed on this target. Missing contributions are skipped.
     * @returns {readonly ArchitectureSummary[]} Id, aliases, and display name.
     */
    getArchitectures() {
        return this.target.architectures.flatMap((id) => {
            const contribution = this.architectures.get(canonical(id))?.value;
            return contribution
                ? [
                    {
                        id: contribution.id,
                        aliases: contribution.aliases ?? [],
                        displayName: contribution.displayName,
                    },
                ]
                : [];
        });
    }
    /**
     * Every target in the environment, not only the one this catalog was built for.
     * @returns {readonly TargetSummary[]} Frozen-friendly summaries for UI/LSP.
     */
    getTargets() {
        return this.targets.map(({ value }) => ({
            id: value.id,
            aliases: value.aliases ?? [],
            displayName: value.displayName,
            defaultArchitecture: value.defaultArchitecture,
            defaultOutputExtension: value.defaultOutputExtension,
        }));
    }
}
/**
 * Frozen, validated view of every plugin contribution after `PluginManager.freeze()`.
 *
 * Construction checks that each target's address space, output format, architectures,
 * directive/expression sets, and lifecycles exist, that aliases and keywords do not
 * collide, and that `defaultArchitecture` / `defaultOutputExtension` are well-formed.
 */
export class AssemblerEnvironment {
    manifests;
    sessionStates;
    #architectures;
    #addressSpaces;
    #outputFormats;
    #directiveSets;
    #expressionSets;
    #lifecycles;
    #targets;
    #targetAliases;
    #architectureAliasesByTarget;
    #targetRecords;
    /**
     * Indexes contributions, checks target alias uniqueness, then validates every target.
     * @param {EnvironmentContributions} contributions Manager-collected plugin graph.
     * @throws {PluginError} On alias collisions or an invalid target graph.
     */
    constructor(contributions) {
        this.manifests = contributions.manifests;
        this.sessionStates = contributions.sessionStates;
        this.#architectures = toMap(contributions.architectures);
        this.#addressSpaces = toMap(contributions.addressSpaces);
        this.#outputFormats = toMap(contributions.outputFormats);
        this.#directiveSets = toMap(contributions.directiveSets);
        this.#expressionSets = toMap(contributions.expressionSets);
        this.#lifecycles = toMap(contributions.lifecycles);
        this.#targets = toMap(contributions.targets);
        this.#targetRecords = contributions.targets;
        const targetAliases = new Map();
        for (const target of contributions.targets) {
            for (const alias of [target.contributionId, ...(target.value.aliases ?? [])]) {
                const key = canonical(alias);
                const previous = targetAliases.get(key);
                if (previous && previous !== target.contributionId) {
                    const previousOwner = this.#targets.get(canonical(previous))?.pluginId;
                    throw new PluginError(`Target alias '${alias}' is owned by both '${previousOwner}' and '${target.pluginId}'.`, {
                        code: "PLUGIN_ALIAS_DUPLICATE",
                        pluginId: target.pluginId,
                        contributionId: target.contributionId,
                        targetId: target.contributionId,
                    });
                }
                targetAliases.set(key, target.contributionId);
            }
        }
        this.#targetAliases = targetAliases;
        const aliasesByTarget = new Map();
        for (const target of contributions.targets) {
            aliasesByTarget.set(target.contributionId, this.#validateTarget(target));
        }
        this.#architectureAliasesByTarget = aliasesByTarget;
        Object.freeze(this);
    }
    /**
     * Ensures a target's referenced contributions exist and that aliases, directive
     * keywords, and expression names are unique within that target.
     * @param {OwnedContribution<TargetContribution>} targetRecord The target to check.
     * @returns {ReadonlyMap<string, string>} Canonical architecture alias → contribution id.
     * @throws {PluginError} `PLUGIN_TARGET_INVALID` or `PLUGIN_ALIAS_DUPLICATE`.
     */
    #validateTarget(targetRecord) {
        const target = targetRecord.value;
        if (!this.#addressSpaces.has(canonical(target.addressSpace))) {
            targetInvalid(targetRecord, `missing address-space contribution '${target.addressSpace}'.`);
        }
        if (!this.#outputFormats.has(canonical(target.outputFormat))) {
            targetInvalid(targetRecord, `missing output-format contribution '${target.outputFormat}'.`);
        }
        if (!target.defaultOutputExtension.startsWith(".") ||
            target.defaultOutputExtension.length < 2) {
            targetInvalid(targetRecord, "defaultOutputExtension must begin with '.'.");
        }
        const architectureIds = new Set(target.architectures.map(canonical));
        const aliases = new Map();
        for (const architectureId of architectureIds) {
            const record = this.#architectures.get(architectureId);
            if (!record) {
                targetInvalid(targetRecord, `missing architecture contribution '${architectureId}'.`);
            }
            for (const alias of [record.value.id, ...(record.value.aliases ?? [])]) {
                const key = canonical(alias);
                const previous = aliases.get(key);
                if (previous && previous !== architectureId) {
                    const previousOwner = this.#architectures.get(previous)?.pluginId;
                    throw new PluginError(`Architecture alias '${alias}' in target '${target.id}' is owned by both '${previousOwner}' and '${record.pluginId}'.`, {
                        code: "PLUGIN_ALIAS_DUPLICATE",
                        pluginId: record.pluginId,
                        contributionId: record.contributionId,
                        targetId: target.id,
                    });
                }
                aliases.set(key, architectureId);
            }
        }
        const defaultArchitecture = aliases.get(canonical(target.defaultArchitecture));
        if (!defaultArchitecture || !architectureIds.has(defaultArchitecture)) {
            targetInvalid(targetRecord, `default architecture '${target.defaultArchitecture}' is not available in this target.`);
        }
        const directiveKeywords = new Map();
        for (const setId of target.directiveSets) {
            const set = this.#directiveSets.get(canonical(setId));
            if (!set) {
                targetInvalid(targetRecord, `missing directive-set contribution '${setId}'.`);
            }
            for (const directive of set.value.directives) {
                for (const keyword of directive.keywords) {
                    const key = canonical(keyword);
                    const previous = directiveKeywords.get(key);
                    if (previous) {
                        targetInvalid(targetRecord, `directive keyword '${keyword}' is supplied by '${previous.id}' (${previous.pluginId}) and '${directive.id}' (${set.pluginId}).`);
                    }
                    directiveKeywords.set(key, { id: directive.id, pluginId: set.pluginId });
                }
            }
        }
        const expressionNames = new Map();
        for (const setId of target.expressionSets) {
            const set = this.#expressionSets.get(canonical(setId));
            if (!set) {
                targetInvalid(targetRecord, `missing expression-set contribution '${setId}'.`);
            }
            for (const expression of set.value.functions) {
                for (const name of [expression.name, ...(expression.aliases ?? [])]) {
                    const key = canonical(name);
                    const previous = expressionNames.get(key);
                    if (previous) {
                        targetInvalid(targetRecord, `expression function '${name}' is supplied by '${previous.name}' (${previous.pluginId}) and '${expression.name}' (${set.pluginId}).`);
                    }
                    expressionNames.set(key, { name: expression.name, pluginId: set.pluginId });
                }
            }
        }
        for (const lifecycleId of target.lifecycle) {
            if (!this.#lifecycles.has(canonical(lifecycleId))) {
                targetInvalid(targetRecord, `missing lifecycle contribution '${lifecycleId}'.`);
            }
        }
        return aliases;
    }
    /**
     * Resolves a target contribution id or alias to the canonical target id.
     * @param {string} idOrAlias Target id or alias (case-insensitive).
     * @returns {string | undefined} Canonical target id, or `undefined` if unknown.
     */
    resolveTargetId(idOrAlias) {
        return this.#targetAliases.get(canonical(idOrAlias));
    }
    /**
     * Looks up a target by id or alias.
     * @param {string} idOrAlias Target id or alias (case-insensitive).
     * @returns {Readonly<TargetContribution> | undefined} The target, if registered.
     */
    getTarget(idOrAlias) {
        const id = this.resolveTargetId(idOrAlias);
        return id ? this.#targets.get(canonical(id))?.value : undefined;
    }
    /**
     * Frozen summaries of every registered target (for LSP/UI pickers).
     * @returns {readonly TargetSummary[]} Id, aliases, display name, defaults.
     */
    getTargetSummaries() {
        return Object.freeze(this.#targetRecords.map(({ value }) => Object.freeze({
            id: value.id,
            aliases: Object.freeze([...(value.aliases ?? [])]),
            displayName: value.displayName,
            defaultArchitecture: value.defaultArchitecture,
            defaultOutputExtension: value.defaultOutputExtension,
        })));
    }
    /**
     * Resolves an architecture id or alias in the context of a target.
     * @param {string} targetId Target id or alias.
     * @param {string} idOrAlias Architecture contribution id or alias.
     * @returns {string | undefined} Canonical architecture id, or `undefined`.
     */
    resolveArchitectureId(targetId, idOrAlias) {
        const id = this.resolveTargetId(targetId);
        return id ? this.#architectureAliasesByTarget.get(id)?.get(canonical(idOrAlias)) : undefined;
    }
    /**
     * Looks up an architecture contribution by canonical id (not alias).
     * @param {string} id Architecture contribution id.
     * @returns {Readonly<ArchitectureContribution> | undefined} The architecture, if registered.
     */
    getArchitecture(id) {
        return this.#architectures.get(canonical(id))?.value;
    }
    /**
     * Looks up an address-space contribution by id.
     * @param {string} id Address-space contribution id.
     * @returns {Readonly<AddressSpaceContribution> | undefined} The contribution, if registered.
     */
    getAddressSpace(id) {
        return this.#addressSpaces.get(canonical(id))?.value;
    }
    /**
     * Looks up an output-format contribution by id.
     * @param {string} id Output-format contribution id.
     * @returns {Readonly<OutputFormatContribution> | undefined} The contribution, if registered.
     */
    getOutputFormat(id) {
        return this.#outputFormats.get(canonical(id))?.value;
    }
    /**
     * Looks up a directive-set contribution by id.
     * @param {string} id Directive-set contribution id.
     * @returns {Readonly<DirectiveSetContribution> | undefined} The contribution, if registered.
     */
    getDirectiveSet(id) {
        return this.#directiveSets.get(canonical(id))?.value;
    }
    /**
     * Looks up an expression-set contribution by id.
     * @param {string} id Expression-set contribution id.
     * @returns {Readonly<ExpressionSetContribution> | undefined} The contribution, if registered.
     */
    getExpressionSet(id) {
        return this.#expressionSets.get(canonical(id))?.value;
    }
    /**
     * Looks up a lifecycle contribution by id.
     * @param {string} id Lifecycle contribution id.
     * @returns {Readonly<LifecycleContribution> | undefined} The contribution, if registered.
     */
    getLifecycle(id) {
        return this.#lifecycles.get(canonical(id))?.value;
    }
    /**
     * Returns the plugin id that registered a contribution (any kind except session state).
     * @param {string} id Contribution id (case-insensitive).
     * @returns {string | undefined} Owning plugin id, or `undefined` if unknown.
     */
    getContributionOwner(id) {
        const key = canonical(id);
        return (this.#architectures.get(key)?.pluginId ??
            this.#addressSpaces.get(key)?.pluginId ??
            this.#outputFormats.get(key)?.pluginId ??
            this.#directiveSets.get(key)?.pluginId ??
            this.#expressionSets.get(key)?.pluginId ??
            this.#lifecycles.get(key)?.pluginId ??
            this.#targets.get(key)?.pluginId);
    }
    /**
     * Lifecycle contributions wired to a target, sorted by registration order.
     * @param {string} targetId Target id or alias.
     * @returns {readonly OwnedContribution<LifecycleContribution>[]} Frozen, ordered records.
     * @throws {PluginError} If `targetId` does not resolve (`PLUGIN_TARGET_INVALID`).
     */
    getTargetLifecycles(targetId) {
        const target = this.getTarget(targetId);
        if (!target) {
            throw new PluginError(`Unknown target '${targetId}'.`, {
                code: "PLUGIN_TARGET_INVALID",
                targetId,
            });
        }
        return Object.freeze(target.lifecycle
            .flatMap((id) => {
            const lifecycle = this.#lifecycles.get(canonical(id));
            return lifecycle ? [lifecycle] : [];
        })
            .sort((left, right) => left.registrationOrder - right.registrationOrder));
    }
    /**
     * Builds the LSP/editor catalog for a target (instructions, directives, expressions).
     * @param {string} targetId Target id or alias.
     * @returns {ToolingCatalog} Frozen per-target tooling view.
     * @throws {PluginError} If `targetId` does not resolve (`PLUGIN_TARGET_INVALID`).
     */
    getToolingCatalog(targetId) {
        const resolvedId = this.resolveTargetId(targetId);
        const target = resolvedId ? this.#targets.get(canonical(resolvedId))?.value : undefined;
        if (!target || !resolvedId) {
            throw new PluginError(`Unknown target '${targetId}'.`, {
                code: "PLUGIN_TARGET_INVALID",
                targetId,
            });
        }
        return Object.freeze(new ResolvedToolingCatalog(target, this.#architectures, this.#architectureAliasesByTarget.get(resolvedId), this.#directiveSets, this.#expressionSets, this.#targetRecords));
    }
}
//# sourceMappingURL=environment.js.map