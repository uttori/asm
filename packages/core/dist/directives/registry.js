import { CORE_DIRECTIVE_GROUPS } from "../directive-groups.js";
import { recordExecutionParser, withTypedExecution } from "../internal-instrumentation.js";
import { createNormalizedCommand } from "../ir/normalized-command.js";
import { copySyntaxValue, immutableSyntaxValue, isImmutableSyntaxValue, } from "../ir/source-syntax.js";
import { syntaxCodec, immutableSyntaxCodec, } from "../ir/syntax-codec.js";
import { clonePluginSyntax } from "../plugin/syntax-snapshot.js";
import { registerDataDirectives } from "./data.js";
import { registerFillPadDirectives } from "./fill-pad.js";
import { registerFlowControlDirectives } from "./flow-control.js";
import { registerIncludeSourceDirectives } from "./include-source.js";
import { registerLayoutDirectives } from "./layout.js";
import { registerMiscDirectives } from "./misc.js";
import { registerNamespaceDirectives } from "./namespace.js";
import { registerStructBinaryDirectives } from "./struct-binary.js";
/** Compact cache key combining grammar version strings without ambiguous concatenation. */
const packIdentity = (value) => `${value.length.toString(36)}:${value}`;
/** Keyword dispatch table merging imperative handlers and typed syntax grammars. */
export class DirectiveRegistry {
    directivePrefixes;
    /** Lowercase keyword to bound handler map including prefix-stripped aliases. */
    handlers = new Map();
    /** Grammar versions are immutable; registration is the only ownership transition. */
    cachedGrammarIdentity;
    syntaxHandlers = new Map();
    /** Ordered keyword ownership is part of every program-cache identity. */
    get grammarIdentity() {
        // Expansion asks for this per occurrence, but sorting is needed only after registration.
        if (this.cachedGrammarIdentity !== undefined) {
            return this.cachedGrammarIdentity;
        }
        // Aliases share a grammar. Group them once while retaining exact, collision-free identities.
        const groups = new Map();
        for (const [keyword, entry] of [...this.syntaxHandlers].toSorted(([a], [b]) => a.localeCompare(b))) {
            const identity = JSON.stringify([entry.id, entry.grammar.version]);
            const group = groups.get(identity) ?? {
                id: entry.id,
                version: entry.grammar.version,
                aliases: [],
            };
            group.aliases.push(keyword);
            groups.set(identity, group);
        }
        let previous = "";
        let previousVersion = "";
        const entries = [...groups]
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([, { id, version, aliases }]) => {
            let prefix = 0;
            while (prefix < previous.length && previous[prefix] === id[prefix]) {
                prefix++;
            }
            const encodedVersion = version === previousVersion ? "0" : `1${packIdentity(version)}`;
            previousVersion = version;
            const entry = `${prefix.toString(36)}:${packIdentity(id.slice(prefix))}${encodedVersion}${aliases.length.toString(36)}:${aliases.map(packIdentity).join("")}`;
            previous = id;
            return entry;
        });
        this.cachedGrammarIdentity = `directive-grammar:1:${entries.join("")}`;
        return this.cachedGrammarIdentity;
    }
    /** Last registration owns both parsing and execution; absent bindings install nothing. */
    registerSyntax(keywords, id, grammar, execute) {
        this.cachedGrammarIdentity = undefined;
        for (const keyword of keywords) {
            this.syntaxHandlers.set(keyword, { id, grammar, execute });
            this.handlers.set(keyword, (words, raw, command) => {
                // Only this public string adapter parses. Source execution supplies immutable syntax directly.
                command ??= createNormalizedCommand(raw, raw || words.join(" "), [...words], "", 0, false);
                const syntax = this.parseSyntax(command);
                if (!syntax) {
                    throw new Error(`Typed directive '${id}' is no longer selected.`);
                }
                this.executeSyntax(syntax, command);
            });
        }
    }
    /** Core and target handlers share a versioned parser and checked, serializable execution payload. */
    registerTyped(keywords, parse, validate, execute) {
        const names = typeof keywords === "string" ? [keywords] : keywords;
        const codec = syntaxCodec("1", parse, validate);
        this.registerSyntax(names, `core.directive.${names[0]}`, codec, (payload, command) => execute(codec.read(payload), command));
    }
    /**
     * Built-in guards and executors borrow immutable syntax across passes and sessions.
     * Guards must be pure; execution state belongs in the session, never in the payload.
     * Plugin registration remains mutable; unknown/transported payloads are copied before validation.
     */
    registerImmutableTyped(keywords, parse, validate, execute) {
        const names = typeof keywords === "string" ? [keywords] : keywords;
        const codec = immutableSyntaxCodec("1", parse, validate);
        this.registerSyntax(names, `core.directive.${names[0]}`, codec, (payload, command) => execute(codec.read(payload), command));
        for (const name of names) {
            this.syntaxHandlers.get(name).immutable = true;
        }
    }
    syntaxKeyword(keyword) {
        if (this.syntaxHandlers.has(keyword)) {
            return keyword;
        }
        keyword = keyword.toLowerCase();
        if (this.syntaxHandlers.has(keyword)) {
            return keyword;
        }
        for (const prefix of this.directivePrefixes) {
            if (keyword.startsWith(prefix)) {
                return keyword.slice(prefix.length);
            }
        }
        return keyword;
    }
    syntaxHandler(keyword) {
        return this.syntaxHandlers.get(this.syntaxKeyword(keyword));
    }
    /** Pure parsing catches diagnostics for deferred reporting, including inactive branches. */
    parseSyntax(command) {
        recordExecutionParser("directive");
        const entry = this.syntaxHandler(command.keyword);
        if (!entry) {
            return undefined;
        }
        const identity = {
            kind: "plugin",
            contributionId: entry.id,
            grammarVersion: entry.grammar.version,
        };
        try {
            const parsed = entry.grammar.parse(clonePluginSyntax({
                keyword: this.syntaxKeyword(command.keyword),
                text: command.command,
                words: [this.syntaxKeyword(command.keyword), ...command.words.slice(1)],
                source: command.source,
                ...(command.parsed.declaration ? { declaration: command.parsed.declaration } : {}),
            }));
            // A read-only codec already detached, bounded and froze this exact root.
            // Ordinary plugin parsers and validators still receive independent mutable copies.
            const owned = entry.immutable && isImmutableSyntaxValue(parsed);
            const payload = owned ? parsed : copySyntaxValue(parsed);
            if (!entry.grammar.validate(owned ? payload : copySyntaxValue(payload))) {
                throw new Error(`Invalid syntax payload for '${entry.id}'.`);
            }
            return { ...identity, payload };
        }
        catch (cause) {
            return { ...identity, error: cause instanceof Error ? cause.message : String(cause) };
        }
    }
    /** Reject stale worker/cache payloads; never reparse or silently select a different grammar. */
    executeSyntax(syntax, command) {
        const entry = this.syntaxHandler(command.keyword);
        if (!entry ||
            entry.id !== syntax.contributionId ||
            entry.grammar.version !== syntax.grammarVersion) {
            throw new Error(`Source grammar changed for '${syntax.contributionId}'; parse the source again.`);
        }
        if (syntax.error !== undefined) {
            throw new Error(syntax.error);
        }
        let payload;
        if (entry.immutable) {
            // Identity proof never crosses serialization. A mutable transported tree is
            // checked and copied on every execution; a shallow freeze cannot forge ownership.
            payload = isImmutableSyntaxValue(syntax.payload)
                ? syntax.payload
                : immutableSyntaxValue(syntax.payload);
        }
        else {
            payload = copySyntaxValue(syntax.payload);
        }
        if (!entry.grammar.validate(entry.immutable ? payload : copySyntaxValue(payload))) {
            throw new Error(`Invalid syntax payload for '${entry.id}'.`);
        }
        withTypedExecution(() => entry.execute(payload, command));
    }
    constructor(directivePrefixes = []) {
        this.directivePrefixes = directivePrefixes;
    }
    /** Reports whether a handler exists for the keyword after prefix normalization. */
    has(keyword) {
        return this.lookup(keyword) !== undefined;
    }
    /** Invokes a registered handler when present; returns false when the keyword is unknown. */
    dispatch(keyword, words, raw, command) {
        const handler = this.lookup(keyword);
        if (!handler) {
            return false;
        }
        handler(words, raw, command);
        return true;
    }
    /**
     * Resolves a directive handler using prefixes supplied by the active syntax profile.
     * @param keyword The directive keyword.
     * @returns The handler, if registered.
     */
    lookup(keyword) {
        const direct = this.handlers.get(keyword);
        if (direct) {
            return direct;
        }
        for (const prefix of this.directivePrefixes) {
            if (keyword.startsWith(prefix)) {
                return this.handlers.get(keyword.slice(prefix.length));
            }
        }
        return undefined;
    }
}
/** Builds a registry with only the enabled core directive groups and syntax prefixes. */
export const createDirectiveRegistry = (contexts, enabledGroups = CORE_DIRECTIVE_GROUPS, directivePrefixes = []) => {
    const registry = new DirectiveRegistry(directivePrefixes);
    const enabled = new Set(enabledGroups);
    if (enabled.has("include")) {
        registerIncludeSourceDirectives(registry, contexts.includeSource);
    }
    if (enabled.has("memory")) {
        registerFillPadDirectives(registry, contexts.fillPad);
    }
    if (enabled.has("control")) {
        registerFlowControlDirectives(registry, contexts.flowControl);
    }
    if (enabled.has("namespace")) {
        registerNamespaceDirectives(registry, contexts.namespace);
    }
    if (enabled.has("layout")) {
        registerLayoutDirectives(registry, contexts.layout);
    }
    if (enabled.has("data")) {
        registerDataDirectives(registry, contexts.data);
    }
    if (enabled.has("struct")) {
        registerStructBinaryDirectives(registry, contexts.struct);
    }
    if (enabled.has("table") || enabled.has("diagnostic")) {
        registerMiscDirectives(registry, {
            table: contexts.table,
            diagnostic: contexts.diagnostic,
        }, enabled);
    }
    return registry;
};
//# sourceMappingURL=registry.js.map