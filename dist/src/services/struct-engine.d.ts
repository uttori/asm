import type { StructDefinition } from "../assembler.js";
type StructHost = {
    currentStruct: StructDefinition | null;
    savedPCStack: number[];
    structs: Map<string, StructDefinition>;
    snespos: number;
    realsnespos: number;
    startpos: number;
    realstartpos: number;
    operandResolver: {
        getnum(input: string): number;
    };
    write1(value: number): void;
    readFile(filename: string): Uint8Array | string;
    addAddressToLine(address: number): void;
    handlePushPC(): void;
    handlePullPC(): void;
    getLabelValue(label: string, requireStatic: boolean): number;
    snestopc(address: number): number;
    evaluateRangeExpression(expression: string): number;
};
export declare class StructEngine {
    private readonly host;
    constructor(host: StructHost);
    handleStructMode(words: string[]): boolean;
    handleStruct(words: string[]): void;
    handleEndStruct(words: string[]): void;
    resolveStructLabel(labelRef: string): number;
    handleIncbin(words: string[]): void;
}
export {};
//# sourceMappingURL=struct-engine.d.ts.map