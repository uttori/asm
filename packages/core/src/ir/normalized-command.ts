import { incrementInternalCounter } from "../internal-instrumentation.js";
import { createLineSpan, deriveTokenSpans, type SourceSpan } from "../source-location.js";
import type { SourceOrigin } from "../source-provenance.js";
import { parseAssetCall, type ParsedAssetCall } from "./asset-call.js";
import { parseCommandOperation, type CommandOperation } from "./command-operation.js";
import { parseDeclarationNode, type DeclarationNode } from "./declaration-node.js";
import { parseDirectiveExpression } from "./directive-arguments.js";
import {
  parseExpressionAtSite,
  type ExpressionNode,
  type RangeExpressionNode,
} from "./expression-node.js";
import type { SourceSyntax } from "./source-syntax.js";

/** High-level syntactic bucket assigned before semantic lowering runs. */
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

/** Immutable source identity carried with every normalized command occurrence. */
export type CommandProvenance = {
  /** Generated token runs and all physical contributors; borrowed immutable by execution clones. */
  readonly fragment?: import("./source-fragment.js").SourceFragment;
  /** Invocation/include ownership attached to an execution occurrence, never a cached program. */
  readonly origin?: SourceOrigin;
  /** Path of the file containing this occurrence. */
  readonly file: string;
  /** Zero-based source line index for span derivation. */
  readonly line: number;
  /** Original physical line text before normalization. */
  readonly raw: string;
  /** Exact physical source extent before profile rewriting, comments, or continuations. */
  readonly physical?: { readonly text: string };
  /** Normalized command text used for classification and parsing. */
  readonly normalized: string;
  /** Span covering {@link raw} within the source file. */
  readonly span: SourceSpan;
  /** Span covering {@link normalized} within the source file. */
  readonly normalizedSpan: SourceSpan;
  /** Per-token spans aligned with the tokenized words array. */
  readonly tokenSpans: readonly SourceSpan[];
};

/** Front-end command node combining classification, tokens, and parsed semantics. */
export type NormalizedCommand = {
  /** Syntactic bucket inferred from normalized text and tokens. */
  kind: CommandKind;
  /** Source identity and spans for diagnostics and metadata. */
  source: CommandProvenance;
  /** Trimmed normalized command string. */
  command: string;
  /** Tokenized words split from the normalized line. */
  words: readonly string[];
  /** First token, often a directive or mnemonic keyword. */
  keyword: string;
  /** Extracted label name when the line begins with label syntax. */
  labelName?: string;
  /** Static assignment target for simple `name = value` forms. */
  assignmentTarget?: string;
  /** Parsed semantic payloads keyed by construct type. */
  parsed: CommandSemantics;
  /** Pure source AST; semantic rewrites invalidate it and re-enter the parser boundary. */
  syntax?: SourceSyntax;
};

const EMPTY_COMMAND_SPAN: SourceSpan = Object.freeze({ start: 0, end: 0 });
const EMPTY_TOKEN_SPANS: readonly SourceSpan[] = Object.freeze([]);

/**
 * Creates immutable provenance metadata for a normalized command.
 * @param raw The original source line.
 * @param normalized The normalized line after pre-dispatch cleanup.
 * @param words The tokenized command words.
 * @param file The current source file.
 * @param line The current source line number.
 * @param [collectSourceMetadata] Whether to derive precise source spans.
 * @returns The command provenance.
 */
export function createCommandProvenance(
  raw: string,
  normalized: string,
  words: string[],
  file: string,
  line: number,
  collectSourceMetadata = true,
): CommandProvenance {
  if (!collectSourceMetadata) {
    return {
      file,
      line,
      raw,
      normalized,
      span: EMPTY_COMMAND_SPAN,
      normalizedSpan: EMPTY_COMMAND_SPAN,
      tokenSpans: EMPTY_TOKEN_SPANS,
    };
  }
  return {
    file,
    line,
    raw,
    normalized,
    span: createLineSpan(raw, line),
    normalizedSpan: createLineSpan(normalized, line),
    tokenSpans: deriveTokenSpans(raw, words, line),
  };
}

/** Conditional directive payload with a parsed test expression. */
export type ParsedCondition = {
  /** Boolean test expression for `if`, `elseif`, or `while`. */
  expression: ExpressionNode;
};

