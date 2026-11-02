import { createTextSpan, type SourceSpan } from "../source-location.js";
import { parseDataOperand } from "./data-node.js";
import { dataResolutionExpression } from "./directive-arguments.js";
import { parseExpressionResult, type ExpressionNode } from "./expression-node.js";
import { compactExpressionSpans, locateContinuedExpression } from "./expression-occurrence.js";
import {
  cloneNormalizedCommand,
  setCommandWords,
  type NormalizedCommand,
} from "./normalized-command.js";

/** Declaration payloads carry syntax and source locations, never the resolved symbol value. */
export type LabelStatement =
  | {
      form: "relative";
      name: string;
      direction: 1 | -1;
      depth: number;
      span: SourceSpan;
      trailing?: NormalizedCommand;
    }
  | {
      form: "global";
      name: string;
      span: SourceSpan;
      preserveHierarchy: boolean;
      missingName: boolean;
      trailing?: NormalizedCommand;
    }
  | {
      form: "named";
      labels: readonly { name: string; span: SourceSpan }[];
      trailing?: NormalizedCommand;
    };

/** Symbol assignment from a parsed expression on one source line. */
export type AssignmentStatement = {
  /** Destination symbol name before namespace qualification. */
  target: string;
  /** Parsed right-hand expression evaluated during assembly. */
  expression: ExpressionNode;
  /** Original spelling for attribution and diagnostics; execution uses the expression node. */
  text: string;
  /** Source extent covering the assignment line. */
  span: SourceSpan;
};

/** Numeric or character data directive operands after width normalization. */
export type NumericDataStatement = {
  /** Storage width in bytes selected by the directive mnemonic. */
  width: 1 | 2 | 3 | 4;
  /** Only invalid empty statements retain their alias for the established diagnostic. */
  emptyDirective?: string;
  /** Per-operand source text paired with its parsed expression tree. */
  operands: readonly { text: string; expression: ExpressionNode }[];
  /**
   * Dense constant rows use six scalars per item: operand text, literal spelling, numeric value
   * (null if absent), UTF-16 start/end, and zero-based line (null if absent). Operands is empty.
   * This is immutable parsed syntax, not evaluated state; materialize at an API boundary if needed.
   */
  literalData?: readonly (string | number | null)[];
};

/**
 * Reconstitute literal occurrences without reparsing or resolving any source text.
 * @yields Original operand spelling and parsed literal occurrence, without retaining a view cache.
 */
export function* literalDataOperands(data: NonNullable<NumericDataStatement["literalData"]>) {
  if (data.length % 6 !== 0) {
    throw new Error("Invalid literal data syntax.");
  }
  for (let index = 0; index < data.length; index += 6) {
    const text = data[index],
      value = data[index + 1],
      numericValue = data[index + 2];
    const start = data[index + 3],
      end = data[index + 4],
      line = data[index + 5];
    if (
      typeof text !== "string" ||
      typeof value !== "string" ||
      (numericValue !== null &&
        (typeof numericValue !== "number" || !Number.isFinite(numericValue))) ||
      typeof start !== "number" ||
      typeof end !== "number" ||
      (line !== null && typeof line !== "number")
    ) {
      throw new Error("Invalid literal data syntax.");
    }
    const expression: ExpressionNode = {
      type: "literal",
      value,
      ...(numericValue === null ? {} : { numericValue }),
      span: { start, end, line: line ?? undefined },
    };
    yield { text, expression };
  }
}

/** Middleware receives detached ordinary operands, preserving the public occurrence view. */
export function materializeNumericData(statement: NumericDataStatement): NumericDataStatement {
  if (!statement.literalData) {
    return statement;
  }
  const { literalData, ...ordinary } = statement;
  return { ...ordinary, operands: Array.from(literalDataOperands(literalData)) };
}

/** Long literal-only rows dominate generated-source heap; retain their scalar fields instead of three objects per item. */
function compactNumericData(
  width: NumericDataStatement["width"],
  operands: NumericDataStatement["operands"],
): NumericDataStatement {
  if (operands.length < 8) {
    return { width, operands };
  }
  const literalData: (string | number | null)[] = [];
  for (const { text, expression } of operands) {
    // Grouping and richer nodes keep their existing evaluation/diagnostic path. Only plain literal
    // fields with compact occurrence spans can be losslessly represented by the scalar row.
    if (
      expression.type !== "literal" ||
      !expression.span ||
      expression.parenthesized ||
      (expression.numericValue !== undefined && !Number.isFinite(expression.numericValue)) ||
      Object.keys(expression).some(
        (key) => !["type", "value", "numericValue", "span"].includes(key),
      ) ||
      Object.keys(expression.span).some((key) => !["start", "end", "line"].includes(key))
    ) {
      return { width, operands };
    }
    literalData.push(
      text,
      expression.value,
      expression.numericValue ?? null,
      expression.span.start,
      expression.span.end,
      expression.span.line ?? null,
    );
  }
  return { width, operands: [], literalData };
}

