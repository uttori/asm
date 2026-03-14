export type CommandKind =
  | "unknown"
  | "directive"
  | "opcodeCandidate"
  | "labelDefinition"
  | "staticAssignment"
  | "characterMapping"
  | "macroDefinitionOrInvoke"
  | "defineCommand"
  | "structCommand"
  | "commentOrEmpty";

export type CommandProvenance = {
  file: string;
  line: number;
  raw: string;
  normalized: string;
};

export type NormalizedCommand = {
  kind: CommandKind;
  source: CommandProvenance;
  command: string;
  words: string[];
  keyword: string;
  labelName?: string;
  assignmentTarget?: string;
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
    source: {
      file,
      line,
      raw,
      normalized,
    },
    command,
    words,
    keyword,
    labelName: deriveLabelName(keyword),
    assignmentTarget: deriveAssignmentTarget(words),
  };
}

/**
 * Creates a lightweight command node for deferred loop or macro collection.
 * @param {string} raw The unprocessed source line.
 * @param {string} file The current source file.
 * @param {number} line The current source line number.
 * @returns {NormalizedCommand} The pending command node.
 */
export function createPendingCommand(raw: string, file: string, line: number): NormalizedCommand {
  const trimmed = raw.trim();
  return {
    kind: classifyCommand(trimmed, []),
    source: {
      file,
      line,
      raw,
      normalized: raw,
    },
    command: trimmed,
    words: [],
    keyword: "",
  };
}

/**
 * Replaces a command node's tokenized words and derived fields.
 * @param {NormalizedCommand} command The command node to update.
 * @param {string[]} words The updated token list.
 * @param {string} [normalized] Optional normalized command text.
 * @returns {NormalizedCommand} The same command node for chaining.
 */
export function setCommandWords(command: NormalizedCommand, words: string[], normalized?: string): NormalizedCommand {
  command.words = words;
  command.keyword = words[0] ?? "";
  command.command = (normalized ?? words.join(" ")).trim();
  command.source.normalized = normalized ?? command.command;
  command.labelName = deriveLabelName(command.keyword);
  command.assignmentTarget = deriveAssignmentTarget(words);
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
function classifyCommand(command: string, words: string[]): CommandKind {
  const trimmed = command.trim();
  const keyword = (words[0] ?? "").toLowerCase();
  if (!trimmed || trimmed.startsWith(";")) {
    return "commentOrEmpty";
  }
  if (words.length === 3 && words[1] === "=" && (words[0]?.startsWith("'") || words[0]?.startsWith("\""))) {
    return "characterMapping";
  }
  if (trimmed.startsWith("!")) {
    return "defineCommand";
  }
  if (keyword === "macro" || keyword.startsWith("%")) {
    return "macroDefinitionOrInvoke";
  }
  if (keyword === "struct" || keyword === "endstruct") {
    return "structCommand";
  }
  if (words.length === 3 && words[1] === "=") {
    return "staticAssignment";
  }
  if (deriveLabelName(words[0] ?? "")) {
    return "labelDefinition";
  }
  return "unknown";
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
function deriveAssignmentTarget(words: string[]): string | undefined {
  if (words.length === 3 && words[1] === "=") {
    return words[0];
  }
  return undefined;
}
