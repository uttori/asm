type FrontEndCommandHost = {
    inFunctionDefinition: boolean;
    functionDefinitionLines: string[];
    realsnespos: number;
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    parseFunctionDefinition(defLine: string): void;
    processCommand(command: string): void;
    handleRelativeLabel(label: string): number;
    handleLabelDefinition(labelName: string): void;
    setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
    resolvedefines(input: string): string;
    evaluateMath(input: string): number;
    getLabelValue(label: string, requireStatic: boolean): number;
    addAddressToLine(address: number): void;
};
export declare class FrontEndCommandService {
    private readonly host;
    constructor(host: FrontEndCommandHost);
    continueFunctionDefinition(command: string): boolean;
    startFunctionDefinition(keyword: string, words: string[]): boolean;
    handleRelativeLabelDefinition(keyword: string): boolean;
    handleGlobalLabel(words: string[]): boolean;
    consumeNamedLabelDefinitions(words: string[], keyword: string): string[];
    handleStaticLabelAssignment(words: string[], keyword: string): boolean;
}
export {};
//# sourceMappingURL=front-end-command-service.d.ts.map