import { createSourceSpan, type SourceSpan } from "../source-location.js";
import { parseDirectiveExpression } from "./directive-arguments.js";
import type { ExpressionNode } from "./expression-node.js";
import { syntaxExpression, syntaxSpan, syntaxObject } from "./syntax-codec.js";

/** Typed source value; numeric leaves keep assembler expressions for later evaluation. */
export type AssetValueNode =
  | { readonly kind: "string"; readonly value: string; readonly span: SourceSpan }
  | { readonly kind: "boolean"; readonly value: boolean; readonly span: SourceSpan }
  | {
      readonly kind: "number";
      readonly expression: ExpressionNode;
      readonly text: string;
      readonly span: SourceSpan;
    }
  | { readonly kind: "array"; readonly items: readonly AssetValueNode[]; readonly span: SourceSpan }
  | {
      readonly kind: "object";
      readonly entries: Readonly<Record<string, AssetValueNode>>;
      readonly span: SourceSpan;
    };

/** One source statement with exactly two string operands and named options. */
export interface ParsedAssetCall {
  /** First positional argument: the asset file path as written, with syntax escapes decoded. */
  readonly path: Extract<AssetValueNode, { kind: "string" }>;
  /** Second positional argument: the asset format identifier. */
  readonly format: Extract<AssetValueNode, { kind: "string" }>;
  /** Named `key: value` options; keys are unique and empty when none are given. */
  readonly options: Readonly<Record<string, AssetValueNode>>;
  /** Extent from `includeAsset` through the closing parenthesis, excluding any leading label. */
  readonly span: SourceSpan;
}

/**
 * Parse only the `includeAsset(...)` form; leave all other commands alone.
 * @param command Normalized source command.
 * @param [line] Zero-based source line for argument spans.
 * @returns Typed call with argument spans, if present.
 */
