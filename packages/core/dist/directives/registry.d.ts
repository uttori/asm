import { type CoreDirectiveGroup } from "../directive-groups.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
import { type ContributionSyntax, type SyntaxGrammar, type SyntaxValue, type SyntaxParseInput } from "../ir/source-syntax.js";
import { type ImmutableSyntax, type SyntaxGuard } from "../ir/syntax-codec.js";
import type { AddressStackDirectiveContext, ArchitectureDirectiveContext, BaseLayoutDirectiveContext, DataDirectiveContext, FillPadDirectiveContext, FlowControlDirectiveContext, IncludeDirectiveContext, NamespaceDirectiveContext, OrgDirectiveContext, RuntimeDirectiveContext, StructDirectiveContext, TableDirectiveContext, DiagnosticDirectiveContext } from "./types.js";
/** Imperative directive handler invoked after tokenization with optional normalized command. */
type BoundDirectiveHandler = (words: readonly string[], raw: string, command?: NormalizedCommand) => void;
/** Session contexts passed to each directive family during registry construction. */
export interface DirectiveRegistryContexts {
    /** Context for numeric and character data directives. */
    data: DataDirectiveContext;
    /** Context for fill and pad layout directives. */
    fillPad: FillPadDirectiveContext;
    /** Context for relative branch label directives. */
    flowControl: FlowControlDirectiveContext;
    /** Context for include and incbin-style source directives. */
    includeSource: IncludeDirectiveContext;
    /** Nested layout contexts for org, base, and address-stack directives. */
    layout: {
        addressStack: AddressStackDirectiveContext;
        architecture: ArchitectureDirectiveContext;
        base: BaseLayoutDirectiveContext;
        org: OrgDirectiveContext;
        runtime: RuntimeDirectiveContext;
    };
    /** Context for namespace scope directives. */
    namespace: NamespaceDirectiveContext;
    /** Context for struct and binary layout directives. */
    struct: StructDirectiveContext;
    /** Context for character table directives. */
    table: TableDirectiveContext;
    /** Context for warning, error, and assert directives. */
    diagnostic: DiagnosticDirectiveContext;
}
/** Keyword dispatch table merging imperative handlers and typed syntax grammars. */
export declare class DirectiveRegistry {
    readonly directivePrefixes: readonly string[];
    /** Lowercase keyword to bound handler map including prefix-stripped aliases. */
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
    /**
     * Built-in guards and executors borrow immutable syntax across passes and sessions.
     * Guards must be pure; execution state belongs in the session, never in the payload.
     * Plugin registration remains mutable; unknown/transported payloads are copied before validation.
     */
    registerImmutableTyped<T>(keywords: string | readonly string[], parse: (input: SyntaxParseInput) => T, validate: SyntaxGuard<T>, execute: (payload: ImmutableSyntax<T>, command: NormalizedCommand) => void): void;
    private syntaxKeyword;
    private syntaxHandler;
    /** Pure parsing catches diagnostics for deferred reporting, including inactive branches. */
    parseSyntax(command: NormalizedCommand): ContributionSyntax | undefined;
    /** Reject stale worker/cache payloads; never reparse or silently select a different grammar. */
    executeSyntax(syntax: ContributionSyntax, command: NormalizedCommand): void;
    constructor(directivePrefixes?: readonly string[]);
    /** Reports whether a handler exists for the keyword after prefix normalization. */
    has(keyword: string): boolean;
    /** Invokes a registered handler when present; returns false when the keyword is unknown. */
    dispatch(keyword: string, words: readonly string[], raw: string, command?: NormalizedCommand): boolean;
    /**
     * Resolves a directive handler using prefixes supplied by the active syntax profile.
     * @param keyword The directive keyword.
     * @returns The handler, if registered.
     */
    lookup(keyword: string): BoundDirectiveHandler | undefined;
}
/** Builds a registry with only the enabled core directive groups and syntax prefixes. */
export declare const createDirectiveRegistry: (contexts: DirectiveRegistryContexts, enabledGroups?: readonly CoreDirectiveGroup[], directivePrefixes?: readonly string[]) => DirectiveRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map