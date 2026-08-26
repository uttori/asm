import semver from "semver";

import type {
  AddressSpaceContribution,
  ArchitectureContribution,
  AssemblerPlugin,
  AssemblerPluginManifest,
  DirectiveSetContribution,
  ExpressionSetContribution,
  LifecycleContribution,
  OutputFormatContribution,
  PluginActivationContext,
  PluginDisposable,
  PluginLogger,
  SessionStateContribution,
  SessionStateKey,
  TargetContribution,
} from "./contracts.js";
import { PLUGIN_API_VERSION } from "./contracts.js";
import { CORE_DIRECTIVE_GROUPS } from "../directive-groups.js";
import { PluginError } from "./diagnostics.js";
import {
  AssemblerEnvironment,
  type EnvironmentContributions,
  type OwnedContribution,
} from "./environment.js";

export interface PluginActivationRequest {
  readonly plugin: AssemblerPlugin<unknown>;
  readonly options?: unknown;
  readonly pluginModule?: string;
}

export interface PluginModuleActivationRequest {
  readonly module: unknown;
  readonly options?: unknown;
  readonly pluginModule: string;
}

export interface PluginManagerOptions {
  readonly logger?: PluginLogger;
}

interface PluginTransaction {
  readonly manifest: AssemblerPluginManifest;
  readonly module?: string;
  readonly sessionStates: OwnedContribution<SessionStateContribution<unknown>>[];
  readonly architectures: OwnedContribution<ArchitectureContribution>[];
  readonly addressSpaces: OwnedContribution<AddressSpaceContribution>[];
  readonly outputFormats: OwnedContribution<OutputFormatContribution>[];
  readonly directiveSets: OwnedContribution<DirectiveSetContribution>[];
  readonly expressionSets: OwnedContribution<ExpressionSetContribution>[];
  readonly lifecycles: OwnedContribution<LifecycleContribution>[];
  readonly targets: OwnedContribution<TargetContribution>[];
}

interface ActivatedPlugin {
  readonly manifest: AssemblerPluginManifest;
  readonly module?: string;
  readonly disposable?: PluginDisposable;
}

const noopLogger: PluginLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const isLowerAlphaNumeric = (character: string): boolean =>
  (character >= "a" && character <= "z") || (character >= "0" && character <= "9");

const isValidId = (value: string): boolean => {
  if (value.length === 0 || value[0] < "a" || value[0] > "z") return false;
  let previousWasSeparator = false;
  for (const character of value) {
    const separator = character === "." || character === "-";
    if (!isLowerAlphaNumeric(character) && !separator) return false;
    if (separator && previousWasSeparator) return false;
    previousWasSeparator = separator;
  }
  return !previousWasSeparator;
};

const isValidContributionId = (value: string): boolean => value.includes(".") && isValidId(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isArray = (value: unknown): boolean => Array.isArray(value);

const isEmptyOptions = (value: unknown): boolean =>
  value === undefined || (isRecord(value) && Object.keys(value).length === 0);

const deepFreeze = <T>(value: T, seen = new Set<unknown>()): Readonly<T> => {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null ||
    seen.has(value)
  ) {
    return value;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item, seen);
  } else {
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item, seen);
  }
  return Object.freeze(value);
};

