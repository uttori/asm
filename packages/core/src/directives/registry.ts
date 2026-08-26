import type { NormalizedCommand } from "../ir/normalized-command.js";
import { CORE_DIRECTIVE_GROUPS, type CoreDirectiveGroup } from "../directive-groups.js";
import { registerDataDirectives } from "./data.js";
import { registerFillPadDirectives } from "./fill-pad.js";
import { registerFlowControlDirectives } from "./flow-control.js";
import { registerIncludeSourceDirectives } from "./include-source.js";
import { registerLayoutDirectives } from "./layout.js";
import { registerMiscDirectives } from "./misc.js";
import { registerNamespaceDirectives } from "./namespace.js";
import { registerStructBinaryDirectives } from "./struct-binary.js";
import type {
  AddressStackDirectiveContext,
  ArchitectureDirectiveContext,
  BaseLayoutDirectiveContext,
  DataDirectiveContext,
  FillPadDirectiveContext,
  FlowControlDirectiveContext,
  IncludeDirectiveContext,
  NarrowDirectiveHandler,
  NamespaceDirectiveContext,
  OrgDirectiveContext,
  RuntimeDirectiveContext,
  StructDirectiveContext,
  TableDirectiveContext,
  DiagnosticDirectiveContext,
} from "./types.js";
type BoundDirectiveHandler = (
  words: readonly string[],
  raw: string,
  command?: NormalizedCommand,
) => void;

export type DirectiveExecutionPhase = "preprocess" | "lowered";

export interface DirectiveRegistryContexts {
  data: DataDirectiveContext;
  fillPad: FillPadDirectiveContext;
  flowControl: FlowControlDirectiveContext;
  includeSource: IncludeDirectiveContext;
  layout: {
    addressStack: AddressStackDirectiveContext;
    architecture: ArchitectureDirectiveContext;
    base: BaseLayoutDirectiveContext;
    org: OrgDirectiveContext;
    runtime: RuntimeDirectiveContext;
  };
  namespace: NamespaceDirectiveContext;
  struct: StructDirectiveContext;
  table: TableDirectiveContext;
  diagnostic: DiagnosticDirectiveContext;
}

export class DirectiveRegistry {
  readonly handlers = new Map<string, BoundDirectiveHandler>();
  readonly phases = new Map<string, DirectiveExecutionPhase>();

  constructor(readonly directivePrefixes: readonly string[] = []) {}

  /**
   * Registers the value.
   * @param {string | string[]} keyword The keyword.
   * @param {Context} context The context.
   * @param {NarrowDirectiveHandler<Context>} handler The handler.
   * @param {DirectiveExecutionPhase} [phase] The directive execution phase.
   */
  register<Context>(
    keyword: string | string[],
    context: Context,
    handler: NarrowDirectiveHandler<Context>,
    phase: DirectiveExecutionPhase = "preprocess",
  ): void {
    const keywords = Array.isArray(keyword) ? keyword : [keyword];
    for (const entry of keywords) {
      this.handlers.set(entry, (words, raw, command) => handler(context, words, raw, command));
      this.phases.set(entry, phase);
    }
  }

  /**
   * Registers a directive that can execute from durable lowered command data.
   * @param {string | string[]} keyword The directive keyword or aliases.
   * @param {Context} context The handler context.
   * @param {NarrowDirectiveHandler<Context>} handler The handler.
   */
  registerLowered<Context>(
    keyword: string | string[],
    context: Context,
    handler: NarrowDirectiveHandler<Context>,
  ): void {
    this.register(keyword, context, handler, "lowered");
  }

  /**
   * Checks whether it has the value.
   * @param {string} keyword The keyword.
   * @returns {boolean} The result.
   */
  has(keyword: string): boolean {
    return this.lookup(keyword) !== undefined;
  }

  /**
   * Dispatches the value.
   * @param {string} keyword The keyword.
   * @param {readonly string[]} words The words.
   * @param {string} raw The raw.
   * @param {NormalizedCommand} [command] The command.
   * @returns {boolean} The result.
   */
  dispatch(
    keyword: string,
    words: readonly string[],
    raw: string,
    command?: NormalizedCommand,
  ): boolean {
    const handler = this.lookup(keyword);
    if (!handler) {
      return false;
    }

    handler(words, raw, command);
    return true;
  }

  /**
   * Resolves a directive handler using prefixes supplied by the active syntax profile.
   * @param {string} keyword The directive keyword.
   * @returns {BoundDirectiveHandler | undefined} The handler, if registered.
   */
  lookup(keyword: string): BoundDirectiveHandler | undefined {
    const direct = this.handlers.get(keyword);
    if (direct) {
      return direct;
    }
    for (const prefix of this.directivePrefixes) {
      if (keyword.startsWith(prefix)) {
        return this.handlers.get(keyword.slice(prefix.length));
      }
    }
    return undefined;
  }

  /**
   * Resolves the execution phase declared alongside a directive handler.
   * @param {string} keyword The directive keyword.
   * @returns {DirectiveExecutionPhase | undefined} The active directive phase.
   */
  getPhase(keyword: string): DirectiveExecutionPhase | undefined {
    const direct = this.phases.get(keyword);
    if (direct) {
      return direct;
    }
    for (const prefix of this.directivePrefixes) {
      if (keyword.startsWith(prefix)) {
        return this.phases.get(keyword.slice(prefix.length));
      }
    }
    return undefined;
  }
}

export const createDirectiveRegistry = (
  contexts: DirectiveRegistryContexts,
  enabledGroups: readonly CoreDirectiveGroup[] = CORE_DIRECTIVE_GROUPS,
  directivePrefixes: readonly string[] = [],
): DirectiveRegistry => {
  const registry = new DirectiveRegistry(directivePrefixes);
  const enabled = new Set<CoreDirectiveGroup>(enabledGroups);

  if (enabled.has("include")) registerIncludeSourceDirectives(registry, contexts.includeSource);
  if (enabled.has("memory")) registerFillPadDirectives(registry, contexts.fillPad);
  if (enabled.has("control")) registerFlowControlDirectives(registry, contexts.flowControl);
  if (enabled.has("namespace")) registerNamespaceDirectives(registry, contexts.namespace);
  if (enabled.has("layout")) registerLayoutDirectives(registry, contexts.layout);
  if (enabled.has("data")) registerDataDirectives(registry, contexts.data);
  if (enabled.has("struct")) registerStructBinaryDirectives(registry, contexts.struct);
  if (enabled.has("table") || enabled.has("diagnostic")) {
    registerMiscDirectives(
      registry,
      {
        table: contexts.table,
        diagnostic: contexts.diagnostic,
      },
      enabled,
    );
  }

  return registry;
};
