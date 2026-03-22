import type { DirectiveRegistry } from "./registry.js";

export const registerFlowControlDirectives = (registry: DirectiveRegistry): void => {
  registry.register(["+", "-"], ({ session }, _words, raw) => {
    session.symbolScope.handleRelativeLabel(raw);
  });
};
