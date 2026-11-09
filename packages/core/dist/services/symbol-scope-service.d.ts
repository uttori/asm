import type { RelativeReferenceExpressionNode } from "../ir/expression-node.js";
import type { SyntaxProfile } from "../syntax-profile.js";
import type { StructDefinition } from "./struct-engine.js";
/** Numeric label binding with macro and hierarchy metadata. */
export type LabelEntry = {
    /** Resolved numeric value for the label at bind time. */
    value: number;
    /** Whether the label is file-local static in ca65-style profiles. */
    isStatic: boolean;
    /** Whether the label was defined inside a macro expansion. */
    isMacroLabel?: boolean;
    /** Tracks which macro instance this label belongs to */
    macroInstance?: number;
    /** Whether this label affects the sublabel hierarchy */
    modifiesHierarchy?: boolean;
};
/** Assembler state consulted and updated while resolving and defining labels. */
export interface SymbolScopeHost {
    /** Present only for section-relative assembly; canonical bindings are retained with their module. */
    readonly moduleIdentity?: string;
    /** Active section name when module-relative labels are recorded. */
    readonly moduleSection?: string;
    /** Optional hook persisting canonical label bindings for relocatable modules. */
    recordLabelBinding?(name: string, entry: LabelEntry): void;
    /** Whether the pass is laying out sizes or emitting final bytes. */
    mode: "layout" | "emit";
    /** When true, unresolved forward references fail instead of deferring. */
    enforceResolvedLabels: boolean;
    /** Whether definitions are collected without requiring final numeric values. */
    isDefinitionCollectionStage: boolean;
    /** Current logical address used when binding new labels. */
    currentTargetAddress: number;
    /** Active namespace prefix applied to newly defined symbols. */
    currentNamespace: string;
    /** Whether nested namespace segments are enabled for qualification. */
    namespaceNestingEnabled: boolean;
    /** Flattened namespace path segments for nested scopes. */
    namespaceNestingPath: string[];
    /** Whether a macro expansion is currently active. */
    inMacroExpansion: boolean;
    /** Monotonic id assigned to macro-local label instances. */
    macroLabelInstance: number;
    /** Storage map for qualified label entries. */
    labelTable: Map<string, LabelEntry>;
    /** Forward anonymous labels bucketed by repeat depth. */
    forwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
            unit?: string;
            section?: string;
        }[];
    };
    /** Backward anonymous labels bucketed by repeat depth. */
    backwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
            unit?: string;
            section?: string;
        }[];
    };
    /** Innermost explicit parent label for cheap-local resolution. */
    currentParentLabel: string;
    /** Whether the current parent label is a global root. */
    currentParentIsGlobal: boolean;
    /** Outermost global root label governing nested local labels. */
    currentGlobalParentLabel: string;
    /** Explicit parent overrides for hierarchy-sensitive labels. */
    labelParents: Map<string, string | null>;
    /** Struct definitions available for member-qualified references. */
    structs: Map<string, StructDefinition>;
    /** Active syntax profile controlling qualification rules. */
    syntaxProfile: SyntaxProfile;
    /** Current source file path for diagnostics and qualification. */
    currentFile: string;
    /** Include stack used to derive file-local symbol units. */
    includeStack: string[];
    /** Names treated as session-global (ca65 `.export` / `.import`). */
    globalSymbols: Set<string>;
    /** Record a label symbol definition for analysis indexing. */
    recordSymbolDefinition(kind: "label", name: string, options?: {
        value?: number | string;
        containerName?: string;
    }): void;
}
/** Resolves, qualifies, and stores labels across namespaces, macros, and file-local rules. */
export declare class SymbolScopeService {
    readonly host: SymbolScopeHost;
    private bindingObserver?;
    constructor(host: SymbolScopeHost);
    /** Canonical qualification is shared with numeric lookup; nested lookups restore their observer. */
    resolveLabelBinding(label: string): {
        name: string;
        entry: LabelEntry;
    } | undefined;
    private resolvedLabelValue;
    /** Preserve every canonical alias, including labels synthesized inside macro and namespace scopes. */
    private storeLabel;
    /**
     * Returns the current ca65-style object file name (last `.asm` on the include stack).
     * @returns The object-file basename, or empty when unknown.
     */
    objectFileKey(): string;
    /**
     * Qualifies a symbol for the active syntax profile's file-local rule.
     * Exported/imported names and cheap/sublabels stay unqualified.
     * @param name The source symbol name.
     * @returns The storage key.
     */
    qualifySymbolName(name: string): string;
    /**
     * Adds a namespace inside a file-local qualifier (`unit::Namespace_Label`).
     * @param namespacePrefix The flattened namespace prefix.
     * @param label The already-qualified or plain label.
     * @returns The namespace-qualified storage key.
     */
    qualifyNamespaceAlias(namespacePrefix: string, label: string): string;
    /**
     * Maps a cheap-local `@name` onto the existing single-dot sublabel form.
     * @param name The label token, without a trailing colon.
     * @returns The rewritten name.
     */
    toCheapDotLabel(name: string): string;
    /** Walks underscore segments to find the nearest hierarchy-modifying ancestor label. */
    findNearestHierarchyAncestor(label: string): string | null;
    /** Builds outer-to-inner label ancestry, stopping at the active global root when applicable. */
    getHierarchyChain(label: string): string[];
    /** Lists every strict underscore prefix of a label from longest to shortest. */
    getAncestorPrefixes(label: string): string[];
    /** Resolves the parent label for cheap-local references given leading dot count. */
    getScopedParentLabel(dotCount: number): string;
    /**
     * Checks if a label is in scope.
     * @param identifier The label to check.
     * @returns `true` if the label is in scope, `false` otherwise.
     */
    hasLabelInScope(identifier: string): boolean;
    /**
     * Handles a relative label.
     * @param label The label to handle.
     * @returns The address of the label.
     */
    handleRelativeLabel(label: string): number;
    /** Declare a parsed relative-label stream; spelling is retained only for diagnostics. */
    declareRelativeLabel({ direction, depth, macroLocal: isMacroLocal, spelling: label, }: {
        direction: 1 | -1;
        depth: number;
        macroLocal: boolean;
        spelling: string;
    }): number;
    /**
     * Records a ca65 unnamed label (`:`). Stored at Asar depth 0 so `+`/`-` streams stay intact.
     * `:+` / `:++` skip N labels in this single stream rather than using Asar's per-depth tables.
     * @returns The address of the unnamed label.
     */
    handleUnnamedLabel(): number;
    /**
     * Resolves a ca65 unnamed-label reference (`:+`, `:++`, `:-`, `:--`).
     * @param label The reference token.
     * @param [currentAddressOverride] PC to search from.
     * @returns The target address.
     */
    findUnnamedLabel(label: string, currentAddressOverride?: number): number;
    /** Resolve a typed relative stream without recognizing its spelling again. */
    resolveRelativeReference(reference: RelativeReferenceExpressionNode, address?: number): number;
    /**
     * Finds the next label.
     * @param label The label to find.
     * @param currentAddressOverride The current address to override.
     * @returns The address of the next label.
     */
    findNextLabel(label: string, currentAddressOverride?: number): number;
    /**
     * Finds the previous label.
     * @param label The label to find.
     * @param currentAddressOverride The current address to override.
     * @returns The address of the previous label.
     */
    findPreviousLabel(label: string, currentAddressOverride?: number): number;
    /**
     * Sets a label.
     * @param label The label to set.
     * @param value The value of the label.
     * @param isStatic Whether the label is static.
     * @param isMacroLabel Whether the label is a macro label.
     * @param isGlobal Whether the label is global.
     * @param modifiesHierarchy Whether the label modifies the hierarchy.
     */
    setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
    /**
     * Resolves a struct member.
     * @param compoundId The compound ID of the struct member.
     * @returns The address of the struct member.
     */
    resolveStructMember(compoundId: string): number;
    /**
     * Gets the value of a label.
     * @param label The label to get the value of.
     * @param requireStatic Whether the label must be static.
     * @returns The value of the label.
     */
    getLabelValue(label: string, requireStatic: boolean): number;
    /**
     * Tries to get a scoped label value without allocating an Error for a miss.
     * @param label The label to get the value of.
     * @param requireStatic Whether the label must be static.
     * @returns The value, or undefined when not found.
     */
    tryGetLabelValue(label: string, requireStatic: boolean): number | undefined;
    /**
     * Gets the value of a label directly.
     * @param label The label to get the value of.
     * @param requireStatic Whether the label must be static.
     * @returns The value of the label.
     */
    getLabelValueDirect(label: string, requireStatic: boolean): number;
    /**
     * Tries a direct label lookup without allocating an Error for ordinary misses.
     * @param label The label to get the value of.
     * @param requireStatic Whether the label must be static.
     * @returns The value, or undefined when not found.
     */
    tryGetLabelValueDirect(label: string, requireStatic: boolean): number | undefined;
    /**
     * Gets the size of a struct or extension.
     * @param identifier The identifier of the struct or extension.
     * @param [baseOnly] If true, returns only the base size without extensions.
     * @returns The size of the struct or extension.
     * @throws {Error} If the struct or extension doesn't exist.
     */
    getObjectSize(identifier: string, baseOnly?: boolean): number;
    /**
     * Returns the outline container for a stored label name.
     * Sublabels nest under their parent. Namespaced labels nest under the namespace.
     * @param fullLabel The stored label name.
     * @param isGlobal Whether the label is global.
     * @returns The container name, if any.
     */
    symbolContainerName(fullLabel: string, isGlobal: boolean): string | undefined;
    /**
     * Handles a label definition.
     * @param labelName The name of the label.
     */
    handleLabelDefinition(labelName: string): void;
}
/**
 * Parses a ca65 unnamed-label reference (`:+`, `:++`, `:-`).
 * @param token The operand token.
 * @returns The skip count, or undefined.
 */
export declare function parseUnnamedLabelReference(token: string): {
    direction: 1 | -1;
    count: number;
} | undefined;
//# sourceMappingURL=symbol-scope-service.d.ts.map