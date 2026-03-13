type DefineHost = {
    defines: Map<string, string>;
    collectingLoop: boolean;
    currentVariadicArgs: string[];
    resolvedefines(input: string): string;
    evaluateMath(input: string): number;
    processCommand(command: string): void;
};
export declare class DefineEngine {
    private readonly host;
    constructor(host: DefineHost);
    handleCommand(command: string): boolean;
    handleDefineCommand(command: string): void;
    processNestedDefines(content: string): string;
    resolveOneLevelOfDefines(content: string): string;
    resolveRegularDefines(content: string): string;
    resolveDefinesInStringLiteral(content: string): string;
    processValueWithBracedDefines(value: string): string;
    private applyDefineOperation;
}
export {};
//# sourceMappingURL=define-engine.d.ts.map