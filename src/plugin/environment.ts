import type { InstructionDescriptor } from "../architecture-types.js";
import type { DirectiveDescriptor } from "../lsp/directive-catalog.js";
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

export interface OwnedContribution<T> {
  readonly pluginId: string;
  readonly contributionId: string;
  readonly registrationOrder: number;
  readonly value: Readonly<T>;
}

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

const canonical = (value: string): string => value.toLowerCase();

const toMap = <T>(records: readonly OwnedContribution<T>[]): Map<string, OwnedContribution<T>> =>
  new Map(records.map((record) => [canonical(record.contributionId), record]));

const targetInvalid = (target: OwnedContribution<TargetContribution>, message: string): never => {
  throw new PluginError(`Invalid target '${target.contributionId}': ${message}`, {
    code: "PLUGIN_TARGET_INVALID",
    pluginId: target.pluginId,
    contributionId: target.contributionId,
    targetId: target.contributionId,
  });
};

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

  getInstructions(architecture: string): readonly InstructionDescriptor[] {
    const id = this.architectureAliases.get(canonical(architecture)) ?? canonical(architecture);
    if (!this.target.architectures.map(canonical).includes(id)) {
      return [];
    }
    return this.architectures.get(id)?.value.instructions ?? [];
  }

  getDirectives(): readonly DirectiveDescriptor[] {
    return this.target.directiveSets.flatMap((id) => {
      const set = this.directiveSets.get(canonical(id))?.value;
      return set ? [...(set.tooling ?? []), ...set.directives.flatMap((item) => item.tooling)] : [];
    });
  }

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

  resolveTargetId(idOrAlias: string): string | undefined {
    return this.#targetAliases.get(canonical(idOrAlias));
  }

  getTarget(idOrAlias: string): Readonly<TargetContribution> | undefined {
    const id = this.resolveTargetId(idOrAlias);
    return id ? this.#targets.get(canonical(id))?.value : undefined;
  }

  resolveArchitectureId(targetId: string, idOrAlias: string): string | undefined {
    const id = this.resolveTargetId(targetId);
    return id ? this.#architectureAliasesByTarget.get(id)?.get(canonical(idOrAlias)) : undefined;
  }

  getArchitecture(id: string): Readonly<ArchitectureContribution> | undefined {
    return this.#architectures.get(canonical(id))?.value;
  }

  getAddressSpace(id: string): Readonly<AddressSpaceContribution> | undefined {
    return this.#addressSpaces.get(canonical(id))?.value;
  }

  getOutputFormat(id: string): Readonly<OutputFormatContribution> | undefined {
    return this.#outputFormats.get(canonical(id))?.value;
  }

  getDirectiveSet(id: string): Readonly<DirectiveSetContribution> | undefined {
    return this.#directiveSets.get(canonical(id))?.value;
  }

  getExpressionSet(id: string): Readonly<ExpressionSetContribution> | undefined {
    return this.#expressionSets.get(canonical(id))?.value;
  }

  getLifecycle(id: string): Readonly<LifecycleContribution> | undefined {
    return this.#lifecycles.get(canonical(id))?.value;
  }

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
        this.#architectureAliasesByTarget.get(resolvedId) ?? new Map(),
        this.#directiveSets,
        this.#expressionSets,
        this.#targetRecords,
      ),
    );
  }
}
