import type { SessionStateKey } from "@uttori/asm-core/plugin";
/** Plugin-owned session slot id. Keep in sync with the contribution in `index.ts`. */
export declare const SNES_SESSION_STATE_ID = "snes.session-state";
/**
 * Payload kind for an open `spcblock`.
 * `nspc` is the Nintendo-format size+dest header; `custom` is accepted by Asar
 * but not implemented here.
 */
export type SnesSpcBlockType = "nspc" | "custom";
/**
 * Snapshot of an open `spcblock` so `endspcblock` can patch size, restore
 * namespace/arch, and optionally emit an execute trailer.
 */
export type SnesSpcBlockData = {
    /** 16-bit SPC-700 destination written after the size word. */
    destination: number;
    type: SnesSpcBlockType;
    /** Logical address of the 16-bit size placeholder (written as `0` at open). */
    sizeAddress: number;
    /** From `startpos`, used when `endspcblock` has no `execute` argument. */
    executeAddress: number | null;
    /** Namespace to restore after the inner `:SPCBLOCK:_…` scope. */
    namespaceBackup: string;
};
/**
 * Per-session SNES target state. Cloned per pass; freespace/SPC fields are
 * also cleared in `resetForStage` so a later stage cannot inherit an open block.
 */
export interface SnesSessionState {
    /** Canonical mapper name (`lorom`, `hirom`, `sa1rom`, `norom`, …). */
    mapper: string;
    /**
     * SA-1 LoROM bank bases in 1 MiB units (`index << 20`).
     * Only slots 0, 1, 4, and 5 are used; the rest stay `-1` (unmapped).
     */
    sa1Banks: number[];
    checksumEnabled: boolean;
    checksumMode: "asar" | "simple";
    /**
     * `full`/`on` = linear PC across `$xxFFFF` → `$xy0000`.
     * `half` = wrap at 32 KiB; `off` = wrap at bank (LoROM `$xx8000`).
     */
    bankCrossMode: "off" | "full" | "half";
    /**
     * Set by `check title`. Until then, `readN` without a default throws
     * `Esnes_address_out_of_bounds` instead of returning a fallback.
     */
    readFunctionsEnabled: boolean;
    /** `optimize dp ram|always` - allow inferred DP width for same-bank labels. */
    optimizeDirectPage: boolean;
    /** Super FX auto-MOVE: Asar stores the raw byte; hardware LMS/SMS store `addr >> 1`. */
    asarSuperFxMoveShortAddress: boolean;
    outputFillByte: number;
    /** File offset of the `STAR` marker, or `null` if no freespace is open. */
    activeFreespaceStartOffset: number | null;
    /** First payload byte after the 8-byte `STAR` header. */
    activeFreespaceContentStartOffset: number | null;
    /** Highest written offset in the open freespace region (inclusive). */
    activeFreespaceEndOffset: number | null;
    inSpcBlock: boolean;
    spcBlock: SnesSpcBlockData | null;
    /** Architecture to restore on `endspcblock`. */
    spcPreviousArchitecture: string | null;
    /** `arch spc700-inline`: `org` becomes `spcblock`, and the pass auto-closes. */
    spcInlineCompatibility: boolean;
    /**
     * ca65-compatible CPU stack for `.pushcpu` / `.popcpu`.
     * Stores the architecture id (not the source alias) of each saved frame.
     */
    cpuStack: string[];
}
/**
 * Branded key for `SessionStateStore.get`. The brand is compile-time only.
 */
export declare const snesSessionStateKey: SessionStateKey<SnesSessionState>;
/**
 * Deep-clones mutable nested fields so parallel/pass clones cannot share banks
 * or an open SPC block.
 * @param {SnesSessionState} value The session state to clone.
 * @returns {SnesSessionState} A deep-cloned session state.
 */
export declare function cloneSnesSessionState(value: SnesSessionState): SnesSessionState;
//# sourceMappingURL=session-state.d.ts.map