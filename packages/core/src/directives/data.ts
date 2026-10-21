import { createNormalizedCommand } from "../ir/normalized-command.js";
import {
  materializeNumericData,
  parseNumericDataStatement,
  type NumericDataStatement,
} from "../ir/statement-node.js";
import {
  syntaxArray,
  syntaxRecord,
  syntaxNumber,
  syntaxString,
  syntaxExpression,
  syntaxOptional,
} from "../ir/syntax-codec.js";
import type { DirectiveRegistry } from "./registry.js";
import type { DataDirectiveContext } from "./types.js";

// Registration identity matters: a plugin that replaces `db` owns its execution again.
const nativeDataHandlers = new WeakSet<NonNullable<ReturnType<DirectiveRegistry["lookup"]>>>();

/** Check the currently registered handler, including replacements after lowering. */
export function isCoreDataDirective(
  registry: Pick<DirectiveRegistry, "lookup">,
  keyword: string,
): boolean {
  const handler = registry.lookup(keyword);
  return handler !== undefined && nativeDataHandlers.has(handler);
}

/** Preserve core ownership through the session's lifecycle-hook wrapper only. */
export function inheritCoreDataHandler(
  original: NonNullable<ReturnType<DirectiveRegistry["lookup"]>>,
  wrapped: NonNullable<ReturnType<DirectiveRegistry["lookup"]>>,
): void {
  if (nativeDataHandlers.has(original)) {
    nativeDataHandlers.add(wrapped);
  }
}

/**
 * Routes byte/word/long data directives through the runtime data handler.
 * @param {DataDirectiveContext} ctx The ROM-capable directive context.
 * @param {string[]} words The directive words.
 */
export const handleDataDirective = (
  { runtime }: DataDirectiveContext,
  words: readonly string[],
): void => {
  runtime.handleDataDirective(words[0], words.slice(1));
};

export const registerDataDirectives = (
  registry: DirectiveRegistry,
  context: DataDirectiveContext,
): void => {
  const keywords = ["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"];
  registry.registerImmutableTyped<NumericDataStatement>(
    keywords,
    ({ text, words, source }) => {
      const command = createNormalizedCommand(
        source.raw,
        text,
        [...words],
        source.file,
        source.line,
      );
      const statement = parseNumericDataStatement(command);
      if (!statement) {
        throw new Error("Expected a data directive.");
      }
      // This registry grammar is also a public source adapter. Keep its portable plugin payload
      // in the ordinary operand form; native source assembly owns compact internal rows directly.
      return materializeNumericData(statement);
    },
    syntaxRecord({
      width: (value): value is 1 | 2 | 3 | 4 => syntaxNumber(value) && [1, 2, 3, 4].includes(value),
      emptyDirective: syntaxOptional(syntaxString),
      operands: syntaxArray(syntaxRecord({ text: syntaxString, expression: syntaxExpression })),
    }),
    (statement) => context.runtime.executeDataStatement(statement),
  );
  for (const keyword of keywords) {
    nativeDataHandlers.add(registry.lookup(keyword)!);
  }
};
