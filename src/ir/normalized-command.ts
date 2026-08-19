import {
  parseExpressionNode,
  type ExpressionNode,
  type RangeExpressionNode,
} from "./expression-node.js";
import { createLineSpan, deriveTokenSpans, type SourceSpan } from "../source-location.js";
import { incrementInternalCounter } from "../internal-instrumentation.js";

export type CommandKind =
  | "unknown"
  | "directive"
  | "opcodeCandidate"
  | "functionDefinition"
  | "labelDefinition"
  | "staticAssignment"
  | "characterMapping"
  | "macroDefinitionOrInvoke"
  | "defineCommand"
  | "structCommand"
  | "commentOrEmpty";

export type CommandProvenance = {
  readonly file: string;
  readonly line: number;
  readonly raw: string;
  readonly normalized: string;
  readonly span: SourceSpan;
  readonly normalizedSpan: SourceSpan;
  readonly tokenSpans: readonly SourceSpan[];
};

export type NormalizedCommand = {
  kind: CommandKind;
  source: CommandProvenance;
  command: string;
  words: readonly string[];
  keyword: string;
  labelName?: string;
  assignmentTarget?: string;
  parsed: CommandSemantics;
};

/**
 * Creates immutable provenance metadata for a normalized command.
 * @param {string} raw The original source line.
 * @param {string} normalized The normalized line after pre-dispatch cleanup.
 * @param {string[]} words The tokenized command words.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @returns {CommandProvenance} The command provenance.
 */
export function createCommandProvenance(
  raw: string,
  normalized: string,
  words: string[],
  file: string,
  line: number,
): CommandProvenance {
  return {
    file,
    line,
    raw,
    normalized,
    span: createLineSpan(raw, line),
    normalizedSpan: createLineSpan(normalized, line),
    tokenSpans: deriveTokenSpans(normalized, words, line),
  };
}

export type ParsedCondition = {
  expression: ExpressionNode;
};

export type ParsedAssignment = {
  target: string;
  expression: ExpressionNode;
};

export type ParsedForLoop = {
  variable: string;
  range: RangeExpressionNode;
  start: ExpressionNode;
  end: ExpressionNode;
};

export type ParsedIncbinRange = {
  range: RangeExpressionNode;
  start: ExpressionNode;
  end: ExpressionNode;
};

export type ParsedMacroInvocation = {
  name: string;
  args: string[];
};

export type ParsedIncludeTarget = {
  directive: "include" | "incsrc";
  target: string;
};

export type ParsedLabelSplit = {
  label: string;
  trailing?: string;
};

export type ParsedDataDirective = {
  directive: string;
  operands: string[];
};

export type ParsedDirectiveArgs = {
  name: string;
  args: string[];
};

export type ParsedOpcodeOperands = {
  mnemonic: string;
  operandText: string;
  operands: string[];
};

export type CommandSemantics = {
  condition?: ParsedCondition;
  assignment?: ParsedAssignment;
  forLoop?: ParsedForLoop;
  incbinRange?: ParsedIncbinRange;
  macroInvocation?: ParsedMacroInvocation;
  includeTarget?: ParsedIncludeTarget;
  labelSplit?: ParsedLabelSplit;
  dataDirective?: ParsedDataDirective;
  directiveArgs?: ParsedDirectiveArgs;
  opcodeOperands?: ParsedOpcodeOperands;
};

/**
 * Builds the normalized command node used by the command pipeline.
 * @param {string} raw The original source line.
 * @param {string} normalized The normalized line after pre-dispatch cleanup.
 * @param {string[]} words The tokenized command words.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @returns {NormalizedCommand} The normalized command node.
 */
export function createNormalizedCommand(
  raw: string,
  normalized: string,
  words: string[],
  file: string,
  line: number,
): NormalizedCommand {
  const command = normalized.trim();
  const keyword = words[0] ?? "";
  return {
    kind: classifyCommand(command, words),
    source: createCommandProvenance(raw, normalized, words, file, line),
    command,
    words,
    keyword,
    labelName: deriveLabelName(keyword),
    assignmentTarget: deriveAssignmentTarget(words),
    parsed: deriveCommandSemantics(command, words),
  };
}

/**
 * Creates a lightweight command node for deferred loop or macro collection.
 * @param {string} raw The unprocessed source line.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @param {string} [normalized] Optional normalized form without inline comments.
 * @param {string[]} [words] Optional tokenized words for semantic payload derivation.
 * @returns {NormalizedCommand} The pending command node.
 */
export function createPendingCommand(
  raw: string,
  file: string,
  line: number,
  normalized?: string,
  words: string[] = [],
): NormalizedCommand {
  const command = (normalized ?? raw).trim();
  return {
    kind: classifyCommand(command, words),
    source: createCommandProvenance(raw, normalized ?? raw, words, file, line),
    command,
    words,
    keyword: words[0] ?? "",
    labelName: deriveLabelName(words[0] ?? ""),
    assignmentTarget: deriveAssignmentTarget(words),
    parsed: deriveCommandSemantics(command, words),
  };
}

