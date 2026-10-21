import { type ArchitectureEncoderContext, type InstructionDescriptor } from "@uttori/asm-core";
/** Public source-entry facade. Instruction semantics belong exclusively to the typed encoder. */
export declare class ArchSuperFX {
    readonly context: ArchitectureEncoderContext;
    readonly asarMoveShortAddress: () => boolean;
    private readonly typedEncoder;
    constructor(context: ArchitectureEncoderContext, asarMoveShortAddress?: () => boolean);
    private typedEntry;
    /** Static catalog shared with typed instruction tooling. */
    getInstructionCatalog(): InstructionDescriptor[];
    /** Parse a source instruction and reserve the byte count selected by the typed encoder. */
    estimateSize(words: readonly string[]): number;
    /** Parse a source instruction and emit through the same target contract as assembler sessions. */
    encode(words: readonly string[]): boolean;
}
//# sourceMappingURL=superfx.d.ts.map