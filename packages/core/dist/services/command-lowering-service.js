import { isCoreDataDirective } from "../directives/data.js";
import { recordExecutionParser, incrementInternalCounter } from "../internal-instrumentation.js";
import { parseLabelStatement, parseNumericDataStatement, materializeNumericData, } from "../ir/statement-node.js";
import { deriveTokenSpans } from "../source-location.js";
/**
 * Lowers stable front-end commands into directive or instruction work units used
 * by later layout and emission stages.
 */
export class CommandLoweringService {
    host;
    /** Command snapshots are immutable; weak ownership releases included/reparsed programs. */
    statements = new WeakMap();
    /** Pure syntax is cached by command and selected grammar, never by resolved values or processor state. */
    instructionSyntax = new WeakMap();
    constructor(host) {
        this.host = host;
    }
    /** Select a native statement without bypassing directive ownership or macro-template syntax. */
    lowerStatement(command) {
        const keyword = this.host.canonicalizeDirectiveKeyword(command.keyword);
        const registry = this.host.directiveRegistry;
        if (/<[^>]+>/.test(command.command) || /\\[A-Z_a-z]/.test(command.command)) {
            return undefined;
        }
        const hasDirective = registry.has(keyword);
        const coreData = registry.lookup && isCoreDataDirective({ lookup: registry.lookup.bind(registry) }, keyword);
        // Prefixed directives outrank dot labels; assignments retain their semantic priority.
        if (hasDirective &&
            !coreData &&
            (command.keyword.startsWith(".") || command.kind !== "staticAssignment")) {
            return undefined;
        }
        const cached = this.statements.get(command);
        if (cached !== undefined) {
            return cached ?? undefined;
        }
        let lowered;
        const common = { command, source: command.source };
        // Named label consumption precedes assignments in the source dialect, including malformed
        // `.local = value` forms. Keep that ordering instead of silently accepting a new declaration.
        const namedLabelPrefix = command.words[0]?.endsWith(":") ||
            (this.host.syntaxProfile.leadingDotLabels && command.keyword.startsWith("."));
        if (command.kind === "staticAssignment" && command.parsed.assignment && !namedLabelPrefix) {
            lowered = {
                ...common,
                kind: "assignment",
                statement: {
                    ...command.parsed.assignment,
                    text: command.words[2],
                    span: command.source.tokenSpans[0] ?? command.source.normalizedSpan,
                },
            };
        }
        else if ((command.kind === "labelDefinition" ||
            (command.kind === "staticAssignment" && namedLabelPrefix)) &&
            !hasDirective) {
            // Inline function declarations have historically been captured before their label prefix.
            if (!command.parsed.labelSplit?.trailing?.toLowerCase().startsWith("function")) {
                let statement;
                if (command.syntax?.kind === "sequence") {
                    let trailing;
                    const following = command.syntax.following;
                    if (following.kind === "numericDataFragment") {
                        // The cache shares the physical occurrence and tokens; no grammar is reparsed here.
                        const words = command.words.slice(following.wordOffset);
                        trailing = {
                            kind: "directive",
                            command: following.command,
                            words,
                            keyword: words[0],
                            source: {
                                ...command.source,
                                normalized: following.command,
                                tokenSpans: command.source.tokenSpans.length
                                    ? deriveTokenSpans(command.source.raw, words, command.source.line)
                                    : [],
                            },
                            parsed: {
                                dataDirective: {
                                    directive: words[0],
                                    operands: materializeNumericData(following.statement).operands.map((operand) => operand.text),
                                },
                            },
                            syntax: { kind: "numericData", statement: following.statement },
                        };
                    }
                    else {
                        trailing = following;
                    }
                    statement = { ...command.syntax.declaration, trailing };
                }
                else if (command.syntax?.kind === "label") {
                    statement = command.syntax.statement;
                }
                else {
                    statement = parseLabelStatement(command, this.host.syntaxProfile.leadingDotLabels ?? false);
                }
                if (statement) {
                    lowered = { ...common, kind: "label", statement };
                }
            }
        }
        else if (coreData) {
            const statement = command.syntax?.kind === "numericData"
                ? command.syntax.statement
                : parseNumericDataStatement(command);
            if (statement) {
                lowered = { ...common, kind: "numericData", statement };
            }
        }
        this.statements.set(command, lowered ?? null);
        return lowered;
    }
    /** Parse once per command/grammar for analysis and execution; never prepare or evaluate operands here. */
    parseInstruction(command) {
        const grammar = this.host.resolveActiveArchitecture().definition?.operandGrammar;
        if (!grammar) {
            return undefined;
        }
        const mnemonic = command.parsed.opcodeOperands?.mnemonic ?? command.keyword;
        const operandText = command.parsed.opcodeOperands?.operandText ?? command.words.slice(1).join(" ");
        const cache = this.instructionSyntax.get(command) ??
            new Map();
        this.instructionSyntax.set(command, cache);
        let parsed = cache.get(grammar);
        if (!parsed || parsed.version !== grammar.version) {
            recordExecutionParser("operand");
            parsed = {
                version: grammar.version,
                instruction: { mnemonic, operands: grammar.parse(mnemonic, operandText) },
            };
            cache.set(grammar, parsed);
        }
        return parsed.instruction;
    }
    /**
     * Lowers a normalized command into the execution-layer representation.
     * @param {NormalizedCommand} command The normalized command node.
     * @returns {LoweredCommand} The lowered execution work unit.
     */
    lowerCommand(command) {
        const keyword = this.host.canonicalizeDirectiveKeyword(command.keyword);
        if (this.host.directiveRegistry.has(keyword)) {
            const syntax = command.syntax?.kind === "plugin"
                ? command.syntax
                : this.host.directiveRegistry.parseSyntax?.(command);
            if (syntax) {
                return { kind: "pluginSyntax", statement: syntax, command, source: command.source };
            }
            throw new Error(`Directive '${keyword}' requires parsed syntax.`);
        }
        const architecture = this.host.resolveActiveArchitecture();
        const grammar = architecture.definition?.operandGrammar;
        if (architecture.definition?.encoder.typed) {
            if (!grammar) {
                throw new Error(`Typed encoder '${architecture.name}' requires an operand grammar.`);
            }
            const instruction = this.parseInstruction(command);
            const node = {
                kind: "typedInstruction",
                architecture: architecture.name,
                grammarVersion: grammar.version,
                instruction,
                command,
                source: command.source,
            };
            this.host.prepareTypedInstruction?.(node);
            return node;
        }
        throw new Error(`Architecture '${architecture.name}' requires a typed encoder and operand grammar.`);
    }
    /**
     * Lowers an executable tree node into a durable execution-layer node.
     * Commands retain their immutable front-end snapshots. Legacy preprocessing
     * creates its mutable execution copy at dispatch time, avoiding a redundant
     * clone for every stage-owned lowered node.
     * @param {ExecutableNode} node The node to lower.
     * @returns {LoweredExecutableNode} The lowered node.
     */
    lowerExecutableNode(node, scope) {
        incrementInternalCounter("runtimeNodesLowered");
        if ("source" in node) {
            const source = node.source;
            const operation = node.parsed.operation;
            if (operation) {
                return { kind: "operation", operation, command: node, source };
            }
            const declaration = node.parsed.declaration;
            if (declaration &&
                (declaration.kind === "function" ||
                    declaration.kind === "character" ||
                    declaration.kind === "dataStructRow" ||
                    (declaration.kind === "invalid" && declaration.context !== "struct") ||
                    (scope === "struct" && declaration.kind === "structField"))) {
                return { kind: "declaration", declaration, command: node, source };
            }
            if (scope === "struct" && !["endstruct", "struct"].includes(node.keyword.toLowerCase())) {
                // Struct bodies historically ignore executable instructions; only field declarations reserve bytes.
                return {
                    kind: "operation",
                    operation: { kind: "empty", seedBaseImage: false },
                    command: node,
                    source,
                };
            }
            if (/<[^>]+>/.test(node.command) || /\\[A-Z_a-z]/.test(node.command)) {
                const data = node.parsed.dataDirective && parseNumericDataStatement(node);
                // Placeholder-looking text inside quoted data is a string value, including outside macros.
                if (data && data.operands.every((operand) => operand.expression.type === "string")) {
                    return { kind: "numericData", statement: data, command: node, source };
                }
                return { kind: "sourceTemplate", command: node, source };
            }
            const statement = this.lowerStatement(node);
            if (statement) {
                return statement;
            }
            if (this.host.syntaxProfile.bareMacroInvocations && node.kind === "opcodeCandidate") {
                const invocation = node.parsed.bareInvocation;
                if (invocation) {
                    return { kind: "bareInvocation", invocation, command: node, source };
                }
            }
            return this.lowerCommand(node);
        }
        if (node.type === "capture") {
            const { type: _type, commands, ...syntax } = node;
            return {
                ...syntax,
                kind: "capture",
                commands,
            };
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
                commands: node.commands.map((command) => this.lowerExecutableNode(command, scope)),
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
                commands: branch.commands.map((command) => this.lowerExecutableNode(command, scope)),
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
}
function assertConditionalNode(node) {
    if (node.type !== "if") {
        throw new Error(`Unknown executable node type: ${node.type}`);
    }
}
//# sourceMappingURL=command-lowering-service.js.map