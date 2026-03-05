export type SourceSpan = {
  line: number;
  column: number;
  endColumn: number;
};

export type ParsedCommandKind =
  | "label"
  | "instruction"
  | "directive"
  | "macro-call"
  | "fallback";

export interface ParsedCommandBase {
  kind: ParsedCommandKind;
  raw: string;
  sourceLine: number;
}

export interface ParsedLabelCommand extends ParsedCommandBase {
  kind: "label";
  label: string;
}

export interface ParsedInstructionCommand extends ParsedCommandBase {
  kind: "instruction";
  mnemonic: string;
  operand?: string;
}

export interface ParsedDirectiveCommand extends ParsedCommandBase {
  kind: "directive";
  directive: string;
}

export interface ParsedMacroCallCommand extends ParsedCommandBase {
  kind: "macro-call";
  macroName: string;
}

export interface ParsedFallbackCommand extends ParsedCommandBase {
  kind: "fallback";
  reason: string;
}

export type ParsedCommand =
  | ParsedLabelCommand
  | ParsedInstructionCommand
  | ParsedDirectiveCommand
  | ParsedMacroCallCommand
  | ParsedFallbackCommand;

export interface TokenizedWord {
  value: string;
  span: SourceSpan;
}

export interface TokenizedCommand {
  raw: string;
  sourceLine: number;
  words: TokenizedWord[];
}
