import type { LoweredInstruction } from "../architecture-types.js";
import type { ConditionalBranch, ConditionalBranchNode, ExecutableNode, LoopNode } from "../ir/assembly-tree.js";
import type { DirectiveRegistry } from "../directives/registry.js";
import type { ArchitectureDefinition } from "../architecture-registry.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { ProgramModel } from "./program-model-builder.js";
export type LoweredDirective = {
    kind: "directive";
    keyword: string;
    words: string[];
    source: NormalizedCommand["source"];
    command?: NormalizedCommand;
};
export type LoweredCommand = LoweredDirective | LoweredInstruction;
export type LoweredPassthroughCommand = {
    kind: "command";
    command: NormalizedCommand;
    source: NormalizedCommand["source"];
};
export type LoweredLoopNode = Omit<LoopNode, "type" | "header" | "commands"> & {
    kind: "loop";
    loopType: LoopNode["type"];
    header?: NormalizedCommand;
    commands: LoweredExecutableNode[];
};
export type LoweredConditionalBranch = Omit<ConditionalBranch, "header" | "commands"> & {
    header?: NormalizedCommand;
    commands: LoweredExecutableNode[];
};
export type LoweredConditionalNode = Omit<ConditionalBranchNode, "type" | "header" | "branches"> & {
    kind: "conditional";
    header?: NormalizedCommand;
    branches: LoweredConditionalBranch[];
};
export type LoweredExecutableNode = LoweredCommand | LoweredPassthroughCommand | LoweredLoopNode | LoweredConditionalNode;
export type LoweredProgram = {
    sourceFile: string;
    startLine: number;
    nodes: LoweredExecutableNode[];
};
export type CommandLoweringHost = {
    directiveRegistry: DirectiveRegistry;
    resolveActiveArchitecture(): {
        name: string;
        definition?: ArchitectureDefinition;
    };
    classifyOperandForActiveArchitecture(operand: string): import("../architecture-types.js").LoweredOperand;
};
/**
 * Lowers stable front-end commands into directive or instruction work units used
 * by later layout and emission stages.
 */
export declare class CommandLoweringService {
    readonly host: CommandLoweringHost;
    constructor(host: CommandLoweringHost);
    /**
     * Lowers a normalized command into the execution-layer representation.
     * @param {NormalizedCommand} command The normalized command node.
     * @returns {LoweredCommand} The lowered execution work unit.
     */
    lowerCommand(command: NormalizedCommand): LoweredCommand;
    /**
     * Lowers an executable tree node into a durable execution-layer node.
     * Commands that still need legacy preprocessing are preserved as detached
     * command snapshots so the cached program tree never gets mutated at runtime.
     * @param {ExecutableNode} node The node to lower.
     * @returns {LoweredExecutableNode} The lowered node.
     */
    lowerExecutableNode(node: ExecutableNode): LoweredExecutableNode;
    /**
     * Lowers a full program model into a stage-owned execution program.
     * @param {ProgramModel} program The program to lower.
     * @returns {LoweredProgram} The lowered program.
     */
    lowerProgram(program: ProgramModel): LoweredProgram;
    /**
     * Commands that still require legacy preprocess / control handlers must remain
     * as detached command snapshots rather than direct lowered directives.
     * @param {NormalizedCommand} command The command to inspect.
     * @returns {boolean} True when the command should stay in passthrough form.
     */
    shouldPreserveCommand(command: NormalizedCommand): boolean;
}
//# sourceMappingURL=command-lowering-service.d.ts.map