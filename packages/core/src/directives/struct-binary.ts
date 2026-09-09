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

  registry.register("datastruct", context, ({ session }, words) => {
    session.structEngine.data.emit(words);
  });
  registry.register("datastructs", context, ({ session }, words) => {
    session.structEngine.data.begin(words);
  });
  registry.register("enddatastructs", context, ({ session }, words) => {
    session.structEngine.data.end(words);
  });
};
