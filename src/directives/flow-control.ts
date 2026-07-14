import type { DirectiveRegistry } from "./registry.js";
import type { FlowControlDirectiveContext } from "./types.js";

export const handleRelativeLabel = (
  { session }: FlowControlDirectiveContext,
  _words: string[],
  raw: string,
): void => {
  session.symbolScope.handleRelativeLabel(raw);
};

export const registerFlowControlDirectives = (
  registry: DirectiveRegistry,
  context: FlowControlDirectiveContext,
): void => {
  registry.register(["+", "-"], context, handleRelativeLabel);
};
