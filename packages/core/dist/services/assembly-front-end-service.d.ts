import type { ExecutableNode } from "../ir/assembly-tree.js";
import { type ExpressionNode } from "../ir/expression-node.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import type { ContributionSyntax } from "../ir/source-syntax.js";
import type { SyntaxProfile } from "../syntax-profile.js";
import { type SourcedCommand } from "./command-text-service.js";
import { ProgramModelBuilder, type IncrementalProgramParseState } from "./program-model-builder.js";
/** Session context for command preprocessing and program model construction. */
export type AssemblyFrontEndHost = {
    /** Active source file path for provenance on normalized commands. */
    currentFile: string;
    /** Zero-based line number advanced as commands are processed. */
    currentLine: number;
    /** Cached lowered program nodes reused across assembly passes. */
    passProgramCache: Map<string, ExecutableNode[]>;
    /** Optional hook parsing plugin-owned directive syntax payloads. */
    parsePluginSyntax?(command: NormalizedCommand): ContributionSyntax | undefined;
    /** Returns a grammar identity string for occurrence syntax caches. */
    grammarIdentity?(): string;
    /** When true, records spans and provenance on normalized commands. */
    collectSourceMetadata: boolean;
    /** True while expanding macro-generated source text. */
    inMacroExpansion: boolean;
    /** True during the definition collection assembly stage. */
    isDefinitionCollectionStage: boolean;
    /** Active dialect profile controlling tokenization and rewrites. */
    syntaxProfile: SyntaxProfile;
    /** Expands variadic macro placeholders before tokenization. */
    resolveVariadicPlaceholders(command: string): string;
    /** Resolves ca65-style endif/while pairing for structured control flow. */
    shouldEndifCloseInnermostWhile(loopType?: "for" | "while", loopStartLine?: number, ifStartLine?: number): boolean;
};
/**
 * Owns command buffering, normalization, and typed program-tree construction so
 * the assembler session can focus on execution instead of front-end shaping.
 */
export declare class AssemblyFrontEndService {
    readonly host: AssemblyFrontEndHost;
    /** Partial command text retained for multiline structured statements. */
    commandBuffer: string;
    /** Source occurrences and grammar identity are part of syntax ownership, never invocation values. */
    private readonly fragmentCommands;
    private readonly fragmentExpressions;
    private readonly assemblyExpressions;
    /** Drops occurrence-keyed syntax caches at assembly boundaries. */
    clearFragmentCache(): void;
    /** String entry adapters share immutable syntax; every caller still resolves current session bindings. */
    parseAssemblyExpression(text: string): ExpressionNode;
    /** Parse generated expression grammar once per actual spelling; resolved values are never retained. */
    parseFragmentExpression(text: string): ExpressionNode;
    /** Reuse generated syntax only for the same spelling, grammar and physical occurrence. */
    parseFragmentCommand(text: string, file: string, line: number): NormalizedCommand;
    /** Opening physical line when processCommand receives a structured statement one line at a time. */
    private statementBufferStart?;
    /** Builds executable program trees from normalized commands. */
    readonly programModelBuilder: ProgramModelBuilder;
    constructor(host: AssemblyFrontEndHost);
    /**
     * Preprocesses raw source blocks while preserving continued-line buffering.
     * @param block The raw source block.
     * @returns The normalized commands.
     */
    preprocessBlockCommands(block: string): string[];
    /**
     * Preprocesses raw source blocks, tagging each command with its original line.
     * @param block The raw source block.
     * @returns The normalized sourced commands.
     */
    preprocessSourcedBlockCommands(block: string): SourcedCommand[];
    /**
     * Splits statements according to the active target's source grammar.
     * @param commands Commands to split.
     * @returns Profile-aware command statements.
     */
    splitInlineCommands(commands: string[]): string[];
    /**
     * Splits sourced statements according to the active target's source grammar.
     * @param commands Sourced commands to split.
     * @returns Profile-aware sourced command statements.
     */
    splitSourcedInlineCommands(commands: SourcedCommand[]): SourcedCommand[];
    /**
     * Builds a normalized command from raw source text.
     * @param command The raw command text.
     * @param sourceFile The command source file.
     * @param sourceLine The source line number.
     * @param [allowEmpty] When true, empty commands still produce nodes.
     * @returns The normalized command or null for empty input.
     */
    createNormalizedCommandFromRaw(command: string, sourceFile: string, sourceLine: number, allowEmpty?: boolean, physical?: string): NormalizedCommand | null;
    private grammarCache?;
    /** Serializable profile flags plus selected contributions reconstruct the same worker grammar. */
    get grammarIdentity(): string;
    /** One source entry family; fragment materialization belongs to the expansion owner. */
    parseSource(source: string, file?: string, line?: number): import("./program-model-builder.js").ProgramModel;
    /** Generated text is parsed with the same profile and grammar identity as physical text. */
    parseGeneratedFragment(source: string, file?: string, line?: number): import("./program-model-builder.js").ProgramModel;
    /** Incremental expansion uses the same command parser while preserving deferred control bodies. */
    parseGeneratedCommand(state: IncrementalProgramParseState, text: string, file: string, line: number, normalized?: NormalizedCommand): ExecutableNode[];
    /** Expression adapters share the existing expression parser; parsing never evaluates values. */
    parseExpression(source: string): import("../ir/expression-node.js").ExpressionParseResult;
    /** Attach only grammars whose parser is pure; deferred templates bind only when their capture is invoked. */
    parseCommandSyntax(command: NormalizedCommand): void;
    /**
     * Creates a loop-aware normalized command node for the typed parser.
     * @param command The raw command text.
     * @param [sourceFile] Optional source file.
     * @param [sourceLine] Optional source line.
     * @returns The normalized node.
     */
    createLoopCommandNode(command: string, sourceFile?: string, sourceLine?: number, physical?: string): NormalizedCommand;
}
//# sourceMappingURL=assembly-front-end-service.d.ts.map