import { type NormalizedCommand } from "../ir/normalized-command.js";
export type FrontEndCommandHost = {
    inFunctionDefinition: boolean;
    functionDefinitionLines: string[];
    currentParentLabel: string;
    currentParentIsGlobal: boolean;
    parseFunctionDefinition(defLine: string): void;
    processNestedCommand(command: string): void;
    handleRelativeLabel(label: string): number;
    handleLabelDefinition(labelName: string): void;
    setLabel(label: string, value?: number, isStatic?: boolean, isMacroLabel?: boolean, isGlobal?: boolean, modifiesHierarchy?: boolean): void;
    resolvedefines(input: string): string;
    evaluateMath(input: string): number;
    getLabelValue(label: string, requireStatic: boolean): number;
    recordCurrentAddress(): void;
};
export declare class FrontEndCommandService {
    private readonly host;
    constructor(host: FrontEndCommandHost);
    continueFunctionDefinition(command: string): boolean;
    startFunctionDefinition(command: NormalizedCommand): boolean;
    handleRelativeLabelDefinition(command: NormalizedCommand): boolean;
    handleGlobalLabel(command: NormalizedCommand): boolean;
    consumeNamedLabelDefinitions(command: NormalizedCommand): boolean;
    handleStaticLabelAssignment(command: NormalizedCommand): boolean;
}
//# sourceMappingURL=front-end-command-service.d.ts.map