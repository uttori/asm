import { incrementInternalCounter } from "../internal-instrumentation.js";
/**
 * Lowers stable front-end commands into directive or instruction work units used
 * by later layout and emission stages.
 */
export class CommandLoweringService {
    host;
    constructor(host) {
        this.host = host;
    }
    /**
     * Lowers a normalized command into the execution-layer representation.
     * @param {NormalizedCommand} command The normalized command node.
     * @returns {LoweredCommand} The lowered execution work unit.
     */
    lowerCommand(command) {
        const keyword = this.host.canonicalizeDirectiveKeyword(command.keyword);
        if (this.host.directiveRegistry.has(keyword)) {
            let directiveWords = command.words;
            if (command.parsed.includeTarget && command.parsed.includeTarget.directive !== "incbin") {
                directiveWords = [
                    command.parsed.includeTarget.directive,
                    command.parsed.includeTarget.target,
                ];
            }
            return {
                kind: "directive",
                keyword,
                words: directiveWords,
                source: command.source,
                command,
            };
        }
        const architecture = this.host.resolveActiveArchitecture();
        const parsedOperands = command.parsed.opcodeOperands;
        const mnemonic = parsedOperands?.mnemonic ?? command.keyword;
        const operandText = parsedOperands?.operandText ?? command.words.slice(1).join(" ");
        const operands = parsedOperands?.operands ??
            architecture.definition?.splitOperands(operandText) ??
            (operandText ? [operandText] : []);
        const loweredOperands = operands.map((operand) => this.host.classifyOperandForActiveArchitecture(operand));
        const loweredOperand = this.host.classifyOperandForActiveArchitecture(operandText);
        return {
            kind: "instruction",
            command,
            mnemonic,
            operandText,
            operands,
            loweredOperands,
            loweredOperand,
            words: command.words,
            sourceFile: command.source.file,
            sourceLine: command.source.line,
            sourceRaw: command.source.raw,
        };
    }
    /**
     * Lowers an executable tree node into a durable execution-layer node.
     * Commands retain their immutable front-end snapshots. Legacy preprocessing
     * creates its mutable execution copy at dispatch time, avoiding a redundant
     * clone for every stage-owned lowered node.
     * @param {ExecutableNode} node The node to lower.
     * @returns {LoweredExecutableNode} The lowered node.
     */
    lowerExecutableNode(node) {
        incrementInternalCounter("runtimeNodesLowered");
        if ("source" in node) {
            if (this.shouldPreserveCommand(node)) {
                return {
                    kind: "command",
                    command: node,
                    source: node.source,
                    passthroughReason: this.getPassthroughReason(node) ?? "unknown",
                };
            }
            return this.lowerCommand(node);
        }
        if (node.type === "for" || node.type === "while") {
            return {
                kind: "loop",
                loopType: node.type,
                header: node.header,
                conditionNode: node.conditionNode,
                rangeNode: node.rangeNode,
                variable: node.variable,
                start: node.start,
                end: node.end,
                startExpression: node.startExpression,
                endExpression: node.endExpression,
                commands: node.commands.map((command) => this.lowerExecutableNode(command)),
                startLine: node.startLine,
                endLine: node.endLine,
            };
        }
        assertConditionalNode(node);
        return {
            kind: "conditional",
            header: node.header,
            branches: node.branches.map((branch) => ({
                kind: branch.kind,
                header: branch.header,
                conditionNode: branch.conditionNode,
                commands: branch.commands.map((command) => this.lowerExecutableNode(command)),
                startLine: branch.startLine,
                endLine: branch.endLine,
            })),
            startLine: node.startLine,
            endLine: node.endLine,
        };
    }
    /**
     * Lowers a full program model into a stage-owned execution program.
     * @param {ProgramModel} program The program to lower.
     * @returns {LoweredProgram} The lowered program.
     */
    lowerProgram(program) {
        incrementInternalCounter("loweredProgramBuilds");
        return {
            sourceFile: program.sourceFile,
            startLine: program.startLine,
            nodes: program.nodes.map((node) => this.lowerExecutableNode(node)),
        };
    }
    /**
     * Commands that still require legacy preprocess / control handlers must remain
     * as command snapshots rather than direct lowered directives. Dispatch clones
     * these snapshots before running the mutable legacy preprocessing pipeline.
     * @param {NormalizedCommand} command The command to inspect.
     * @returns {boolean} True when the command should stay in passthrough form.
     */
    shouldPreserveCommand(command) {
        return this.getPassthroughReason(command) !== undefined;
    }
    /**
     * Names the ordered preprocessing requirement that prevents direct lowering.
     * @param {NormalizedCommand} command The command to inspect.
     * @returns {PassthroughReason | undefined} The reason, or undefined when direct lowering is safe.
     */
    getPassthroughReason(command) {
        const keyword = this.host.canonicalizeDirectiveKeyword(command.keyword);
        if (/<[^>]+>/.test(command.command) || /\\[A-Z_a-z]/.test(command.command)) {
            // Macro bodies use ASAR-style `<param>` placeholders that are resolved
            // and ca65-style `\param` placeholders that are resolved during normalized
            // dispatch. Lowering them early would send placeholders straight into
            // numeric evaluation.
            return "macroPlaceholder";
        }
        if (command.keyword.startsWith(".") && this.host.directiveRegistry.has(keyword)) {
            if (this.host.directiveRegistry.getPhase(keyword) === "lowered") {
                return undefined;
            }
            if (command.parsed.dataDirective) {
                return "dataDirective";
            }
            return "registeredPreprocessDirective";
        }
        if (command.kind !== "unknown" &&
            command.kind !== "opcodeCandidate" &&
            command.kind !== "directive") {
            // Semantic front-end forms require the ordered preprocess chain. This also
            // keeps forms such as `FillByte = $EE` from colliding with directives.
            return command.kind;
        }
        if (this.host.syntaxProfile.bareMacroInvocations && command.kind === "opcodeCandidate") {
            // Bare ca65 macro calls cannot be distinguished from opcodes until earlier
            // definitions have executed in this stage. Preserve them for ordered preprocessing.
            return "bareMacroCandidate";
        }
        if (this.host.directiveRegistry.has(keyword)) {
            if (this.host.directiveRegistry.getPhase(keyword) === "lowered") {
                return undefined;
            }
            if (command.parsed.dataDirective) {
                return "dataDirective";
            }
            return "registeredPreprocessDirective";
        }
        return command.kind === "opcodeCandidate" ? undefined : "unknown";
    }
}
function assertConditionalNode(node) {
    if (node.type !== "if") {
        throw new Error(`Unknown executable node type: ${node.type}`);
    }
}
//# sourceMappingURL=command-lowering-service.js.map