import type { DirectiveRegistry } from "./registry.js";

export const registerDataDirectives = (registry: DirectiveRegistry): void => {
  registry.register(["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"], ({ session }, words) => {
    session.handleDataDirective(words[0], words.slice(1));
  });
};