const validateText = (value: unknown, field: string, pluginId?: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PluginError(`Plugin field '${field}' must be a non-empty string.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId,
    });
  }
  return value;
};

const validateManifest = (manifest: unknown, pluginModule?: string): AssemblerPluginManifest => {
  if (!isRecord(manifest)) {
    throw new PluginError("Plugin manifest must be an object.", {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginModule,
    });
  }
  const id = validateText(manifest.id, "id");
  if (!isValidId(id)) {
    throw new PluginError(`Plugin ID '${id}' is invalid.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId: id,
      pluginModule,
    });
  }
  const name = validateText(manifest.name, "name", id);
  const version = validateText(manifest.version, "version", id);
  if (!semver.valid(version)) {
    throw new PluginError(`Plugin '${id}' has invalid semantic version '${version}'.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId: id,
      pluginModule,
    });
  }
  if (manifest.apiVersion !== PLUGIN_API_VERSION) {
    throw new PluginError(
      `Plugin '${id}' requires plugin API ${String(manifest.apiVersion)}; this host supports ${PLUGIN_API_VERSION}.`,
      { code: "PLUGIN_API_INCOMPATIBLE", pluginId: id, pluginModule },
    );
  }
  if (manifest.description !== undefined && typeof manifest.description !== "string") {
    throw new PluginError(`Plugin '${id}' description must be a string.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId: id,
      pluginModule,
    });
  }
  if (manifest.requires !== undefined && !Array.isArray(manifest.requires)) {
    throw new PluginError(`Plugin '${id}' dependencies must be an array.`, {
      code: "PLUGIN_INVALID_MANIFEST",
      pluginId: id,
      pluginModule,
    });
  }
  const requires = (manifest.requires ?? []).map((dependency) => {
    if (!isRecord(dependency)) {
      throw new PluginError(`Plugin '${id}' has a malformed dependency.`, {
        code: "PLUGIN_INVALID_MANIFEST",
        pluginId: id,
        pluginModule,
      });
    }
    const pluginId = validateText(dependency.pluginId, "requires.pluginId", id);
    const range = validateText(dependency.version, "requires.version", id);
    if (!isValidId(pluginId) || !semver.validRange(range)) {
      throw new PluginError(`Plugin '${id}' has invalid dependency '${pluginId}@${range}'.`, {
        code: "PLUGIN_INVALID_MANIFEST",
        pluginId: id,
        pluginModule,
      });
    }
    return { pluginId, version: range };
  });
  return deepFreeze({
    id,
    name,
    version,
    apiVersion: PLUGIN_API_VERSION,
    ...(manifest.description === undefined ? {} : { description: manifest.description }),
    ...(requires.length === 0 ? {} : { requires }),
  });
};

const validatePlugin = (value: unknown, pluginModule?: string): AssemblerPlugin<unknown> => {
  if (!isRecord(value) || typeof value.activate !== "function") {
    throw new PluginError(
      `Module '${pluginModule ?? "<programmatic>"}' has no valid default plugin export.`,
      {
        code: "PLUGIN_INVALID_EXPORT",
        pluginModule,
      },
    );
  }
  const manifest = validateManifest(value.manifest, pluginModule);
  if (value.validateOptions !== undefined && typeof value.validateOptions !== "function") {
    throw new PluginError(`Plugin '${manifest.id}' validateOptions must be a function.`, {
      code: "PLUGIN_INVALID_EXPORT",
      pluginId: manifest.id,
      pluginModule,
    });
  }
  const plugin = value as unknown as AssemblerPlugin<unknown>;
  return {
    manifest,
    ...(plugin.validateOptions ? { validateOptions: plugin.validateOptions.bind(plugin) } : {}),
    activate: plugin.activate.bind(plugin),
  };
};

const validateContributionId = (id: unknown, pluginId: string): string => {
  if (typeof id !== "string" || !isValidContributionId(id)) {
    throw new PluginError(
      `Plugin '${pluginId}' registered invalid contribution ID '${String(id)}'.`,
      {
        code: "PLUGIN_CONFIGURATION_INVALID",
        pluginId,
        contributionId: typeof id === "string" ? id : undefined,
      },
    );
  }
  return id;
};

const validateAliases = (aliases: unknown, pluginId: string, contributionId: string): void => {
  if (aliases === undefined) return;
  if (
    !Array.isArray(aliases) ||
    aliases.some((alias) => typeof alias !== "string" || alias === "")
  ) {
    throw new PluginError(`Contribution '${contributionId}' has invalid aliases.`, {
      code: "PLUGIN_CONFIGURATION_INVALID",
      pluginId,
      contributionId,
    });
  }
};

export class PluginManager implements PluginDisposable {
  readonly #logger: PluginLogger;
  readonly #activated: ActivatedPlugin[] = [];
  readonly #manifests = new Map<string, AssemblerPluginManifest>();
  readonly #contributionOwners = new Map<string, string>();
  readonly #sessionStates: OwnedContribution<SessionStateContribution<unknown>>[] = [];
  readonly #architectures: OwnedContribution<ArchitectureContribution>[] = [];
  readonly #addressSpaces: OwnedContribution<AddressSpaceContribution>[] = [];
  readonly #outputFormats: OwnedContribution<OutputFormatContribution>[] = [];
  readonly #directiveSets: OwnedContribution<DirectiveSetContribution>[] = [];
  readonly #expressionSets: OwnedContribution<ExpressionSetContribution>[] = [];
  readonly #lifecycles: OwnedContribution<LifecycleContribution>[] = [];
  readonly #targets: OwnedContribution<TargetContribution>[] = [];
  #registrationOrder = 0;
  #environment?: AssemblerEnvironment;
  #disposed = false;

