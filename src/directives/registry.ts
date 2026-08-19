import type { NormalizedCommand } from "../ir/normalized-command.js";
import { registerDataDirectives } from "./data.js";
import { registerFillPadDirectives } from "./fill-pad.js";
import { registerFlowControlDirectives } from "./flow-control.js";
import { registerIncludeSourceDirectives } from "./include-source.js";
import { registerLayoutDirectives } from "./layout.js";
import { registerMemoryDirectives } from "./memory.js";
import { registerMiscDirectives } from "./misc.js";
import { registerNamespaceDirectives } from "./namespace.js";
import { registerSpcDirectives } from "./spc.js";
import { registerStructBinaryDirectives } from "./struct-binary.js";
import type {
  AddressStackDirectiveContext,
  ArchitectureDirectiveContext,
  AssemblerPolicyDirectiveContext,
  BaseLayoutDirectiveContext,
  DataDirectiveContext,
  FillPadDirectiveContext,
  FlowControlDirectiveContext,
  IncludeDirectiveContext,
  MapperDirectiveContext,
  MemoryDirectiveContext,
  NarrowDirectiveHandler,
  NamespaceDirectiveContext,
  OrgDirectiveContext,
  SpcDirectiveContext,
  StartposDirectiveContext,
  StructDirectiveContext,
  TableDirectiveContext,
} from "./types.js";
import type { TargetDirectiveFeature } from "../target-profile.js";

export const ALL_TARGET_DIRECTIVE_FEATURES: ReadonlySet<TargetDirectiveFeature> = new Set([
  "snes-mappers",
  "snes-memory",
  "snes-policy",
  "spc-blocks",
]);

type BoundDirectiveHandler = (
  words: readonly string[],
  raw: string,
  command?: NormalizedCommand,
) => void;

export interface DirectiveRegistryContexts {
  data: DataDirectiveContext;
  fillPad: FillPadDirectiveContext;
  flowControl: FlowControlDirectiveContext;
  includeSource: IncludeDirectiveContext;
  layout: {
    addressStack: AddressStackDirectiveContext;
    architecture: ArchitectureDirectiveContext;
    base: BaseLayoutDirectiveContext;
    mapper: MapperDirectiveContext;
    org: OrgDirectiveContext;
    policy: AssemblerPolicyDirectiveContext;
    runtime: SpcDirectiveContext;
    startpos: StartposDirectiveContext;
  };
  memory: MemoryDirectiveContext;
  namespace: NamespaceDirectiveContext;
  spc: SpcDirectiveContext;
  struct: StructDirectiveContext;
  table: TableDirectiveContext;
}

export class DirectiveRegistry {
  readonly handlers = new Map<string, BoundDirectiveHandler>();

  /**
   * Registers the value.
   * @param {string | string[]} keyword The keyword.
   * @param {Context} context The context.
   * @param {NarrowDirectiveHandler<Context>} handler The handler.
   */
  register<Context>(
    keyword: string | string[],
    context: Context,
    handler: NarrowDirectiveHandler<Context>,
  ): void {
    const keywords = Array.isArray(keyword) ? keyword : [keyword];
    for (const entry of keywords) {
      this.handlers.set(entry, (words, raw, command) => handler(context, words, raw, command));
    }
  }

  /**
   * Checks whether it has the value.
   * @param {string} keyword The keyword.
   * @returns {boolean} The result.
   */
  has(keyword: string): boolean {
    return this.handlers.has(keyword);
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
    const handler = this.handlers.get(keyword);
    if (!handler) {
      return false;
    }

    handler(words, raw, command);
    return true;
  }
}

export const createDirectiveRegistry = (
  contexts: DirectiveRegistryContexts,
  features: ReadonlySet<TargetDirectiveFeature> = ALL_TARGET_DIRECTIVE_FEATURES,
): DirectiveRegistry => {
  const registry = new DirectiveRegistry();

  registerIncludeSourceDirectives(registry, contexts.includeSource);
  registerFillPadDirectives(registry, contexts.fillPad);
  registerFlowControlDirectives(registry, contexts.flowControl);
  registerNamespaceDirectives(registry, contexts.namespace);
  registerLayoutDirectives(registry, contexts.layout, features);
  registerDataDirectives(registry, contexts.data);
  if (features.has("spc-blocks")) {
    registerSpcDirectives(registry, contexts.spc);
  }
  registerStructBinaryDirectives(registry, contexts.struct);
  registerMiscDirectives(registry, contexts.table);
  if (features.has("snes-memory")) {
    registerMemoryDirectives(registry, contexts.memory);
  }

  return registry;
};
