import type { StructDefinition } from "../assembler.js";
import type { ExpressionNode } from "../ir/expression-node.js";
import { type NormalizedCommand } from "../ir/normalized-command.js";
export type StructHost = {
    currentStruct: StructDefinition | null;
    structs: Map<string, StructDefinition>;
    operandResolver: {
        getnum(input: string): number;
    };
    write1(value: number): void;
    readFile(filename: string): Uint8Array | string;
    recordCurrentAddress(): void;
    handlePushPC(): void;
    handlePullPC(): void;
    getLabelValue(label: string, requireStatic: boolean): number;
    evaluateRangeExpression(expression: string | ExpressionNode): number;
    enterStructDefinition(base: number): void;
    restoreStructDefinition(): void;
    setWritePosition(address: number): void;
};
export declare class StructEngine {
    private readonly host;
    constructor(host: StructHost);
    handleStructMode(command: NormalizedCommand): boolean;
    handleStruct(words: string[]): void;
    handleEndStruct(words: string[]): void;
    resolveStructLabel(labelRef: string): number;
    handleIncbin(words: string[]): void;
}
//# sourceMappingURL=struct-engine.d.ts.map