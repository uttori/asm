import { type ArchitectureEncoderContext, type InstructionDescriptor } from "@uttori/asm-core";
/** Public source-entry facade. Instruction semantics belong exclusively to the typed encoder. */
export declare class Arch65816 {
    readonly context: ArchitectureEncoderContext;
    readonly optimizeDirectPage: () => boolean;
    private readonly typedEncoder;
    private typedEntry;
    /** Native 16-bit accumulator (REP #$20). Reset at the start of each assembly stage. */
    m16: boolean;
    /** Native 16-bit index registers (REP #$10). Reset at the start of each assembly stage. */
    x16: boolean;
    /**
     * When true, `SEP`/`REP` auto-update M/X hints (Asar-compatible default).
     * Set to false by `.smart off`. Re-enabled by `.smart` or `.smart on`.
     */
    smartMode: boolean;
    constructor(context: ArchitectureEncoderContext, optimizeDirectPage?: () => boolean);
    /**
     * Resets M/X size flags at the start of each assembly stage.
     * `smartMode` is intentionally NOT reset so `.smart off` persists across stages.
     */
    beginPass(): void;
    /**
     * Sets the accumulator (M-flag) width hint.
     * Used by the ca65-compatible `.a8` and `.a16` directives.
     * @param is16 True for 16-bit accumulator, false for 8-bit.
     */
    setAccumulatorWidth(is16: boolean): void;
    /**
     * Sets the index register (X-flag) width hint.
     * Used by the ca65-compatible `.i8` and `.i16` directives.
     * @param is16 True for 16-bit index registers, false for 8-bit.
     */
    setIndexWidth(is16: boolean): void;
    /**
     * Enables or disables automatic M/X tracking via `SEP`/`REP` instructions.
     * Used by the ca65-compatible `.smart` directive.
     * @param enabled True to enable smart mode (default), false to disable.
     */
    setSmartMode(enabled: boolean): void;
    /** Static catalog shared with typed instruction tooling. */
    getInstructionCatalog(): InstructionDescriptor[];
    /** Parse a source instruction and reserve the byte count selected by the typed encoder. */
    estimateSize(words: readonly string[]): number;
    /** Parse a source instruction and emit through the same target contract as assembler sessions. */
    encode(words: readonly string[]): boolean;
}
//# sourceMappingURL=65816.d.ts.map