  constructor(options: PluginManagerOptions = {}) {
    this.#logger = options.logger ?? noopLogger;
  }

  get activatedPlugins(): readonly AssemblerPluginManifest[] {
    return this.#activated.map((item) => item.manifest);
  }

  async activateModules(requests: readonly PluginModuleActivationRequest[]): Promise<void> {
    const normalized = requests.map((request) => {
      if (!isRecord(request.module) || !("default" in request.module)) {
        throw new PluginError(`Module '${request.pluginModule}' has no default export.`, {
          code: "PLUGIN_INVALID_EXPORT",
          pluginModule: request.pluginModule,
        });
      }
      return {
        plugin: validatePlugin(request.module.default, request.pluginModule),
        options: request.options,
        pluginModule: request.pluginModule,
      };
    });
    await this.activatePlugins(normalized);
  }

  async activatePlugins(requests: readonly PluginActivationRequest[]): Promise<void> {
    if (this.#disposed) {
      throw new PluginError("Cannot activate plugins after the manager has been disposed.", {
        code: "PLUGIN_ACTIVATION_FAILED",
      });
    }
    if (this.#environment) {
      throw new PluginError("Cannot activate plugins after the environment has been frozen.", {
        code: "PLUGIN_ACTIVATION_FAILED",
      });
    }

    const normalized = requests.map((request) => ({
      ...request,
      plugin: validatePlugin(request.plugin, request.pluginModule),
    }));
    const pending = new Map<string, (typeof normalized)[number]>();
    for (const request of normalized) {
      const id = request.plugin.manifest.id;
      if (this.#manifests.has(id) || pending.has(id)) {
        throw new PluginError(`Duplicate plugin ID '${id}'.`, {
          code: "PLUGIN_CONTRIBUTION_DUPLICATE",
          pluginId: id,
          pluginModule: request.pluginModule,
        });
      }
      pending.set(id, request);
    }

    const available = new Map(this.#manifests);
    for (const [id, request] of pending) available.set(id, request.plugin.manifest);
    for (const request of normalized) {
      for (const dependency of request.plugin.manifest.requires ?? []) {
        const installed = available.get(dependency.pluginId);
        if (!installed) {
          throw new PluginError(
            `Plugin '${request.plugin.manifest.id}' requires missing plugin '${dependency.pluginId}'.`,
            {
              code: "PLUGIN_DEPENDENCY_MISSING",
              pluginId: request.plugin.manifest.id,
              pluginModule: request.pluginModule,
            },
          );
        }
        if (!semver.satisfies(installed.version, dependency.version)) {
          throw new PluginError(
            `Plugin '${request.plugin.manifest.id}' requires '${dependency.pluginId}@${dependency.version}', but ${installed.version} is active.`,
            {
              code: "PLUGIN_DEPENDENCY_INCOMPATIBLE",
              pluginId: request.plugin.manifest.id,
              pluginModule: request.pluginModule,
            },
          );
        }
      }
    }

    const activatedThisCall = new Set(this.#manifests.keys());
    while (pending.size > 0) {
      const ready = [...pending.values()].find((request) =>
        (request.plugin.manifest.requires ?? []).every((dependency) =>
          activatedThisCall.has(dependency.pluginId),
        ),
      );
      if (!ready) {
        const ids = [...pending.keys()].join(", ");
        throw new PluginError(`Plugin dependency cycle among: ${ids}.`, {
          code: "PLUGIN_DEPENDENCY_CYCLE",
        });
      }
      await this.#activateOne(ready);
      pending.delete(ready.plugin.manifest.id);
      activatedThisCall.add(ready.plugin.manifest.id);
    }
  }

  async #activateOne(request: PluginActivationRequest): Promise<void> {
    const plugin = request.plugin;
    const manifest = plugin.manifest;
    let options: unknown;
    try {
      if (plugin.validateOptions) {
        options = plugin.validateOptions(request.options);
      } else if (isEmptyOptions(request.options)) {
        options = {};
      } else {
        throw new PluginError(`Plugin '${manifest.id}' does not accept options.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: manifest.id,
          pluginModule: request.pluginModule,
        });
      }
    } catch (error) {
      if (error instanceof PluginError) throw error;
      throw new PluginError(`Configuration for plugin '${manifest.id}' is invalid.`, {
        code: "PLUGIN_CONFIGURATION_INVALID",
        pluginId: manifest.id,
        pluginModule: request.pluginModule,
        cause: error,
      });
    }
    const frozenOptions = deepFreeze(options);
    const transaction = this.#createTransaction(manifest, request.pluginModule);
    const context = this.#createActivationContext(transaction, frozenOptions);
    let disposable: void | PluginDisposable;
    try {
      disposable = await plugin.activate(context, frozenOptions);
      if (
        disposable !== undefined &&
        (!isRecord(disposable) || typeof disposable.dispose !== "function")
      ) {
        throw new Error("activate() returned an invalid disposable.");
      }
      this.#validateTransaction(transaction);
      this.#commit(transaction);
      this.#activated.push({
        manifest,
        module: request.pluginModule,
        disposable: disposable ?? undefined,
      });
      this.#manifests.set(manifest.id, manifest);
    } catch (error) {
      if (disposable) await disposable.dispose();
      if (error instanceof PluginError) throw error;
      throw new PluginError(`Activation failed for plugin '${manifest.id}'.`, {
        code: "PLUGIN_ACTIVATION_FAILED",
        pluginId: manifest.id,
        pluginModule: request.pluginModule,
        cause: error,
      });
    }
  }

  #createTransaction(manifest: AssemblerPluginManifest, module?: string): PluginTransaction {
    return {
      manifest,
      module,
      sessionStates: [],
      architectures: [],
      addressSpaces: [],
      outputFormats: [],
      directiveSets: [],
      expressionSets: [],
      lifecycles: [],
      targets: [],
    };
  }

  #createActivationContext<Options>(
    transaction: PluginTransaction,
    options: Readonly<Options>,
  ): PluginActivationContext<Options> {
    const add = <T>(list: OwnedContribution<T>[], contribution: T & { id: string }): void => {
      const contributionId = validateContributionId(contribution.id, transaction.manifest.id);
      list.push({
        pluginId: transaction.manifest.id,
        contributionId,
        registrationOrder: this.#registrationOrder++,
        value: contribution,
      });
    };
    const logger = this.#namespacedLogger(transaction.manifest.id);
    return Object.freeze({
      pluginId: transaction.manifest.id,
      logger,
      options,
      registerSessionState: <T>(contribution: SessionStateContribution<T>): SessionStateKey<T> => {
        add(
          transaction.sessionStates,
          contribution as unknown as SessionStateContribution<unknown>,
        );
        return Object.freeze({ id: contribution.id }) as SessionStateKey<T>;
      },
      registerArchitecture: (contribution: ArchitectureContribution) =>
        add(transaction.architectures, contribution),
      registerAddressSpace: (contribution: AddressSpaceContribution) =>
        add(transaction.addressSpaces, contribution),
      registerOutputFormat: (contribution: OutputFormatContribution) =>
        add(transaction.outputFormats, contribution),
      registerDirectiveSet: (contribution: DirectiveSetContribution) =>
        add(transaction.directiveSets, contribution),
      registerExpressionSet: (contribution: ExpressionSetContribution) =>
        add(transaction.expressionSets, contribution),
      registerLifecycle: (contribution: LifecycleContribution) =>
        add(transaction.lifecycles, contribution),
      registerTarget: (contribution: TargetContribution) => add(transaction.targets, contribution),
    });
  }

  #namespacedLogger(pluginId: string): PluginLogger {
    const log =
      (level: keyof PluginLogger) =>
      (message: string, details?: Readonly<Record<string, unknown>>): void =>
        this.#logger[level](`[${pluginId}] ${message}`, details);
    return Object.freeze({
      debug: log("debug"),
      info: log("info"),
      warn: log("warn"),
      error: log("error"),
    });
  }

  #validateTransaction(transaction: PluginTransaction): void {
    const local = new Set<string>();
    const all = [
      ...transaction.sessionStates,
      ...transaction.architectures,
      ...transaction.addressSpaces,
      ...transaction.outputFormats,
      ...transaction.directiveSets,
      ...transaction.expressionSets,
      ...transaction.lifecycles,
      ...transaction.targets,
    ];
    for (const record of all) {
      const id = record.contributionId.toLowerCase();
      const existingOwner = this.#contributionOwners.get(id);
      if (existingOwner || local.has(id)) {
        throw new PluginError(
          `Contribution '${record.contributionId}' from '${transaction.manifest.id}' conflicts with owner '${existingOwner ?? transaction.manifest.id}'.`,
          {
            code: "PLUGIN_CONTRIBUTION_DUPLICATE",
            pluginId: transaction.manifest.id,
            pluginModule: transaction.module,
            contributionId: record.contributionId,
          },
        );
      }
      local.add(id);
    }
    for (const record of transaction.architectures) {
      validateAliases(record.value.aliases, transaction.manifest.id, record.contributionId);
      if (
        typeof record.value.displayName !== "string" ||
        typeof record.value.createEncoder !== "function" ||
        typeof record.value.classifyOperand !== "function" ||
        typeof record.value.splitOperands !== "function" ||
        !isArray(record.value.instructions)
      ) {
        throw new PluginError(`Architecture '${record.contributionId}' is malformed.`, {
          code: "PLUGIN_CONFIGURATION_INVALID",
          pluginId: transaction.manifest.id,
          contributionId: record.contributionId,
        });
      }
    }
    for (const record of transaction.addressSpaces) {
      if (typeof record.value.create !== "function") this.#malformed(transaction, record);
    }
    for (const record of transaction.outputFormats) {
      if (typeof record.value.create !== "function") this.#malformed(transaction, record);
    }
    for (const record of transaction.sessionStates) {
      if (typeof record.value.create !== "function" || typeof record.value.clone !== "function") {
        this.#malformed(transaction, record);
      }
    }
    for (const record of transaction.directiveSets) {
      if (
        !isArray(record.value.directives) ||
        (record.value.tooling !== undefined && !isArray(record.value.tooling))
      ) {
        this.#malformed(transaction, record);
      }
      for (const directive of record.value.directives) {
        validateContributionId(directive.id, transaction.manifest.id);
        if (
          local.has(directive.id.toLowerCase()) ||
          this.#contributionOwners.has(directive.id.toLowerCase())
        ) {
          throw new PluginError(`Duplicate directive contribution '${directive.id}'.`, {
            code: "PLUGIN_CONTRIBUTION_DUPLICATE",
            pluginId: transaction.manifest.id,
            contributionId: directive.id,
          });
        }
        local.add(directive.id.toLowerCase());
        if (
          !isArray(directive.keywords) ||
          directive.keywords.length === 0 ||
          directive.keywords.some(
            (keyword: unknown) => typeof keyword !== "string" || keyword === "",
          ) ||
          typeof directive.createHandler !== "function" ||
          !isArray(directive.tooling)
        ) {
          throw new PluginError(`Directive '${directive.id}' is malformed.`, {
            code: "PLUGIN_CONFIGURATION_INVALID",
            pluginId: transaction.manifest.id,
            contributionId: directive.id,
          });
        }
      }
    }
    for (const record of transaction.expressionSets) {
      if (!isArray(record.value.functions)) this.#malformed(transaction, record);
      for (const expression of record.value.functions) {
        validateAliases(expression.aliases, transaction.manifest.id, record.contributionId);
        if (
          typeof expression.name !== "string" ||
          expression.name === "" ||
          typeof expression.evaluate !== "function" ||
          typeof expression.summary !== "string" ||
          !isRecord(expression.signature)
        ) {
          this.#malformed(transaction, record);
        }
      }
    }
    for (const record of transaction.lifecycles) {
      if (typeof record.value.create !== "function") this.#malformed(transaction, record);
    }
    for (const record of transaction.targets) {
      validateAliases(record.value.aliases, transaction.manifest.id, record.contributionId);
      if (
        typeof record.value.displayName !== "string" ||
        typeof record.value.defaultArchitecture !== "string" ||
        !isArray(record.value.architectures) ||
        typeof record.value.addressSpace !== "string" ||
        typeof record.value.outputFormat !== "string" ||
        !isArray(record.value.directiveSets) ||
        (record.value.coreDirectiveGroups !== undefined &&
          (!isArray(record.value.coreDirectiveGroups) ||
            record.value.coreDirectiveGroups.some(
              (group: unknown) =>
                typeof group !== "string" ||
                !(CORE_DIRECTIVE_GROUPS as readonly string[]).includes(group),
            ))) ||
        !isArray(record.value.expressionSets) ||
        !isArray(record.value.lifecycle) ||
        (record.value.syntaxProfile !== undefined &&
          (typeof record.value.syntaxProfile.id !== "string" ||
            typeof record.value.syntaxProfile.preserveLeadingWhitespace !== "boolean" ||
            typeof record.value.syntaxProfile.splitColonStatements !== "boolean" ||
            typeof record.value.syntaxProfile.splitRelativeLabelStatements !== "boolean" ||
            typeof record.value.syntaxProfile.leadingDotLabels !== "boolean" ||
            !isArray(record.value.syntaxProfile.directivePrefixes))) ||
        typeof record.value.defaultOutputExtension !== "string"
      ) {
        this.#malformed(transaction, record);
      }
    }
  }

  #malformed(transaction: PluginTransaction, record: OwnedContribution<unknown>): never {
    throw new PluginError(`Contribution '${record.contributionId}' is malformed.`, {
      code: "PLUGIN_CONFIGURATION_INVALID",
      pluginId: transaction.manifest.id,
      pluginModule: transaction.module,
      contributionId: record.contributionId,
    });
  }

  #commit(transaction: PluginTransaction): void {
    const lists = [
      transaction.sessionStates,
      transaction.architectures,
      transaction.addressSpaces,
      transaction.outputFormats,
      transaction.directiveSets,
      transaction.expressionSets,
      transaction.lifecycles,
      transaction.targets,
    ];
    for (const list of lists) {
      for (const record of list) {
        this.#contributionOwners.set(record.contributionId.toLowerCase(), record.pluginId);
        deepFreeze(record.value);
        Object.freeze(record);
      }
    }
    for (const set of transaction.directiveSets) {
      for (const directive of set.value.directives) {
        this.#contributionOwners.set(directive.id.toLowerCase(), set.pluginId);
      }
    }
    this.#sessionStates.push(...transaction.sessionStates);
    this.#architectures.push(...transaction.architectures);
    this.#addressSpaces.push(...transaction.addressSpaces);
    this.#outputFormats.push(...transaction.outputFormats);
    this.#directiveSets.push(...transaction.directiveSets);
    this.#expressionSets.push(...transaction.expressionSets);
    this.#lifecycles.push(...transaction.lifecycles);
    this.#targets.push(...transaction.targets);
  }

  freeze(): AssemblerEnvironment {
    if (this.#disposed) {
      throw new PluginError("Cannot freeze a disposed plugin manager.", {
        code: "PLUGIN_ACTIVATION_FAILED",
      });
    }
    if (this.#environment) return this.#environment;
    const contributions: EnvironmentContributions = {
      manifests: deepFreeze([...this.#manifests.values()]),
      sessionStates: Object.freeze([...this.#sessionStates]),
      architectures: Object.freeze([...this.#architectures]),
      addressSpaces: Object.freeze([...this.#addressSpaces]),
      outputFormats: Object.freeze([...this.#outputFormats]),
      directiveSets: Object.freeze([...this.#directiveSets]),
      expressionSets: Object.freeze([...this.#expressionSets]),
      lifecycles: Object.freeze([...this.#lifecycles]),
      targets: Object.freeze([...this.#targets]),
    };
    this.#environment = new AssemblerEnvironment(contributions);
    return this.#environment;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    const errors: unknown[] = [];
    for (const plugin of [...this.#activated].reverse()) {
      try {
        await plugin.disposable?.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "One or more plugins failed to dispose.");
    }
  }
}
