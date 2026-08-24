import {
  preprocessBlockCommands as preprocessCommandBlock,
  removeInlineComment,
  splitCommandIntoWords,
} from "./command-text-service.js";
import type { ExecutableNode } from "../ir/assembly-tree.js";
import { ProgramModelBuilder } from "./program-model-builder.js";
import { createNormalizedCommand, type NormalizedCommand } from "../ir/normalized-command.js";

export type AssemblyFrontEndHost = {
  currentFile: string;
  currentLine: number;
  passProgramCache: Map<string, ExecutableNode[]>;
  inMacroExpansion: boolean;
  isDefinitionCollectionStage: boolean;
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
    const processed = preprocessCommandBlock(block, this.commandBuffer);
    this.commandBuffer = processed.commandBuffer;
    return processed.commands;
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
    let normalizedCommand = removeInlineComment(command);

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

    return createNormalizedCommand(command, normalizedCommand, words, sourceFile, sourceLine);
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
      createNormalizedCommand(command, "", [], sourceFile, sourceLine)
    );
  }
}
