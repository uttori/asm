import type {
  ParsedCommand,
  ParsedDirectiveCommand,
  ParsedFallbackCommand,
  ParsedInstructionCommand,
  ParsedLabelCommand,
  TokenizedCommand
} from "./ir.js";

const COMMON_DIRECTIVES = new Set([
  "arch",
  "base",
  "bank",
  "db",
  "dw",
  "dl",
  "dd",
  "fill",
  "incbin",
  "incsrc",
  "include",
  "if",
  "elseif",
  "else",
  "endif",
  "while",
  "endwhile",
  "for",
  "endfor",
  "macro",
  "endmacro",
  "function",
  "endfunction",
  "namespace",
  "endnamespace",
  "struct",
  "endstruct",
  "table",
  "pushtable",
  "pulltable",
  "pushpc",
  "pullpc",
  "org",
  "warnpc",
  "pad",
  "padbyte",
  "lorom",
  "hirom",
  "norom"
]);

const isLikelyLabel = (raw: string): boolean => {
  const trimmed = raw.trim();
  return trimmed.endsWith(":") && !trimmed.includes(" ");
};

const splitArguments = (input: string): string[] => {
  if (!input.trim()) {
    return [];
  }

  const out: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  let parenDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if ((char === "\"" || char === "'") && input[i - 1] !== "\\") {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        inQuote = false;
      }
      current += char;
      continue;
    }

    if (!inQuote) {
      if (char === "(") {
        parenDepth++;
      } else if (char === ")" && parenDepth > 0) {
        parenDepth--;
      } else if (char === "," && parenDepth === 0) {
        out.push(current.trim());
        current = "";
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    out.push(current.trim());
  }
  return out;
};

const isDirective = (firstWord: string): boolean => {
  if (!firstWord) {
    return false;
  }
  if (firstWord.startsWith(".")) {
    return true;
  }
  const lowercase = firstWord.toLowerCase();
  return COMMON_DIRECTIVES.has(lowercase);
};

const parseOne = (tokenized: TokenizedCommand): ParsedCommand => {
  const raw = tokenized.raw;
  const firstWord = tokenized.words[0]?.value ?? "";

  if (!firstWord) {
    const fallback: ParsedFallbackCommand = {
      kind: "fallback",
      raw,
      sourceLine: tokenized.sourceLine,
      reason: "empty-command"
    };
    return fallback;
  }

  if (isLikelyLabel(raw)) {
    const label: ParsedLabelCommand = {
      kind: "label",
      raw,
      sourceLine: tokenized.sourceLine,
      labelKind: "declaration",
      labelName: raw.slice(0, -1)
    };
    return label;
  }

  if (isDirective(firstWord)) {
    const argumentsRaw = raw.slice(firstWord.length).trim();
    const directive: ParsedDirectiveCommand = {
      kind: "directive",
      raw,
      sourceLine: tokenized.sourceLine,
      directive: firstWord,
      argumentsRaw,
      arguments: splitArguments(argumentsRaw)
    };
    return directive;
  }

  if (tokenized.words.length >= 2) {
    const operandRaw = raw.slice(firstWord.length).trim();
    const instruction: ParsedInstructionCommand = {
      kind: "instruction",
      raw,
      sourceLine: tokenized.sourceLine,
      mnemonic: firstWord,
      operand: operandRaw || undefined,
      operands: splitArguments(operandRaw),
      isImmediate: operandRaw.startsWith("#")
    };
    return instruction;
  }

  const fallback: ParsedFallbackCommand = {
    kind: "fallback",
    raw,
    sourceLine: tokenized.sourceLine,
    reason: "unclassified-command"
  };
  return fallback;
};

export const parseTokenizedCommands = (tokenizedCommands: TokenizedCommand[]): ParsedCommand[] =>
  tokenizedCommands.map(parseOne);
