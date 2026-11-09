import { type CommandOperation } from "../ir/command-operation.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import { type SourceFragment } from "../ir/source-fragment.js";
import type { MathCore } from "../mathcore.js";
import type { SourceOccurrence } from "../source-provenance.js";
/** Session callbacks used while expanding and declaring textual defines. */
export type DefineHost = {
    /** Live define value map for the current assembly session. */
    defines: Map<string, string>;
    /** Resolves define references in plain command text. */
    resolvedefines(input: string): string;
    /** Evaluates pure numeric define values without full command parsing. */
    mathCore: MathCore;
    /** Executes a generated command after define binding. */
    processCommand(command: string): void;
    /** Executes a generated source fragment after define binding. */
    processSourceFragment(fragment: SourceFragment): void;
    /** Optional fragment-aware define name resolution for braced references. */
    resolveDefineFragment?(fragment: SourceFragment): SourceFragment;
    /** Optional namespace-aware define lookup overriding the flat map. */
    lookupDefineValue?(name: string): string | undefined;
    /** Active namespace prefix for recorded define symbols. */
    currentNamespace: string;
    /** Records define symbols for navigation and cross-pass lookup. */
    recordSymbolDefinition(kind: "define", name: string, options?: {
        value?: number | string;
        containerName?: string;
    }): void;
};
/** Parses, caches, and expands define templates during assembly. */
export declare class DefineEngine {
    readonly host: DefineHost;
    /** Value identity remains in defines; metadata is refreshed when a declaration executes. */
    private readonly origins;
    private readonly syntaxCache;
    /** Release snapshot-owned syntax while retaining live declaration values. */
    clearSyntaxCache(): void;
    private template;
    /** Bind one define phase; dynamic names may themselves be attributed generated fragments. */
    resolveFragment(fragment: SourceFragment): SourceFragment;
    /** Attribute a generated statement to its invoking define rather than reparsing an anonymous string. */
    private dispatch;
    constructor(host: DefineHost);
    /** True when a define value contains only literal numbers and math operators. */
    isPureMathExpression(value: string): boolean;
    /**
     * Handles a define command.
     * @param commandNode The command node to handle.
     * @returns `true` if the command was handled, `false` otherwise.
     */
    handleCommand(commandNode: NormalizedCommand): boolean;
    /**
     * Handles a define command.
     * @param command The command to handle.
     * @example
     * !identifier = value // Basic assignment
     * !identifier += value // Append to existing value
     * !identifier := value // Resolve defines in the value
     * !identifier #= value // Evaluate as math expression
     * !identifier ?= value // Only assign if not already defined
     * undef identifier // Remove a define
     * undef "identifier" // Remove a define
     */
    handleDefineCommand(command: string, source?: SourceOccurrence & {
        raw?: string;
    }): void;
    /** Apply a parsed declaration or expand a source-valued define in the current scope. */
    executeOperation(operation: Extract<CommandOperation, {
        kind: "defineAssignment" | "undef" | "defineExpansion" | "invalid";
    }>, source?: SourceOccurrence & {
        raw?: string;
    }): void;
    /**
     * Resolves nested defines in a string.
     * @param content The content to process.
     * @returns The processed content with nested defines resolved.
     */
    processNestedDefines(content: string): string;
    /**
     * Resolves one level of defines in a string.
     * @param content The content to process.
     * @returns The processed content with one level of defines resolved.
     */
    resolveOneLevelOfDefines(content: string): string;
    /**
     * Resolves regular defines in a string.
     * @param content The content to process.
     * @returns The processed content with regular defines resolved.
     */
    resolveRegularDefines(content: string): string;
    /** Bind only unbraced defines, preserving string/resource grammar and physical contributors. */
    resolveRegularFragment(fragment: SourceFragment): SourceFragment;
    /**
     * Resolves defines in a string literal.
     * @param content The content to process.
     * @returns The processed content with defines in string literal resolved.
     */
    resolveDefinesInStringLiteral(content: string): string;
    /**
     * Processes a value with braced defines.
     * @param value The value to process.
     * @returns The processed value with braced defines resolved.
     */
    processValueWithBracedDefines(value: string): string;
    /**
     * Applies a define operation.
     * @param identifier The identifier to apply the operation to.
     * @param operator The operator to apply.
     * @param initialValue The initial value to apply the operation to.
     */
    applyDefineOperation(identifier: string, operator: string, initialValue: string, source?: SourceOccurrence & {
        raw?: string;
    }): void;
    /**
     * Applies an `undef` operation.
     * @param command The normalized undef command.
     */
    applyUndefOperation(command: string): void;
}
//# sourceMappingURL=define-engine.d.ts.map