import { parseExpressionNode } from "../ir/expression-node.js";
import type { DirectiveRegistry } from "./registry.js";
import type { IncludeDirectiveContext } from "./types.js";

/**
 * Handles an incbin command.
 * @param {IncludeDirectiveContext} ctx The directive context.
 * @param {string[]} words Directive keyword.
 */
export const handleIncbin = (
  { session, includeSource, operandResolver, runtime }: IncludeDirectiveContext,
  words: readonly string[],
): void => {
  // Keep direct handler callers source-compatible while registry wiring uses
  // the explicit focused service capability.
  includeSource ??= (
    session as unknown as { includeSource: IncludeDirectiveContext["includeSource"] }
  ).includeSource;
  let targetLocationSpecified = false;
  let targetLocation: string | null = null;
  const arrowIndex = words.indexOf("->");
  const sourceWords = arrowIndex === -1 ? words.slice(1) : words.slice(1, arrowIndex);
  if (arrowIndex !== -1) {
    targetLocationSpecified = true;
    if (arrowIndex + 1 >= words.length) {
      throw new Error("incbin '->' syntax requires a target location.");
    }
    targetLocation = words[arrowIndex + 1];
    words = words.slice(0, arrowIndex);
  }

  // Normalized commands split on whitespace, so range expressions like
  // `(000 * 32)..(014 * 32)` arrive as multiple tokens. Rejoin the source
  // operand before extracting the optional `:start..end` suffix.
  const filenameWithRange = sourceWords.join(" ");
  let filename: string;
  let rangeStr: string | null = null;
  const colonIndex = filenameWithRange.indexOf(":");
  if (colonIndex !== -1) {
    filename = filenameWithRange.substring(0, colonIndex);
    rangeStr = filenameWithRange.substring(colonIndex + 1);
  } else {
    filename = filenameWithRange;
  }
  filename = filename.replace(/^"(.*)"$/, "$1");

  const fileData = includeSource.readFile(filename) as Uint8Array;
  if (!fileData) {
    throw new Error(`Failed to read file: ${filename}`);
  }

  let startOffset = 0;
  let endOffset = fileData.length;
  if (rangeStr) {
    if (rangeStr.indexOf("..") !== -1) {
      const parts = rangeStr.split("..");
      if (parts[0] === "" || parts[1] === "") {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      const rangeNode = parseExpressionNode(rangeStr);
      if (rangeNode.type !== "range") {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      startOffset = session.evaluateRangeExpression(rangeNode.start);
      endOffset = session.evaluateRangeExpression(rangeNode.end);
      if (endOffset === 0) {
        endOffset = fileData.length;
      }
    } else if (rangeStr.indexOf("-") !== -1) {
      if (rangeStr.includes("(") || rangeStr.includes(")")) {
        throw new Error("Emismatched_parentheses: Mismatched parentheses.");
      }
      const parts = rangeStr.split("-");
      if (parts[0] === "" || parts[1] === "") {
        throw new Error(`Invalid range specification: ${rangeStr}`);
      }
      startOffset = session.evaluateRangeExpression(parts[0]);
      endOffset = session.evaluateRangeExpression(parts[1]);
      if (endOffset === 0) {
        endOffset = fileData.length;
      }
    } else {
      throw new Error(`Invalid range specification: ${rangeStr}`);
    }
  }

  if (startOffset > endOffset || startOffset < 0 || startOffset > fileData.length) {
    throw new Error(`Start offset ${startOffset} out of bounds for file ${filename}`);
  }
  if (endOffset < startOffset || endOffset > fileData.length) {
    throw new Error(`End offset ${endOffset} out of bounds for file ${filename}`);
  }

  const incbinData = fileData.slice(startOffset, endOffset);

  if (targetLocationSpecified) {
    runtime.handlePushPC();

    let targetAddress: number;
    if (/^\$?[\dA-Fa-f]+$/.test(targetLocation ?? "")) {
      targetAddress = operandResolver.getnum(targetLocation ?? "");
    } else {
      targetAddress = session.symbolScope.getLabelValue(targetLocation ?? "", false);
    }
    session.setWritePosition(targetAddress);

    for (const byte of incbinData) {
      session.write1(byte);
    }

    runtime.handlePullPC();
  } else {
    for (const byte of incbinData) {
      session.write1(byte);
    }
  }

  session.recordCurrentAddress();
};

export const registerIncludeSourceDirectives = (
  registry: DirectiveRegistry,
  context: IncludeDirectiveContext,
): void => {
  registry.register("incsrc", context, ({ includeSource }, words, _raw, command) => {
    const target = command?.parsed.includeTarget?.target ?? words[1];
    if (!target) {
      throw new Error("incsrc requires exactly one filename parameter");
    }

    includeSource.assembleFile(target);
  });

  registry.register("include", context, ({ includeSource }, words, _raw, command) => {
    const target = command?.parsed.includeTarget?.target ?? words[1];
    if (!target) {
      throw new Error("include requires exactly one filename parameter");
    }
    includeSource.includeFile(target);
  });

  registry.register("includeonce", context, ({ includeSource }) => {
    includeSource.guardCurrentFile();
  });

  registry.register("incbin", context, handleIncbin);
};
