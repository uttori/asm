import type { InstructionDescriptor } from "../architecture-types.js";
import { directiveCatalog, type DirectiveDescriptor } from "../lsp/directive-catalog.js";
import { CORE_DIRECTIVE_GROUPS } from "../directive-groups.js";
import { PluginError } from "./diagnostics.js";
import type {
  ArchitectureContribution,
  ArchitectureSummary,
  AssemblerPluginManifest,
  DirectiveSetContribution,
  ExpressionFunctionDescriptor,
  ExpressionSetContribution,
  LifecycleContribution,
  OutputFormatContribution,
  SessionStateContribution,
  TargetContribution,
  TargetSummary,
  ToolingCatalog,
  AddressSpaceContribution,
} from "./contracts.js";

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
 * Case-folds contribution ids and aliases so lookups are case-insensitive.
 * @param {string} value Id or alias.
 * @returns {string} Lowercased key.
 */
const canonical = (value: string): string => value.toLowerCase();

/**
 * Indexes owned contributions by canonical contribution id.
 * Duplicate ids last-write-win; the manager already rejects duplicates before freeze.
 * @param {readonly OwnedContribution<T>[]} records Contribution records to index.
 * @returns {Map<string, OwnedContribution<T>>} Canonical id → record.
 */
const toMap = <T>(records: readonly OwnedContribution<T>[]): Map<string, OwnedContribution<T>> =>
  new Map(records.map((record) => [canonical(record.contributionId), record]));

/**
 * Throws a `PLUGIN_TARGET_INVALID` diagnostic for a broken target graph.
 * @param {OwnedContribution<TargetContribution>} target The invalid target record.
 * @param {string} message Human-readable reason appended after the target id.
 * @returns {never} Always throws.
 */
