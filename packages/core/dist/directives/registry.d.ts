import { type CoreDirectiveGroup } from "../directive-groups.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import { type ContributionSyntax, type SyntaxGrammar, type SyntaxValue, type SyntaxParseInput } from "../ir/source-syntax.js";
import { type SyntaxGuard } from "../ir/syntax-codec.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext, BaseLayoutDirectiveContext, DataDirectiveContext, FillPadDirectiveContext, FlowControlDirectiveContext, IncludeDirectiveContext, NamespaceDirectiveContext, OrgDirectiveContext, RuntimeDirectiveContext, StructDirectiveContext, TableDirectiveContext, DiagnosticDirectiveContext } from "./types.js";
type BoundDirectiveHandler = (words: readonly string[], raw: string, command?: NormalizedCommand) => void;
export interface DirectiveRegistryContexts {
    data: DataDirectiveContext;
    fillPad: FillPadDirectiveContext;
    flowControl: FlowControlDirectiveContext;
    includeSource: IncludeDirectiveContext;
    layout: {
        addressStack: AddressStackDirectiveContext;
        architecture: ArchitectureDirectiveContext;
        base: BaseLayoutDirectiveContext;
        org: OrgDirectiveContext;
        runtime: RuntimeDirectiveContext;
    };
    namespace: NamespaceDirectiveContext;
    struct: StructDirectiveContext;
    table: TableDirectiveContext;
    diagnostic: DiagnosticDirectiveContext;
}
export declare class DirectiveRegistry {
    readonly directivePrefixes: readonly string[];
    readonly handlers: Map<string, BoundDirectiveHandler>;
    /** Grammar versions are immutable; registration is the only ownership transition. */
    private cachedGrammarIdentity?;
    private readonly syntaxHandlers;
    /** Ordered keyword ownership is part of every program-cache identity. */
    get grammarIdentity(): string;
    /** Last registration owns both parsing and execution; absent bindings install nothing. */
    registerSyntax(keywords: readonly string[], id: string, grammar: SyntaxGrammar, execute: (payload: SyntaxValue, command: NormalizedCommand) => void): void;
    /** Core and target handlers share a versioned parser and checked, serializable execution payload. */
    registerTyped<T>(keywords: string | readonly string[], parse: (input: SyntaxParseInput) => T, validate: SyntaxGuard<T>, execute: (payload: T, command: NormalizedCommand) => void): void;
    private syntaxKeyword;
    private syntaxHandler;
    /** Pure parsing catches diagnostics for deferred reporting, including inactive branches. */
    parseSyntax(command: NormalizedCommand): ContributionSyntax | undefined;
    /** Reject stale worker/cache payloads; never reparse or silently select a different grammar. */
    executeSyntax(syntax: ContributionSyntax, command: NormalizedCommand): void;
    constructor(directivePrefixes?: readonly string[]);
    has(keyword: string): boolean;
    dispatch(keyword: string, words: readonly string[], raw: string, command?: NormalizedCommand): boolean;
    /**
     * Resolves a directive handler using prefixes supplied by the active syntax profile.
     * @param {string} keyword The directive keyword.
     * @returns {BoundDirectiveHandler | undefined} The handler, if registered.
     */
    lookup(keyword: string): BoundDirectiveHandler | undefined;
}
export declare const createDirectiveRegistry: (contexts: DirectiveRegistryContexts, enabledGroups?: readonly CoreDirectiveGroup[], directivePrefixes?: readonly string[]) => DirectiveRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map