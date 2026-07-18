import type { ArchitectureEncoder, LoweredOperand } from "./architecture-types.js";
import type { OperandResolver } from "./operand-resolver.js";
export type ArchitectureDefinition = {
    name: string;
    encoder: ArchitectureEncoder;
    classifyOperand: (resolver: OperandResolver, operand: string) => LoweredOperand;
    splitOperands: (operandText: string) => string[];
    unknownInstructionBehavior: "throw" | "returnFalse";
};
export declare class ArchitectureRegistry {
    readonly definitions: Map<string, ArchitectureDefinition>;
    readonly aliases: Map<string, string>;
    register(definition: ArchitectureDefinition, aliases?: string[]): void;
    getCanonicalName(name: string): string | undefined;
    getDefinition(name: string): ArchitectureDefinition | undefined;
}
export declare const createArchitectureRegistry: (encoder65816: ArchitectureEncoder, encoderSpc700: ArchitectureEncoder, encoderSuperFx: ArchitectureEncoder) => ArchitectureRegistry;
//# sourceMappingURL=architecture-registry.d.ts.map