import type { OperandResolver } from "../operand-resolver.js";
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
import type { AssemblySession, DirectiveContext, DirectiveHandler } from "./types.js";

export class DirectiveRegistry {
  private readonly handlers = new Map<string, DirectiveHandler>();

  constructor(private readonly ctx: DirectiveContext) {}

  register(keyword: string | string[], handler: DirectiveHandler): void {
    const keywords = Array.isArray(keyword) ? keyword : [keyword];
    for (const entry of keywords) {
      this.handlers.set(entry, handler);
    }
  }

  dispatch(keyword: string, words: string[], raw: string, command?: NormalizedCommand): boolean {
    const handler = this.handlers.get(keyword);
    if (!handler) {
      return false;
    }

    handler(this.ctx, words, raw, command);
    return true;
  }

  dispatchCommand(command: NormalizedCommand): boolean {
    return this.dispatch(command.keyword, command.words, command.command, command);
  }
}

export const createDirectiveRegistry = (
  session: AssemblySession,
  operandResolver: OperandResolver,
): DirectiveRegistry => {
  const registry = new DirectiveRegistry({ session, operandResolver });

  registerIncludeSourceDirectives(registry);
  registerFillPadDirectives(registry);
  registerFlowControlDirectives(registry);
  registerNamespaceDirectives(registry);
  registerLayoutDirectives(registry);
  registerDataDirectives(registry);
  registerSpcDirectives(registry);
  registerStructBinaryDirectives(registry);
  registerMiscDirectives(registry);
  registerMemoryDirectives(registry);

  return registry;
};
