import {
  preprocessBlockCommands as preprocessCommandBlock,
  removeInlineComment,
  splitInlineCommands,
  splitSourcedInlineCommands,
  splitCommandIntoWords,
  type SourcedCommand,
} from "./command-text-service.js";
import type { ExecutableNode } from "../ir/assembly-tree.js";
import { ProgramModelBuilder } from "./program-model-builder.js";
import { createNormalizedCommand, type NormalizedCommand } from "../ir/normalized-command.js";
import type { SyntaxProfile } from "../syntax-profile.js";

export type AssemblyFrontEndHost = {
  currentFile: string;
  currentLine: number;
  passProgramCache: Map<string, ExecutableNode[]>;
  collectSourceMetadata: boolean;
  inMacroExpansion: boolean;
  isDefinitionCollectionStage: boolean;
  syntaxProfile: SyntaxProfile;
  resolveVariadicPlaceholders(command: string): string;
  shouldEndifCloseInnermostWhile(
    loopType?: "for" | "while",
    loopStartLine?: number,
    ifStartLine?: number,
  ): boolean;
};

/**
 * Owns command buffering, normalization, and typed program-tree construction so
 * the assembler session can focus on execution instead of front-end shaping.
 */
export class AssemblyFrontEndService {
  commandBuffer = "";

  readonly programModelBuilder: ProgramModelBuilder;

  constructor(readonly host: AssemblyFrontEndHost) {
    this.programModelBuilder = new ProgramModelBuilder({
      currentFile: this.host.currentFile,
      currentLine: this.host.currentLine,
      passProgramCache: this.host.passProgramCache,
      preprocessBlockCommands: (source: string) => this.preprocessBlockCommands(source),
      splitInlineCommands: (commands: string[]) => this.splitInlineCommands(commands),
      preprocessSourcedBlockCommands: (source: string) =>
        this.preprocessSourcedBlockCommands(source),
      splitSourcedInlineCommands: (commands: SourcedCommand[]) =>
        this.splitSourcedInlineCommands(commands),
      createLoopCommandNode: (command: string, sourceFile?: string, sourceLine?: number) =>
        this.createLoopCommandNode(command, sourceFile, sourceLine),
      shouldEndifCloseInnermostWhile: (
        loopType?: "for" | "while",
        loopStartLine?: number,
        ifStartLine?: number,
      ) => this.host.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
    });
  }

  /**
   * Preprocesses raw source blocks while preserving continued-line buffering.
   * @param {string} block The raw source block.
   * @returns {string[]} The normalized commands.
   */
  preprocessBlockCommands(block: string): string[] {
    return this.preprocessSourcedBlockCommands(block).map((command) => command.text);
  }

  /**
   * Preprocesses raw source blocks, tagging each command with its original line.
   * @param {string} block The raw source block.
   * @returns {SourcedCommand[]} The normalized sourced commands.
   */
  preprocessSourcedBlockCommands(block: string): SourcedCommand[] {
    const processed = preprocessCommandBlock(block, this.commandBuffer, this.host.syntaxProfile);
    this.commandBuffer = processed.commandBuffer;
    return processed.sourcedCommands;
  }

  /**
   * Splits statements according to the active target's source grammar.
   * @param {string[]} commands Commands to split.
   * @returns {string[]} Profile-aware command statements.
   */
  splitInlineCommands(commands: string[]): string[] {
    return splitInlineCommands(commands, this.host.syntaxProfile);
  }

  /**
   * Splits sourced statements according to the active target's source grammar.
   * @param {SourcedCommand[]} commands Sourced commands to split.
   * @returns {SourcedCommand[]} Profile-aware sourced command statements.
   */
  splitSourcedInlineCommands(commands: SourcedCommand[]): SourcedCommand[] {
    return splitSourcedInlineCommands(commands, this.host.syntaxProfile);
  }

  /**
   * Builds a normalized command from raw source text.
   * @param {string} command The raw command text.
   * @param {string} sourceFile The command source file.
   * @param {number} sourceLine The source line number.
   * @param {boolean} [allowEmpty] When true, empty commands still produce nodes.
   * @returns {NormalizedCommand | null} The normalized command or null for empty input.
   */
  createNormalizedCommandFromRaw(
    command: string,
    sourceFile: string,
    sourceLine: number,
    allowEmpty = false,
  ): NormalizedCommand | null {
    let normalizedCommand = removeInlineComment(command, this.host.syntaxProfile);

    if (
      this.host.inMacroExpansion &&
      !this.host.isDefinitionCollectionStage &&
      (normalizedCommand.includes("...") || normalizedCommand.includes("…"))
    ) {
      normalizedCommand = this.host.resolveVariadicPlaceholders(normalizedCommand);
    }

    const words = splitCommandIntoWords(normalizedCommand);
    if (!allowEmpty && words.length === 0) {
      return null;
    }

    return createNormalizedCommand(
      command,
      normalizedCommand,
      words,
      sourceFile,
      sourceLine,
      this.host.collectSourceMetadata,
    );
  }

  /**
   * Creates a loop-aware normalized command node for the typed parser.
   * @param {string} command The raw command text.
   * @param {string} [sourceFile] Optional source file.
   * @param {number} [sourceLine] Optional source line.
   * @returns {NormalizedCommand} The normalized node.
   */
  createLoopCommandNode(
    command: string,
    sourceFile = this.host.currentFile,
    sourceLine = this.host.currentLine,
  ): NormalizedCommand {
    return (
      this.createNormalizedCommandFromRaw(command, sourceFile, sourceLine, true) ??
      createNormalizedCommand(
        command,
        "",
        [],
        sourceFile,
        sourceLine,
        this.host.collectSourceMetadata,
      )
    );
  }
}
