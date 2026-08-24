import type { Assembler } from "@uttori/asm-core";
import type { SnesSessionState } from "../session-state.js";
export declare const MAPPER_KEYWORDS: readonly ["lorom", "hirom", "exlorom", "exhirom", "sfxrom", "norom", "fullsa1rom", "sa1rom"];
export declare function handleMapper(state: SnesSessionState, words: readonly string[]): void;
export declare function handleCheck(state: SnesSessionState, words: readonly string[]): void;
export declare function handleOptimize(state: SnesSessionState, words: readonly string[]): void;
export declare function handleStartpos(session: Assembler, state: SnesSessionState, words: readonly string[]): void;
//# sourceMappingURL=layout.d.ts.map