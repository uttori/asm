import type { Assembler } from "@uttori/asm-core";
import type { SnesSessionState } from "../session-state.js";
/** Session-bound runtime for SPC block directives and stage cleanup. */
export declare class SnesSpcRuntimeService {
    readonly session: Assembler;
    readonly state: SnesSessionState;
    constructor(session: Assembler, state: SnesSessionState);
    finishPass(): void;
    handleSpcblock(words: readonly string[]): void;
    handleEndSpcblock(words: readonly string[]): void;
}
//# sourceMappingURL=spc-runtime.d.ts.map