/** Static assignment payload for `name = expr` commands. */
export type ParsedAssignment = {
  /** Left-hand symbol receiving the value. */
  target: string;
  /** Right-hand expression evaluated at assembly time. */
  expression: ExpressionNode;
};

/** Parsed `for` loop header with an inclusive numeric range. */
export type ParsedForLoop = {
  /** Loop variable name introduced by the directive. */
  variable: string;
  /** Range expression node covering start and end. */
  range: RangeExpressionNode;
  /** Parsed start bound from the range. */
  start: ExpressionNode;
  /** Parsed end bound from the range. */
  end: ExpressionNode;
};

/** Optional byte slice suffix on an `incbin` operand. */
export type ParsedIncbinRange = {
  /** Range expression node after the path colon. */
  range: RangeExpressionNode;
  /** Parsed start bound from the range. */
  start: ExpressionNode;
  /** Parsed end bound from the range. */
  end: ExpressionNode;
};

/** Macro invocation name and actual arguments. */
export type ParsedMacroInvocation = {
  /** Macro symbol invoked, without the leading `%`. */
  name: string;
  /** Comma-split actual arguments when parentheses are present. */
  args: string[];
};

/** Include-family directive with a resolved path operand. */
export type ParsedIncludeTarget = {
  /** Which include directive introduced the path. */
  directive: "include" | "incsrc" | "incbin";
  /** Path token after quote stripping and range removal. */
  target: string;
};

/** Label prefix split from trailing statement text on the same line. */
export type ParsedLabelSplit = {
  /** Label name without the trailing colon. */
  label: string;
  /** Remaining statement text after the label, when non-empty. */
  trailing?: string;
};

/** Data emission directive with comma-split operands. */
export type ParsedDataDirective = {
  /** Lowercased directive keyword such as `db` or `dw`. */
  directive: string;
  /** Operand strings following the directive keyword. */
  operands: string[];
};

/** Generic directive keyword with parsed argument strings. */
export type ParsedDirectiveArgs = {
  /** Directive keyword in lower case. */
  name: string;
  /** Operand strings parsed from the trailing payload. */
  args: string[];
};

/** Instruction mnemonic with operand text split for encoding. */
export type ParsedOpcodeOperands = {
  /** Mnemonic token as authored. */
  mnemonic: string;
  /** Raw operand text following the mnemonic. */
  operandText: string;
  /** Comma-split operand strings derived from the payload. */
  operands: string[];
};

/** Optional semantic payloads attached to one normalized command. */
export type CommandSemantics = {
  /** Structured control-flow or declaration operation when recognized. */
  operation?: CommandOperation;
  /** Bare macro call operation without surrounding syntax sugar. */
  bareInvocation?: Extract<CommandOperation, { kind: "macroCall" }>;
  /** Declaration AST when the line introduces a definition. */
  declaration?: DeclarationNode;
  /** Parsed `includeasset` call site when present. */
  includeAsset?: ParsedAssetCall;
  /** Conditional test for branching directives. */
  condition?: ParsedCondition;
  /** Static assignment form when parsed. */
  assignment?: ParsedAssignment;
  /** `for` loop header when parsed. */
  forLoop?: ParsedForLoop;
  /** `incbin` slice suffix when parsed. */
  incbinRange?: ParsedIncbinRange;
  /** Macro `%name(args)` invocation when parsed. */
  macroInvocation?: ParsedMacroInvocation;
  /** Include path target when parsed. */
  includeTarget?: ParsedIncludeTarget;
  /** Same-line label split when parsed. */
  labelSplit?: ParsedLabelSplit;
  /** Data directive operands when parsed. */
  dataDirective?: ParsedDataDirective;
  /** Generic directive arguments when parsed. */
  directiveArgs?: ParsedDirectiveArgs;
  /** Instruction operand payload when parsed. */
  opcodeOperands?: ParsedOpcodeOperands;
};

/**
 * Builds the normalized command node used by the command pipeline.
 * @param raw The original source line.
 * @param normalized The normalized line after pre-dispatch cleanup.
 * @param words The tokenized command words.
 * @param file The current source file.
 * @param line The current source line number.
 * @param [collectSourceMetadata] Whether to derive precise source spans.
 * @returns The normalized command node.
 */
