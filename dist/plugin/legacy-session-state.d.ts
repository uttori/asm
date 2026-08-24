import type { SessionStateKey } from "./contracts.js";
export declare const LEGACY_TARGET_SESSION_STATE_ID = "legacy.target-session-state";
export type LegacySpcBlockType = "nspc" | "custom";
export type LegacySpcBlockData = {
    destination: number;
    type: LegacySpcBlockType;
    sizeAddress: number;
    executeAddress: number | null;
    namespaceBackup: string;
};
export interface LegacyTargetSessionState {
    mapper: string;
    sa1Banks: number[];
    checksumEnabled: boolean;
    checksumMode: "asar" | "simple";
    bankCrossMode: "off" | "full" | "half";
    readFunctionsEnabled: boolean;
    optimizeDirectPage: boolean;
    asarSuperFxMoveShortAddress: boolean;
    outputFillByte: number;
    activeFreespaceStartOffset: number | null;
    activeFreespaceContentStartOffset: number | null;
    activeFreespaceEndOffset: number | null;
    inSpcBlock: boolean;
    spcBlock: LegacySpcBlockData | null;
    spcInlineCompatibility: boolean;
}
export declare const legacyTargetSessionStateKey: SessionStateKey<LegacyTargetSessionState>;
export declare function cloneLegacyTargetSessionState(value: LegacyTargetSessionState): LegacyTargetSessionState;
//# sourceMappingURL=legacy-session-state.d.ts.map