/**
 * Creates an isolated execution copy so runtime preprocessing can mutate command
 * state without changing cached front-end program nodes.
 * @param {NormalizedCommand} command The command to clone.
 * @returns {NormalizedCommand} The detached execution command.
 */
export function cloneNormalizedCommand(command: NormalizedCommand): NormalizedCommand {
  incrementInternalCounter("normalizedCommandClones");
  return { ...command };
}

/**
 * Replaces a command node's tokenized words and derived fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {string[]} words The updated token list.
 * @param {string} [normalized] Optional normalized command text.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export function setCommandWords(
  command: NormalizedCommand,
  words: readonly string[],
  normalized?: string,
): NormalizedCommand {
  command.words = words;
  command.keyword = words[0] ?? "";
  command.command = (normalized ?? words.join(" ")).trim();
  const normalizedSource = normalized ?? command.command;
  command.source = {
    ...command.source,
    normalized: normalizedSource,
    normalizedSpan: createLineSpan(normalizedSource, command.source.line),
    tokenSpans: deriveTokenSpans(normalizedSource, words, command.source.line),
  };
  command.labelName = deriveLabelName(command.keyword);
  command.assignmentTarget = deriveAssignmentTarget(words);
  command.parsed = deriveCommandSemantics(command.command, words);
  command.kind = classifyCommand(command.command, words);
  return command;
}

/**
 * Reclassifies a normalized command without changing any other fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {CommandKind} kind The new command kind.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export function setCommandKind(command: NormalizedCommand, kind: CommandKind): NormalizedCommand {
  command.kind = kind;
  return command;
}

/**
 * Applies lightweight heuristics to classify a normalized command.
 * @param {string} command The normalized command text.
 * @param {string[]} words The tokenized command words.
 * @returns {CommandKind} The inferred command kind.
 */
function classifyCommand(command: string, words: readonly string[]): CommandKind {
  const trimmed = command.trim();
  const keyword = (words[0] ?? "").toLowerCase();
  if (!trimmed || trimmed.startsWith(";")) {
    return "commentOrEmpty";
  }
  if (
    words.length === 3 &&
    words[1] === "=" &&
    (words[0]?.startsWith("'") || words[0]?.startsWith('"'))
  ) {
    return "characterMapping";
  }
  if (trimmed.startsWith("!")) {
    return "defineCommand";
  }
  if (keyword === "macro" || keyword === "endmacro" || keyword.startsWith("%")) {
    return "macroDefinitionOrInvoke";
  }
  if (keyword === "undef") {
    return "defineCommand";
  }
  if (keyword === "struct" || keyword === "endstruct" || keyword === "skip") {
    return "structCommand";
  }
  if (keyword === "function") {
    return "functionDefinition";
  }
  if (keyword === "global") {
    return "labelDefinition";
  }
  if (words.length === 3 && words[1] === "=") {
    return "staticAssignment";
  }
  if (deriveLabelName(words[0] ?? "")) {
    return "labelDefinition";
  }
  return keyword ? "opcodeCandidate" : "unknown";
}

/**
 * Extracts a label name from a potential label token.
 * @param {string} keyword The candidate label token.
 * @returns {string | undefined} The label name when present.
 */
function deriveLabelName(keyword: string): string | undefined {
  if (!keyword) {
    return undefined;
  }
  if (/^\++:?$/.test(keyword) || /^-+:?$/.test(keyword)) {
    return keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
  }
  if (keyword.endsWith(":") || keyword.startsWith(".")) {
    return keyword.endsWith(":") ? keyword.slice(0, -1) : keyword;
  }
  return undefined;
}

/**
 * Extracts a static assignment target from a simple `name = value` command.
 * @param {string[]} words The tokenized command words.
 * @returns {string | undefined} The assignment target when present.
 */
function deriveAssignmentTarget(words: readonly string[]): string | undefined {
  if (words.length === 3 && words[1] === "=") {
    return words[0];
  }
  return undefined;
}

/**
 * Derives semantic payloads from a normalized command's stable syntax.
 * @param {string} command The normalized command text.
 * @param {string[]} words The tokenized command words.
 * @returns {CommandSemantics} Parsed semantic payloads keyed by construct type.
 */
