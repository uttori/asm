import type { DirectiveRegistry } from "./registry.js";

export const registerStructBinaryDirectives = (registry: DirectiveRegistry): void => {
  registry.register("struct", ({ session }, words) => {
    session.structEngine.handleStruct(words);
  });

  registry.register("endstruct", ({ session }, words) => {
    session.structEngine.handleEndStruct(words);
  });
};
