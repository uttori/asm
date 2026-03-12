import type { DirectiveRegistry } from "./registry.js";

export const registerSpcDirectives = (registry: DirectiveRegistry): void => {
  registry.register("spcblock", ({ session }, words) => {
    session.handleSpcblock(words);
  });

  registry.register("endspcblock", ({ session }, words) => {
    session.handleEndSpcblock(words);
  });
};