const targetInvalid = (target: OwnedContribution<TargetContribution>, message: string): never => {
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
class ResolvedToolingCatalog implements ToolingCatalog {
  constructor(
    private readonly target: TargetContribution,
    private readonly architectures: ReadonlyMap<
      string,
      OwnedContribution<ArchitectureContribution>
    >,
    private readonly architectureAliases: ReadonlyMap<string, string>,
    private readonly directiveSets: ReadonlyMap<
      string,
      OwnedContribution<DirectiveSetContribution>
    >,
    private readonly expressionSets: ReadonlyMap<
      string,
      OwnedContribution<ExpressionSetContribution>
    >,
    private readonly targets: readonly OwnedContribution<TargetContribution>[],
  ) {}

  /**
   * Instruction catalog for an architecture id or alias on this target.
   * Unknown architectures, or ones not listed on the target, yield an empty list.
   * @param {string} architecture Architecture contribution id or alias.
   * @returns {readonly InstructionDescriptor[]} Instruction descriptors, possibly empty.
   */
  getInstructions(architecture: string): readonly InstructionDescriptor[] {
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
  getDirectives(): readonly DirectiveDescriptor[] {
    const enabledCoreGroups = new Set<string>(
      this.target.coreDirectiveGroups ?? CORE_DIRECTIVE_GROUPS,
    );
    const core = directiveCatalog.filter((descriptor) => enabledCoreGroups.has(descriptor.group));
    const contributed = this.target.directiveSets.flatMap((id) => {
      const set = this.directiveSets.get(canonical(id))?.value;
      return set ? [...(set.tooling ?? []), ...set.directives.flatMap((item) => item.tooling)] : [];
    });
    return Object.freeze([
      ...new Map(
        [...core, ...contributed].map((descriptor) => [canonical(descriptor.keyword), descriptor]),
      ).values(),
    ]);
  }

  /**
   * Expression functions contributed by this target's expression sets.
   * @returns {readonly ExpressionFunctionDescriptor[]} Name, aliases, signature, summary.
   */
  getExpressionFunctions(): readonly ExpressionFunctionDescriptor[] {
    return this.target.expressionSets.flatMap(
      (id) =>
        this.expressionSets.get(canonical(id))?.value.functions.map((item) => ({
          name: item.name,
          aliases: item.aliases ?? [],
          signature: item.signature,
          summary: item.summary,
        })) ?? [],
    );
  }

  /**
   * Architectures listed on this target. Missing contributions are skipped.
   * @returns {readonly ArchitectureSummary[]} Id, aliases, and display name.
   */
  getArchitectures(): readonly ArchitectureSummary[] {
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
  getTargets(): readonly TargetSummary[] {
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
  readonly manifests: readonly AssemblerPluginManifest[];
  readonly sessionStates: readonly OwnedContribution<SessionStateContribution<unknown>>[];

  readonly #architectures: ReadonlyMap<string, OwnedContribution<ArchitectureContribution>>;
  readonly #addressSpaces: ReadonlyMap<string, OwnedContribution<AddressSpaceContribution>>;
  readonly #outputFormats: ReadonlyMap<string, OwnedContribution<OutputFormatContribution>>;
  readonly #directiveSets: ReadonlyMap<string, OwnedContribution<DirectiveSetContribution>>;
  readonly #expressionSets: ReadonlyMap<string, OwnedContribution<ExpressionSetContribution>>;
  readonly #lifecycles: ReadonlyMap<string, OwnedContribution<LifecycleContribution>>;
  readonly #targets: ReadonlyMap<string, OwnedContribution<TargetContribution>>;
  readonly #targetAliases: ReadonlyMap<string, string>;
  readonly #architectureAliasesByTarget: ReadonlyMap<string, ReadonlyMap<string, string>>;
  readonly #targetRecords: readonly OwnedContribution<TargetContribution>[];

  /**
   * Indexes contributions, checks target alias uniqueness, then validates every target.
   * @param {EnvironmentContributions} contributions Manager-collected plugin graph.
   * @throws {PluginError} On alias collisions or an invalid target graph.
   */
  constructor(contributions: EnvironmentContributions) {
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

    const targetAliases = new Map<string, string>();
    for (const target of contributions.targets) {
      for (const alias of [target.contributionId, ...(target.value.aliases ?? [])]) {
        const key = canonical(alias);
        const previous = targetAliases.get(key);
        if (previous && previous !== target.contributionId) {
          const previousOwner = this.#targets.get(canonical(previous))?.pluginId;
          throw new PluginError(
            `Target alias '${alias}' is owned by both '${previousOwner}' and '${target.pluginId}'.`,
            {
              code: "PLUGIN_ALIAS_DUPLICATE",
              pluginId: target.pluginId,
              contributionId: target.contributionId,
              targetId: target.contributionId,
            },
          );
        }
        targetAliases.set(key, target.contributionId);
      }
    }
    this.#targetAliases = targetAliases;

    const aliasesByTarget = new Map<string, ReadonlyMap<string, string>>();
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
  #validateTarget(
    targetRecord: OwnedContribution<TargetContribution>,
  ): ReadonlyMap<string, string> {
    const target = targetRecord.value;
    if (!this.#addressSpaces.has(canonical(target.addressSpace))) {
      targetInvalid(targetRecord, `missing address-space contribution '${target.addressSpace}'.`);
    }
    if (!this.#outputFormats.has(canonical(target.outputFormat))) {
      targetInvalid(targetRecord, `missing output-format contribution '${target.outputFormat}'.`);
    }
    if (
      !target.defaultOutputExtension.startsWith(".") ||
      target.defaultOutputExtension.length < 2
    ) {
      targetInvalid(targetRecord, "defaultOutputExtension must begin with '.'.");
    }

    const architectureIds = new Set(target.architectures.map(canonical));
    const aliases = new Map<string, string>();
    for (const architectureId of architectureIds) {
      const record = this.#architectures.get(architectureId);
      if (!record) {
        targetInvalid(targetRecord, `missing architecture contribution '${architectureId}'.`);
      }
      for (const alias of [record!.value.id, ...(record!.value.aliases ?? [])]) {
        const key = canonical(alias);
        const previous = aliases.get(key);
        if (previous && previous !== architectureId) {
          const previousOwner = this.#architectures.get(previous)?.pluginId;
          throw new PluginError(
            `Architecture alias '${alias}' in target '${target.id}' is owned by both '${previousOwner}' and '${record!.pluginId}'.`,
            {
              code: "PLUGIN_ALIAS_DUPLICATE",
              pluginId: record!.pluginId,
              contributionId: record!.contributionId,
              targetId: target.id,
            },
          );
        }
        aliases.set(key, architectureId);
      }
    }
    const defaultArchitecture = aliases.get(canonical(target.defaultArchitecture));
    if (!defaultArchitecture || !architectureIds.has(defaultArchitecture)) {
      targetInvalid(
        targetRecord,
        `default architecture '${target.defaultArchitecture}' is not available in this target.`,
      );
    }

    const directiveKeywords = new Map<string, { id: string; pluginId: string }>();
    for (const setId of target.directiveSets) {
      const set = this.#directiveSets.get(canonical(setId));
      if (!set) {
        targetInvalid(targetRecord, `missing directive-set contribution '${setId}'.`);
      }
      for (const directive of set!.value.directives) {
        for (const keyword of directive.keywords) {
          const key = canonical(keyword);
          const previous = directiveKeywords.get(key);
          if (previous) {
            targetInvalid(
              targetRecord,
              `directive keyword '${keyword}' is supplied by '${previous.id}' (${previous.pluginId}) and '${directive.id}' (${set!.pluginId}).`,
            );
          }
          directiveKeywords.set(key, { id: directive.id, pluginId: set!.pluginId });
        }
      }
    }

    const expressionNames = new Map<string, { name: string; pluginId: string }>();
    for (const setId of target.expressionSets) {
      const set = this.#expressionSets.get(canonical(setId));
      if (!set) {
        targetInvalid(targetRecord, `missing expression-set contribution '${setId}'.`);
      }
      for (const expression of set!.value.functions) {
        for (const name of [expression.name, ...(expression.aliases ?? [])]) {
          const key = canonical(name);
          const previous = expressionNames.get(key);
          if (previous) {
            targetInvalid(
              targetRecord,
              `expression function '${name}' is supplied by '${previous.name}' (${previous.pluginId}) and '${expression.name}' (${set!.pluginId}).`,
            );
          }
          expressionNames.set(key, { name: expression.name, pluginId: set!.pluginId });
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
  resolveTargetId(idOrAlias: string): string | undefined {
    return this.#targetAliases.get(canonical(idOrAlias));
  }

  /**
   * Looks up a target by id or alias.
   * @param {string} idOrAlias Target id or alias (case-insensitive).
   * @returns {Readonly<TargetContribution> | undefined} The target, if registered.
   */
  getTarget(idOrAlias: string): Readonly<TargetContribution> | undefined {
    const id = this.resolveTargetId(idOrAlias);
    return id ? this.#targets.get(canonical(id))?.value : undefined;
  }

  /**
   * Frozen summaries of every registered target (for LSP/UI pickers).
   * @returns {readonly TargetSummary[]} Id, aliases, display name, defaults.
   */
  getTargetSummaries(): readonly TargetSummary[] {
    return Object.freeze(
      this.#targetRecords.map(({ value }) =>
        Object.freeze({
          id: value.id,
          aliases: Object.freeze([...(value.aliases ?? [])]),
          displayName: value.displayName,
          defaultArchitecture: value.defaultArchitecture,
          defaultOutputExtension: value.defaultOutputExtension,
        }),
      ),
    );
  }

  /**
   * Resolves an architecture id or alias in the context of a target.
   * @param {string} targetId Target id or alias.
   * @param {string} idOrAlias Architecture contribution id or alias.
   * @returns {string | undefined} Canonical architecture id, or `undefined`.
   */
  resolveArchitectureId(targetId: string, idOrAlias: string): string | undefined {
    const id = this.resolveTargetId(targetId);
    return id ? this.#architectureAliasesByTarget.get(id)?.get(canonical(idOrAlias)) : undefined;
  }

  /**
   * Looks up an architecture contribution by canonical id (not alias).
   * @param {string} id Architecture contribution id.
   * @returns {Readonly<ArchitectureContribution> | undefined} The architecture, if registered.
   */
  getArchitecture(id: string): Readonly<ArchitectureContribution> | undefined {
    return this.#architectures.get(canonical(id))?.value;
  }

  /**
   * Looks up an address-space contribution by id.
   * @param {string} id Address-space contribution id.
   * @returns {Readonly<AddressSpaceContribution> | undefined} The contribution, if registered.
   */
  getAddressSpace(id: string): Readonly<AddressSpaceContribution> | undefined {
    return this.#addressSpaces.get(canonical(id))?.value;
  }

  /**
   * Looks up an output-format contribution by id.
   * @param {string} id Output-format contribution id.
   * @returns {Readonly<OutputFormatContribution> | undefined} The contribution, if registered.
   */
  getOutputFormat(id: string): Readonly<OutputFormatContribution> | undefined {
    return this.#outputFormats.get(canonical(id))?.value;
  }

  /**
   * Looks up a directive-set contribution by id.
   * @param {string} id Directive-set contribution id.
   * @returns {Readonly<DirectiveSetContribution> | undefined} The contribution, if registered.
   */
  getDirectiveSet(id: string): Readonly<DirectiveSetContribution> | undefined {
    return this.#directiveSets.get(canonical(id))?.value;
  }

  /**
   * Looks up an expression-set contribution by id.
   * @param {string} id Expression-set contribution id.
   * @returns {Readonly<ExpressionSetContribution> | undefined} The contribution, if registered.
   */
  getExpressionSet(id: string): Readonly<ExpressionSetContribution> | undefined {
    return this.#expressionSets.get(canonical(id))?.value;
  }

  /**
   * Looks up a lifecycle contribution by id.
   * @param {string} id Lifecycle contribution id.
   * @returns {Readonly<LifecycleContribution> | undefined} The contribution, if registered.
   */
  getLifecycle(id: string): Readonly<LifecycleContribution> | undefined {
    return this.#lifecycles.get(canonical(id))?.value;
  }

  /**
   * Returns the plugin id that registered a contribution (any kind except session state).
   * @param {string} id Contribution id (case-insensitive).
   * @returns {string | undefined} Owning plugin id, or `undefined` if unknown.
   */
  getContributionOwner(id: string): string | undefined {
    const key = canonical(id);
    return (
      this.#architectures.get(key)?.pluginId ??
      this.#addressSpaces.get(key)?.pluginId ??
      this.#outputFormats.get(key)?.pluginId ??
      this.#directiveSets.get(key)?.pluginId ??
      this.#expressionSets.get(key)?.pluginId ??
      this.#lifecycles.get(key)?.pluginId ??
      this.#targets.get(key)?.pluginId
    );
  }

  /**
   * Lifecycle contributions wired to a target, sorted by registration order.
   * @param {string} targetId Target id or alias.
   * @returns {readonly OwnedContribution<LifecycleContribution>[]} Frozen, ordered records.
   * @throws {PluginError} If `targetId` does not resolve (`PLUGIN_TARGET_INVALID`).
   */
  getTargetLifecycles(targetId: string): readonly OwnedContribution<LifecycleContribution>[] {
    const target = this.getTarget(targetId);
    if (!target) {
      throw new PluginError(`Unknown target '${targetId}'.`, {
        code: "PLUGIN_TARGET_INVALID",
        targetId,
      });
    }
    return Object.freeze(
      target.lifecycle
        .flatMap((id) => {
          const lifecycle = this.#lifecycles.get(canonical(id));
          return lifecycle ? [lifecycle] : [];
        })
        .sort((left, right) => left.registrationOrder - right.registrationOrder),
    );
  }

  /**
   * Builds the LSP/editor catalog for a target (instructions, directives, expressions).
   * @param {string} targetId Target id or alias.
   * @returns {ToolingCatalog} Frozen per-target tooling view.
   * @throws {PluginError} If `targetId` does not resolve (`PLUGIN_TARGET_INVALID`).
   */
  getToolingCatalog(targetId: string): ToolingCatalog {
    const resolvedId = this.resolveTargetId(targetId);
    const target = resolvedId ? this.#targets.get(canonical(resolvedId))?.value : undefined;
    if (!target || !resolvedId) {
      throw new PluginError(`Unknown target '${targetId}'.`, {
        code: "PLUGIN_TARGET_INVALID",
        targetId,
      });
    }
    return Object.freeze(
      new ResolvedToolingCatalog(
        target,
        this.#architectures,
        this.#architectureAliasesByTarget.get(resolvedId)!,
        this.#directiveSets,
        this.#expressionSets,
        this.#targetRecords,
      ),
    );
  }
}
