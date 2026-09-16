import { createNormalizedCommand } from "../ir/normalized-command.js";
import { preprocessBlockCommands as preprocessCommandBlock, removeInlineComment, splitInlineCommands, splitSourcedInlineCommands, splitCommandIntoWords, } from "./command-text-service.js";
import { ProgramModelBuilder } from "./program-model-builder.js";
import { isOpenStructInitializer } from "./struct-initializer.js";
/**
 * Owns command buffering, normalization, and typed program-tree construction so
 * the assembler session can focus on execution instead of front-end shaping.
 */
export class AssemblyFrontEndService {
    host;
    commandBuffer = "";
    /** Opening physical line when processCommand receives a record one line at a time. */
    structBufferStart;
    programModelBuilder;
    constructor(host) {
        this.host = host;
        this.programModelBuilder = new ProgramModelBuilder({
            currentFile: this.host.currentFile,
            currentLine: this.host.currentLine,
            passProgramCache: this.host.passProgramCache,
            preprocessBlockCommands: (source) => this.preprocessBlockCommands(source),
            splitInlineCommands: (commands) => this.splitInlineCommands(commands),
            preprocessSourcedBlockCommands: (source) => this.preprocessSourcedBlockCommands(source),
            splitSourcedInlineCommands: (commands) => this.splitSourcedInlineCommands(commands),
            createLoopCommandNode: (command, sourceFile, sourceLine) => this.createLoopCommandNode(command, sourceFile, sourceLine),
            shouldEndifCloseInnermostWhile: (loopType, loopStartLine, ifStartLine) => this.host.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
        });
    }
    /**
     * Preprocesses raw source blocks while preserving continued-line buffering.
     * @param {string} block The raw source block.
     * @returns {string[]} The normalized commands.
     */
    preprocessBlockCommands(block) {
        return this.preprocessSourcedBlockCommands(block).map((command) => command.text);
    }
    /**
     * Preprocesses raw source blocks, tagging each command with its original line.
     * @param {string} block The raw source block.
     * @returns {SourcedCommand[]} The normalized sourced commands.
     */
    preprocessSourcedBlockCommands(block) {
        const opening = this.structBufferStart;
        if (opening && opening.file !== this.host.currentFile) {
            throw new Error(`Unclosed dataStruct initializer in '${opening.file}'.`);
        }
        const processed = preprocessCommandBlock(block, this.commandBuffer, this.host.syntaxProfile);
        if (opening && processed.sourcedCommands.length > 0) {
            // SourcedCommand lines are relative to this input block. A negative line
            // points back into an earlier incremental call, where the literal opened.
            processed.sourcedCommands[0].line = opening.line - this.host.currentLine;
        }
        this.commandBuffer = processed.commandBuffer;
        if (isOpenStructInitializer(this.commandBuffer)) {
            if (!opening || processed.sourcedCommands.length > 0) {
                const lines = block.split("\n");
                const start = lines.findLastIndex((line) => /^(?:datastruct\b|\[)/i.test(line.trimStart()));
                this.structBufferStart = {
                    file: this.host.currentFile,
                    line: this.host.currentLine + Math.max(0, start),
                };
            }
        }
        else
            this.structBufferStart = undefined;
        return processed.sourcedCommands;
    }
    /**
     * Splits statements according to the active target's source grammar.
     * @param {string[]} commands Commands to split.
     * @returns {string[]} Profile-aware command statements.
     */
    splitInlineCommands(commands) {
        return splitInlineCommands(commands, this.host.syntaxProfile);
    }
    /**
     * Splits sourced statements according to the active target's source grammar.
     * @param {SourcedCommand[]} commands Sourced commands to split.
     * @returns {SourcedCommand[]} Profile-aware sourced command statements.
     */
    splitSourcedInlineCommands(commands) {
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
    createNormalizedCommandFromRaw(command, sourceFile, sourceLine, allowEmpty = false) {
        let normalizedCommand = removeInlineComment(command, this.host.syntaxProfile);
        normalizedCommand =
            this.host.syntaxProfile.rewriteCommand?.(normalizedCommand, {
                sourceFile,
                sourceLine,
            }) ?? normalizedCommand;
        if (this.host.inMacroExpansion &&
            !this.host.isDefinitionCollectionStage &&
            (normalizedCommand.includes("...") || normalizedCommand.includes("…"))) {
            normalizedCommand = this.host.resolveVariadicPlaceholders(normalizedCommand);
        }
        const words = splitCommandIntoWords(normalizedCommand);
        if (!allowEmpty && words.length === 0) {
            return null;
        }
        return createNormalizedCommand(command, normalizedCommand, words, sourceFile, sourceLine, this.host.collectSourceMetadata);
    }
    /**
     * Creates a loop-aware normalized command node for the typed parser.
     * @param {string} command The raw command text.
     * @param {string} [sourceFile] Optional source file.
     * @param {number} [sourceLine] Optional source line.
     * @returns {NormalizedCommand} The normalized node.
     */
    createLoopCommandNode(command, sourceFile = this.host.currentFile, sourceLine = this.host.currentLine) {
        return (this.createNormalizedCommandFromRaw(command, sourceFile, sourceLine, true) ??
            createNormalizedCommand(command, "", [], sourceFile, sourceLine, this.host.collectSourceMetadata));
    }
}
//# sourceMappingURL=assembly-front-end-service.js.map