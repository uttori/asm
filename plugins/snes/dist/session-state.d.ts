import type { SessionStateKey } from "@uttori/asm-core/plugin";
export declare const SNES_SESSION_STATE_ID = "snes.session-state";
export type SnesSpcBlockType = "nspc" | "custom";
export type SnesSpcBlockData = {
    destination: number;
    type: SnesSpcBlockType;
    sizeAddress: number;
    executeAddress: number | null;
    namespaceBackup: string;
};
export interface SnesSessionState {
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
    spcBlock: SnesSpcBlockData | null;
    spcPreviousArchitecture: string | null;
    spcInlineCompatibility: boolean;
}
export declare const snesSessionStateKey: SessionStateKey<SnesSessionState>;
export declare function cloneSnesSessionState(value: SnesSessionState): SnesSessionState;
//# sourceMappingURL=session-state.d.ts.map