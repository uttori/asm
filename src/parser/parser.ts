import type {
  ParsedCommand,
  ParsedDirectiveCommand,
  ParsedFallbackCommand,
  ParsedInstructionCommand,
  ParsedLabelCommand,
  ParsedMacroCallCommand,
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

const isMacroCall = (firstWord: string): boolean => {
  if (!firstWord) {
    return false;
  }
  if (firstWord.startsWith("!")) {
    return false;
  }
  // Keep this permissive; parser is allowed to classify uncertain inputs
  // into macro-call and rely on legacy execution behavior.
  return /^[A-Za-z_?][\w?.-]*$/.test(firstWord);
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
      label: raw.slice(0, -1)
    };
    return label;
  }

  if (isDirective(firstWord)) {
    const directive: ParsedDirectiveCommand = {
      kind: "directive",
      raw,
      sourceLine: tokenized.sourceLine,
      directive: firstWord
    };
    return directive;
  }

  if (tokenized.words.length >= 2) {
    const instruction: ParsedInstructionCommand = {
      kind: "instruction",
      raw,
      sourceLine: tokenized.sourceLine,
      mnemonic: firstWord,
      operand: raw.slice(firstWord.length).trim() || undefined
    };
    return instruction;
  }

  if (isMacroCall(firstWord)) {
    const macroCall: ParsedMacroCallCommand = {
      kind: "macro-call",
      raw,
      sourceLine: tokenized.sourceLine,
      macroName: firstWord
    };
    return macroCall;
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
