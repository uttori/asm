import { incrementInternalCounter, recordInternalCounterPeak, } from "../internal-instrumentation.js";
import { setCommandKind } from "../ir/normalized-command.js";
/**
 * Builds reusable program models from command streams.
 */
export class ProgramModelBuilder {
    host;
    constructor(host) {
        this.host = host;
    }
    /**
     * Creates an incremental parser state for line-by-line assembly.
     * @returns {IncrementalProgramParseState} The parser state.
     */
    createIncrementalParseState() {
        return {
            roots: [],
            loopStack: [],
            ifStack: [],
            branchStack: [],
            inMacroDefinition: false,
            inFunctionDefinition: false,
        };
    }
    /**
     * Resets an incremental parser state in place.
     * @param {IncrementalProgramParseState} state The parser state.
     */
    resetIncrementalParseState(state) {
        state.roots.length = 0;
        state.loopStack.length = 0;
        state.ifStack.length = 0;
        state.branchStack.length = 0;
        state.inMacroDefinition = false;
        state.inFunctionDefinition = false;
        state.inDataStructs = false;
    }
    /**
     * Builds a program model from raw source text.
     * @param {string} source The source block to parse.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ProgramModel} The parsed program model.
     */
    buildProgramModel(source, sourceFile = this.host.currentFile, startLine = 0) {
        const commands = this.host.splitSourcedInlineCommands(this.host.preprocessSourcedBlockCommands(source));
        return {
            sourceFile,
            startLine,
            nodes: this.getOrBuildPassProgram(commands, sourceFile, startLine),
        };
    }
    /**
     * Creates a typed include node from a source file body.
     * @param {string} file The include file name.
     * @param {string} source The include source content.
     * @returns {IncludeProgramNode} The include node.
     */
    createIncludeNode(file, source) {
        const commands = this.host.splitSourcedInlineCommands(this.host.preprocessSourcedBlockCommands(source));
        return {
            type: "include",
            file,
            commands: this.getOrBuildPassProgram(commands, file, 0),
        };
    }
    /**
     * Returns cached executable nodes for a command stream.
     * @param {Array<string | SourcedCommand>} commands The command stream.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ExecutableNode[]} The cached or parsed nodes.
     */
    getOrBuildPassProgram(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine) {
        // Include source line numbers so identical text at different locations has distinct cache entries.
        const commandStream = commands
            .map((command) => (typeof command === "string" ? command : `${command.line}:${command.text}`))
            .join("\n");
        const cacheKey = `${sourceFile}::${startLine}::${commandStream}`;
        const cached = this.host.passProgramCache.get(cacheKey);
        if (cached) {
            incrementInternalCounter("passProgramCacheHits");
            return cached;
        }
        incrementInternalCounter("passProgramCacheMisses");
        const nodes = this.parseCommandStreamToNodes(commands, sourceFile, startLine);
        this.host.passProgramCache.set(cacheKey, nodes);
        recordInternalCounterPeak("passProgramCachePeakSize", this.host.passProgramCache.size);
        return nodes;
    }
    /**
     * Consumes one raw command into an incremental parse state and returns newly
     * completed top-level executable nodes.
     * @param {IncrementalProgramParseState} state The parser state.
     * @param {string} rawCommand The raw command to consume.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [sourceLine] Optional source line override.
     * @returns {ExecutableNode[]} Newly completed top-level nodes.
     */
    consumeIncrementalCommand(state, rawCommand, sourceFile = this.host.currentFile, sourceLine = this.host.currentLine) {
        this.consumeCommandIntoState(state, rawCommand, sourceFile, sourceLine);
        return this.drainCompletedRoots(state);
    }
    /**
     * Parses a flat command stream into nested executable nodes.
     * @param {Array<string | SourcedCommand>} commands The command stream.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ExecutableNode[]} The executable nodes.
     */
    parseCommandStreamToNodes(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine) {
        const state = this.createIncrementalParseState();
        for (let index = 0; index < commands.length; index++) {
            const command = commands[index];
            const text = typeof command === "string" ? command : command.text;
            const sourceLine = typeof command === "string" ? startLine + index : startLine + command.line;
            this.consumeCommandIntoState(state, text, sourceFile, sourceLine);
        }
        return state.roots;
    }
    /**
     * Pushes to current.
     * @param {IncrementalProgramParseState} state The state.
     * @param {ExecutableNode} node The node.
     */
    pushToCurrent(state, node) {
        const currentBranch = state.branchStack[state.branchStack.length - 1];
        const currentLoop = state.loopStack[state.loopStack.length - 1];
        if (currentBranch && currentLoop) {
            if (currentLoop.startLine >= currentBranch.startLine) {
                currentLoop.commands.push(node);
            }
            else {
                currentBranch.commands.push(node);
            }
            return;
        }
        if (currentBranch) {
            currentBranch.commands.push(node);
            return;
        }
        if (currentLoop) {
            currentLoop.commands.push(node);
            return;
        }
        state.roots.push(node);
    }
    /**
     * Consumes command into state.
     * @param {IncrementalProgramParseState} state The state.
     * @param {string} rawCommand The raw command.
     * @param {string} sourceFile The source file.
     * @param {number} sourceLine The source line.
     */
    consumeCommandIntoState(state, rawCommand, sourceFile, sourceLine) {
        const command = this.host.createLoopCommandNode(rawCommand, sourceFile, sourceLine);
        const keyword = command.keyword.toLowerCase();
        if (keyword === "macro") {
            state.inMacroDefinition = true;
            this.pushToCurrent(state, command);
            return;
        }
        if (state.inMacroDefinition) {
            // Macro bodies are stored as source commands and interpreted when the
            // macro expands. Even instruction-looking lines require preprocessing.
            setCommandKind(command, "macroDefinitionOrInvoke");
            this.pushToCurrent(state, command);
            if (keyword === "endmacro") {
                state.inMacroDefinition = false;
            }
            return;
        }
        // A record table is a data-only block. Preserve even malformed/control-like
        // rows for its runtime validator instead of interpreting them as if/for/org.
        if (state.inDataStructs || keyword === "datastructs") {
            state.inDataStructs = keyword !== "enddatastructs";
            setCommandKind(command, "structCommand");
            this.pushToCurrent(state, command);
            return;
        }
        if (state.inFunctionDefinition) {
            setCommandKind(command, "functionDefinition");
            this.pushToCurrent(state, command);
            state.inFunctionDefinition = command.command.trimEnd().endsWith("\\");
            return;
        }
        const functionSource = command.parsed.labelSplit?.trailing ?? command.command;
        if (functionSource.toLowerCase().startsWith("function")) {
            setCommandKind(command, "functionDefinition");
            this.pushToCurrent(state, command);
            state.inFunctionDefinition = functionSource.trimEnd().endsWith("\\");
            return;
        }
        if (keyword === "for" || keyword === "while") {
            const loopNode = {
                type: keyword,
                header: command,
                conditionNode: keyword === "while"
                    ? command.parsed.condition?.expression
                    : command.parsed.forLoop?.range,
                variable: command.parsed.forLoop?.variable,
                rangeNode: command.parsed.forLoop?.range,
                startExpression: command.parsed.forLoop?.start,
                endExpression: command.parsed.forLoop?.end,
                commands: [],
                startLine: command.source.line,
            };
            this.pushToCurrent(state, loopNode);
            state.loopStack.push(loopNode);
            return;
        }
        if (keyword === "endfor" || keyword === "endwhile") {
            const loopNode = state.loopStack.pop();
            if (loopNode) {
                loopNode.endLine = command.source.line;
            }
            return;
        }
        if (keyword === "if") {
            const branch = {
                kind: "if",
                header: command,
                conditionNode: command.parsed.condition?.expression,
                commands: [],
                startLine: command.source.line,
            };
            const conditionalNode = {
                type: "if",
                header: command,
                branches: [branch],
                startLine: command.source.line,
            };
            this.pushToCurrent(state, conditionalNode);
            state.ifStack.push(conditionalNode);
            state.branchStack.push(branch);
            return;
        }
        if (keyword === "elseif" || keyword === "else") {
            const currentIf = state.ifStack[state.ifStack.length - 1];
            if (!currentIf) {
                this.pushToCurrent(state, command);
                return;
            }
            if (state.branchStack.length > 0) {
                const closedBranch = state.branchStack.pop();
                if (closedBranch) {
                    closedBranch.endLine = command.source.line;
                }
            }
            const branch = {
                kind: keyword,
                header: command,
                conditionNode: keyword === "elseif" ? command.parsed.condition?.expression : undefined,
                commands: [],
                startLine: command.source.line,
            };
            currentIf.branches.push(branch);
            state.branchStack.push(branch);
            return;
        }
        if (keyword === "endif") {
            const currentIf = state.ifStack[state.ifStack.length - 1];
            const currentLoop = state.loopStack[state.loopStack.length - 1];
            const whileIsInnermost = this.host.shouldEndifCloseInnermostWhile(currentLoop?.type, currentLoop?.startLine, currentIf?.startLine);
            if (whileIsInnermost) {
                const loopNode = state.loopStack.pop();
                if (loopNode) {
                    loopNode.endLine = command.source.line;
                }
                return;
            }
            if (state.branchStack.length > 0) {
                const closedBranch = state.branchStack.pop();
                if (closedBranch) {
                    closedBranch.endLine = command.source.line;
                }
            }
            if (currentIf) {
                state.ifStack.pop();
                currentIf.endLine = command.source.line;
            }
            return;
        }
        this.pushToCurrent(state, command);
    }
    isNodeComplete(node) {
        if ("source" in node) {
            return true;
        }
        return node.endLine !== undefined;
    }
    drainCompletedRoots(state) {
        let completedCount = 0;
        while (completedCount < state.roots.length &&
            this.isNodeComplete(state.roots[completedCount])) {
            completedCount++;
        }
        const ready = state.roots.slice(0, completedCount);
        state.roots = state.roots.slice(completedCount);
        return ready;
    }
}
//# sourceMappingURL=program-model-builder.js.map