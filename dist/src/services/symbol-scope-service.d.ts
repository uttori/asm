type LabelEntry = {
    value: number;
    isStatic: boolean;
    isMacroLabel?: boolean;
    macroInstance?: number;
    modifiesHierarchy?: boolean;
};
type StructDefinition = {
    name: string;
    base: number;
    offset: number;
    size: number;
    labels: Map<string, number>;
    align?: number;
    parent?: string;
    extensionSize?: number;
};
export interface SymbolScopeHost {
    pass: number;
    snespos: number;
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
    structs: Map<string, StructDefinition>;
}
export declare class SymbolScopeService {
    private readonly host;
    constructor(host: SymbolScopeHost);
    hasLabelInScope(identifier: string): boolean;
    handleRelativeLabel(label: string): number;
    findNextLabel(label: string, currentAddressOverride?: number): number;
    findPreviousLabel(label: string, currentAddressOverride?: number): number;
    setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
    resolveStructMember(compoundId: string): number;
    getLabelValue(label: string, requireStatic: boolean): number;
    getLabelValueDirect(label: string, requireStatic: boolean): number;
    getObjectSize(identifier: string, baseOnly?: boolean): number;
    handleLabelDefinition(labelName: string): void;
}
export {};
//# sourceMappingURL=symbol-scope-service.d.ts.map