function deriveCommandSemantics(command: string, words: readonly string[]): CommandSemantics {
  const keyword = (words[0] ?? "").toLowerCase();
  const semantics: CommandSemantics = {};

  if ((keyword === "if" || keyword === "elseif" || keyword === "while") && words.length > 1) {
    semantics.condition = {
      expression: parseExpressionNode(words.slice(1).join(" ")),
    };
  }

  if (keyword === "for" && words.length >= 4 && words[2] === "=") {
    const variable = words[1];
    const parsedRange = parseExpressionNode(words.slice(3).join(" "));
    if (parsedRange.type === "range") {
      semantics.forLoop = {
        variable,
        range: parsedRange,
        start: parsedRange.start,
        end: parsedRange.end,
      };
    }
  }

  if (
    words.length === 3 &&
    words[1] === "=" &&
    !(words[0]?.startsWith("'") || words[0]?.startsWith('"'))
  ) {
    semantics.assignment = {
      target: words[0],
      expression: parseExpressionNode(words[2]),
    };
  }

  if (keyword === "incbin" && words.length >= 2) {
    const incbinSource = command
      .slice((words[0] ?? "").length)
      .split(/\s+->\s+/u, 1)[0]
      .trim();
    const rangeCandidate = extractIncbinRange(incbinSource);
    if (rangeCandidate) {
      const parsedRange = parseExpressionNode(rangeCandidate);
      if (parsedRange.type === "range") {
        semantics.incbinRange = {
          range: parsedRange,
          start: parsedRange.start,
          end: parsedRange.end,
        };
      }
    }
  }

  if (keyword.startsWith("%")) {
    const invocationText = command.trim().slice(1);
    const openParen = invocationText.indexOf("(");
    if (openParen !== -1 && invocationText.endsWith(")")) {
      const name = invocationText.slice(0, openParen).trim();
      const argsText = invocationText.slice(openParen + 1, -1);
      const args = splitCommaArguments(argsText);
      semantics.macroInvocation = { name, args };
    } else if (invocationText) {
      semantics.macroInvocation = { name: invocationText.trim(), args: [] };
    }
  }

  if ((keyword === "include" || keyword === "incsrc") && words.length >= 2) {
    semantics.includeTarget = {
      directive: keyword,
      target: words.slice(1).join(" ").trim(),
    };
  }

  const labelSplit = extractLabelSplit(command);
  if (labelSplit) {
    semantics.labelSplit = labelSplit;
  }

  if (["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"].includes(keyword) && words.length >= 2) {
    const payload = command.slice((words[0] ?? "").length).trim();
    semantics.dataDirective = {
      directive: keyword,
      operands: splitCommaArguments(payload),
    };
  }

  if (keyword && !keyword.startsWith("%") && !keyword.startsWith("!")) {
    const payload = command.slice((words[0] ?? "").length).trim();
    const args = semantics.dataDirective?.operands ?? (payload ? splitCommaArguments(payload) : []);
    semantics.directiveArgs = {
      name: keyword,
      args,
    };
    if (!deriveLabelName(words[0] ?? "") && payload) {
      semantics.opcodeOperands = {
        mnemonic: words[0] ?? "",
        operandText: payload,
        operands: args,
      };
    }
  }

  // void command;
  return semantics;
}

/**
 * Extracts the optional `incbin` range suffix from a file argument.
 * @param {string} argument The raw filename or filename-with-range token.
 * @returns {string | undefined} The trailing range expression when present.
 */
function extractIncbinRange(argument: string): string | undefined {
  const colonIndex = argument.indexOf(":");
  if (colonIndex === -1) {
    return undefined;
  }
  return argument.slice(colonIndex + 1);
}

/**
 * Extracts the label split from a command.
 * @param {string} command The command to extract the label split from.
 * @returns {ParsedLabelSplit | undefined} The label split when present.
 */
function extractLabelSplit(command: string): ParsedLabelSplit | undefined {
  const trimmed = command.trim();
  const labelMatch = trimmed.match(/^([$.?A-Z_a-z][\w$.?]*):\s*(.*)$/);
  if (!labelMatch) {
    return undefined;
  }
  const trailing = labelMatch[2].trim();
  return {
    label: labelMatch[1],
    trailing: trailing || undefined,
  };
}

/**
 * Splits comma-separated arguments into an array of strings.
 * Handles quoted strings and nested parentheses.
 * @param {string} input The input string to split.
 * @returns {string[]} An array of split values.
 */
function splitCommaArguments(input: string): string[] {
  const values: string[] = [];
  let current = "";
  let depth = 0;
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === '"' || char === "'") && input[i - 1] !== "\\") {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        inQuote = false;
      }
      current += char;
      continue;
    }
    if (!inQuote && char === "(") {
      depth++;
      current += char;
      continue;
    }
    if (!inQuote && char === ")") {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }
    if (!inQuote && depth === 0 && char === ",") {
      const normalized = current.trim();
      if (normalized) {
        values.push(normalized);
      }
      current = "";
      continue;
    }
    current += char;
  }
  const tail = current.trim();
  if (tail) {
    values.push(tail);
  }
  return values;
}
