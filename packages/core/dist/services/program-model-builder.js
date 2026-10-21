import { incrementInternalCounter, recordSyntaxBoundary, recordInternalCounterPeak, } from "../internal-instrumentation.js";
import { setCommandKind } from "../ir/normalized-command.js";
import { OccurrenceSyntaxCache } from "./occurrence-syntax-cache.js";
function stackTop(stack) {
    const topIndex = stack.length - 1;
    return topIndex >= 0 ? stack[topIndex] : undefined;
}
/**
 * Builds reusable program models from command streams.
 */
export class ProgramModelBuilder {
    host;
    identities = new OccurrenceSyntaxCache();
    nextProgramId = 0;
    /** Release the lookup index together with the public program values at snapshot end/disposal. */
    clearCache() {
        this.identities.clear();
        this.host.passProgramCache.clear();
        this.nextProgramId = 0;
    }
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
            captures: [],
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
        state.captures.length = 0;
    }
    /**
     * Builds a program model from raw source text.
     * @param {string} source The source block to parse.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ProgramModel} The parsed program model.
     */
    buildProgramModel(source, sourceFile = this.host.currentFile, startLine = 0, sourceKind = "physical") {
        const grammar = this.host.grammarIdentity?.() ?? "";
        const reusableSource = this.host.sourceBufferEmpty?.() ?? false;
        const family = `source:${sourceKind}`;
        const cachedId = reusableSource
            ? this.identities.get(grammar, sourceFile, startLine, family, source)
            : undefined;
        const cached = cachedId === undefined ? undefined : this.host.passProgramCache.get(cachedId);
        if (cached) {
            incrementInternalCounter("passProgramCacheHits");
            return {
                sourceFile,
                startLine,
                sourceText: source,
                grammarIdentity: this.host.grammarIdentity?.(),
                nodes: cached,
            };
        }
        const commands = this.host.splitSourcedInlineCommands(this.host.preprocessSourcedBlockCommands(source));
        const lines = source.split("\n");
        let nextLine = lines.length;
        for (let index = commands.length - 1; index >= 0; index--) {
            const current = commands[index];
            if (commands[index + 1]?.line > current.line) {
                nextLine = commands[index + 1].line;
            }
            current.physical = lines.slice(Math.max(0, current.line), nextLine).join("\n");
        }
        return {
            sourceFile,
            startLine,
            sourceText: source,
            grammarIdentity: this.host.grammarIdentity?.(),
            // An unfinished streaming statement changes the meaning of the next input block. Only
            // complete, buffer-independent source can bypass preprocessing on a later stage.
            nodes: reusableSource && this.host.sourceBufferEmpty?.()
                ? this.getOrBuildCachedProgram(source, family, sourceFile, startLine, () => this.parseCommandStreamToNodes(commands, sourceFile, startLine, sourceKind))
                : this.getOrBuildPassProgram(commands, sourceFile, startLine, sourceKind),
        };
    }
    /**
     * Creates a typed include node from a source file body.
     * @param {string} file The include file name.
     * @param {string} source The include source content.
     * @returns {IncludeProgramNode} The include node.
     */
    createIncludeNode(file, source) {
        const program = this.buildProgramModel(source, file, 0);
        return { type: "include", file, commands: program.nodes };
    }
    /**
     * Returns cached executable nodes for a command stream.
     * @param {Array<string | SourcedCommand>} commands The command stream.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ExecutableNode[]} The cached or parsed nodes.
     */
    getOrBuildPassProgram(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine, sourceKind = "physical") {
        // Structured encoding distinguishes sourced commands, physical spelling and embedded separators.
        // Most complete-source calls use the original source string directly and never build this key.
        const stream = JSON.stringify(commands.map((command) => typeof command === "string"
            ? [command]
            : [command.line, command.text, command.physical ?? null]));
        return this.getOrBuildCachedProgram(stream, `commands:${sourceKind}`, sourceFile, startLine, () => this.parseCommandStreamToNodes(commands, sourceFile, startLine, sourceKind));
    }
    /** Index text separately from short public cache identities; never retain a second joined source copy. */
    getOrBuildCachedProgram(text, family, file, line, build) {
        const grammar = this.host.grammarIdentity?.() ?? "";
        let id = this.identities.get(grammar, file, line, family, text);
        const cached = id === undefined ? undefined : this.host.passProgramCache.get(id);
        if (cached) {
            incrementInternalCounter("passProgramCacheHits");
            return cached;
        }
        incrementInternalCounter("passProgramCacheMisses");
        recordSyntaxBoundary("source-cache-miss");
        const nodes = build();
        if (id === undefined) {
            id = `program:${this.nextProgramId++}`;
            this.identities.set(grammar, file, line, family, text, id);
        }
        this.host.passProgramCache.set(id, nodes);
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
    consumeIncrementalCommand(state, rawCommand, sourceFile = this.host.currentFile, sourceLine = this.host.currentLine, normalized) {
        if (!normalized) {
            recordSyntaxBoundary("generated-fragment-parse");
        }
        this.consumeCommandIntoState(state, rawCommand, sourceFile, sourceLine, normalized);
        return this.drainCompletedRoots(state);
    }
    /**
     * Parses a flat command stream into nested executable nodes.
     * @param {Array<string | SourcedCommand>} commands The command stream.
     * @param {string} [sourceFile] Optional source file override.
     * @param {number} [startLine] Optional starting line number.
     * @returns {ExecutableNode[]} The executable nodes.
     */
    parseCommandStreamToNodes(commands, sourceFile = this.host.currentFile, startLine = this.host.currentLine, sourceKind = "physical") {
        recordSyntaxBoundary(sourceKind === "physical" ? "physical-source-parse" : "generated-fragment-parse");
        const state = this.createIncrementalParseState();
        for (let index = 0; index < commands.length; index++) {
            const command = commands[index];
            const text = typeof command === "string" ? command : command.text;
            const sourceLine = typeof command === "string" ? startLine + index : startLine + command.line;
            const normalized = typeof command === "string"
                ? undefined
                : this.host.createLoopCommandNode(text, sourceFile, sourceLine, command.physical);
            this.consumeCommandIntoState(state, text, sourceFile, sourceLine, normalized);
        }
        return state.roots;
    }
    /**
     * Pushes to current.
     * @param {IncrementalProgramParseState} state The state.
     * @param {ExecutableNode} node The node.
     */
    pushToCurrent(state, node) {
        const capture = stackTop(state.captures);
        if (capture &&
            state.branchStack.length <= capture.branchDepth &&
            state.loopStack.length <= capture.loopDepth) {
            capture.node.commands.push(node);
            return;
        }
        const currentBranch = stackTop(state.branchStack);
        const currentLoop = stackTop(state.loopStack);
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
    consumeCommandIntoState(state, rawCommand, sourceFile, sourceLine, normalized) {
        // Expanded templates may already own parsed syntax and occurrence provenance.
        const command = normalized ?? this.host.createLoopCommandNode(rawCommand, sourceFile, sourceLine);
        const keyword = command.keyword.toLowerCase();
        const capture = stackTop(state.captures);
        if (capture) {
            const kind = capture.node.captureKind;
            const closing = keyword === `end${kind.toLowerCase()}`;
            if (closing) {
                capture.node.footer = command;
                capture.node.endLine = command.source.line;
                state.captures.pop();
                return;
            }
            if (kind === "macro" || kind === "function" || kind === "dataStructs") {
                // Macro/control-looking table rows remain syntax until the owning declaration selects them.
                if (kind === "macro") {
                    setCommandKind(command, "macroDefinitionOrInvoke");
                }
                if (kind === "function") {
                    setCommandKind(command, "functionDefinition");
                }
                if (kind === "dataStructs") {
                    setCommandKind(command, "structCommand");
                }
                capture.node.commands.push(command);
                if (kind === "function" && !command.command.trimEnd().endsWith("\\")) {
                    capture.node.endLine = command.source.line;
                    state.captures.pop();
                }
                return;
            }
        }
        const functionSource = command.parsed.labelSplit?.trailing ?? command.command;
        let captureKind;
        if (keyword === "macro") {
            captureKind = "macro";
        }
        else if (keyword === "struct") {
            captureKind = "struct";
        }
        else if (keyword === "datastructs") {
            captureKind = "dataStructs";
        }
        else if (functionSource.toLowerCase().startsWith("function")) {
            captureKind = "function";
        }
        if (captureKind) {
            const node = {
                type: "capture",
                captureKind,
                header: command,
                commands: [],
                startLine: command.source.line,
            };
            this.pushToCurrent(state, node);
            if (captureKind === "function") {
                setCommandKind(command, "functionDefinition");
            }
            if (captureKind === "function" && !functionSource.trimEnd().endsWith("\\")) {
                node.endLine = command.source.line;
            }
            else {
                state.captures.push({
                    node,
                    loopDepth: state.loopStack.length,
                    branchDepth: state.branchStack.length,
                });
            }
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
            const currentIf = stackTop(state.ifStack);
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
            const currentIf = stackTop(state.ifStack);
            const currentLoop = stackTop(state.loopStack);
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