import type { NormalizedCommand } from "../ir/normalized-command.js";
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
   * Resolves a directive handler, including Asar's `@directive` file-header form.
   * @param {string} keyword The directive keyword.
   * @returns {BoundDirectiveHandler | undefined} The handler, if registered.
   */
  lookup(keyword: string): BoundDirectiveHandler | undefined {
    const direct = this.handlers.get(keyword);
    if (direct) {
      return direct;
    }
    if (keyword.startsWith("@")) {
      return this.handlers.get(keyword.slice(1));
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
    if (keyword.startsWith("@")) {
      return this.phases.get(keyword.slice(1));
    }
    return undefined;
  }
}

export const createDirectiveRegistry = (contexts: DirectiveRegistryContexts): DirectiveRegistry => {
  const registry = new DirectiveRegistry();

  registerIncludeSourceDirectives(registry, contexts.includeSource);
  registerFillPadDirectives(registry, contexts.fillPad);
  registerFlowControlDirectives(registry, contexts.flowControl);
  registerNamespaceDirectives(registry, contexts.namespace);
  registerLayoutDirectives(registry, contexts.layout);
  registerDataDirectives(registry, contexts.data);
  registerStructBinaryDirectives(registry, contexts.struct);
  registerMiscDirectives(registry, {
    table: contexts.table,
    diagnostic: contexts.diagnostic,
  });

  return registry;
};
