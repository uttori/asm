import type { DirectiveRegistry } from "./registry.js";
import type { StructDirectiveContext } from "./types.js";

export const registerStructBinaryDirectives = (
  registry: DirectiveRegistry,
  context: StructDirectiveContext,
): void => {
  registry.register("struct", context, ({ session }, words) => {
    session.structEngine.handleStruct(words);
  });

  registry.register("endstruct", context, ({ session }, words) => {
    session.structEngine.handleEndStruct(words);
  });
};