export function parseAssetCall(command: string, line?: number): ParsedAssetCall | undefined {
  const leading = command.length - command.trimStart().length;
  const trimmed = command.slice(leading);
  const label = /^[\w$.?]+:/.exec(trimmed);
  let callStart = leading;
  if (label && /\s/.test(trimmed[label[0].length] ?? "")) {
    callStart += label[0].length;
    while (/\s/.test(command[callStart] ?? "")) {
      callStart++;
    }
  }
  const prefix = /^includeasset\s*\(/i.exec(command.slice(callStart));
  if (!prefix) {
    return undefined;
  }
  let at = callStart + prefix[0].length;
  const span = (start: number, end: number): SourceSpan => createSourceSpan(start, end, line);
  const fail = (message: string): never => {
    throw new Error(`includeAsset at column ${at + 1}: ${message}`);
  };
  const skip = (): void => {
    while (/\s/.test(command[at] ?? "") && at < command.length) {
      at++;
    }
  };
  const string = (): Extract<AssetValueNode, { kind: "string" }> => {
    const start = at;
    const quote = command[at++];
    let value = "";
    while (at < command.length) {
      const character = command[at++];
      if (character === quote) {
        return { kind: "string", value, span: span(start, at) };
      }
      if (character === "\\") {
        const escaped = at < command.length ? command[at] : undefined;
        at++;
        if (escaped === undefined) {
          fail("unterminated string escape");
        }
        // Preserve assembler define escapes; decode only syntax escapes.
        if (escaped === quote || escaped === "\\") {
          value += escaped;
        } else if (escaped === "n") {
          value += "\n";
        } else if (escaped === "t") {
          value += "\t";
        } else {
          value += `\\${escaped}`;
        }
      } else {
        value += character;
      }
    }
    return fail("unterminated string");
  };
  const value = (): AssetValueNode => {
    skip();
    const start = at;
    const character = command[at];
    if (character === '"' || character === "'") {
      return string();
    }
    if (character === "[") {
      at++;
      const items: AssetValueNode[] = [];
      skip();
      while (command[at] !== "]") {
        items.push(value());
        skip();
        if (command[at] === "]") {
          break;
        }
        if (command[at++] !== ",") {
          fail("expected ',' in array");
        }
        skip();
      }
      if (command[at++] !== "]") {
        fail("unterminated array");
      }
      return { kind: "array", items, span: span(start, at) };
    }
    if (character === "{") {
      at++;
      const entries: Record<string, AssetValueNode> = {};
      skip();
      while (command[at] !== "}") {
        let key: string;
        if (command[at] === '"' || command[at] === "'") {
          key = string().value;
        } else {
          const match = /^[A-Z_a-z][\w-]*/.exec(command.slice(at));
          if (!match) {
            return fail("expected object key");
          }
          key = match[0];
          at += key.length;
        }
        skip();
        if (command[at++] !== ":") {
          fail("expected ':' after object key");
        }
        if (Object.hasOwn(entries, key)) {
          fail(`duplicate object key '${key}'`);
        }
        entries[key] = value();
        skip();
        if (command[at] === "}") {
          break;
        }
        if (command[at++] !== ",") {
          fail("expected ',' in object");
        }
        skip();
      }
      if (command[at++] !== "}") {
        fail("unterminated object");
      }
      return { kind: "object", entries, span: span(start, at) };
    }
    let parens = 0;
    while (at < command.length) {
      const next = command[at];
      if (next === "(") {
        parens++;
      } else if (next === ")") {
        if (parens === 0) {
          break;
        }
        parens--;
      } else if (parens === 0 && (next === "," || next === "]" || next === "}")) {
        break;
      }
      at++;
    }
    if (parens !== 0) {
      fail("unbalanced numeric expression");
    }
    const expression = command.slice(start, at).trim();
    if (expression === "true" || expression === "false") {
      return { kind: "boolean", value: expression === "true", span: span(start, at) };
    }
    if (!expression) {
      fail("expected value");
    }
    return {
      kind: "number",
      expression: parseDirectiveExpression(expression, false),
      text: expression,
      span: span(start, at),
    };
  };
  const positional: AssetValueNode[] = [];
  const options: Record<string, AssetValueNode> = {};
  let named = false;
  while (true) {
    skip();
    if (command[at] === ")") {
      break;
    }
    const namedMatch = /^([A-Z_a-z][\w-]*)\s*:/.exec(command.slice(at));
    if (namedMatch) {
      named = true;
      at += namedMatch[0].length;
      if (Object.hasOwn(options, namedMatch[1])) {
        fail(`duplicate option '${namedMatch[1]}'`);
      }
      options[namedMatch[1]] = value();
    } else {
      if (named) {
        fail("positional argument after named argument");
      }
      positional.push(value());
    }
    skip();
    if (command[at] === ")") {
      break;
    }
    if (command[at++] !== ",") {
      fail("expected ',' between arguments");
    }
  }
  if (command[at++] !== ")") {
    fail("unterminated call");
  }
  skip();
  if (at !== command.length) {
    fail("unexpected text after call");
  }
  const stringArgument = (
    argument: AssetValueNode | undefined,
  ): Extract<AssetValueNode, { kind: "string" }> => {
    if (!argument || argument.kind !== "string") {
      throw new Error(
        `includeAsset at column ${at + 1}: expected exactly two leading string arguments`,
      );
    }
    return argument;
  };
  if (positional.length !== 2) {
    fail("expected exactly two leading string arguments");
  }
  return {
    path: stringArgument(positional[0]),
    format: stringArgument(positional[1]),
    options,
    span: span(callStart, at),
  };
}

/** Transport validation mirrors the recursive asset grammar without interpreting string data. */
export const assetCallGuard: import("./syntax-codec.js").SyntaxGuard<ParsedAssetCall> = (
  value,
): value is ParsedAssetCall => {
  if (!syntaxObject(value)) {
    return false;
  }
  const call = value;
  return (
    assetValueGuard(call.path) &&
    call.path.kind === "string" &&
    assetValueGuard(call.format) &&
    call.format.kind === "string" &&
    assetEntriesGuard(call.options) &&
    syntaxSpan(call.span)
  );
};

/** Accepts a plain non-array object whose every value is a valid asset value node. */
function assetEntriesGuard(value: unknown): value is Readonly<Record<string, AssetValueNode>> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(assetValueGuard)
  );
}
/** Recursively validates one asset value node, including its span and kind-specific payload. */
function assetValueGuard(value: unknown): value is AssetValueNode {
  if (!syntaxObject(value)) {
    return false;
  }
  const node = value;
  if (!syntaxSpan(node.span)) {
    return false;
  }
  switch (node.kind) {
    case "string":
      return typeof node.value === "string";
    case "boolean":
      return typeof node.value === "boolean";
    case "number":
      return typeof node.text === "string" && syntaxExpression(node.expression);
    case "array":
      return Array.isArray(node.items) && node.items.every(assetValueGuard);
    case "object":
      return assetEntriesGuard(node.entries);
    default:
      return false;
  }
}