export function createNormalizedCommand(
  raw: string,
  normalized: string,
  words: string[],
  file: string,
  line: number,
  collectSourceMetadata = true,
): NormalizedCommand {
  const command = normalized.trim();
  const keyword = words[0] ?? "";
  return {
    kind: classifyCommand(command, words),
    source: createCommandProvenance(raw, normalized, words, file, line, collectSourceMetadata),
    command,
    words,
    keyword,
    labelName: deriveLabelName(keyword),
    assignmentTarget: deriveAssignmentTarget(words),
    parsed: deriveCommandSemantics(command, words, line, raw),
  };
}

/**
 * Creates an isolated execution copy so runtime preprocessing can mutate command
 * state without changing cached front-end program nodes.
 * @param command The command to clone.
 * @returns The detached execution command.
 */
export function cloneNormalizedCommand(command: NormalizedCommand): NormalizedCommand {
  incrementInternalCounter("normalizedCommandClones");
  return { ...command };
}

/**
 * Replaces a command node's tokenized words and derived fields.
 * @param command The command node to update.
 * @param words The updated token list.
 * @param [normalized] Optional normalized command text.
 * @returns The same command node for chaining.
 */
export function setCommandWords(
  command: NormalizedCommand,
  words: readonly string[],
  normalized?: string,
): NormalizedCommand {
  delete command.syntax;
  command.words = words;
  command.keyword = words[0] ?? "";
  command.command = (normalized ?? words.join(" ")).trim();
  const normalizedSource = normalized ?? command.command;
  if (command.source.tokenSpans === EMPTY_TOKEN_SPANS) {
    command.source = {
      ...command.source,
      normalized: normalizedSource,
      normalizedSpan: EMPTY_COMMAND_SPAN,
      tokenSpans: EMPTY_TOKEN_SPANS,
    };
  } else {
    command.source = {
      ...command.source,
      normalized: normalizedSource,
      normalizedSpan: createLineSpan(normalizedSource, command.source.line),
      tokenSpans: deriveTokenSpans(command.source.raw, words, command.source.line),
    };
  }
  command.labelName = deriveLabelName(command.keyword);
  command.assignmentTarget = deriveAssignmentTarget(words);
  command.parsed = deriveCommandSemantics(
    command.command,
    words,
    command.source.line,
    command.source.raw,
  );
  command.kind = classifyCommand(command.command, words);
  return command;
}

/**
 * Reclassifies a normalized command without changing any other fields.
 * @param command The command node to update.
 * @param kind The new command kind.
 * @returns The same command node for chaining.
 */
export function setCommandKind(command: NormalizedCommand, kind: CommandKind): NormalizedCommand {
  command.kind = kind;
  return command;
}

/**
 * Applies lightweight heuristics to classify a normalized command.
 * @param command The normalized command text.
 * @param words The tokenized command words.
 * @returns The inferred command kind.
 */
