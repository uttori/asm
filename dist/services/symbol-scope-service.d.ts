import type { StructDefinition } from "../assembler.js";
type LabelEntry = {
    value: number;
    isStatic: boolean;
    isMacroLabel?: boolean;
    macroInstance?: number;
    modifiesHierarchy?: boolean;
};
export interface SymbolScopeHost {
    mode: "layout" | "emit";
    enforceResolvedLabels: boolean;
    isDefinitionCollectionStage: boolean;
    currentTargetAddress: number;
    currentNamespace: string;
    namespaceNestingEnabled: boolean;
    namespaceNestingPath: string[];
    inMacroExpansion: boolean;
    macroLabelInstance: number;
    labelTable: Map<string, LabelEntry>;
    forwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    backwardLabels: {
        [depth: number]: {
            addr: number;
            macroInstance?: number;
        }[];
    };
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    currentGlobalParentLabel: string;
    labelParents: Map<string, string | null>;
    structs: Map<string, StructDefinition>;
    recordSymbolDefinition(kind: "label", name: string, options?: {
        value?: number | string;
    }): void;
}
export declare class SymbolScopeService {
    readonly host: SymbolScopeHost;
    constructor(host: SymbolScopeHost);
    /**
     * Finds nearest hierarchy ancestor.
     * @param {string} label The label.
     * @returns {string | null} The result.
     */
    findNearestHierarchyAncestor(label: string): string | null;
    /**
     * Gets hierarchy chain.
     * @param {string} label The label.
     * @returns {string[]} The result.
     */
    getHierarchyChain(label: string): string[];
    /**
     * Gets ancestor prefixes.
     * @param {string} label The label.
     * @returns {string[]} The result.
     */
    getAncestorPrefixes(label: string): string[];
    /**
     * Gets scoped parent label.
     * @param {number} dotCount The dot count.
     * @returns {string} The result.
     */
    getScopedParentLabel(dotCount: number): string;
    /**
     * Checks if a label is in scope.
     * @param {string} identifier The label to check.
     * @returns {boolean} `true` if the label is in scope, `false` otherwise.
     */
    hasLabelInScope(identifier: string): boolean;
    /**
     * Handles a relative label.
     * @param {string} label The label to handle.
     * @returns {number} The address of the label.
     */
    handleRelativeLabel(label: string): number;
    /**
     * Finds the next label.
     * @param {string} label The label to find.
     * @param {number} currentAddressOverride The current address to override.
     * @returns {number} The address of the next label.
     */
    findNextLabel(label: string, currentAddressOverride?: number): number;
    /**
     * Finds the previous label.
     * @param {string} label The label to find.
     * @param {number} currentAddressOverride The current address to override.
     * @returns {number} The address of the previous label.
     */
    findPreviousLabel(label: string, currentAddressOverride?: number): number;
    /**
     * Sets a label.
     * @param {string} label The label to set.
     * @param {number} value The value of the label.
     * @param {boolean} isStatic Whether the label is static.
     * @param {boolean} isMacroLabel Whether the label is a macro label.
     * @param {boolean} isGlobal Whether the label is global.
     * @param {boolean} modifiesHierarchy Whether the label modifies the hierarchy.
     */
    setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
    /**
     * Resolves a struct member.
     * @param {string} compoundId The compound ID of the struct member.
     * @returns {number} The address of the struct member.
     */
    resolveStructMember(compoundId: string): number;
    /**
     * Gets the value of a label.
     * @param {string} label The label to get the value of.
     * @param {boolean} requireStatic Whether the label must be static.
     * @returns {number} The value of the label.
     */
    getLabelValue(label: string, requireStatic: boolean): number;
    /**
     * Tries to get a scoped label value without allocating an Error for a miss.
     * @param {string} label The label to get the value of.
     * @param {boolean} requireStatic Whether the label must be static.
     * @returns {number | undefined} The value, or undefined when not found.
     */
    tryGetLabelValue(label: string, requireStatic: boolean): number | undefined;
    /**
     * Gets the value of a label directly.
     * @param {string} label The label to get the value of.
     * @param {boolean} requireStatic Whether the label must be static.
     * @returns {number} The value of the label.
     */
    getLabelValueDirect(label: string, requireStatic: boolean): number;
    /**
     * Tries a direct label lookup without allocating an Error for ordinary misses.
     * @param {string} label The label to get the value of.
     * @param {boolean} requireStatic Whether the label must be static.
     * @returns {number | undefined} The value, or undefined when not found.
     */
    tryGetLabelValueDirect(label: string, requireStatic: boolean): number | undefined;
    /**
     * Gets the size of a struct or extension.
     * @param {string} identifier The identifier of the struct or extension.
     * @param {boolean} [baseOnly] If true, returns only the base size without extensions.
     * @returns {number} The size of the struct or extension.
     * @throws {Error} If the struct or extension doesn't exist.
     */
    getObjectSize(identifier: string, baseOnly?: boolean): number;
    /**
     * Handles a label definition.
     * @param {string} labelName The name of the label.
     */
    handleLabelDefinition(labelName: string): void;
}
export {};
//# sourceMappingURL=symbol-scope-service.d.ts.map