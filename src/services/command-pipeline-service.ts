export type CommandPipelineState = {
  command: string;
  words: string[];
  keyword: string;
};

export type CommandPipelineHost = {
  splitCommandIntoWords(command: string): string[];
  handleCharacterMapping(words: string[]): void;
  recordCurrentAddress(): void;
};

export type FrontEndHandlers = {
  continueFunctionDefinition(command: string): boolean;
  startFunctionDefinition(keyword: string, words: string[]): boolean;
  handleRelativeLabelDefinition(keyword: string): boolean;
  handleGlobalLabel(words: string[]): boolean;
  consumeNamedLabelDefinitions(words: string[], keyword: string): string[];
  handleStaticLabelAssignment(words: string[], keyword: string): boolean;
};

export type MacroHandlers = {
  rewriteMacroLabelReferences(command: string): string;
  handleDefinitionCommand(command: string, keyword: string, words: string[]): boolean;
};

export type DefineHandlers = {
  handleCommand(command: string): boolean;
};

export type StructHandlers = {
  handleStructMode(words: string[]): boolean;
};

export type PreDispatchHandlers = {
  interceptRawCommand(command: string): boolean;
  normalizeCommand(command: string): string;
  shouldSkipForCondition(keyword: string): boolean;
  shouldSkipForInlineCondition(keyword: string): boolean;
  resolveElseIfWords(keyword: string, command: string, words: string[]): string[];
};

export type PreprocessResult = "continue" | "handled" | "skipped_for_condition";

export class CommandPipelineService {
  constructor(
    private readonly host: CommandPipelineHost,
    private readonly frontEndHandlers: FrontEndHandlers,
    private readonly macroHandlers: MacroHandlers,
    private readonly defineHandlers: DefineHandlers,
    private readonly structHandlers: StructHandlers,
    private readonly preDispatchHandlers: PreDispatchHandlers,
  ) {}

  rewriteRawCommand(command: string): string {
    return this.macroHandlers.rewriteMacroLabelReferences(command);
  }

  interceptRawCommand(command: string): boolean {
    return this.preDispatchHandlers.interceptRawCommand(command) || this.frontEndHandlers.continueFunctionDefinition(command);
  }

  create(command: string): CommandPipelineState | null {
    const normalizedCommand = this.preDispatchHandlers.normalizeCommand(command);
    const words = this.host.splitCommandIntoWords(normalizedCommand);
    if (words.length === 0) {
      return null;
    }

    return {
      command: normalizedCommand,
      words,
      keyword: words[0],
    };
  }

  preprocess(state: CommandPipelineState): PreprocessResult {
    if (state.words.length === 3 && state.words[1] === "=" && (state.words[0].startsWith("'") || state.words[0].startsWith('"'))) {
      this.host.handleCharacterMapping(state.words);
      return "handled";
    }

    if (this.frontEndHandlers.startFunctionDefinition(state.keyword, state.words)) {
      return "handled";
    }

    if (this.macroHandlers.handleDefinitionCommand(state.command, state.keyword, state.words)) {
      return "handled";
    }

    if (this.preDispatchHandlers.shouldSkipForCondition(state.keyword)) {
      return "skipped_for_condition";
    }

    if (this.defineHandlers.handleCommand(state.command)) {
      if (state.command.includes("=")) {
        this.host.recordCurrentAddress();
      }
      return "handled";
    }

    if (this.structHandlers.handleStructMode(state.words)) {
      return "handled";
    }

    if (this.frontEndHandlers.handleRelativeLabelDefinition(state.keyword)) {
      return "handled";
    }

    if (this.frontEndHandlers.handleGlobalLabel(state.words)) {
      return "handled";
    }

    state.words = this.frontEndHandlers.consumeNamedLabelDefinitions(state.words, state.keyword);
    if (state.words.length === 0) {
      return "handled";
    }

    if (this.frontEndHandlers.handleStaticLabelAssignment(state.words, state.keyword)) {
      return "handled";
    }

    state.keyword = state.words[0] ?? state.keyword;
    return "continue";
  }

  prepareForDispatch(state: CommandPipelineState): boolean {
    if (this.preDispatchHandlers.shouldSkipForInlineCondition(state.keyword)) {
      return false;
    }

    state.words = this.preDispatchHandlers.resolveElseIfWords(state.keyword, state.command, state.words);
    state.keyword = state.words[0] ?? state.keyword;
    return true;
  }
}