/** Parse declaration structure once; the syntax profile decides whether dot-prefixed names qualify. */
export function parseLabelStatement(
  command: NormalizedCommand,
  leadingDotLabels: boolean,
): LabelStatement | undefined {
  const { keyword, words, source } = command;
  const span = source.tokenSpans[0] ?? source.normalizedSpan;
  if (keyword === ":" || /^\++:?$|^-+:?$/.test(keyword)) {
    const name = keyword === ":" ? ":" : keyword.replace(/:$/, "");
    return {
      form: "relative",
      name,
      direction: name[0] === "-" ? -1 : 1,
      depth: name.length,
      span,
      trailing: keyword === ":" ? sliceTrailingCommand(command, 1) : undefined,
    };
  }
  if (keyword === "global") {
    const payload =
      command.parsed.directiveArgs?.args.join(",").split(/\s+/).filter(Boolean) ?? words.slice(1);
    // Keep the missing-name diagnostic in execution, like other directive validation.
    const declaration = payload[0] ?? "";
    const preserveHierarchy = declaration.startsWith("#");
    const name = (preserveHierarchy ? declaration.slice(1) : declaration).replace(/:$/, "");
    return {
      form: "global",
      name,
      span,
      preserveHierarchy,
      missingName: payload.length === 0,
      trailing: sliceTrailingCommand(command, 2),
    };
  }
  const labels: { name: string; span: SourceSpan }[] = [];
  for (const word of words) {
    if (word === ":" || (!word.endsWith(":") && !(leadingDotLabels && word.startsWith(".")))) {
      break;
    }
    labels.push({ name: word.replace(/:$/, ""), span: source.tokenSpans[labels.length] ?? span });
  }
  if (!labels.length) {
    return undefined;
  }
  let trailing: NormalizedCommand | undefined;
  if (labels.length < words.length) {
    // Preserve the original occurrence and raw line for writes following an inline label.
    trailing = sliceTrailingCommand(command, labels.length);
  }
  return { form: "named", labels, trailing };
}

/** Parse mixed numeric/string data without resolving defines or invoking character mappings. */
export function parseNumericDataStatement(
  command: NormalizedCommand,
): NumericDataStatement | undefined {
  const data = command.parsed.dataDirective;
  if (!data) {
    return undefined;
  }
  const widths: Partial<Record<string, 1 | 2 | 3 | 4>> = {
    db: 1,
    dw: 2,
    dl: 3,
    dd: 4,
    "dc.b": 1,
    "dc.w": 2,
    "dc.l": 3,
  };
  const width = widths[data.directive];
  if (!width) {
    return undefined;
  }
  if (!data.operands.length) {
    return { width, emptyDirective: data.directive, operands: [] };
  }
  const operands: { text: string; expression: ExpressionNode }[] = [];
  const physical = command.source.physical?.text ?? command.source.raw;
  let offset =
    (command.source.tokenSpans[0]?.start ?? physical.indexOf(command.words[0])) +
    command.words[0].length;
  for (const text of data.operands) {
    if (/^["']/.test(text.trim()) || text.trim().startsWith("#") || /![\w{]/.test(text)) {
      operands.push(parseDataOperand(text));
      continue;
    }
    const at = physical.indexOf(text, offset);
    const positions = at < 0 ? locateContinuedExpression(text, physical, offset) : undefined;
    let occurrence: { text: string; offset: number; line: number } | undefined;
    if (at >= 0) {
      occurrence = { text: physical, offset: at, line: command.source.line };
    } else if (positions) {
      occurrence = { text, offset: 0, line: 0 };
    }
    const parsed = parseExpressionResult(text, "statement", occurrence);
    offset = Math.max(offset, at + text.length, (positions?.at(-1) ?? -1) + 1);
    let relocate: ((span: SourceSpan) => SourceSpan) | undefined;
    if (positions) {
      relocate = (span) =>
        createTextSpan(
          physical,
          positions[span.start],
          positions[span.end - 1] + 1,
          command.source.line,
        );
    }
    compactExpressionSpans(parsed.node, relocate);
    operands.push({ text, expression: dataResolutionExpression(text, parsed.node) });
  }
  return compactNumericData(width, operands);
}

/** Preserve exact trailing spelling instead of rebuilding a statement with words.join(). */
function sliceTrailingCommand(
  command: NormalizedCommand,
  count: number,
): NormalizedCommand | undefined {
  if (count >= command.words.length) {
    return undefined;
  }
  let offset = 0;
  for (const word of command.words.slice(0, count)) {
    const at = command.command.indexOf(word, offset);
    offset = at + word.length;
  }
  const trailing = cloneNormalizedCommand(command);
  setCommandWords(trailing, command.words.slice(count), command.command.slice(offset).trimStart());
  trailing.source = { ...trailing.source, tokenSpans: command.source.tokenSpans.slice(count) };
  return trailing;
}
