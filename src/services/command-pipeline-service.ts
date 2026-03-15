import {
  createNormalizedCommand,
  setCommandKind,
  setCommandWords,
  type NormalizedCommand,
} from "../ir/normalized-command.js";

export type CommandPipelineHost = {
  splitCommandIntoWords(command: string): string[];
  currentFile: string;
  currentLine: number;
  handleCharacterMapping(command: NormalizedCommand): void;
  recordCurrentAddress(): void;
};

export type FrontEndHandlers = {
  continueFunctionDefinition(command: string): boolean;
  startFunctionDefinition(command: NormalizedCommand): boolean;
  handleRelativeLabelDefinition(command: NormalizedCommand): boolean;
  handleGlobalLabel(command: NormalizedCommand): boolean;
  consumeNamedLabelDefinitions(command: NormalizedCommand): boolean;
  handleStaticLabelAssignment(command: NormalizedCommand): boolean;
};

export type MacroHandlers = {
  rewriteMacroLabelReferences(command: string): string;
  handleDefinitionCommand(command: NormalizedCommand): boolean;
};

export type DefineHandlers = {
  handleCommand(command: NormalizedCommand): boolean;
};

export type StructHandlers = {
  handleStructMode(command: NormalizedCommand): boolean;
};

export type PreDispatchHandlers = {
  interceptRawCommand(command: string): boolean;
  normalizeCommand(command: string): string;
  shouldSkipForCondition(command: NormalizedCommand): boolean;
  shouldSkipForInlineCondition(command: NormalizedCommand): boolean;
  resolveElseIf(command: NormalizedCommand): void;
};

export type PreprocessResult = "continue" | "handled" | "skipped_for_condition";

export class CommandPipelineService {
  constructor(
    readonly host: CommandPipelineHost,
    readonly frontEndHandlers: FrontEndHandlers,
    readonly macroHandlers: MacroHandlers,
    readonly defineHandlers: DefineHandlers,
    readonly structHandlers: StructHandlers,
    readonly preDispatchHandlers: PreDispatchHandlers,
  ) {}

  rewriteRawCommand(command: string): string {
    return this.macroHandlers.rewriteMacroLabelReferences(command);
  }

  interceptRawCommand(command: string): boolean {
    return this.preDispatchHandlers.interceptRawCommand(command) || this.frontEndHandlers.continueFunctionDefinition(command);
  }

  create(command: string): NormalizedCommand | null {
    const normalizedCommand = this.preDispatchHandlers.normalizeCommand(command);
    const words = this.host.splitCommandIntoWords(normalizedCommand);
    if (words.length === 0) {
      return null;
    }

    return createNormalizedCommand(command, normalizedCommand, words, this.host.currentFile, this.host.currentLine);
  }

  preprocess(state: NormalizedCommand): PreprocessResult {
    if (state.words.length === 3 && state.words[1] === "=" && (state.words[0].startsWith("'") || state.words[0].startsWith('"'))) {
      setCommandKind(state, "characterMapping");
      this.host.handleCharacterMapping(state);
      return "handled";
    }

    if (this.frontEndHandlers.startFunctionDefinition(state)) {
      return "handled";
    }

    if (this.macroHandlers.handleDefinitionCommand(state)) {
      return "handled";
    }

    if (this.preDispatchHandlers.shouldSkipForCondition(state)) {
      return "skipped_for_condition";
    }

    if (this.defineHandlers.handleCommand(state)) {
      if (state.command.includes("=")) {
        this.host.recordCurrentAddress();
      }
      return "handled";
    }

    if (this.structHandlers.handleStructMode(state)) {
      return "handled";
    }

    if (this.frontEndHandlers.handleRelativeLabelDefinition(state)) {
      return "handled";
    }

    if (this.frontEndHandlers.handleGlobalLabel(state)) {
      return "handled";
    }

    if (this.frontEndHandlers.consumeNamedLabelDefinitions(state)) {
      return "handled";
    }

    if (this.frontEndHandlers.handleStaticLabelAssignment(state)) {
      return "handled";
    }

    return "continue";
  }

  prepareForDispatch(state: NormalizedCommand): boolean {
    if (this.preDispatchHandlers.shouldSkipForInlineCondition(state)) {
      return false;
    }

    this.preDispatchHandlers.resolveElseIf(state);
    if (state.kind === "unknown") {
      setCommandWords(state, state.words, state.command);
      setCommandKind(state, "opcodeCandidate");
    }
    return true;
  }
}
