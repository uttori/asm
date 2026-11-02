import { withSourceSyntax, recordSyntaxBoundary } from "../internal-instrumentation.js";
import type { ExecutableNode } from "../ir/assembly-tree.js";
import {
  parseExpressionAtSite,
  parseExpressionResult,
  type ExpressionNode,
} from "../ir/expression-node.js";
import { parseMacroArguments } from "../ir/macro-template.js";
import {
  cloneNormalizedCommand,
  createNormalizedCommand,
  type NormalizedCommand,
} from "../ir/normalized-command.js";
import type { ContributionSyntax } from "../ir/source-syntax.js";
import { parseLabelStatement, parseNumericDataStatement } from "../ir/statement-node.js";
import { deriveTokenSpans } from "../source-location.js";
import type { SyntaxProfile } from "../syntax-profile.js";
import {
  preprocessBlockCommands as preprocessCommandBlock,
  removeInlineComment,
  splitInlineCommands,
  splitSourcedInlineCommands,
  splitCommandIntoWords,
  type SourcedCommand,
  isOpenStructuredCommand,
  isStructuredCommandStart,
} from "./command-text-service.js";
import { OccurrenceSyntaxCache } from "./occurrence-syntax-cache.js";
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
  /** Partial command text retained for multiline structured statements. */
  commandBuffer = "";
  /** Source occurrences and grammar identity are part of syntax ownership, never invocation values. */
  private readonly fragmentCommands = new OccurrenceSyntaxCache<NormalizedCommand>();

  private readonly fragmentExpressions = new OccurrenceSyntaxCache<ExpressionNode>();
  private readonly assemblyExpressions = new Map<string, ExpressionNode>();

  /** Drops occurrence-keyed syntax caches at assembly boundaries. */
  clearFragmentCache(): void {
    this.fragmentCommands.clear();
    this.fragmentExpressions.clear();
    this.assemblyExpressions.clear();
  }

  /** String entry adapters share immutable syntax; every caller still resolves current session bindings. */
  parseAssemblyExpression(text: string): ExpressionNode {
    let syntax = this.assemblyExpressions.get(text);
    if (!syntax) {
      syntax = parseExpressionAtSite(text, "assembler");
      this.assemblyExpressions.set(text, syntax);
    }
    return syntax;
  }

  /** Parse generated expression grammar once per actual spelling; resolved values are never retained. */
  parseFragmentExpression(text: string): ExpressionNode {
    const grammar = this.grammarIdentity;
    let syntax = this.fragmentExpressions.get(grammar, "", 0, "expression", text);
    if (!syntax) {
      recordSyntaxBoundary("generated-fragment-parse");
      syntax = withSourceSyntax(() => parseExpressionAtSite(text, "generated-expression"));
      this.fragmentExpressions.set(grammar, "", 0, "expression", text, syntax);
    }
    return syntax;
  }

  /** Reuse generated syntax only for the same spelling, grammar and physical occurrence. */
  parseFragmentCommand(text: string, file: string, line: number): NormalizedCommand {
    const grammar = this.grammarIdentity;
    let command = this.fragmentCommands.get(grammar, file, line, "command", text);
    if (!command) {
      recordSyntaxBoundary("generated-fragment-parse");
      recordSyntaxBoundary("source-cache-miss");
      command = this.createLoopCommandNode(text, file, line);
      this.fragmentCommands.set(grammar, file, line, "command", text, command);
    }
    return cloneNormalizedCommand(command);
  }
  /** Opening physical line when processCommand receives a structured statement one line at a time. */
  private statementBufferStart?: { file: string; line: number };

  /** Builds executable program trees from normalized commands. */
  readonly programModelBuilder: ProgramModelBuilder;

  constructor(readonly host: AssemblyFrontEndHost) {
    this.programModelBuilder = new ProgramModelBuilder({
      currentFile: this.host.currentFile,
      currentLine: this.host.currentLine,
      passProgramCache: this.host.passProgramCache,
      grammarIdentity: () => this.grammarIdentity,
      sourceBufferEmpty: () => this.commandBuffer.length === 0 && !this.statementBufferStart,
      preprocessBlockCommands: (source: string) => this.preprocessBlockCommands(source),
      splitInlineCommands: (commands: string[]) => this.splitInlineCommands(commands),
      preprocessSourcedBlockCommands: (source: string) =>
        this.preprocessSourcedBlockCommands(source),
      splitSourcedInlineCommands: (commands: SourcedCommand[]) =>
        this.splitSourcedInlineCommands(commands),
      createLoopCommandNode: (
        command: string,
        sourceFile?: string,
        sourceLine?: number,
        physical?: string,
      ) => this.createLoopCommandNode(command, sourceFile, sourceLine, physical),
      shouldEndifCloseInnermostWhile: (
        loopType?: "for" | "while",
        loopStartLine?: number,
        ifStartLine?: number,
      ) => this.host.shouldEndifCloseInnermostWhile(loopType, loopStartLine, ifStartLine),
    });
  }

  /**
   * Preprocesses raw source blocks while preserving continued-line buffering.
   * @param block The raw source block.
   * @returns The normalized commands.
   */
  preprocessBlockCommands(block: string): string[] {
    return this.preprocessSourcedBlockCommands(block).map((command) => command.text);
  }

  /**
   * Preprocesses raw source blocks, tagging each command with its original line.
   * @param block The raw source block.
   * @returns The normalized sourced commands.
   */
  preprocessSourcedBlockCommands(block: string): SourcedCommand[] {
    const opening = this.statementBufferStart;
    if (opening && opening.file !== this.host.currentFile) {
      throw new Error(`Unclosed structured statement in '${opening.file}'.`);
    }
    const processed = preprocessCommandBlock(block, this.commandBuffer, this.host.syntaxProfile);
    if (opening && processed.sourcedCommands.length > 0) {
      // SourcedCommand lines are relative to this input block. A negative line
      // points back into an earlier incremental call, where the statement opened.
      processed.sourcedCommands[0].line = opening.line - this.host.currentLine;
    }
    this.commandBuffer = processed.commandBuffer;
    if (isOpenStructuredCommand(this.commandBuffer)) {
      if (!opening || processed.sourcedCommands.length > 0) {
        const lines = block.split("\n");
        const start = lines.findLastIndex(isStructuredCommandStart);
        this.statementBufferStart = {
          file: this.host.currentFile,
          line: this.host.currentLine + Math.max(0, start),
        };
      }
    } else {
      this.statementBufferStart = undefined;
    }
    return processed.sourcedCommands;
  }

  /**
   * Splits statements according to the active target's source grammar.
   * @param commands Commands to split.
   * @returns Profile-aware command statements.
   */
  splitInlineCommands(commands: string[]): string[] {
    return splitInlineCommands(commands, this.host.syntaxProfile);
  }

  /**
   * Splits sourced statements according to the active target's source grammar.
   * @param commands Sourced commands to split.
   * @returns Profile-aware sourced command statements.
   */
  splitSourcedInlineCommands(commands: SourcedCommand[]): SourcedCommand[] {
    return splitSourcedInlineCommands(commands, this.host.syntaxProfile);
  }

  /**
   * Builds a normalized command from raw source text.
   * @param command The raw command text.
   * @param sourceFile The command source file.
   * @param sourceLine The source line number.
   * @param [allowEmpty] When true, empty commands still produce nodes.
   * @returns The normalized command or null for empty input.
   */
  createNormalizedCommandFromRaw(
    command: string,
    sourceFile: string,
    sourceLine: number,
    allowEmpty = false,
    physical?: string,
  ): NormalizedCommand | null {
    let normalizedCommand = removeInlineComment(command, this.host.syntaxProfile);
    normalizedCommand =
      this.host.syntaxProfile.rewriteCommand?.(normalizedCommand, {
        sourceFile,
        sourceLine,
      }) ?? normalizedCommand;

    const words = splitCommandIntoWords(normalizedCommand);
    if (!allowEmpty && words.length === 0) {
      return null;
    }

    const node = createNormalizedCommand(
      command,
      normalizedCommand,
      words,
      sourceFile,
      sourceLine,
      this.host.collectSourceMetadata,
    );
    if (physical !== undefined && physical !== command && this.host.collectSourceMetadata) {
      node.source = {
        ...node.source,
        physical: { text: physical },
        tokenSpans: deriveTokenSpans(physical, words, sourceLine),
      };
    }
    this.parseCommandSyntax(node);
    return node;
  }

  private grammarCache?: { profile: SyntaxProfile; contribution: string; identity: string };

  /** Serializable profile flags plus selected contributions reconstruct the same worker grammar. */
  get grammarIdentity(): string {
    const contribution = this.host.grammarIdentity?.() ?? "core";
    const cached = this.grammarCache;
    // Profiles are readonly session contracts; registry revisions invalidate contribution identity.
    if (cached?.profile === this.host.syntaxProfile && cached.contribution === contribution) {
      return cached.identity;
    }
    const { rewriteCommand, ...profile } = this.host.syntaxProfile;
    const identity = JSON.stringify([
      "source-ast:4",
      contribution,
      Object.entries(profile).toSorted(([a], [b]) => a.localeCompare(b)),
      !!rewriteCommand,
    ]);
    this.grammarCache = { profile: this.host.syntaxProfile, contribution, identity };
    return identity;
  }

  /** One source entry family; fragment materialization belongs to the expansion owner. */
  parseSource(source: string, file = this.host.currentFile, line = 0) {
    return this.programModelBuilder.buildProgramModel(source, file, line);
  }

  /** Generated text is parsed with the same profile and grammar identity as physical text. */
  parseGeneratedFragment(source: string, file = this.host.currentFile, line = 0) {
    return this.programModelBuilder.buildProgramModel(source, file, line, "generated");
  }

  /** Incremental expansion uses the same command parser while preserving deferred control bodies. */
  parseGeneratedCommand(
    state: IncrementalProgramParseState,
    text: string,
    file: string,
    line: number,
    normalized?: NormalizedCommand,
  ) {
    return this.programModelBuilder.consumeIncrementalCommand(
      state,
      text,
      file,
      line,
      normalized ?? this.parseFragmentCommand(text, file, line),
    );
  }

  /** Expression adapters share the existing expression parser; parsing never evaluates values. */
  parseExpression(source: string) {
    return parseExpressionResult(source, "public");
  }

  /** Attach only grammars whose parser is pure; deferred templates bind only when their capture is invoked. */
  parseCommandSyntax(command: NormalizedCommand): void {
    if (this.host.syntaxProfile.bareMacroInvocations && command.kind === "opcodeCandidate") {
      const text = command.command.slice(command.keyword.length).trim();
      command.parsed.bareInvocation = {
        kind: "macroCall",
        name: command.keyword,
        arguments: parseMacroArguments(text).map((argument) => argument.value),
        parenthesized: text.length > 0,
      };
    }
    if (/<[^>]+>|\\[A-Z_a-z]/.test(command.command)) {
      // Data templates have a known element count during collection; values bind at invocation.
      if (command.parsed.dataDirective && /\.{3}|…/.test(command.command)) {
        const statement = parseNumericDataStatement(command);
        if (statement) {
          command.syntax = { kind: "numericData", statement };
        }
      }
      return;
    }
    const plugin = this.host.parsePluginSyntax?.(command);
    if (plugin) {
      command.syntax = plugin;
      return;
    }
    if (command.kind === "labelDefinition") {
      const statement = parseLabelStatement(command, this.host.syntaxProfile.leadingDotLabels);
      if (statement) {
        if (statement.trailing) {
          const following = statement.trailing;
          this.parseCommandSyntax(following);
          const declaration = { ...statement };
          delete declaration.trailing;
          if (following.syntax?.kind === "numericData") {
            command.syntax = {
              kind: "sequence",
              declaration,
              following: {
                kind: "numericDataFragment",
                command: following.command,
                wordOffset: command.words.length - following.words.length,
                statement: following.syntax.statement,
              },
            };
          } else {
            command.syntax = { kind: "sequence", declaration, following };
          }
        } else {
          command.syntax = { kind: "label", statement };
        }
      }
    } else if (command.parsed.dataDirective) {
      const statement = parseNumericDataStatement(command);
      if (statement) {
        command.syntax = { kind: "numericData", statement };
      }
    }
  }

  /**
   * Creates a loop-aware normalized command node for the typed parser.
   * @param command The raw command text.
   * @param [sourceFile] Optional source file.
   * @param [sourceLine] Optional source line.
   * @returns The normalized node.
   */
  createLoopCommandNode(
    command: string,
    sourceFile = this.host.currentFile,
    sourceLine = this.host.currentLine,
    physical?: string,
  ): NormalizedCommand {
    return (
      this.createNormalizedCommandFromRaw(command, sourceFile, sourceLine, true, physical) ??
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
