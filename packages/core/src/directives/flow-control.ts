import {
  syntaxBoolean,
  syntaxNumber,
  syntaxRecord,
  syntaxString,
  syntaxUnion,
  syntaxLiteral,
} from "../ir/syntax-codec.js";
import type { DirectiveRegistry } from "./registry.js";
import type { FlowControlDirectiveContext } from "./types.js";

/** Forwards raw relative label text to the session symbol scope handler. */
export const handleRelativeLabel = (
  { session }: FlowControlDirectiveContext,
  _words: readonly string[],
  raw: string,
): void => {
  session.symbolScope.handleRelativeLabel(raw);
};

/** Registers relative branch label directives and their typed syntax hooks. */
export const registerFlowControlDirectives = (
  registry: DirectiveRegistry,
  context: FlowControlDirectiveContext,
): void => {
  registry.registerImmutableTyped(
    ["+", "-"],
    ({ source }) => {
      const spelling = source.raw;
      const direction: 1 | -1 = spelling.includes("+") ? 1 : -1;
      const depth = (spelling.match(direction === 1 ? /\+/g : /-/g) ?? []).length;
      return { direction, depth, macroLocal: spelling.startsWith("?"), spelling };
    },
    syntaxRecord({
      direction: syntaxUnion(syntaxLiteral(1), syntaxLiteral(-1)),
      depth: syntaxNumber,
      macroLocal: syntaxBoolean,
      spelling: syntaxString,
    }),
    (node) => {
      context.session.symbolScope.declareRelativeLabel(node);
    },
  );
};
