export type DefineHost = {
    defines: Map<string, string>;
    resolvedefines(input: string): string;
    evaluateMath(input: string): number;
    processNestedCommand(command: string): void;
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
//# sourceMappingURL=define-engine.d.ts.map