export function classifyCommand(command: string, words: readonly string[]): CommandKind {
  const trimmed = command.trim();
  const keyword = (words[0] ?? "").toLowerCase();
  if (!trimmed || trimmed.startsWith(";")) {
    return "commentOrEmpty";
  }
  // Apostrophe table rows can be one lexer token; their declaration grammar owns the quotes.
  if (/^(["'])[\S\s]\1\s*=/.test(trimmed)) {
    return "characterMapping";
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
  if (
    keyword === "struct" ||
    keyword === "endstruct" ||
    keyword === "skip" ||
    keyword === "datastruct" ||
    keyword === "datastructs" ||
    keyword === "enddatastructs" ||
    /^\[[^\]]+]\s*=/.test(trimmed)
  ) {
    return "structCommand";
  }
  if (keyword === "function") {
    return "functionDefinition";
  }
  if (keyword === "global") {
    return "labelDefinition";
  }
  if (words.length === 3 && (words[1] === "=" || words[1] === ":=")) {
    return "staticAssignment";
  }
  if (deriveLabelName(words[0] ?? "")) {
    return "labelDefinition";
  }
  return keyword ? "opcodeCandidate" : "unknown";
}

/**
 * Extracts a label name from a potential label token.
 * @param keyword The candidate label token.
 * @returns The label name when present.
 */
function deriveLabelName(keyword: string): string | undefined {
  if (!keyword) {
    return undefined;
  }
  if (keyword === ":") {
    return ":";
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
 * @param words The tokenized command words.
 * @returns The assignment target when present.
 */
function deriveAssignmentTarget(words: readonly string[]): string | undefined {
  if (words.length === 3 && (words[1] === "=" || words[1] === ":=")) {
    return words[0];
  }
  return undefined;
}

/**
 * Derives semantic payloads from a normalized command's stable syntax.
 * @param command The normalized command text.
 * @param words The tokenized command words.
 * @param [line] Source line for argument spans.
 * @param [raw] Original source line for same-line label offsets.
 * @returns Parsed semantic payloads keyed by construct type.
 */
function deriveCommandSemantics(
  command: string,
  words: readonly string[],
  line?: number,
  raw = command,
): CommandSemantics {
  const keyword = (words[0] ?? "").toLowerCase();
  const bareKeyword = keyword.startsWith(".") ? keyword.slice(1) : keyword;
  const semantics: CommandSemantics = {};
  const operation = parseCommandOperation(command, raw);
  if (operation) {
    semantics.operation = operation;
  }
  const declaration = parseDeclarationNode(command, words);
  if (declaration) {
    semantics.declaration = declaration;
  }
  if (keyword === "includeasset") {
    semantics.includeAsset = parseAssetCall(raw, line);
  }

  if ((keyword === "if" || keyword === "elseif" || keyword === "while") && words.length > 1) {
    semantics.condition = {
      expression: parseExpressionAtSite(words.slice(1).join(" "), "command"),
    };
  }

  if (keyword === "for" && words.length >= 4 && words[2] === "=") {
    const variable = words[1];
    const parsedRange = parseExpressionAtSite(words.slice(3).join(" "), "command");
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
    (words[1] === "=" || words[1] === ":=") &&
    !(words[0]?.startsWith("'") || words[0]?.startsWith('"'))
  ) {
    semantics.assignment = {
      target: words[0],
      expression: parseDirectiveExpression(words[2], false),
    };
  }

  if (bareKeyword === "incbin" && words.length >= 2) {
    const incbinSource = command
      .slice((words[0] ?? "").length)
      .split(/\s+->\s+/u, 1)[0]
      .trim();
    const colonIndex = incbinSource.indexOf(":");
    const rangeCandidate = colonIndex === -1 ? undefined : incbinSource.slice(colonIndex + 1);
    if (rangeCandidate) {
      const parsedRange = parseExpressionAtSite(rangeCandidate, "command");
      if (parsedRange.type === "range") {
        semantics.incbinRange = {
          range: parsedRange,
          start: parsedRange.start,
          end: parsedRange.end,
        };
      }
    }
    const includePath = extractIncludePath(incbinSource);
    if (includePath) {
      semantics.includeTarget = { directive: "incbin", target: includePath };
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

  if ((bareKeyword === "include" || bareKeyword === "incsrc") && words.length >= 2) {
    semantics.includeTarget = {
      directive: bareKeyword,
      target: words.slice(1).join(" ").trim(),
    };
  }

  const labelSplit = extractLabelSplit(command);
  if (labelSplit) {
    semantics.labelSplit = labelSplit;
  }

  if (["db", "dw", "dl", "dd", "dc.b", "dc.w", "dc.l"].includes(keyword)) {
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

  // void command.
  return semantics;
}

/**
 * Extracts an include/incbin path, stripping quotes and an optional `:range` suffix.
 * @param raw The raw filename operand.
 * @returns The path token.
 */
function extractIncludePath(raw: string): string {
  const trimmed = raw.trim();
  const quote = trimmed[0];
  if (quote === '"' || quote === "'" || quote === "`") {
    const end = trimmed.indexOf(quote, 1);
    if (end !== -1) {
      return trimmed.slice(1, end);
    }
  }
  const colonIndex = trimmed.indexOf(":");
  const pathToken = colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex);
  return pathToken.replace(/^["'`]+|["'`]+$/g, "");
}

/**
 * Extracts the label split from a command.
 * @param command The command to extract the label split from.
 * @returns The label split when present.
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
 * @param input The input string to split.
 * @returns An array of split values.
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
